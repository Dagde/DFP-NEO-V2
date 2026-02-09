import NextAuth, { DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Use original database for authentication
const authPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.ORIGINAL_DATABASE_URL,
    },
  },
});

// Use V2 database for other operations
const prisma = new PrismaClient();

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      userId: string;
      username: string;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      isActive: boolean;
      role: Role;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    userId: string;
    username: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
    isActive: boolean;
    role: Role;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // Use Railway public domain for NextAuth URL to ensure cookies work correctly
  ...(process.env.RAILWAY_PUBLIC_DOMAIN && {
    trustHost: true,
  }),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        userId: { label: 'User ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.userId || !credentials?.password) {
          return null;
        }

        // Authenticate against original database
        const user = await authPrisma.user.findUnique({
          where: { userId: credentials.userId as string },
        });

        if (!user || !user.password) {
          return null;
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          userId: user.userId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          isActive: user.isActive,
          role: user.role,
          username: user.username,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.userId;
        token.username = user.username;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
        token.email = user.email;
        token.isActive = user.isActive;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub || '';
        session.user.userId = token.userId as string;
        session.user.username = token.username as string;
        session.user.firstName = token.firstName as string | null;
        session.user.lastName = token.lastName as string | null;
        session.user.email = token.email as string;
        session.user.isActive = token.isActive as boolean;
        session.user.role = token.role as Role;
      }
      return session;
    },
  },
});