import cron from 'node-cron';
import { default as pool } from '../config/database.js';
import { StellarService } from './stellarService.js';
import { scheduleService } from './scheduleService.js';
import type { Schedule, ExecutionResult, PaymentRecipient } from '../types/schedule.js';
import { Operation, Asset, Memo, Keypair } from '@stellar/stellar-sdk';

export class ScheduleExecutor {
  private cronJob: cron.ScheduledTask | null = null;

  /**
   * Initialize the cron job to run every minute
   * Sets up node-cron job with error handling and logging
   */
  initialize(): void {
    // Cron expression: run every minute
    this.cronJob = cron.schedule('* * * * *', async () => {
      try {
        console.log('[ScheduleExecutor] Running scheduled task check...');
        await this.processDueSchedules();
      } catch (error) {
        console.error('[ScheduleExecutor] Error in cron job execution:', error);
      }
    });

    console.log('[ScheduleExecutor] Cron job initialized - running every minute');
  }

  /**
   * Stop the cron job (for graceful shutdown)
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      console.log('[ScheduleExecutor] Cron job stopped');
    }
  }

  /**
   * Query database for due schedules and execute each one
   * Handles errors in isolation so one failure doesn't block others
   */
  async processDueSchedules(): Promise<void> {
    const client = await pool.connect();
    try {
      // Query for schedules where next_run_timestamp <= NOW() AND status = 'active'
      const query = `
        SELECT 
          id,
          organization_id as "organizationId",
          user_id as "userId",
          frequency,
          time_of_day as "timeOfDay",
          start_date as "startDate",
          end_date as "endDate",
          payment_config as "paymentConfig",
          next_run_timestamp as "nextRunTimestamp",
          last_run_timestamp as "lastRunTimestamp",
          status,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM schedules
        WHERE next_run_timestamp <= NOW() AND status = 'active'
        ORDER BY next_run_timestamp ASC
      `;

      const result = await client.query(query);
      const dueSchedules = result.rows;

      console.log(`[ScheduleExecutor] Found ${dueSchedules.length} due schedule(s)`);

      let successCount = 0;
      let failureCount = 0;

      // Process each schedule in isolation
      for (const scheduleRow of dueSchedules) {
        try {
          // Parse dates and JSON from database
          const schedule: Schedule = {
            ...scheduleRow,
            startDate: new Date(scheduleRow.startDate),
            endDate: scheduleRow.endDate ? new Date(scheduleRow.endDate) : undefined,
            nextRunTimestamp: new Date(scheduleRow.nextRunTimestamp),
            lastRunTimestamp: scheduleRow.lastRunTimestamp
              ? new Date(scheduleRow.lastRunTimestamp)
              : undefined,
            createdAt: new Date(scheduleRow.createdAt),
            updatedAt: new Date(scheduleRow.updatedAt),
          };

          console.log(`[ScheduleExecutor] Executing schedule ID ${schedule.id}`);
          
          // Execute the schedule
          const executionResult = await this.executeSchedule(schedule);
          
          // Record the execution
          await this.recordExecution(schedule.id, executionResult);

          if (executionResult.success) {
            successCount++;
            console.log(`[ScheduleExecutor] Schedule ID ${schedule.id} executed successfully`);
          } else {
            failureCount++;
            console.error(
              `[ScheduleExecutor] Schedule ID ${schedule.id} failed:`,
              executionResult.error?.message
            );
          }
        } catch (error) {
          failureCount++;
          console.error(
            `[ScheduleExecutor] Error processing schedule ID ${scheduleRow.id}:`,
            error
          );
          
          // Record the failure
          try {
            await this.recordExecution(scheduleRow.id, {
              success: false,
              error: {
                message: error instanceof Error ? error.message : 'Unknown error',
                details: error,
              },
            });
          } catch (recordError) {
            console.error(
              `[ScheduleExecutor] Failed to record execution error for schedule ID ${scheduleRow.id}:`,
              recordError
            );
          }
        }
      }

      console.log(
        `[ScheduleExecutor] Execution complete - Success: ${successCount}, Failed: ${failureCount}`
      );
    } finally {
      client.release();
    }
  }

