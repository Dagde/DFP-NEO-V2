import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      username: string;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    username: string;
    email?: string | null;
    role: string;
    name?: string | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    username: string;
  }
}