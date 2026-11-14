'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

type Option = { id: string; name: string };
type Registration = { email: string; name: string; batches: Option[] };
const messages: Record<string, string> = {
  DUPLICATE_STUDENT_RECORD: 'This student index or registration number is already in use. Contact the laboratory administrator.',
  EXISTING_ACCOUNT_CONTACT_ADMIN: 'An account already uses this university email. Contact an administrator to link your Google sign-in securely.',
  ALREADY_REGISTERED: 'This Google account has already been registered. Sign in again.',
  INVALID_BATCH: 'Choose an active academic batch.',
  INVALID_STUDENT_PROFILE: 'Check the required profile fields and try again.',
  SIGNUP_EXPIRED: 'Your Google registration session expired. Sign in with Google again.',
};
export function StudentRegistration() {
  const router = useRouter();
  const [ready, setReady] = useState<Registration | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [batchId, setBatchId] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/google/profile', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal })
      .then(async response => {
        if (response.status === 401) { router.replace('/login?google=expired'); return null; }
        if (!response.ok) throw new Error('Unable to load university registration options.');
        return response.json() as Promise<Registration>;
      })
      .then(result => { if (!controller.signal.aborted && result) setReady(result); })
      .catch(() => { if (!controller.signal.aborted) setError('Unable to load registration options. Please retry sign-in.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [router]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || !batchId || busy) return;
    const fields = new FormData(event.currentTarget);
    setError('');
    setBusy(true);
    const payload = {
      indexNumber: String(fields.get('indexNumber') ?? '').trim(),
      registrationNumber: String(fields.get('registrationNumber') ?? '').trim(),
      fullName: String(fields.get('fullName') ?? '').trim(),
      batchId,
      department: String(fields.get('department') ?? '').trim(),
      phone: String(fields.get('phone') ?? '').trim(),
      universityEmail: ready.email,
      personalEmail: String(fields.get('personalEmail') ?? '').trim(),
    };
    try {
      const response = await fetch('/api/google/profile', {
        method: 'POST', cache: 'no-store', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { code?: string };
        if (response.status === 401) { router.replace('/login?google=expired'); return; }
        setError(messages[data.code ?? ''] ?? 'Registration could not be completed. Please check your information.');
        return;
      }
      router.replace('/workspace');
      router.refresh();
    } catch {
      setError('Unable to reach the server. Check your connection and retry.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <main id="main" className="min-h-screen bg-[#f5f6f8] px-4 py-8 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Image src="/foe-logo.png" width={250} height={57}
            alt="University of Sri Jayewardenepura Faculty of Engineering" priority />
          <span className="text-xs font-semibold tracking-wide text-[#7b1c2a]">STUDENT REGISTRATION</span>
        </div>
        <Card className="rounded-xl border-[#dfe3e8] shadow-sm">
          <CardHeader className="space-y-2 border-b pb-6">
            <p className="text-xs font-semibold tracking-widest text-[#861727]">FIRST-TIME ACCOUNT SETUP</p>
            <CardTitle className="text-2xl tracking-tight">Complete your student profile</CardTitle>
            <CardDescription>
              Use your verified university Google account. These details help identify you for equipment borrowing.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? <p role="status">Checking university sign-in…</p> : null}
            {error && <Alert variant="destructive" className="mb-5"><AlertDescription>{error}</AlertDescription></Alert>}
            {ready && (
              <form id="student-registration" onSubmit={submit} className="grid gap-5">
                <div className="rounded-lg border bg-muted/30 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Verified university email</p>
                  <p className="mt-1 text-sm font-semibold">{ready.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">This address comes from your verified Google account and cannot be edited here.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">Index number *
                    <Input name="indexNumber" required minLength={3} maxLength={40} autoComplete="off" placeholder="University index number" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">Registration number *
                    <Input name="registrationNumber" required minLength={3} maxLength={80} autoComplete="off" placeholder="University registration number" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">Academic batch *
                    <Select value={batchId} onValueChange={setBatchId}>
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select your batch" /></SelectTrigger>
                      <SelectContent>{ready.batches.map(batch => <SelectItem key={batch.id} value={batch.id}>{batch.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </label>
                  <label className="grid gap-2 text-sm font-medium">Department *
                    <Input name="department" required minLength={2} maxLength={120} placeholder="Your department" />
                  </label>
                </div>
                <label className="grid gap-2 text-sm font-medium">Full name *
                  <Input name="fullName" required minLength={3} maxLength={120} defaultValue={ready.name} autoComplete="name" />
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-2 text-sm font-medium">Phone number *
                    <Input name="phone" type="tel" required minLength={7} maxLength={25} autoComplete="tel" placeholder="+94…" />
                  </label>
                  <label className="grid gap-2 text-sm font-medium">Personal email (optional)
                    <Input name="personalEmail" type="email" maxLength={254} autoComplete="email" placeholder="you@example.com" />
                  </label>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Your details will be used for authorized laboratory borrowing and account administration.
                  Your assigned batch and student identity may be reviewed by a laboratory administrator.
                </p>
              </form>
            )}
          </CardContent>
          {ready && <CardFooter className="flex items-center justify-end gap-3 border-t pt-5">
            <Button type="button" variant="outline" onClick={() => router.replace('/login')}>Cancel</Button>
            <Button type="submit" form="student-registration" disabled={busy || !batchId}
              className="bg-[#861727] hover:bg-[#6f1521]">
              {busy ? 'Creating account…' : 'Create student account'}
            </Button>
          </CardFooter>}
        </Card>
      </div>
    </main>
  );
}