  /**
   * Execute a single schedule by building and submitting a Stellar transaction
   * @param schedule - The schedule to execute
   * @returns ExecutionResult with success status and transaction hash or error
   */
  async executeSchedule(schedule: Schedule): Promise<ExecutionResult> {
    try {
      // Extract payment configuration
      const paymentConfig = schedule.paymentConfig;
      
      if (!paymentConfig || !paymentConfig.recipients || paymentConfig.recipients.length === 0) {
        throw new Error('Invalid payment configuration: no recipients found');
      }

      // Get source keypair from environment
      // In production, this should be securely managed (e.g., KMS, vault)
      const sourceSecret = process.env.STELLAR_SOURCE_SECRET;
      if (!sourceSecret) {
        throw new Error('STELLAR_SOURCE_SECRET environment variable not set');
      }

      const sourceKeypair = Keypair.fromSecret(sourceSecret);

      // Build Stellar operations from recipients
      const operations = paymentConfig.recipients.map((recipient: PaymentRecipient) => {
        // Parse asset - handle native XLM and custom assets
        let asset: Asset;
        if (recipient.assetCode === 'XLM' || recipient.assetCode === 'native') {
          asset = Asset.native();
        } else {
          // For custom assets, we need an issuer public key
          // This should be configured per asset in production
          const issuerPublicKey = process.env.STELLAR_ASSET_ISSUER;
          if (!issuerPublicKey) {
            throw new Error(`Asset issuer not configured for ${recipient.assetCode}`);
          }
          asset = new Asset(recipient.assetCode, issuerPublicKey);
        }

        return Operation.payment({
          destination: recipient.walletAddress,
          asset,
          amount: recipient.amount,
        });
      });

      // Build transaction using StellarService
      const builder = await StellarService.buildTransaction(
        sourceKeypair.publicKey(),
        operations,
        {
          memo: paymentConfig.memo ? Memo.text(paymentConfig.memo) : undefined,
          timeout: 30,
        }
      );

      const transaction = builder.build();

      // Sign transaction
      const signedTransaction = StellarService.signTransaction(transaction, sourceKeypair);

      // Submit transaction
      const result = await StellarService.submitTransaction(signedTransaction);

      return {
        success: result.success,
        transactionHash: result.hash,
      };
    } catch (error) {
      // Parse Stellar error for better error messages
      const parsedError = StellarService.parseError(error);
      
      return {
        success: false,
        error: {
          message: parsedError.message,
          details: {
            type: parsedError.type,
            code: parsedError.code,
            resultXdr: parsedError.resultXdr,
          },
        },
      };
    }
  }

  /**
   * Record execution in execution_history table and update schedule state
   * @param scheduleId - The schedule ID
   * @param result - The execution result
   */
  async recordExecution(scheduleId: number, result: ExecutionResult): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Determine execution status
      const status = result.success ? 'success' : 'failed';

      // Insert into execution_history
      const insertQuery = `
        INSERT INTO execution_history (
          schedule_id,
          executed_at,
          status,
          transaction_hash,
          transaction_result,
          error_message,
          error_details
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;

      const insertValues = [
        scheduleId,
        new Date(), // executed_at
        status,
        result.transactionHash || null,
        result.success ? JSON.stringify({ hash: result.transactionHash }) : null,
        result.error?.message || null,
        result.error?.details ? JSON.stringify(result.error.details) : null,
      ];

      await client.query(insertQuery, insertValues);

      // Update schedule state using ScheduleService
      await scheduleService.updateAfterExecution(scheduleId, result);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

// Export singleton instance
export const scheduleExecutor = new ScheduleExecutor();
