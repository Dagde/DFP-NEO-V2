const bcrypt = require('bcryptjs');

// Mock user data (same as in auth.config.ts)
const mockUsers = [
  {
    id: '1',
    username: 'admin',
    email: 'admin@dfp-neo.com',
    password: '$2a$10$UQW34KIPs5Cmkg3Ni4.hUuVQInCsT1VVLKTIR78cgtrSqnrpkKvvS', // 'admin123' hashed
    role: 'ADMIN',
    firstName: 'System',
    lastName: 'Administrator',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: new Date().toISOString(),
  },
  {
    id: '2',
    username: 'john.pilot',
    email: 'john.pilot@dfp-neo.com',
    password: '$2a$10$k42WWwZ5MUhk3V0W6W58Dupj1zSkQoJ0Vvbvf2dGiHWwUyYQZomJi', // 'pilot123' hashed
    role: 'PILOT',
    firstName: 'John',
    lastName: 'Smith',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: null,
  },
  {
    id: '3',
    username: 'jane.instructor',
    email: 'jane.instructor@dfp-neo.com',
    password: '$2a$10$eTq2oMUhI9R8MMoU0CGuX.VCZ66NQD/a/JVKdqorD/PXdmWTOttA6', // 'instructor123' hashed
    role: 'INSTRUCTOR',
    firstName: 'Jane',
    lastName: 'Wilson',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: null,
  }
];

async function testAuth() {
  console.log('🧪 Testing authentication logic...\n');
  
  const testCases = [
    { username: 'admin', password: 'admin123' },
    { username: 'john.pilot', password: 'pilot123' },
    { username: 'jane.instructor', password: 'instructor123' },
    { username: 'admin', password: 'wrongpassword' },
    { username: 'nonexistent', password: 'anypassword' },
  ];

  for (const testCase of testCases) {
    console.log(`🔍 Testing: ${testCase.username} / ${testCase.password}`);
    
    // Simulate the authorize function
    const credentials = testCase;
    
    if (!credentials?.username || !credentials?.password) {
      console.log('❌ Missing credentials');
      continue;
    }

    const user = mockUsers.find(u => u.username === credentials.username);
    
    if (!user || !user.isActive) {
      console.log('❌ User not found or inactive\n');
      continue;
    }

    const isPasswordValid = await bcrypt.compare(
      credentials.password,
      user.password
    );

    if (!isPasswordValid) {
      console.log('❌ Invalid password\n');
      continue;
    }

    console.log('✅ Authentication successful!\n');
  }
}

testAuth().catch(console.error);