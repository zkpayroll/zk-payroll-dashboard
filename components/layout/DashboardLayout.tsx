import { cookies } from 'next/headers';
import DashboardShell from './DashboardShell';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import type { UserRole } from '@/types';

async function getCurrentRole(): Promise<UserRole> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return 'operator';

  const session = await verifySessionToken(token);
  return session?.role ?? 'operator';
}

async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();

  return (
    <DashboardShell role={role}>
      {children}
    </DashboardShell>
  );
}

export default DashboardLayout;
