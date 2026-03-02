import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        userId: { label: 'User ID', type: 'text' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.userId || !credentials?.password) {
          return null
        }

        const user = await prisma.user.findUnique({
          where: {
            userId: credentials.userId
          },
          include: {
            role: {
              include: {
                capabilities: true
              }
            }
          }
        })

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(
          credentials.password,
          user.password
        )

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          userId: user.userId,
          email: user.email,
          name: user.name,
          role: user.role.name,
          capabilities: user.role.capabilities.map(cap => cap.name),
          mustChangePassword: user.mustChangePassword,
          status: user.status
        }
      }
    })
  ],
  session: {
    strategy: 'jwt'
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.userId
        token.role = user.role
        token.capabilities = user.capabilities
        token.mustChangePassword = user.mustChangePassword
        token.status = user.status
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.sub!
        session.user.userId = token.userId as string
        session.user.role = token.role as string
        session.user.capabilities = token.capabilities as string[]
        session.user.mustChangePassword = token.mustChangePassword as boolean
        session.user.status = token.status as string
      }
      return session
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
}