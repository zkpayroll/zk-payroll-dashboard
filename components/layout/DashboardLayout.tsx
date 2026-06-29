import { cookies } from 'next/headers';
import Header from './Header';
import Sidebar from './Sidebar';
import EnvironmentBanner from './EnvironmentBanner';
import CommandPaletteProvider from './CommandPaletteProvider';
import PrintAuditReport from '../features/transactions/PrintAuditReport';
import { SESSION_COOKIE_NAME, verifySessionToken } from '@/lib/auth/session';
import type { UserRole } from '@/types';

async function getCurrentRole(): Promise<UserRole> {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return 'operator';

  const session = await verifySessionToken(token);
  return session?.role ?? 'operator';
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const role = await getCurrentRole();

  return (
    <>
      <div className="flex h-screen bg-gray-100 print:hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Sidebar role={role} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <EnvironmentBanner />
          <Header role={role} />
          <main
            id="main-content"
            className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>

      <CommandPaletteProvider />
      <PrintAuditReport />
    </>
  );
}
