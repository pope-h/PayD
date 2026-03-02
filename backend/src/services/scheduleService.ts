import { default as pool } from '../config/database.js';
import type {
  Schedule,
  ScheduleFrequency,
  CreateScheduleRequest,
  ScheduleFilters,
  ExecutionResult,
} from '../types/schedule.js';

export class ScheduleService {
  /**
   * Calculate the next run timestamp for a schedule based on frequency
   * @param frequency - Schedule frequency ('once', 'weekly', 'biweekly', 'monthly')
   * @param timeOfDay - Time of day in HH:MM format
   * @param startDate - Start date for the schedule
   * @param lastRun - Optional last run timestamp for recurring schedules
   * @returns Date object representing the next execution time
   */
  calculateNextRun(
    frequency: ScheduleFrequency,
    timeOfDay: string,
    startDate: Date,
    lastRun?: Date,
  ): Date {
    // Parse time of day (HH:MM format)
    const [hours, minutes] = timeOfDay.split(':').map(Number);

    // For 'once' frequency, return startDate + timeOfDay
    if (frequency === 'once') {
      const nextRun = new Date(startDate);
      nextRun.setHours(hours, minutes, 0, 0);
      return nextRun;
    }

    // For recurring schedules, use lastRun if provided, otherwise use startDate
    const baseDate = lastRun ? new Date(lastRun) : new Date(startDate);
    const nextRun = new Date(baseDate);

    // Calculate next occurrence based on frequency
    switch (frequency) {
      case 'weekly':
        // Add 7 days
        nextRun.setDate(nextRun.getDate() + 7);
        break;

      case 'biweekly':
        // Add 14 days
        nextRun.setDate(nextRun.getDate() + 14);
        break;

      case 'monthly':
        // Add 1 month
        nextRun.setMonth(nextRun.getMonth() + 1);
        break;

      default:
        throw new Error(`Unsupported frequency: ${frequency}`);
    }

    // Set the time of day
    nextRun.setHours(hours, minutes, 0, 0);

    return nextRun;
  }

