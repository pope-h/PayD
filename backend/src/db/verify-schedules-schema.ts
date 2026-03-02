/**
 * @file src/db/verify-schedules-schema.ts
 * @description Verification script for schedules and execution_history tables
 * 
 * This script verifies that migrations 014 and 015 have been applied correctly:
 * - Checks that both tables exist
 * - Verifies all columns with correct types
 * - Validates constraints (CHECK, FOREIGN KEY)
 * - Confirms indexes are in place
 * - Tests foreign key relationships
 * 
 * Usage:
 *   ts-node src/db/verify-schedules-schema.ts
 */

import dotenv from 'dotenv';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error('[verify] ERROR: DATABASE_URL environment variable is not set.');
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
    check_clause?: string;
}

interface IndexInfo {
    indexname: string;
    indexdef: string;
}

interface ForeignKeyInfo {
    constraint_name: string;
    table_name: string;
    column_name: string;
    foreign_table_name: string;
    foreign_column_name: string;
}

async function verifySchema(): Promise<void> {
    const pool = new Pool({
        connectionString: DATABASE_URL,
        max: 1,
    });

    const client = await pool.connect();
    let allChecksPass = true;

    try {
        console.log('[verify] Starting schema verification for schedules and execution_history tables\n');

        // ─── Check 1: Verify schedules table exists ───────────────────────────
        console.log('─── Check 1: Table Existence ───');
        const schedulesExists = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'schedules'
            )`
        );
        
        const executionHistoryExists = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'execution_history'
            )`
        );

        if (schedulesExists.rows[0].exists) {
            console.log('✓ schedules table exists');
        } else {
            console.error('✗ schedules table does NOT exist');
            allChecksPass = false;
        }

        if (executionHistoryExists.rows[0].exists) {
            console.log('✓ execution_history table exists');
        } else {
            console.error('✗ execution_history table does NOT exist');
            allChecksPass = false;
        }

        if (!schedulesExists.rows[0].exists || !executionHistoryExists.rows[0].exists) {
            console.log('\n[verify] Tables do not exist. Run migrations first: npm run db:migrate');
            process.exit(1);
        }

        // ─── Check 2: Verify schedules table columns ──────────────────────────
        console.log('\n─── Check 2: schedules Table Columns ───');
        const schedulesColumns = await client.query<ColumnInfo>(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'schedules'
             ORDER BY ordinal_position`
        );

        const expectedSchedulesColumns = [
            { name: 'id', type: 'integer', nullable: 'NO' },
            { name: 'organization_id', type: 'integer', nullable: 'NO' },
            { name: 'user_id', type: 'integer', nullable: 'NO' },
            { name: 'frequency', type: 'character varying', nullable: 'NO' },
            { name: 'time_of_day', type: 'time without time zone', nullable: 'NO' },
            { name: 'start_date', type: 'date', nullable: 'NO' },
            { name: 'end_date', type: 'date', nullable: 'YES' },
            { name: 'payment_config', type: 'jsonb', nullable: 'NO' },
            { name: 'next_run_timestamp', type: 'timestamp without time zone', nullable: 'NO' },
            { name: 'last_run_timestamp', type: 'timestamp without time zone', nullable: 'YES' },
            { name: 'status', type: 'character varying', nullable: 'YES' },
            { name: 'created_at', type: 'timestamp without time zone', nullable: 'YES' },
            { name: 'updated_at', type: 'timestamp without time zone', nullable: 'YES' },
        ];

        for (const expected of expectedSchedulesColumns) {
            const actual = schedulesColumns.rows.find(c => c.column_name === expected.name);
            if (!actual) {
                console.error(`✗ Column '${expected.name}' is missing`);
                allChecksPass = false;
            } else if (actual.data_type !== expected.type) {
                console.error(`✗ Column '${expected.name}' has wrong type: ${actual.data_type} (expected ${expected.type})`);
                allChecksPass = false;
            } else if (actual.is_nullable !== expected.nullable) {
                console.error(`✗ Column '${expected.name}' has wrong nullable: ${actual.is_nullable} (expected ${expected.nullable})`);
                allChecksPass = false;
            } else {
                console.log(`✓ Column '${expected.name}' is correct (${expected.type}, nullable: ${expected.nullable})`);
            }
        }

        // ─── Check 3: Verify execution_history table columns ─────────────────
        console.log('\n─── Check 3: execution_history Table Columns ───');
        const executionHistoryColumns = await client.query<ColumnInfo>(
            `SELECT column_name, data_type, is_nullable, column_default
             FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'execution_history'
             ORDER BY ordinal_position`
        );

        const expectedExecutionHistoryColumns = [
            { name: 'id', type: 'integer', nullable: 'NO' },
            { name: 'schedule_id', type: 'integer', nullable: 'NO' },
            { name: 'executed_at', type: 'timestamp without time zone', nullable: 'YES' },
            { name: 'status', type: 'character varying', nullable: 'NO' },
            { name: 'transaction_hash', type: 'character varying', nullable: 'YES' },
            { name: 'transaction_result', type: 'jsonb', nullable: 'YES' },
            { name: 'error_message', type: 'text', nullable: 'YES' },
            { name: 'error_details', type: 'jsonb', nullable: 'YES' },
            { name: 'created_at', type: 'timestamp without time zone', nullable: 'YES' },
        ];

        for (const expected of expectedExecutionHistoryColumns) {
            const actual = executionHistoryColumns.rows.find(c => c.column_name === expected.name);
            if (!actual) {
                console.error(`✗ Column '${expected.name}' is missing`);
                allChecksPass = false;
            } else if (actual.data_type !== expected.type) {
                console.error(`✗ Column '${expected.name}' has wrong type: ${actual.data_type} (expected ${expected.type})`);
                allChecksPass = false;
            } else if (actual.is_nullable !== expected.nullable) {
                console.error(`✗ Column '${expected.name}' has wrong nullable: ${actual.is_nullable} (expected ${expected.nullable})`);
                allChecksPass = false;
            } else {
                console.log(`✓ Column '${expected.name}' is correct (${expected.type}, nullable: ${expected.nullable})`);
            }
        }

        // ─── Check 4: Verify CHECK constraints ────────────────────────────────
        console.log('\n─── Check 4: CHECK Constraints ───');
        const schedulesConstraints = await client.query<ConstraintInfo>(
            `SELECT con.conname AS constraint_name, 
                    con.contype AS constraint_type,
                    pg_get_constraintdef(con.oid) AS check_clause
             FROM pg_constraint con
             JOIN pg_class rel ON rel.oid = con.conrelid
             JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
             WHERE nsp.nspname = 'public' 
             AND rel.relname = 'schedules'
             AND con.contype = 'c'`
        );

        const expectedSchedulesChecks = [
            { name: 'schedules_frequency_check', pattern: /frequency.*IN.*once.*weekly.*biweekly.*monthly/i },
            { name: 'schedules_status_check', pattern: /status.*IN.*active.*completed.*cancelled.*failed/i },
        ];

        for (const expected of expectedSchedulesChecks) {
            const actual = schedulesConstraints.rows.find(c => c.constraint_name === expected.name);
            if (!actual) {
                console.error(`✗ CHECK constraint '${expected.name}' is missing`);
                allChecksPass = false;
            } else if (!expected.pattern.test(actual.check_clause || '')) {
                console.error(`✗ CHECK constraint '${expected.name}' has wrong definition: ${actual.check_clause}`);
                allChecksPass = false;
            } else {
                console.log(`✓ CHECK constraint '${expected.name}' is correct`);
            }
        }

        const executionHistoryConstraints = await client.query<ConstraintInfo>(
            `SELECT con.conname AS constraint_name, 
                    con.contype AS constraint_type,
                    pg_get_constraintdef(con.oid) AS check_clause
             FROM pg_constraint con
             JOIN pg_class rel ON rel.oid = con.conrelid
             JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
             WHERE nsp.nspname = 'public' 
             AND rel.relname = 'execution_history'
             AND con.contype = 'c'`
        );

        const expectedExecutionHistoryChecks = [
            { name: 'execution_history_status_check', pattern: /status.*IN.*success.*failed.*partial/i },
        ];

        for (const expected of expectedExecutionHistoryChecks) {
            const actual = executionHistoryConstraints.rows.find(c => c.constraint_name === expected.name);
            if (!actual) {
                console.error(`✗ CHECK constraint '${expected.name}' is missing`);
                allChecksPass = false;
            } else if (!expected.pattern.test(actual.check_clause || '')) {
                console.error(`✗ CHECK constraint '${expected.name}' has wrong definition: ${actual.check_clause}`);
                allChecksPass = false;
            } else {
                console.log(`✓ CHECK constraint '${expected.name}' is correct`);
            }
        }

        // ─── Check 5: Verify foreign key constraints ──────────────────────────
        console.log('\n─── Check 5: Foreign Key Constraints ───');
        const foreignKeys = await client.query<ForeignKeyInfo>(
            `SELECT
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
             FROM information_schema.table_constraints AS tc
             JOIN information_schema.key_column_usage AS kcu
               ON tc.constraint_name = kcu.constraint_name
               AND tc.table_schema = kcu.table_schema
             JOIN information_schema.constraint_column_usage AS ccu
               ON ccu.constraint_name = tc.constraint_name
               AND ccu.table_schema = tc.table_schema
             WHERE tc.constraint_type = 'FOREIGN KEY'
             AND tc.table_schema = 'public'
             AND tc.table_name IN ('schedules', 'execution_history')`
        );

        const expectedForeignKeys = [
            { table: 'schedules', column: 'organization_id', foreign_table: 'organizations', foreign_column: 'id' },
            { table: 'execution_history', column: 'schedule_id', foreign_table: 'schedules', foreign_column: 'id' },
        ];

        for (const expected of expectedForeignKeys) {
            const actual = foreignKeys.rows.find(
                fk => fk.table_name === expected.table &&
                      fk.column_name === expected.column &&
                      fk.foreign_table_name === expected.foreign_table &&
                      fk.foreign_column_name === expected.foreign_column
            );
            if (!actual) {
                console.error(`✗ Foreign key ${expected.table}.${expected.column} -> ${expected.foreign_table}.${expected.foreign_column} is missing`);
                allChecksPass = false;
            } else {
                console.log(`✓ Foreign key ${expected.table}.${expected.column} -> ${expected.foreign_table}.${expected.foreign_column} exists`);
            }
        }

        // ─── Check 6: Verify indexes ──────────────────────────────────────────
        console.log('\n─── Check 6: Indexes ───');
        const indexes = await client.query<IndexInfo>(
            `SELECT indexname, indexdef
             FROM pg_indexes
             WHERE schemaname = 'public'
             AND tablename IN ('schedules', 'execution_history')
             ORDER BY indexname`
        );

        const expectedIndexes = [
            { name: 'idx_schedules_next_run', pattern: /schedules.*next_run_timestamp.*status/i },
            { name: 'idx_schedules_org_id', pattern: /schedules.*organization_id/i },
            { name: 'idx_schedules_status', pattern: /schedules.*status/i },
            { name: 'idx_execution_schedule_id', pattern: /execution_history.*schedule_id/i },
            { name: 'idx_execution_status', pattern: /execution_history.*status/i },
            { name: 'idx_execution_executed_at', pattern: /execution_history.*executed_at/i },
        ];

        for (const expected of expectedIndexes) {
            const actual = indexes.rows.find(idx => idx.indexname === expected.name);
            if (!actual) {
                console.error(`✗ Index '${expected.name}' is missing`);
                allChecksPass = false;
            } else if (!expected.pattern.test(actual.indexdef)) {
                console.error(`✗ Index '${expected.name}' has wrong definition: ${actual.indexdef}`);
                allChecksPass = false;
            } else {
                console.log(`✓ Index '${expected.name}' exists with correct definition`);
            }
        }

        // ─── Check 7: Test foreign key constraints work ───────────────────────
        console.log('\n─── Check 7: Foreign Key Constraint Functionality ───');
        
        // Test 1: Verify organizations table exists (required for FK)
        const orgsExists = await client.query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'organizations'
            )`
        );

        if (!orgsExists.rows[0].exists) {
            console.error('✗ organizations table does not exist (required for foreign key)');
            allChecksPass = false;
        } else {
            console.log('✓ organizations table exists (required for foreign key)');
            
            // Test 2: Try to insert a schedule with invalid organization_id (should fail)
            try {
                await client.query('BEGIN');
                await client.query(
                    `INSERT INTO schedules (
                        organization_id, user_id, frequency, time_of_day, 
                        start_date, payment_config, next_run_timestamp, status
                    ) VALUES (
                        999999, 1, 'once', '10:00:00', 
                        CURRENT_DATE, '{"recipients": []}'::jsonb, 
                        CURRENT_TIMESTAMP, 'active'
                    )`
                );
                await client.query('ROLLBACK');
                console.error('✗ Foreign key constraint schedules.organization_id -> organizations.id is NOT enforced');
                allChecksPass = false;
            } catch (err) {
                await client.query('ROLLBACK');
                if (err instanceof Error && err.message.includes('foreign key constraint')) {
                    console.log('✓ Foreign key constraint schedules.organization_id -> organizations.id is enforced');
                } else {
                    console.error(`✗ Unexpected error testing foreign key: ${err instanceof Error ? err.message : String(err)}`);
                    allChecksPass = false;
                }
            }

            // Test 3: Try to insert execution_history with invalid schedule_id (should fail)
            try {
                await client.query('BEGIN');
                await client.query(
                    `INSERT INTO execution_history (
                        schedule_id, status
                    ) VALUES (
                        999999, 'success'
                    )`
                );
                await client.query('ROLLBACK');
                console.error('✗ Foreign key constraint execution_history.schedule_id -> schedules.id is NOT enforced');
                allChecksPass = false;
            } catch (err) {
                await client.query('ROLLBACK');
                if (err instanceof Error && err.message.includes('foreign key constraint')) {
                    console.log('✓ Foreign key constraint execution_history.schedule_id -> schedules.id is enforced');
                } else {
                    console.error(`✗ Unexpected error testing foreign key: ${err instanceof Error ? err.message : String(err)}`);
                    allChecksPass = false;
                }
            }
        }

        // ─── Summary ───────────────────────────────────────────────────────────
        console.log('\n─────────────────────────────────────────');
        if (allChecksPass) {
            console.log('[verify] ✓ All schema verification checks PASSED');
            console.log('[verify] Migrations 014 and 015 have been applied correctly');
            process.exit(0);
        } else {
            console.error('[verify] ✗ Some schema verification checks FAILED');
            console.error('[verify] Please review the errors above and re-run migrations if needed');
            process.exit(1);
        }

    } catch (err) {
        console.error('[verify] Verification failed:', err instanceof Error ? err.message : err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

verifySchema();
