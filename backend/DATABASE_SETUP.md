# Database Setup Guide

This guide explains how to set up the PostgreSQL database for the PayeD backend.

## Prerequisites

You need either:

- Docker and Docker Compose (recommended), OR
- PostgreSQL installed locally

## Option 1: Using Docker Compose (Recommended)

1. **Start the database**:

   ```bash
   cd backend
   docker-compose up -d postgres
   ```

2. **Create .env file**:

   ```bash
   cp .env.example .env
   ```

3. **Update .env with database credentials**:

   ```env
   DATABASE_URL=postgresql://payd_user:payd_password@localhost:5432/payd_db
   ```

4. **Run migrations**:

   ```bash
   npm run db:migrate
   ```

5. **Verify schema**:
   ```bash
   npm run db:verify-schema
   ```

## Option 2: Using Local PostgreSQL

1. **Install PostgreSQL** (if not already installed):

   ```bash
   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib

   # macOS
   brew install postgresql
   ```

2. **Start PostgreSQL service**:

   ```bash
   # Ubuntu/Debian
   sudo systemctl start postgresql

   # macOS
   brew services start postgresql
   ```

3. **Create database and user**:

   ```bash
   sudo -u postgres psql
   ```

   Then in the PostgreSQL prompt:

   ```sql
   CREATE USER payd_user WITH PASSWORD 'payd_password';
   CREATE DATABASE payd_db OWNER payd_user;
   GRANT ALL PRIVILEGES ON DATABASE payd_db TO payd_user;
   \q
   ```

4. **Create .env file**:

   ```bash
   cd backend
   cp .env.example .env
   ```

5. **Update .env with database credentials**:

   ```env
   DATABASE_URL=postgresql://payd_user:payd_password@localhost:5432/payd_db
   ```

6. **Run migrations**:

   ```bash
   npm run db:migrate
   ```

7. **Verify schema**:
   ```bash
   npm run db:verify-schema
   ```

## Migration Scripts

The following npm scripts are available:

- `npm run db:migrate` - Run all pending migrations
- `npm run db:migrate:dry-run` - Preview migrations without executing
- `npm run db:verify-schema` - Verify database schema is correct

## Payroll Scheduler Migrations

The payroll scheduler feature adds two new tables:

### schedules table

Stores payroll schedule configurations including:

- Schedule frequency (once, weekly, biweekly, monthly)
- Time of day for execution
- Payment configuration (recipients, amounts, assets)
- Execution tracking (next run, last run, status)

### execution_history table

Records all schedule execution attempts including:

- Execution status (success, failed, partial)
- Blockchain transaction details
- Error information for failed executions

## Verification

After running migrations, the verify-schema script will check:

1. ✓ Tables exist (schedules, execution_history)
2. ✓ All columns are present with correct types
3. ✓ Primary key constraints are configured
4. ✓ Foreign key constraints are configured
5. ✓ Check constraints are enforced
6. ✓ Indexes are created
7. ✓ Foreign key relationships work correctly
8. ✓ Check constraints reject invalid data

## Troubleshooting

### "DATABASE_URL environment variable is not set"

- Make sure you have a `.env` file in the `backend` directory
- Verify the `.env` file contains `DATABASE_URL=postgresql://...`

### "Connection refused" or "ECONNREFUSED"

- Check if PostgreSQL is running: `docker ps` or `sudo systemctl status postgresql`
- Verify the host and port in DATABASE_URL match your PostgreSQL instance

### "database does not exist"

- Create the database using the SQL commands in Option 2, step 3
- Or use Docker Compose which creates the database automatically

### "permission denied for schema public"

- Grant privileges to your user: `GRANT ALL PRIVILEGES ON DATABASE payd_db TO payd_user;`
- Or use Docker Compose which handles permissions automatically

### Migration already applied

- Migrations are tracked in the `schema_migrations` table
- If you need to re-run a migration, delete its entry from `schema_migrations`
- Or drop and recreate the database for a clean slate

## Next Steps

After successful database setup:

1. Start the backend server: `npm run dev`
2. The server will connect to the database automatically
3. The cron job will start monitoring for due schedules
4. Use the API endpoints to create and manage schedules

For API documentation, see the main README.md file.
