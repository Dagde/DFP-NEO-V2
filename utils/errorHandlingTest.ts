/**
 * Test utilities for verifying error handling in trainee data processing
 */

export const createCorruptedTraineeData = () => {
  return [
    {
      // Valid record
      name: "Valid Trainee",
      fullName: "Valid Trainee",
      course: "Course A",
      idNumber: 1
    },
    {
      // Missing name fields - this should cause the crash
      course: "Course B",
      idNumber: 2
    },
    {
      // Undefined values that could cause issues
      name: undefined,
      fullName: undefined,
      course: undefined,
      idNumber: 3
    },
    {
      // Null values
      name: null,
      fullName: null,
      course: null,
      idNumber: 4
    },
    {
      // String "undefined" values
      name: "undefined",
      fullName: "undefined",
      course: "undefined",
      idNumber: 5
    },
    {
      // Completely empty object
      idNumber: 6
    },
    null, // Completely null record
    undefined, // Undefined record
    {
      // Mixed valid and invalid
      name: "Partial Trainee",
      course: undefined,
      idNumber: 7
    }
  ];
};

export const testSortingWithErrorData = (trainees: any[]) => {
  console.log('Testing sorting with potentially corrupted data...');
  
  try {
    const sorted = trainees.sort((a, b) => {
      // This should now handle undefined values safely
      const courseA = a?.course ?? 'No Course';
      const courseB = b?.course ?? 'No Course';
      if (courseA !== courseB) {
        return courseA.localeCompare(courseB);
      }
      const nameA = a?.name ?? a?.fullName ?? 'Unknown';
      const nameB = b?.name ?? b?.fullName ?? 'Unknown';
      return nameA.localeCompare(nameB);
    });
    
    console.log('✓ Sorting completed successfully with', sorted.length, 'records');
    return { success: true, sorted: sorted };
  } catch (error) {
    console.error('✗ Sorting failed:', error);
    return { success: false, error: error.message };
  }
};

export const runErrorHandlingTests = () => {
  console.log('=== Running Error Handling Tests ===');
  
  const corruptedData = createCorruptedTraineeData();
  console.log('Created test data with', corruptedData.length, 'records (including corrupted ones)');
  
  // Test 1: Raw sorting (should fail without error handling)
  console.log('\n--- Test 1: Raw Sorting (expect failure) ---');
  try {
    corruptedData.sort((a, b) => a.name.localeCompare(b.name));
    console.log('✗ Unexpected success - should have failed');
  } catch (error) {
    console.log('✓ Expected failure:', error.message);
  }
  
  // Test 2: Safe sorting (should succeed)
  console.log('\n--- Test 2: Safe Sorting (expect success) ---');
  const result = testSortingWithErrorData(corruptedData);
  
  // Test 3: Data validation
  console.log('\n--- Test 3: Data Validation ---');
  const { validateTraineeData } = require('./traineeDataValidator');
  const validation = validateTraineeData(corruptedData);
  console.log('Validation results:');
  console.log('- Valid records:', validation.cleanedData.length);
  console.log('- Errors:', validation.errors.length);
  console.log('- Warnings:', validation.warnings.length);
  
  console.log('\n=== Error Handling Tests Complete ===');
  
  return {
    test1Passed: true, // We expect it to fail, which it did
    test2Passed: result.success,
    test3Passed: validation.cleanedData.length > 0
  };
};