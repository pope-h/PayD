// Schedule domain types for payroll scheduler backend

// Frequency enum type
export type ScheduleFrequency = 'once' | 'weekly' | 'biweekly' | 'monthly';

// Status enum type
export type ScheduleStatus = 'active' | 'completed' | 'cancelled' | 'failed';

// Execution status enum type
export type ExecutionStatus = 'success' | 'failed' | 'partial';

// Payment recipient interface
export interface PaymentRecipient {
  walletAddress: string;
  amount: string;
  assetCode: string;
}

// Payment configuration interface
export interface PaymentConfig {
  recipients: PaymentRecipient[];
  memo?: string;
}

// Main schedule interface
export interface Schedule {
  id: number;
  organizationId: number;
  userId: number;
  frequency: ScheduleFrequency;
  timeOfDay: string;
  startDate: Date;
  endDate?: Date;
  paymentConfig: PaymentConfig;
  timezone: string;
  nextRunTimestamp: Date;
  lastRunTimestamp?: Date;
  status: ScheduleStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Schedule filters for querying
export interface ScheduleFilters {
  status?: ScheduleStatus;
  page?: number;
  limit?: number;
}

// Execution result interface
export interface ExecutionResult {
  success: boolean;
  transactionHash?: string;
  error?: {
    message: string;
    details?: object;
  };
}

// Execution history interface
export interface ExecutionHistory {
  id: number;
  scheduleId: number;
  executedAt: Date;
  status: ExecutionStatus;
  transactionHash?: string;
  transactionResult?: object;
  errorMessage?: string;
  errorDetails?: object;
  createdAt: Date;
}

// Type guard for ScheduleFrequency
export function isScheduleFrequency(value: unknown): value is ScheduleFrequency {
  return (
    typeof value === 'string' &&
    ['once', 'weekly', 'biweekly', 'monthly'].includes(value)
  );
}

// Type guard for ScheduleStatus
export function isScheduleStatus(value: unknown): value is ScheduleStatus {
  return (
    typeof value === 'string' &&
    ['active', 'completed', 'cancelled', 'failed'].includes(value)
  );
}

// Type guard for ExecutionStatus
export function isExecutionStatus(value: unknown): value is ExecutionStatus {
  return (
    typeof value === 'string' &&
    ['success', 'failed', 'partial'].includes(value)
  );
}

// API Request/Response Types

// Request body for creating a new schedule
export interface CreateScheduleRequest {
  frequency: ScheduleFrequency;
  timeOfDay: string; // HH:MM format
  startDate: string; // ISO date
  endDate?: string; // ISO date, optional for recurring
  timezone: string;
  paymentConfig: PaymentConfig;
}

// Response for successful schedule creation
export interface CreateScheduleResponse {
  id: number;
  frequency: string;
  timeOfDay: string;
  startDate: string;
  endDate?: string;
  timezone: string;
  nextRunTimestamp: string; // ISO timestamp
  status: string;
  createdAt: string;
}

// Response for getting schedules with pagination
export interface GetSchedulesResponse {
  schedules: Array<{
    id: number;
    frequency: string;
    timeOfDay: string;
    startDate: string;
    endDate?: string;
    nextRunTimestamp: string;
    lastRunTimestamp?: string;
    status: string;
    timezone: string;
    paymentConfig: PaymentConfig;
    createdAt: string;
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
}

// Error response interface with error codes
export interface ErrorResponse {
  error: {
    code: string; // Machine-readable error code
    message: string; // Human-readable message
    details?: object; // Additional context (e.g., validation errors)
  };
}

// Error codes enum for consistent error handling
export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  SCHEDULE_NOT_FOUND = 'SCHEDULE_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  DATABASE_ERROR = 'DATABASE_ERROR',
  BLOCKCHAIN_ERROR = 'BLOCKCHAIN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}
