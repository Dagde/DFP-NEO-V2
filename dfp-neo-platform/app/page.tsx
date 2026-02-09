import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';

export default async function Home() {
  const session = await auth();
  
  if (session?.user) {
    redirect('/flight-school');
  } else {
    redirect('/login');
  }
}