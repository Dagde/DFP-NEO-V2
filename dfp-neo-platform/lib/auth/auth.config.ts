import type { NextAuthConfig } from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/db/prisma';

export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        // Development hardcoded users - remove in production
        const testUsers = [
          { username: 'admin', password: 'admin123', role: 'ADMIN', name: 'Admin User', email: 'admin@dfp-neo.com' },
          { username: 'pilot', password: 'pilot123', role: 'PILOT', name: 'Test Pilot', email: 'pilot@dfp-neo.com' },
          { username: 'instructor', password: 'instructor123', role: 'INSTRUCTOR', name: 'Flight Instructor', email: 'instructor@dfp-neo.com' },
        ];

        const testUser = testUsers.find(user => 
          user.username === credentials.username && user.password === credentials.password
        );

        if (testUser) {
          return {
            id: testUser.username,
            username: testUser.username,
            email: testUser.email,
            role: testUser.role,
            name: testUser.name,
          };
        }

        // Production database code (commented out for development)
        /*
        const user = await prisma.user.findUnique({
          where: { username: credentials.username as string },
        });

        if (!user || !user.isActive) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Update last login
        await prisma.user.update({
          where: { id: user.id },
          data: { lastLogin: new Date() },
        });

        return {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        };
        */
        return null;
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