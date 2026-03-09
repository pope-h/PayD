import { Request, Response } from 'express';
import { ScheduleService } from '../services/scheduleService.js';
import { createScheduleSchema, scheduleQuerySchema } from '../schemas/scheduleSchema.js';
import { z } from 'zod';
import { ErrorCode } from '../types/schedule.js';
import logger from '../utils/logger.js';

const scheduleService = new ScheduleService();

export class ScheduleController {
  /**
   * Create a new payroll schedule
   * POST /api/schedules
   */
  static async createSchedule(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;
      const userId = req.user?.id;

      if (!organizationId || !userId) {
        res.status(403).json({
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'User is not associated with an organization',
          },
        });
        return;
      }

      // Validate request body
      const validatedData = createScheduleSchema.parse(req.body);

      // Create schedule
      const schedule = await scheduleService.createSchedule(
        organizationId,
        userId,
        validatedData
      );

      // Format response
      const response = {
        id: schedule.id,
        frequency: schedule.frequency,
        timeOfDay: schedule.timeOfDay,
        startDate: schedule.startDate.toISOString().split('T')[0],
        endDate: schedule.endDate?.toISOString().split('T')[0],
        nextRunTimestamp: schedule.nextRunTimestamp.toISOString(),
        status: schedule.status,
        createdAt: schedule.createdAt.toISOString(),
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            details: error.issues,
          },
        });
      } else if (error instanceof Error) {
        logger.error('Create schedule error:', error);
        res.status(500).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to create schedule',
          },
        });
      }
    }
  }

  /**
   * Get all schedules for the authenticated user's organization
   * GET /api/schedules
   */
  static async getSchedules(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        res.status(403).json({
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'User is not associated with an organization',
          },
        });
        return;
      }

      // Validate and parse query parameters
      const validatedQuery = scheduleQuerySchema.parse(req.query);

      // Get schedules with filters
      const schedules = await scheduleService.getActiveSchedules(organizationId, validatedQuery);

      // Format response
      const response = {
        schedules: schedules.map((schedule) => ({
          id: schedule.id,
          frequency: schedule.frequency,
          timeOfDay: schedule.timeOfDay,
          startDate: schedule.startDate.toISOString().split('T')[0],
          endDate: schedule.endDate?.toISOString().split('T')[0],
          nextRunTimestamp: schedule.nextRunTimestamp.toISOString(),
          lastRunTimestamp: schedule.lastRunTimestamp?.toISOString(),
          status: schedule.status,
          paymentConfig: schedule.paymentConfig,
          createdAt: schedule.createdAt.toISOString(),
        })),
        pagination: {
          page: validatedQuery.page || 1,
          limit: validatedQuery.limit || 50,
          total: schedules.length,
        },
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid query parameters',
            details: error.issues,
          },
        });
      } else if (error instanceof Error) {
        logger.error('Get schedules error:', error);
        res.status(500).json({
          error: {
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Failed to retrieve schedules',
          },
        });
      }
    }
  }

  /**
   * Cancel a pending schedule
   * DELETE /api/schedules/:id
   */
  static async deleteSchedule(req: Request, res: Response): Promise<void> {
    try {
      const organizationId = req.user?.organizationId;

      if (!organizationId) {
        res.status(403).json({
          error: {
            code: ErrorCode.FORBIDDEN,
            message: 'User is not associated with an organization',
          },
        });
        return;
      }

      const scheduleIdRaw = req.params.id;
      const scheduleId = Number.parseInt(String(scheduleIdRaw), 10);
      if (Number.isNaN(scheduleId)) {
        res.status(400).json({
          error: {
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Invalid schedule ID',
          },
        });
        return;
      }

      // Cancel the schedule
      await scheduleService.cancelSchedule(scheduleId, organizationId);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        // Check for specific error messages from the service
        if (error.message.includes('not found')) {
          res.status(404).json({
            error: {
              code: ErrorCode.SCHEDULE_NOT_FOUND,
              message: 'Schedule not found',
            },
          });
        } else if (error.message.includes('does not belong')) {
          res.status(403).json({
            error: {
              code: ErrorCode.FORBIDDEN,
              message: 'You do not have permission to delete this schedule',
            },
          });
        } else {
          logger.error('Delete schedule error:', error);
          res.status(500).json({
            error: {
              code: ErrorCode.INTERNAL_ERROR,
              message: 'Failed to delete schedule',
            },
          });
        }
      }
    }
  }
}
