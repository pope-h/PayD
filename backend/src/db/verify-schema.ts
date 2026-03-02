/**
 * @file src/db/verify-schema.ts
 * @description Schema verification script for schedules and execution_history tables
 * 
 * This script verifies that:
 * 1. The schedules table exists with correct structure
 * 2. The execution_history table exists with correct structure
 * 3. Foreign key constraints are properly configured
 * 4. All indexes are created
 * 5. Check constraints work correctly
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('[verify-schema] ERROR: DATABASE_URL environment variable is not set.');
    console.error('[verify-schema] Please create a .env file in the backend directory with DATABASE_URL.');
    process.exit(1);
}

interface ColumnInfo {
    column_name: string;
    data_type: string;
    is_nullable: string;
    column_default: string | null;
}

interface ConstraintInfo {
    constraint_name: string;
    constraint_type: string;
}

interface IndexInfo {
    indexname: string;
    indexdef: string;
}

async function verifySchema(): Promise<void> {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        max: 1,
        idleTimeoutMillis: 5_000,
        connectionTimeoutMillis: 10_000,
    });

    const client = await pool.connect();

    try {
        console.log('[verify-schema] Starting schema verification...\n');

        // ── Step 1: Verify schedules table exists ──────────────────────────────
        console.log('1. Checking schedules table...');
        const schedulesTableResult = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'schedules'
            )`
        );

        if (!schedulesTableResult.rows[0].exists) {
            console.error('   ✗ schedules table does not exist');
            throw new Error('schedules table not found');
        }
        console.log('   ✓ schedules table exists');

        // ── Step 2: Verify schedules table columns ─────────────────────────────
        console.log('\n2. Verifying schedules table columns...');
        const schedulesColumns = await client.query<ColumnInfo>(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'schedules'
             ORDER BY ordinal_position`
        );

        const expectedSchedulesColumns = [
            'id', 'organization_id', 'user_id', 'frequency', 'time_of_day',
            'start_date', 'end_date', 'payment_config', 'next_run_timestamp',
            'last_run_timestamp', 'status', 'created_at', 'updated_at'
        ];

        const actualColumns = schedulesColumns.rows.map(r => r.column_name);
        const missingColumns = expectedSchedulesColumns.filter(col => !actualColumns.includes(col));
        
        if (missingColumns.length > 0) {
            console.error(`   ✗ Missing columns: ${missingColumns.join(', ')}`);
            throw new Error('schedules table has missing columns');
        }
        console.log(`   ✓ All ${expectedSchedulesColumns.length} columns present`);

        // ── Step 3: Verify schedules table constraints ─────────────────────────
        console.log('\n3. Verifying schedules table constraints...');
        const schedulesConstraints = await client.query<ConstraintInfo>(
            `SELECT constraint_name, constraint_type
             FROM information_schema.table_constraints
             WHERE table_schema = 'public' AND table_name = 'schedules'`
        );

        const constraintTypes = schedulesConstraints.rows.map(r => r.constraint_type);
        const hasPrimaryKey = constraintTypes.includes('PRIMARY KEY');
        const hasForeignKey = constraintTypes.includes('FOREIGN KEY');
        const hasCheck = constraintTypes.includes('CHECK');

        if (!hasPrimaryKey) {
            console.error('   ✗ Primary key constraint missing');
            throw new Error('schedules table missing primary key');
        }
        console.log('   ✓ Primary key constraint exists');

        if (!hasForeignKey) {
            console.error('   ✗ Foreign key constraint missing');
            throw new Error('schedules table missing foreign key');
        }
        console.log('   ✓ Foreign key constraint exists');

        if (!hasCheck) {
            console.error('   ✗ Check constraints missing');
            throw new Error('schedules table missing check constraints');
        }
        console.log('   ✓ Check constraints exist');

        // ── Step 4: Verify schedules table indexes ─────────────────────────────
        console.log('\n4. Verifying schedules table indexes...');
        const schedulesIndexes = await client.query<IndexInfo>(
            `SELECT indexname, indexdef
             FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = 'schedules'`
        );

        const expectedIndexes = [
            'idx_schedules_next_run',
            'idx_schedules_org_id',
            'idx_schedules_status'
        ];

        const actualIndexes = schedulesIndexes.rows.map(r => r.indexname);
        const missingIndexes = expectedIndexes.filter(idx => !actualIndexes.includes(idx));

        if (missingIndexes.length > 0) {
            console.error(`   ✗ Missing indexes: ${missingIndexes.join(', ')}`);
            throw new Error('schedules table has missing indexes');
        }
        console.log(`   ✓ All ${expectedIndexes.length} indexes present`);

        // ── Step 5: Verify execution_history table exists ──────────────────────
        console.log('\n5. Checking execution_history table...');
        const executionHistoryTableResult = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'execution_history'
            )`
        );

        if (!executionHistoryTableResult.rows[0].exists) {
            console.error('   ✗ execution_history table does not exist');
            throw new Error('execution_history table not found');
        }
        console.log('   ✓ execution_history table exists');

        // ── Step 6: Verify execution_history table columns ────────────────────
        console.log('\n6. Verifying execution_history table columns...');
        const executionHistoryColumns = await client.query<ColumnInfo>(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'execution_history'
             ORDER BY ordinal_position`
        );

        const expectedExecutionHistoryColumns = [
            'id', 'schedule_id', 'executed_at', 'status', 'transaction_hash',
            'transaction_result', 'error_message', 'error_details', 'created_at'
        ];

        const actualExecutionHistoryColumns = executionHistoryColumns.rows.map(r => r.column_name);
        const missingExecutionHistoryColumns = expectedExecutionHistoryColumns.filter(
            col => !actualExecutionHistoryColumns.includes(col)
        );

        if (missingExecutionHistoryColumns.length > 0) {
            console.error(`   ✗ Missing columns: ${missingExecutionHistoryColumns.join(', ')}`);
            throw new Error('execution_history table has missing columns');
        }
        console.log(`   ✓ All ${expectedExecutionHistoryColumns.length} columns present`);

        // ── Step 7: Verify execution_history table constraints ────────────────
        console.log('\n7. Verifying execution_history table constraints...');
        const executionHistoryConstraints = await client.query<ConstraintInfo>(
            `SELECT constraint_name, constraint_type
             FROM information_schema.table_constraints
             WHERE table_schema = 'public' AND table_name = 'execution_history'`
        );

        const executionHistoryConstraintTypes = executionHistoryConstraints.rows.map(r => r.constraint_type);
        const hasExecutionHistoryPrimaryKey = executionHistoryConstraintTypes.includes('PRIMARY KEY');
        const hasExecutionHistoryForeignKey = executionHistoryConstraintTypes.includes('FOREIGN KEY');
        const hasExecutionHistoryCheck = executionHistoryConstraintTypes.includes('CHECK');

        if (!hasExecutionHistoryPrimaryKey) {
            console.error('   ✗ Primary key constraint missing');
            throw new Error('execution_history table missing primary key');
        }
        console.log('   ✓ Primary key constraint exists');

        if (!hasExecutionHistoryForeignKey) {
            console.error('   ✗ Foreign key constraint missing');
            throw new Error('execution_history table missing foreign key');
        }
        console.log('   ✓ Foreign key constraint exists');

        if (!hasExecutionHistoryCheck) {
            console.error('   ✗ Check constraints missing');
            throw new Error('execution_history table missing check constraints');
        }
        console.log('   ✓ Check constraints exist');

        // ── Step 8: Verify execution_history table indexes ────────────────────
        console.log('\n8. Verifying execution_history table indexes...');
        const executionHistoryIndexes = await client.query<IndexInfo>(
            `SELECT indexname, indexdef
             FROM pg_indexes
             WHERE schemaname = 'public' AND tablename = 'execution_history'`
        );

        const expectedExecutionHistoryIndexes = [
            'idx_execution_schedule_id',
            'idx_execution_status',
            'idx_execution_executed_at'
        ];

        const actualExecutionHistoryIndexes = executionHistoryIndexes.rows.map(r => r.indexname);
        const missingExecutionHistoryIndexes = expectedExecutionHistoryIndexes.filter(
            idx => !actualExecutionHistoryIndexes.includes(idx)
        );

        if (missingExecutionHistoryIndexes.length > 0) {
            console.error(`   ✗ Missing indexes: ${missingExecutionHistoryIndexes.join(', ')}`);
            throw new Error('execution_history table has missing indexes');
        }
        console.log(`   ✓ All ${expectedExecutionHistoryIndexes.length} indexes present`);

        // ── Step 9: Test foreign key constraint ───────────────────────────────
        console.log('\n9. Testing foreign key constraints...');
        
        // Test that we cannot insert into execution_history with non-existent schedule_id
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO execution_history (schedule_id, status) VALUES (-999, 'success')`
            );
            await client.query('ROLLBACK');
            console.error('   ✗ Foreign key constraint not enforced (should have failed)');
            throw new Error('Foreign key constraint not working');
        } catch (error: any) {
            await client.query('ROLLBACK');
            if (error.code === '23503') { // Foreign key violation
                console.log('   ✓ Foreign key constraint properly enforced');
            } else if (error.message.includes('Foreign key constraint not working')) {
                throw error;
            } else {
                console.error('   ✗ Unexpected error testing foreign key:', error.message);
                throw error;
            }
        }

        // ── Step 10: Test check constraints ───────────────────────────────────
        console.log('\n10. Testing check constraints...');
        
        // Test invalid frequency value
        try {
            await client.query('BEGIN');
            await client.query(
                `INSERT INTO schedules (organization_id, user_id, frequency, time_of_day, start_date, payment_config, next_run_timestamp)
                 VALUES (1, 1, 'invalid', '10:00:00', CURRENT_DATE, '{}', NOW())`
            );
            await client.query('ROLLBACK');
            console.error('   ✗ Check constraint on frequency not enforced');
            throw new Error('Check constraint not working');
        } catch (error: any) {
            await client.query('ROLLBACK');
            if (error.code === '23514') { // Check violation
                console.log('   ✓ Check constraint on frequency properly enforced');
            } else if (error.message.includes('Check constraint not working')) {
                throw error;
            } else {
                console.error('   ✗ Unexpected error testing check constraint:', error.message);
                throw error;
            }
        }

        console.log('\n' + '─'.repeat(60));
        console.log('[verify-schema] ✓ All schema verifications passed!');
        console.log('─'.repeat(60));

    } catch (error) {
        console.error('\n[verify-schema] ✗ Schema verification failed:', error instanceof Error ? error.message : error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

async function main(): Promise<void> {
    try {
        await verifySchema();
        process.exit(0);
    } catch (error) {
        console.error('[verify-schema] Fatal error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();
