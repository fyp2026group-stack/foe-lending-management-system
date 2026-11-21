import type { ReactNode } from 'react';
import './globals.css';
import { AppSessionShell } from '@/components/identity/app-session-shell';

export const metadata = {
  title: 'University Laboratory Management',
  description: 'Secure laboratory inventory, equipment lending and custody management.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <AppSessionShell>{children}</AppSessionShell>
      </body>
    </html>
  );
}
