import { redirect } from 'next/navigation';

export default function RootPage() {
  // Redirect to flight-school app
  redirect('/flight-school');
}