  async createSchedule(
    organizationId: number,
    userId: number,
    scheduleData: CreateScheduleRequest,
  ): Promise<Schedule> {
    // Validate schedule data
    this.validateScheduleData(scheduleData);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Parse dates
      const startDate = new Date(scheduleData.startDate);
      const endDate = scheduleData.endDate ? new Date(scheduleData.endDate) : null;

      // Calculate initial next_run_timestamp
      const nextRunTimestamp = this.calculateNextRun(
        scheduleData.frequency,
        scheduleData.timeOfDay,
        startDate,
      );

      // Insert schedule into database
      const query = `
        INSERT INTO schedules (
          organization_id,
          user_id,
          frequency,
          time_of_day,
          start_date,
          end_date,
          payment_config,
          next_run_timestamp,
          status
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING 
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
      `;

      const values = [
        organizationId,
        userId,
        scheduleData.frequency,
        scheduleData.timeOfDay,
        startDate,
        endDate,
        JSON.stringify(scheduleData.paymentConfig),
        nextRunTimestamp,
        'active',
      ];

      const result = await client.query(query, values);
      await client.query('COMMIT');

      const schedule = result.rows[0];
      
      // Parse dates and JSON from database
      return {
        ...schedule,
        startDate: new Date(schedule.startDate),
        endDate: schedule.endDate ? new Date(schedule.endDate) : undefined,
        nextRunTimestamp: new Date(schedule.nextRunTimestamp),
        lastRunTimestamp: schedule.lastRunTimestamp
          ? new Date(schedule.lastRunTimestamp)
          : undefined,
        createdAt: new Date(schedule.createdAt),
        updatedAt: new Date(schedule.updatedAt),
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Validate schedule data against business rules
   * @param scheduleData - Schedule data to validate
   * @throws Error if validation fails
   */
  private validateScheduleData(scheduleData: CreateScheduleRequest): void {
    // Validate frequency
    if (!['once', 'weekly', 'biweekly', 'monthly'].includes(scheduleData.frequency)) {
      throw new Error(`Invalid frequency: ${scheduleData.frequency}`);
    }

    // Validate timeOfDay format (HH:MM)
    const timeRegex = /^([0-1][0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(scheduleData.timeOfDay)) {
      throw new Error(`Invalid time format: ${scheduleData.timeOfDay}. Expected HH:MM format.`);
    }

    // Validate startDate is not in the past
    const startDate = new Date(scheduleData.startDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (startDate < today) {
      throw new Error('Start date cannot be in the past');
    }

    // Validate endDate is after startDate (if provided)
    if (scheduleData.endDate) {
      const endDate = new Date(scheduleData.endDate);
      if (endDate <= startDate) {
        throw new Error('End date must be after start date');
      }
    }

    // Validate payment config
    if (!scheduleData.paymentConfig || !scheduleData.paymentConfig.recipients) {
      throw new Error('Payment configuration is required');
    }

    if (scheduleData.paymentConfig.recipients.length === 0) {
      throw new Error('At least one recipient is required');
    }

    // Validate each recipient
    scheduleData.paymentConfig.recipients.forEach((recipient, index) => {
      if (!recipient.walletAddress || recipient.walletAddress.trim() === '') {
        throw new Error(`Recipient ${index + 1}: Wallet address is required`);
      }

      if (!recipient.amount || parseFloat(recipient.amount) <= 0) {
        throw new Error(`Recipient ${index + 1}: Amount must be greater than 0`);
      }

      if (!recipient.assetCode || recipient.assetCode.trim() === '') {
        throw new Error(`Recipient ${index + 1}: Asset code is required`);
      }
    });

    // Validate memo length if provided
    if (scheduleData.paymentConfig.memo && scheduleData.paymentConfig.memo.length > 28) {
      throw new Error('Memo cannot exceed 28 characters');
    }
  }

  async getActiveSchedules(
    organizationId: number,
    filters?: ScheduleFilters,
  ): Promise<Schedule[]> {
    const client = await pool.connect();
    try {
      // Default filter values
      const status = filters?.status || 'active';
      const page = filters?.page || 1;
      const limit = filters?.limit || 50;
      const offset = (page - 1) * limit;

      // Build query with filters
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
        WHERE organization_id = $1 AND status = $2
        ORDER BY next_run_timestamp ASC
        LIMIT $3 OFFSET $4
      `;

      const values = [organizationId, status, limit, offset];
      const result = await client.query(query, values);

      // Parse dates and JSON from database
      return result.rows.map((row) => ({
        ...row,
        startDate: new Date(row.startDate),
        endDate: row.endDate ? new Date(row.endDate) : undefined,
        nextRunTimestamp: new Date(row.nextRunTimestamp),
        lastRunTimestamp: row.lastRunTimestamp
          ? new Date(row.lastRunTimestamp)
          : undefined,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      }));
    } finally {
      client.release();
    }
  }

  async cancelSchedule(
    scheduleId: number,
    organizationId: number,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      // Query the schedule by ID
      const selectQuery = `
        SELECT id, organization_id as "organizationId", status
        FROM schedules
        WHERE id = $1
      `;
      
      const selectResult = await client.query(selectQuery, [scheduleId]);
      
      // Check if schedule exists
      if (selectResult.rows.length === 0) {
        const error = new Error('Schedule not found') as any;
        error.statusCode = 404;
        throw error;
      }
      
      const schedule = selectResult.rows[0];
      
      // Verify schedule belongs to the organization
      if (schedule.organizationId !== organizationId) {
        const error = new Error('Access denied: Schedule belongs to a different organization') as any;
        error.statusCode = 403;
        throw error;
      }
      
      // Update schedule status to 'cancelled'
      const updateQuery = `
        UPDATE schedules
        SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
      `;
      
      await client.query(updateQuery, [scheduleId]);
    } finally {
      client.release();
    }
  }

  async updateAfterExecution(
    scheduleId: number,
    executionResult: ExecutionResult,
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Query the schedule to get its frequency and configuration
      const selectQuery = `
        SELECT 
          id,
          frequency,
          time_of_day as "timeOfDay",
          start_date as "startDate",
          last_run_timestamp as "lastRunTimestamp"
        FROM schedules
        WHERE id = $1
      `;
      
      const selectResult = await client.query(selectQuery, [scheduleId]);
      
      if (selectResult.rows.length === 0) {
        throw new Error(`Schedule with ID ${scheduleId} not found`);
      }
      
      const schedule = selectResult.rows[0];
      const executionTime = new Date();
      
      // Determine the new status and next_run_timestamp based on execution result
      let newStatus: string;
      let nextRunTimestamp: Date | null = null;
      
      if (!executionResult.success) {
        // If execution failed, set status to 'failed'
        newStatus = 'failed';
      } else {
        // Execution succeeded
        if (schedule.frequency === 'once') {
          // For one-time schedules, set status to 'completed'
          newStatus = 'completed';
        } else {
          // For recurring schedules, calculate new next_run_timestamp and keep status 'active'
          newStatus = 'active';
          nextRunTimestamp = this.calculateNextRun(
            schedule.frequency,
            schedule.timeOfDay,
            new Date(schedule.startDate),
            executionTime, // Use execution time as lastRun
          );
        }
      }
      
      // Update the schedule in the database
      const updateQuery = `
        UPDATE schedules
        SET 
          last_run_timestamp = $1,
          status = $2,
          next_run_timestamp = COALESCE($3, next_run_timestamp),
          updated_at = CURRENT_TIMESTAMP
        WHERE id = $4
      `;
      
      await client.query(updateQuery, [
        executionTime,
        newStatus,
        nextRunTimestamp,
        scheduleId,
      ]);
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}

export const scheduleService = new ScheduleService();
