/**
 * Manual test for calculateNextRun method
 * Run with: npx ts-node src/services/__tests__/scheduleService.manual.test.ts
 */

import { ScheduleService } from '../scheduleService.js';
import type { ScheduleFrequency } from '../../types/schedule.js';

const service = new ScheduleService();

function testCalculateNextRun() {
  console.log('Testing calculateNextRun method...\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Once frequency
  try {
    const startDate = new Date('2024-01-15');
    const result = service.calculateNextRun('once', '14:30', startDate);
    
    if (
      result.getFullYear() === 2024 &&
      result.getMonth() === 0 &&
      result.getDate() === 15 &&
      result.getHours() === 14 &&
      result.getMinutes() === 30
    ) {
      console.log('✓ Test 1 passed: Once frequency returns startDate with time');
      passed++;
    } else {
      console.log('✗ Test 1 failed: Once frequency incorrect result');
      console.log('  Expected: 2024-01-15 14:30');
      console.log('  Got:', result.toISOString());
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 1 failed with error:', error);
    failed++;
  }

  // Test 2: Weekly frequency without lastRun
  try {
    const startDate = new Date('2024-01-15');
    const result = service.calculateNextRun('weekly', '10:00', startDate);
    
    if (
      result.getFullYear() === 2024 &&
      result.getMonth() === 0 &&
      result.getDate() === 22 &&
      result.getHours() === 10 &&
      result.getMinutes() === 0
    ) {
      console.log('✓ Test 2 passed: Weekly frequency adds 7 days to startDate');
      passed++;
    } else {
      console.log('✗ Test 2 failed: Weekly frequency incorrect result');
      console.log('  Expected: 2024-01-22 10:00');
      console.log('  Got:', result.toISOString());
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 2 failed with error:', error);
    failed++;
  }

  // Test 3: Weekly frequency with lastRun
  try {
    const startDate = new Date('2024-01-15');
    const lastRun = new Date('2024-02-05');
    const result = service.calculateNextRun('weekly', '15:45', startDate, lastRun);
    
    if (
      result.getFullYear() === 2024 &&
      result.getMonth() === 1 &&
      result.getDate() === 12 &&
      result.getHours() === 15 &&
      result.getMinutes() === 45
    ) {
      console.log('✓ Test 3 passed: Weekly frequency adds 7 days to lastRun');
      passed++;
    } else {
      console.log('✗ Test 3 failed: Weekly frequency with lastRun incorrect result');
      console.log('  Expected: 2024-02-12 15:45');
      console.log('  Got:', result.toISOString());
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 3 failed with error:', error);
    failed++;
  }

  // Test 4: Biweekly frequency
  try {
    const startDate = new Date('2024-01-15');
    const result = service.calculateNextRun('biweekly', '08:30', startDate);
    
    if (
      result.getFullYear() === 2024 &&
      result.getMonth() === 0 &&
      result.getDate() === 29 &&
      result.getHours() === 8 &&
      result.getMinutes() === 30
    ) {
      console.log('✓ Test 4 passed: Biweekly frequency adds 14 days');
      passed++;
    } else {
      console.log('✗ Test 4 failed: Biweekly frequency incorrect result');
      console.log('  Expected: 2024-01-29 08:30');
      console.log('  Got:', result.toISOString());
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 4 failed with error:', error);
    failed++;
  }

  // Test 5: Monthly frequency
  try {
    const startDate = new Date('2024-01-15');
    const result = service.calculateNextRun('monthly', '11:00', startDate);
    
    if (
      result.getFullYear() === 2024 &&
      result.getMonth() === 1 &&
      result.getDate() === 15 &&
      result.getHours() === 11 &&
      result.getMinutes() === 0
    ) {
      console.log('✓ Test 5 passed: Monthly frequency adds 1 month');
      passed++;
    } else {
      console.log('✗ Test 5 failed: Monthly frequency incorrect result');
      console.log('  Expected: 2024-02-15 11:00');
      console.log('  Got:', result.toISOString());
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 5 failed with error:', error);
    failed++;
  }

  // Test 6: Monthly frequency with year boundary
  try {
    const startDate = new Date('2024-12-15');
    const result = service.calculateNextRun('monthly', '09:00', startDate);
    
    if (
      result.getFullYear() === 2025 &&
      result.getMonth() === 0 &&
      result.getDate() === 15 &&
      result.getHours() === 9 &&
      result.getMinutes() === 0
    ) {
      console.log('✓ Test 6 passed: Monthly frequency handles year boundary');
      passed++;
    } else {
      console.log('✗ Test 6 failed: Monthly frequency year boundary incorrect');
      console.log('  Expected: 2025-01-15 09:00');
      console.log('  Got:', result.toISOString());
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 6 failed with error:', error);
    failed++;
  }

  // Test 7: Midnight time
  try {
    const startDate = new Date('2024-01-15');
    const result = service.calculateNextRun('weekly', '00:00', startDate);
    
    if (result.getHours() === 0 && result.getMinutes() === 0) {
      console.log('✓ Test 7 passed: Handles midnight time correctly');
      passed++;
    } else {
      console.log('✗ Test 7 failed: Midnight time incorrect');
      console.log('  Expected: 00:00');
      console.log('  Got:', `${result.getHours()}:${result.getMinutes()}`);
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 7 failed with error:', error);
    failed++;
  }

  // Test 8: End of day time
  try {
    const startDate = new Date('2024-01-15');
    const result = service.calculateNextRun('weekly', '23:59', startDate);
    
    if (result.getHours() === 23 && result.getMinutes() === 59) {
      console.log('✓ Test 8 passed: Handles end of day time correctly');
      passed++;
    } else {
      console.log('✗ Test 8 failed: End of day time incorrect');
      console.log('  Expected: 23:59');
      console.log('  Got:', `${result.getHours()}:${result.getMinutes()}`);
      failed++;
    }
  } catch (error) {
    console.log('✗ Test 8 failed with error:', error);
    failed++;
  }

  // Test 9: Unsupported frequency should throw error
  try {
    const startDate = new Date('2024-01-15');
    service.calculateNextRun('yearly' as ScheduleFrequency, '10:00', startDate);
    console.log('✗ Test 9 failed: Should have thrown error for unsupported frequency');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Unsupported frequency')) {
      console.log('✓ Test 9 passed: Throws error for unsupported frequency');
      passed++;
    } else {
      console.log('✗ Test 9 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  if (failed === 0) {
    console.log('\n✓ All tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
}

testCalculateNextRun();
