# Requirements Document

## Introduction

This feature connects the existing frontend payroll scheduler components (PayrollScheduler.tsx and SchedulingWizard.tsx) to a backend scheduling API. The system will persist scheduled payroll configurations in a PostgreSQL database and execute on-chain bulk payments via Stellar blockchain at the configured times using a backend cron job. The frontend will display real-time schedule status and support immediate cancellation of pending schedules.

## Glossary

- **Payroll_Scheduler_Frontend**: The React components (PayrollScheduler.tsx and SchedulingWizard.tsx) that provide the user interface for scheduling payroll
- **Scheduling_API**: The backend REST API endpoints that handle schedule persistence and retrieval
- **Schedule_Config**: A data structure containing payroll schedule parameters including timing, recipients, and payment amounts
- **Backend_Cron_Job**: The server-side scheduled task that monitors for due schedules and triggers payments
- **Bulk_Payment_Contract**: The Stellar blockchain smart contract that executes multiple payments in a single transaction
- **Next_Run_Timestamp**: The server-calculated datetime indicating when a schedule will next execute
- **Active_Schedule**: A schedule that has been persisted and is awaiting execution
- **Database**: The PostgreSQL database storing schedule configurations and execution history

## Requirements

### Requirement 1: Schedule Persistence

**User Story:** As a payroll administrator, I want to save my scheduled payroll configuration, so that payments are automatically executed at the configured time without manual intervention.

#### Acceptance Criteria

1. WHEN the user submits a schedule from the Payroll_Scheduler_Frontend, THE Scheduling_API SHALL accept a POST request to /api/schedules
2. WHEN a POST request is received at /api/schedules, THE Scheduling_API SHALL validate the Schedule_Config structure
3. WHEN the Schedule_Config is valid, THE Scheduling_API SHALL persist the configuration to the Database
4. WHEN the schedule is successfully persisted, THE Scheduling_API SHALL return the created schedule with a unique identifier and Next_Run_Timestamp
5. IF the Schedule_Config is invalid, THEN THE Scheduling_API SHALL return a 400 error with descriptive validation messages

### Requirement 2: Active Schedule Retrieval

**User Story:** As a payroll administrator, I want to view all my active scheduled payrolls with their next run times, so that I can monitor upcoming payments.

#### Acceptance Criteria

1. WHEN the Payroll_Scheduler_Frontend requests active schedules, THE Scheduling_API SHALL accept a GET request to /api/schedules
2. WHEN a GET request is received at /api/schedules, THE Scheduling_API SHALL retrieve all Active_Schedule records from the Database
3. THE Scheduling_API SHALL calculate the Next_Run_Timestamp for each Active_Schedule based on the current time and schedule configuration
4. THE Scheduling_API SHALL return a list of Active_Schedule objects including schedule identifiers, configurations, and Next_Run_Timestamp values
5. WHEN no active schedules exist, THE Scheduling_API SHALL return an empty array with a 200 status

### Requirement 3: Schedule Cancellation

**User Story:** As a payroll administrator, I want to cancel a pending scheduled payroll, so that I can prevent unwanted payments from being executed.

#### Acceptance Criteria

1. WHEN the user cancels a schedule from the Payroll_Scheduler_Frontend, THE Scheduling_API SHALL accept a DELETE request to /api/schedules/:id
2. WHEN a DELETE request is received, THE Scheduling_API SHALL remove the specified Active_Schedule from the Database
3. WHEN the schedule is successfully deleted, THE Scheduling_API SHALL return a 204 status
4. IF the schedule identifier does not exist, THEN THE Scheduling_API SHALL return a 404 error
5. WHEN the Payroll_Scheduler_Frontend receives a successful deletion response, THE Payroll_Scheduler_Frontend SHALL immediately remove the schedule from the displayed list

### Requirement 4: Frontend Countdown Display

**User Story:** As a payroll administrator, I want to see a live countdown to the next scheduled payment, so that I know exactly when the payment will execute.

#### Acceptance Criteria

1. WHEN the Payroll_Scheduler_Frontend receives a Next_Run_Timestamp from the Scheduling_API, THE Payroll_Scheduler_Frontend SHALL display the timestamp in the CountdownTimer component
2. THE CountdownTimer SHALL calculate the time remaining until the Next_Run_Timestamp
3. WHILE the countdown is active, THE CountdownTimer SHALL update the displayed time every second
4. WHEN the Next_Run_Timestamp is reached, THE CountdownTimer SHALL display an indication that execution is in progress
5. THE CountdownTimer SHALL use the server-provided Next_Run_Timestamp as the authoritative time source

### Requirement 5: Scheduled Payment Execution

**User Story:** As a payroll administrator, I want the system to automatically execute bulk payments at the scheduled time, so that employees are paid on schedule without manual intervention.

#### Acceptance Criteria

1. THE Backend_Cron_Job SHALL check for due Active_Schedule records every minute
2. WHEN an Active_Schedule Next_Run_Timestamp is less than or equal to the current time, THE Backend_Cron_Job SHALL retrieve the Schedule_Config
3. WHEN a schedule is due, THE Backend_Cron_Job SHALL invoke the Bulk_Payment_Contract on the Stellar blockchain with the payment parameters from the Schedule_Config
4. WHEN the Bulk_Payment_Contract invocation succeeds, THE Backend_Cron_Job SHALL update the schedule execution status in the Database
5. IF the Bulk_Payment_Contract invocation fails, THEN THE Backend_Cron_Job SHALL log the error and mark the schedule execution as failed in the Database
6. WHEN a one-time schedule completes execution, THE Backend_Cron_Job SHALL mark the schedule as inactive
7. WHEN a recurring schedule completes execution, THE Backend_Cron_Job SHALL calculate and update the Next_Run_Timestamp for the next occurrence

### Requirement 6: API Error Handling

**User Story:** As a developer, I want comprehensive error handling in the API, so that the frontend can provide meaningful feedback to users when operations fail.

#### Acceptance Criteria

1. WHEN a database connection error occurs, THE Scheduling_API SHALL return a 503 error with a message indicating service unavailability
2. WHEN a request contains malformed JSON, THE Scheduling_API SHALL return a 400 error with a message describing the parsing error
3. WHEN authentication fails, THE Scheduling_API SHALL return a 401 error
4. WHEN a user attempts to access or modify a schedule they do not own, THE Scheduling_API SHALL return a 403 error
5. IF an unexpected error occurs during request processing, THEN THE Scheduling_API SHALL log the full error details and return a 500 error with a generic message

### Requirement 7: Real-Time UI Updates

**User Story:** As a payroll administrator, I want the schedule list to update immediately after I create or cancel a schedule, so that I always see the current state without refreshing the page.

#### Acceptance Criteria

1. WHEN the Payroll_Scheduler_Frontend successfully creates a schedule, THE Payroll_Scheduler_Frontend SHALL add the new schedule to the displayed list immediately
2. WHEN the Payroll_Scheduler_Frontend successfully cancels a schedule, THE Payroll_Scheduler_Frontend SHALL remove the schedule from the displayed list immediately
3. THE Payroll_Scheduler_Frontend SHALL display loading indicators while API requests are in progress
4. IF an API request fails, THEN THE Payroll_Scheduler_Frontend SHALL display an error message and maintain the previous UI state
5. WHEN an error occurs, THE Payroll_Scheduler_Frontend SHALL provide a retry option for the failed operation
