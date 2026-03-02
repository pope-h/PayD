import { ScheduleExecutor } from '../scheduleExecutor';
import { StellarService } from '../stellarService';
import { scheduleService } from '../scheduleService';
import type { Schedule, ExecutionResult } from '../../types/schedule';
import { Keypair } from '@stellar/stellar-sdk';

// Mock dependencies
jest.mock('../../config/database.js', () => ({
  __esModule: true,
  default: {
    connect: jest.fn(),
  },
}));

jest.mock('../stellarService');
jest.mock('../scheduleService');
jest.mock('node-cron', () => ({
  schedule: jest.fn((expression, callback) => ({
    stop: jest.fn(),
  })),
}));

import pool from '../../config/database.js';
import cron from 'node-cron';

describe('ScheduleExecutor', () => {
  let executor: ScheduleExecutor;
  const mockPool = pool as unknown as jest.Mocked<typeof pool>;
  const mockCron = cron as jest.Mocked<typeof cron>;
  const mockStellarService = StellarService as jest.Mocked<typeof StellarService>;
  const mockScheduleService = scheduleService as jest.Mocked<typeof scheduleService>;

  const mockConnect = jest.fn();
  const mockRelease = jest.fn();
  const mockClientQuery = jest.fn();

  beforeEach(() => {
    executor = new ScheduleExecutor();
    jest.clearAllMocks();

    // Setup default mock client
    (mockPool.connect as jest.Mock).mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });

    // Setup environment variables
    process.env.STELLAR_SOURCE_SECRET = 'SXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
    process.env.STELLAR_ASSET_ISSUER = 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';
  });

  afterEach(() => {
    delete process.env.STELLAR_SOURCE_SECRET;
    delete process.env.STELLAR_ASSET_ISSUER;
  });

  describe('initialize', () => {
    it('should set up cron job to run every minute', () => {
      executor.initialize();

      expect(mockCron.schedule).toHaveBeenCalledWith(
        '* * * * *',
        expect.any(Function)
      );
    });

    it('should log initialization message', () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      executor.initialize();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cron job initialized')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('stop', () => {
    it('should stop the cron job', () => {
      const mockStop = jest.fn();
      (mockCron.schedule as jest.Mock).mockReturnValue({
        stop: mockStop,
      });

      executor.initialize();
      executor.stop();

      expect(mockStop).toHaveBeenCalled();
    });

    it('should handle stop when cron job not initialized', () => {
      expect(() => executor.stop()).not.toThrow();
    });
  });

  describe('processDueSchedules', () => {
    it('should query for due schedules and process them', async () => {
      const mockSchedules = [
        {
          id: 1,
          organizationId: 1,
          userId: 1,
          frequency: 'weekly',
          timeOfDay: '14:30',
          startDate: '2024-01-15',
          endDate: null,
          paymentConfig: {
            recipients: [
              {
                walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                amount: '100.00',
                assetCode: 'XLM',
              },
            ],
          },
          nextRunTimestamp: new Date(),
          lastRunTimestamp: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockClientQuery.mockResolvedValueOnce({ rows: mockSchedules });

      // Mock executeSchedule to return success
      jest.spyOn(executor, 'executeSchedule').mockResolvedValue({
        success: true,
        transactionHash: 'abc123',
      });

      // Mock recordExecution
      jest.spyOn(executor, 'recordExecution').mockResolvedValue();

      await executor.processDueSchedules();

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('WHERE next_run_timestamp <= NOW() AND status = \'active\'')
      );
      expect(executor.executeSchedule).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          frequency: 'weekly',
        })
      );
      expect(executor.recordExecution).toHaveBeenCalledWith(1, {
        success: true,
        transactionHash: 'abc123',
      });
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should handle empty result set', async () => {
      mockClientQuery.mockResolvedValueOnce({ rows: [] });

      await executor.processDueSchedules();

      expect(mockClientQuery).toHaveBeenCalled();
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should process multiple schedules', async () => {
      const mockSchedules = [
        {
          id: 1,
          organizationId: 1,
          userId: 1,
          frequency: 'weekly',
          timeOfDay: '14:30',
          startDate: '2024-01-15',
          endDate: null,
          paymentConfig: {
            recipients: [
              {
                walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                amount: '100.00',
                assetCode: 'XLM',
              },
            ],
          },
          nextRunTimestamp: new Date(),
          lastRunTimestamp: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          organizationId: 1,
          userId: 1,
          frequency: 'monthly',
          timeOfDay: '10:00',
          startDate: '2024-01-01',
          endDate: null,
          paymentConfig: {
            recipients: [
              {
                walletAddress: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
                amount: '200.00',
                assetCode: 'XLM',
              },
            ],
          },
          nextRunTimestamp: new Date(),
          lastRunTimestamp: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockClientQuery.mockResolvedValueOnce({ rows: mockSchedules });

      jest.spyOn(executor, 'executeSchedule').mockResolvedValue({
        success: true,
        transactionHash: 'abc123',
      });
      jest.spyOn(executor, 'recordExecution').mockResolvedValue();

      await executor.processDueSchedules();

      expect(executor.executeSchedule).toHaveBeenCalledTimes(2);
      expect(executor.recordExecution).toHaveBeenCalledTimes(2);
    });

    it('should continue processing other schedules if one fails', async () => {
      const mockSchedules = [
        {
          id: 1,
          organizationId: 1,
          userId: 1,
          frequency: 'weekly',
          timeOfDay: '14:30',
          startDate: '2024-01-15',
          endDate: null,
          paymentConfig: {
            recipients: [
              {
                walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
                amount: '100.00',
                assetCode: 'XLM',
              },
            ],
          },
          nextRunTimestamp: new Date(),
          lastRunTimestamp: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 2,
          organizationId: 1,
          userId: 1,
          frequency: 'monthly',
          timeOfDay: '10:00',
          startDate: '2024-01-01',
          endDate: null,
          paymentConfig: {
            recipients: [
              {
                walletAddress: 'GYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYYY',
                amount: '200.00',
                assetCode: 'XLM',
              },
            ],
          },
          nextRunTimestamp: new Date(),
          lastRunTimestamp: null,
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockClientQuery.mockResolvedValueOnce({ rows: mockSchedules });

      jest.spyOn(executor, 'executeSchedule')
        .mockRejectedValueOnce(new Error('Execution failed'))
        .mockResolvedValueOnce({
          success: true,
          transactionHash: 'def456',
        });
      jest.spyOn(executor, 'recordExecution').mockResolvedValue();

      await executor.processDueSchedules();

      // Both schedules should be processed despite first one failing
      expect(executor.executeSchedule).toHaveBeenCalledTimes(2);
      expect(executor.recordExecution).toHaveBeenCalledTimes(2);
    });

    it('should release client even on error', async () => {
      mockClientQuery.mockRejectedValueOnce(new Error('Database error'));

      await expect(executor.processDueSchedules()).rejects.toThrow('Database error');

      expect(mockRelease).toHaveBeenCalled();
    });
  });

  describe('executeSchedule', () => {
    const mockSchedule: Schedule = {
      id: 1,
      organizationId: 1,
      userId: 1,
      frequency: 'weekly',
      timeOfDay: '14:30',
      startDate: new Date('2024-01-15'),
      endDate: undefined,
      paymentConfig: {
        recipients: [
          {
            walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            amount: '100.00',
            assetCode: 'XLM',
          },
        ],
        memo: 'Test payment',
      },
      nextRunTimestamp: new Date(),
      lastRunTimestamp: undefined,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should execute schedule successfully', async () => {
      const mockTransaction = { build: jest.fn().mockReturnValue({ sign: jest.fn() }) };
      const mockBuilder = { build: jest.fn().mockReturnValue(mockTransaction) };

      mockStellarService.buildTransaction.mockResolvedValue(mockBuilder as any);
      mockStellarService.signTransaction.mockReturnValue(mockTransaction as any);
      mockStellarService.submitTransaction.mockResolvedValue({
        hash: 'abc123',
        ledger: 12345,
        success: true,
      });

      const result = await executor.executeSchedule(mockSchedule);

      expect(result.success).toBe(true);
      expect(result.transactionHash).toBe('abc123');
      expect(mockStellarService.buildTransaction).toHaveBeenCalled();
      expect(mockStellarService.signTransaction).toHaveBeenCalled();
      expect(mockStellarService.submitTransaction).toHaveBeenCalled();
    });

    it('should handle execution failure', async () => {
      mockStellarService.buildTransaction.mockRejectedValue(
        new Error('Insufficient balance')
      );
      mockStellarService.parseError.mockReturnValue({
        type: 'HorizonError',
        message: 'Insufficient balance',
      });

      const result = await executor.executeSchedule(mockSchedule);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Insufficient balance');
    });

    it('should throw error if STELLAR_SOURCE_SECRET not set', async () => {
      delete process.env.STELLAR_SOURCE_SECRET;

      const result = await executor.executeSchedule(mockSchedule);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('STELLAR_SOURCE_SECRET');
    });

    it('should handle invalid payment configuration', async () => {
      const invalidSchedule = {
        ...mockSchedule,
        paymentConfig: {
          recipients: [],
        },
      };

      const result = await executor.executeSchedule(invalidSchedule);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('no recipients found');
    });
  });

  describe('recordExecution', () => {
    const scheduleId = 1;

    it('should record successful execution', async () => {
      const executionResult: ExecutionResult = {
        success: true,
        transactionHash: 'abc123',
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockScheduleService.updateAfterExecution.mockResolvedValue();

      await executor.recordExecution(scheduleId, executionResult);

      expect(mockClientQuery).toHaveBeenCalledWith('BEGIN');
      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_history'),
        expect.arrayContaining([
          scheduleId,
          expect.any(Date),
          'success',
          'abc123',
          expect.any(String),
          null,
          null,
        ])
      );
      expect(mockScheduleService.updateAfterExecution).toHaveBeenCalledWith(
        scheduleId,
        executionResult
      );
      expect(mockClientQuery).toHaveBeenCalledWith('COMMIT');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should record failed execution', async () => {
      const executionResult: ExecutionResult = {
        success: false,
        error: {
          message: 'Transaction failed',
          details: { code: 'tx_failed' },
        },
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ id: 1 }] }) // INSERT
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockScheduleService.updateAfterExecution.mockResolvedValue();

      await executor.recordExecution(scheduleId, executionResult);

      expect(mockClientQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO execution_history'),
        expect.arrayContaining([
          scheduleId,
          expect.any(Date),
          'failed',
          null,
          null,
          'Transaction failed',
          expect.any(String),
        ])
      );
      expect(mockScheduleService.updateAfterExecution).toHaveBeenCalledWith(
        scheduleId,
        executionResult
      );
    });

    it('should rollback transaction on error', async () => {
      const executionResult: ExecutionResult = {
        success: true,
        transactionHash: 'abc123',
      };

      mockClientQuery
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockRejectedValueOnce(new Error('Database error')); // INSERT fails

      await expect(
        executor.recordExecution(scheduleId, executionResult)
      ).rejects.toThrow('Database error');

      expect(mockClientQuery).toHaveBeenCalledWith('ROLLBACK');
      expect(mockRelease).toHaveBeenCalled();
    });

    it('should release client even on error', async () => {
      const executionResult: ExecutionResult = {
        success: true,
        transactionHash: 'abc123',
      };

      mockClientQuery.mockRejectedValueOnce(new Error('Connection error'));

      await expect(
        executor.recordExecution(scheduleId, executionResult)
      ).rejects.toThrow('Connection error');

      expect(mockRelease).toHaveBeenCalled();
    });
  });
});
