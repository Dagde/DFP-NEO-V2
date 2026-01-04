import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';

// Mock user data for development (matching admin API mock users)
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

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        console.log('🔍 Auth attempt received');
        console.log('📝 Username:', credentials?.username);
        
        if (!credentials?.username || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          // Use mock users for now since database is not connected
          const user = mockUsers.find(u => u.username === credentials.username);

          if (!user || !user.isActive) {
            console.log('❌ User not found or inactive:', credentials.username);
            return null;
          }

          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );

          if (!isPasswordValid) {
            console.log('❌ Invalid password for:', credentials.username);
            return null;
          }

          console.log('✅ Authentication successful for:', credentials.username);

          // Update last login
          user.lastLogin = new Date().toISOString();

          return {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
          };
        } catch (error) {
          console.error('Authentication error:', error);
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
};