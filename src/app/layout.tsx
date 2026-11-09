import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Laboratory workspace | M1 foundation',
  description: 'Local laboratory inventory interface foundation with synthetic content.',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <html lang="en"><body><a className="skip-link" href="#main">Skip to content</a>{children}</body></html>;
}
