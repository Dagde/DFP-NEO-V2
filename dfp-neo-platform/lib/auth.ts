import NextAuth, { DefaultSession } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaClient, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Extend the built-in session types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      userId: string;
      displayName: string | null;
      email: string | null;
      status: UserStatus;
      permissionsRole: {
        id: string;
        name: string;
      };
      mustChangePassword: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    userId: string;
    displayName: string | null;
    email: string | null;
    status: UserStatus;
    permissionsRole: {
      id: string;
      name: string;
    };
    mustChangePassword: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
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

        const user = await prisma.user.findUnique({
          where: { userId: credentials.userId as string },
          include: { permissionsRole: true },
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
          displayName: user.displayName,
          email: user.email,
          status: user.status,
          permissionsRole: user.permissionsRole,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.userId;
        token.displayName = user.displayName;
        token.email = user.email;
        token.status = user.status;
        token.permissionsRole = user.permissionsRole;
        token.mustChangePassword = user.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub || '';
        session.user.userId = token.userId as string;
        session.user.displayName = token.displayName as string;
        session.user.email = token.email as string;
        session.user.status = token.status as UserStatus;
        session.user.permissionsRole = token.permissionsRole as { id: string; name: string; };
        session.user.mustChangePassword = token.mustChangePassword as boolean;
      }
      return session;
    },
  },
});