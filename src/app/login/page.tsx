import { Login } from '@/components/identity/login';
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ google?: string | string[] }>;
}) {
  const { google } = await searchParams;
  return <Login googleStatus={typeof google === 'string' ? google : undefined} />;
}
