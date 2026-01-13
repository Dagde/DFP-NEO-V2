// Test script to verify Railway DB connection and staff data
console.log('=== Testing Railway Database Connection ===\n');

// This will be called from the browser to test the actual API
console.log('To test the actual database:');
console.log('1. Deploy the changes to Railway');
console.log('2. Visit: https://your-railway-app.com/api/debug/staff-count');
console.log('3. This will return the actual staff count from Railway Postgres');
console.log('\nExpected Response Format:');
console.log(JSON.stringify({
  status: 'success',
  database: 'Railway Postgres',
  totalPersonnel: 123,
  realStaffCount: 45,
  mockdataCount: 78,
  exampleStaff: {
    id: 'clxxx...',
    userId: 'clxxx...',
    name: 'Smith, John',
    rank: 'SQLDR',
    role: 'QFI',
    category: 'B',
    idNumber: 1234567,
    isActive: true,
    createdAt: '2024-01-10T00:00:00.000Z'
  },
  allStaff: [...]
}, null, 2));