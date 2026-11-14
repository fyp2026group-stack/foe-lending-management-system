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
