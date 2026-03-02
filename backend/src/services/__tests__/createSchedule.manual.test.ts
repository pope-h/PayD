/**
 * Manual test for createSchedule method
 * This test verifies the validation logic without requiring database connection
 * Run with: npx ts-node src/services/__tests__/createSchedule.manual.test.ts
 */

import { ScheduleService } from '../scheduleService.js';
import type { CreateScheduleRequest } from '../../types/schedule.js';

const service = new ScheduleService();

function testValidation() {
  console.log('Testing createSchedule validation logic...\n');

  let passed = 0;
  let failed = 0;

  // Helper to create valid schedule data
  const getValidScheduleData = (): CreateScheduleRequest => ({
    frequency: 'weekly',
    timeOfDay: '14:30',
    startDate: new Date(Date.now() + 86400000).toISOString().split('T')[0], // Tomorrow
    paymentConfig: {
      recipients: [
        {
          walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
          amount: '100.00',
          assetCode: 'USDC',
        },
      ],
      memo: 'Test payment',
    },
  });

  // Test 1: Invalid frequency
  try {
    const invalidData = {
      ...getValidScheduleData(),
      frequency: 'invalid' as any,
    };
    // @ts-ignore - accessing private method for testing
    service.validateScheduleData(invalidData);
    console.log('✗ Test 1 failed: Should have thrown error for invalid frequency');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid frequency')) {
      console.log('✓ Test 1 passed: Rejects invalid frequency');
      passed++;
    } else {
      console.log('✗ Test 1 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 2: Invalid time format (hour > 23)
  try {
    const invalidData = {
      ...getValidScheduleData(),
      timeOfDay: '25:00',
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 2 failed: Should have thrown error for invalid time format');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid time format')) {
      console.log('✓ Test 2 passed: Rejects invalid time format');
      passed++;
    } else {
      console.log('✗ Test 2 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 3: Invalid time format (wrong format)
  try {
    const invalidData = {
      ...getValidScheduleData(),
      timeOfDay: '14:30:00',
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 3 failed: Should have thrown error for invalid time format');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Invalid time format')) {
      console.log('✓ Test 3 passed: Rejects time with seconds');
      passed++;
    } else {
      console.log('✗ Test 3 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 4: Start date in the past
  try {
    const invalidData = {
      ...getValidScheduleData(),
      startDate: '2020-01-01',
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 4 failed: Should have thrown error for past start date');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Start date cannot be in the past')) {
      console.log('✓ Test 4 passed: Rejects past start date');
      passed++;
    } else {
      console.log('✗ Test 4 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 5: End date before start date
  try {
    const tomorrow = new Date(Date.now() + 86400000);
    const today = new Date();
    const invalidData = {
      ...getValidScheduleData(),
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: today.toISOString().split('T')[0],
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 5 failed: Should have thrown error for end date before start date');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('End date must be after start date')) {
      console.log('✓ Test 5 passed: Rejects end date before start date');
      passed++;
    } else {
      console.log('✗ Test 5 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 6: Empty recipients array
  try {
    const invalidData = {
      ...getValidScheduleData(),
      paymentConfig: {
        recipients: [],
      },
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 6 failed: Should have thrown error for empty recipients');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('At least one recipient is required')) {
      console.log('✓ Test 6 passed: Rejects empty recipients array');
      passed++;
    } else {
      console.log('✗ Test 6 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 7: Empty wallet address
  try {
    const invalidData = {
      ...getValidScheduleData(),
      paymentConfig: {
        recipients: [
          {
            walletAddress: '',
            amount: '100.00',
            assetCode: 'USDC',
          },
        ],
      },
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 7 failed: Should have thrown error for empty wallet address');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Wallet address is required')) {
      console.log('✓ Test 7 passed: Rejects empty wallet address');
      passed++;
    } else {
      console.log('✗ Test 7 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 8: Zero amount
  try {
    const invalidData = {
      ...getValidScheduleData(),
      paymentConfig: {
        recipients: [
          {
            walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            amount: '0',
            assetCode: 'USDC',
          },
        ],
      },
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 8 failed: Should have thrown error for zero amount');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Amount must be greater than 0')) {
      console.log('✓ Test 8 passed: Rejects zero amount');
      passed++;
    } else {
      console.log('✗ Test 8 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 9: Negative amount
  try {
    const invalidData = {
      ...getValidScheduleData(),
      paymentConfig: {
        recipients: [
          {
            walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            amount: '-10.00',
            assetCode: 'USDC',
          },
        ],
      },
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 9 failed: Should have thrown error for negative amount');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Amount must be greater than 0')) {
      console.log('✓ Test 9 passed: Rejects negative amount');
      passed++;
    } else {
      console.log('✗ Test 9 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 10: Empty asset code
  try {
    const invalidData = {
      ...getValidScheduleData(),
      paymentConfig: {
        recipients: [
          {
            walletAddress: 'GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX',
            amount: '100.00',
            assetCode: '',
          },
        ],
      },
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 10 failed: Should have thrown error for empty asset code');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Asset code is required')) {
      console.log('✓ Test 10 passed: Rejects empty asset code');
      passed++;
    } else {
      console.log('✗ Test 10 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 11: Memo too long
  try {
    const invalidData = {
      ...getValidScheduleData(),
      paymentConfig: {
        recipients: getValidScheduleData().paymentConfig.recipients,
        memo: 'This memo is way too long and exceeds the limit',
      },
    };
    // @ts-ignore
    service.validateScheduleData(invalidData);
    console.log('✗ Test 11 failed: Should have thrown error for memo too long');
    failed++;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Memo cannot exceed 28 characters')) {
      console.log('✓ Test 11 passed: Rejects memo longer than 28 characters');
      passed++;
    } else {
      console.log('✗ Test 11 failed: Wrong error thrown');
      console.log('  Error:', error);
      failed++;
    }
  }

  // Test 12: Valid data should pass
  try {
    const validData = getValidScheduleData();
    // @ts-ignore
    service.validateScheduleData(validData);
    console.log('✓ Test 12 passed: Accepts valid schedule data');
    passed++;
  } catch (error) {
    console.log('✗ Test 12 failed: Should not have thrown error for valid data');
    console.log('  Error:', error);
    failed++;
  }

  // Test 13: Valid data with memo should pass
  try {
    const validData = {
      ...getValidScheduleData(),
      paymentConfig: {
        recipients: getValidScheduleData().paymentConfig.recipients,
        memo: 'Valid memo',
      },
    };
    // @ts-ignore
    service.validateScheduleData(validData);
    console.log('✓ Test 13 passed: Accepts valid schedule data with memo');
    passed++;
  } catch (error) {
    console.log('✗ Test 13 failed: Should not have thrown error for valid data with memo');
    console.log('  Error:', error);
    failed++;
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Test Results: ${passed} passed, ${failed} failed`);
  console.log(`${'='.repeat(50)}`);

  if (failed === 0) {
    console.log('\n✓ All validation tests passed!');
    process.exit(0);
  } else {
    console.log('\n✗ Some tests failed');
    process.exit(1);
  }
}

testValidation();
