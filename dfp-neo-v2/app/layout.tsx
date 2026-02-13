import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'DFP-NEO | Daily Flying Program',
  description: 'Advanced flight scheduling and management system',
  icons: {
    icon: '/images/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Log build info on server side
  if (typeof window === 'undefined') {
    console.log("Build SHA:", process.env.NEXT_PUBLIC_GIT_SHA || 'not set');
    console.log("Build Time:", process.env.NEXT_PUBLIC_BUILD_TIME || 'not set');
  }
  
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{
          __html: `console.log("Build SHA:", "${process.env.NEXT_PUBLIC_GIT_SHA || 'not set'}");
                   console.log("Build Time:", "${process.env.NEXT_PUBLIC_BUILD_TIME || 'not set'}");`
        }} />
      </body>
    </html>
  );
}