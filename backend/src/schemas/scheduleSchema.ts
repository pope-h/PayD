import { z } from 'zod';

// Payment recipient schema
const paymentRecipientSchema = z.object({
  walletAddress: z.string().min(1, 'Wallet address is required'),
  amount: z.string().regex(/^\d+(\.\d{1,7})?$/, 'Amount must be a valid decimal number'),
  assetCode: z.string().min(1, 'Asset code is required'),
});

// Payment config schema
const paymentConfigSchema = z.object({
  recipients: z.array(paymentRecipientSchema).min(1, 'At least one recipient is required'),
  memo: z.string().max(28, 'Memo must be 28 characters or less').optional(),
});

// Time of day validation (HH:MM format)
const timeOfDayRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// Create schedule request schema
export const createScheduleSchema = z.object({
  frequency: z.enum(['once', 'weekly', 'biweekly', 'monthly']),
  timeOfDay: z.string().regex(timeOfDayRegex, 'Time must be in HH:MM format (00:00 to 23:59)'),
  startDate: z.string().refine(
    (date) => {
      const parsed = new Date(date);
      return !isNaN(parsed.getTime());
    },
    { message: 'Start date must be a valid ISO date' }
  ),
  endDate: z
    .string()
    .refine(
      (date) => {
        const parsed = new Date(date);
        return !isNaN(parsed.getTime());
      },
      { message: 'End date must be a valid ISO date' }
    )
    .optional(),
  timezone: z.string().min(1).default('UTC'),
  paymentConfig: paymentConfigSchema,
});

// Query parameters schema for GET /api/schedules
export const scheduleQuerySchema = z.object({
  status: z.enum(['active', 'completed', 'cancelled', 'failed']).optional(),
  page: z.string().regex(/^\d+$/).transform(Number).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional(),
});

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type ScheduleQueryInput = z.infer<typeof scheduleQuerySchema>;
