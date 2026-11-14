'use client';
import { useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, readSession, type Session } from './api';
export function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      await api('/api/auth/login', {
        method: 'POST',
        body: { email: String(data.get('email')).trim(), password: String(data.get('password')) },
      });
      readSession(await api<Session>('/api/auth/me'));
      form.reset();
      router.replace('/workspace');
      router.refresh();
    } catch {
      setError('We could not sign you in. Check the email and password, then try again.');
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      const password = form.elements.namedItem('password');
      if (password instanceof HTMLInputElement) password.value = '';
      setBusy(false);
    }
  }
  return (
    <main id="main" tabIndex={-1} className="login-page">
      <section className="login-intro" aria-labelledby="system-title">
        <div className="faculty-identity">
          <Image
            src="/foe-logo.png"
            width={500}
            height={114}
            alt="Faculty of Engineering, University of Sri Jayewardenepura"
            priority
          />
        </div>
        <div className="system-intro">
          <span className="gold-rule" />
          <p className="eyebrow">LABORATORY ADMINISTRATION</p>
          <h1 id="system-title">Inventory &amp; Equipment Lending Management System</h1>
          <p>
            A secure operational workspace for laboratory inventory, approvals, equipment custody
            and returns.
          </p>
        </div>
        <p className="system-note">Authorized faculty staff and students only</p>
      </section>
      <section className="login-panel">
        <div className="login-card">
          <div className="login-card-heading">
            <p className="eyebrow">SYSTEM ACCESS</p>
            <h2>Sign in</h2>
            <p>Use your assigned university account to continue.</p>
          </div>
          <form onSubmit={submit} className="login-form" aria-busy={busy}>
            {error && (
              <div
                ref={errorRef}
                tabIndex={-1}
                role="alert"
                id="login-error"
                className="login-error"
              >
                <strong>Sign-in unsuccessful</strong>
                <span>{error}</span>
              </div>
            )}
            <div>
              <label htmlFor="email">Email address</label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                placeholder="name@sjp.ac.lk"
                required
                maxLength={254}
                disabled={busy}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <div>
              <div className="field-heading">
                <label htmlFor="password">Password</label>
                <span>Case sensitive</span>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                disabled={busy}
                aria-describedby={error ? 'login-error' : undefined}
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? 'Verifying account…' : 'Sign in'}
            </Button>
          </form>
          <div className="border-t border-border/70 pt-5 mt-5">
            <p className="text-sm font-semibold mb-2">New student?</p>
            <p className="text-xs text-muted-foreground mb-4">Use your university Google account to create or access a student account.</p>
            <Button variant="outline" className="w-full" asChild>
              <a href="/api/google/start" aria-label="Continue with university Google account">
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path fill="#4285F4" d="M21.6 12.22c0-.71-.06-1.39-.18-2.04H12v3.86h5.38a4.6 4.6 0 0 1-2 3.03v2.52h3.23c1.89-1.74 2.99-4.3 2.99-7.37Z"/>
                  <path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.61-2.41l-3.23-2.52c-.9.6-2.05.96-3.38.96-2.6 0-4.79-1.76-5.58-4.12H3.09v2.6A10 10 0 0 0 12 22Z"/>
                  <path fill="#FBBC05" d="M6.42 13.91A6 6 0 0 1 6.1 12c0-.66.12-1.3.32-1.91V7.48H3.09A10 10 0 0 0 2 12c0 1.62.39 3.15 1.09 4.52l3.33-2.61Z"/>
                  <path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.83 1.5l2.87-2.87C16.95 2.94 14.69 2 12 2a10 10 0 0 0-8.91 5.48l3.33 2.61C7.21 7.73 9.4 5.97 12 5.97Z"/>
                </svg>
                Continue with Google
              </a>
            </Button>
          </div>
          <div className="login-support">
            <strong>Having trouble signing in?</strong>
            <p>Contact your laboratory administrator to confirm that your account is active.</p>
          </div>
        </div>
        <p className="login-footer">Secure local development environment · Access is logged</p>
      </section>
    </main>
  );
}
