'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Users, Settings, History, Shield, Play, Building2, Landmark, FileSearch, AlertTriangle, ClipboardList, Upload, Menu, X } from 'lucide-react';
import { getNavigationForRole, ROLE_LABELS } from '@/lib/auth/roles';
import type { NavigationItem } from '@/lib/auth/roles';
import type { UserRole } from '@/types';

const icons: Record<NavigationItem['icon'], React.ComponentType<{ className?: string }>> = {
  home: Home,
  users: Users,
  settings: Settings,
  history: History,
  shield: Shield,
  play: Play,
  building: Building2,
  treasury: Landmark,
  'file-search': FileSearch,
  alert: AlertTriangle,
  clipboard: ClipboardList,
  upload: Upload,
};

function NavLinks({ role, onClick }: { role: UserRole; onClick?: () => void }) {
  const pathname = usePathname();
  const items = getNavigationForRole(role);

  return (
    <nav className="mt-6" aria-label={`${ROLE_LABELS[role]} navigation`}>
      {items.map((item) => {
        const Icon = icons[item.icon];
        const disabled = item.access?.[role] === 'disabled';
        const active = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
        const className = active
          ? 'flex items-center px-6 py-3 text-gray-700 bg-gray-100 border-r-4 border-indigo-500'
          : 'flex items-center px-6 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500';

        if (disabled) {
          return (
            <span
              key={item.href}
              className="flex items-center px-6 py-3 text-gray-400 cursor-not-allowed"
              aria-disabled="true"
              title={item.disabledReason?.[role]}
            >
              <Icon className="w-5 h-5 mr-3" />
              {item.label}
            </span>
          );
        }

        return (
          <Link key={item.href} className={className} href={item.href} aria-current={active ? 'page' : undefined} onClick={onClick}>
            <Icon className="w-5 h-5 mr-3" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function Sidebar({ role }: { role: UserRole }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-md bg-white shadow-md text-gray-600 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Open navigation menu"
        aria-expanded={open}
        aria-controls="mobile-nav"
      >
        <Menu className="w-5 h-5" aria-hidden="true" />
      </button>

      {/* Mobile drawer + overlay */}
      {open && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="md:hidden fixed top-0 left-0 z-50 h-full w-64 bg-white shadow-xl"
          >
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h1 className="text-xl font-bold text-gray-800">ZK Payroll</h1>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
                  {ROLE_LABELS[role]}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <NavLinks role={role} onClick={() => setOpen(false)} />
          </div>
        </>
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:block w-64 bg-white shadow-md flex-shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold text-gray-800">ZK Payroll</h1>
          <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
            {ROLE_LABELS[role]} workspace
          </p>
        </div>
        <NavLinks role={role} />
      </div>
    </>
  );
}

export default Sidebar;
