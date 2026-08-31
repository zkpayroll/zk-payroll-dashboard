
"use client";

import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Home,
  Users,
  Settings,
  History,
  Archive,
  Shield,
  ShieldCheck,
  Play,
  Building2,
  Landmark,
  CalendarDays,
  Menu,
  X,
  FileSearch,
  AlertTriangle,
  ClipboardList,
  Upload,
  FileDown,
  Gavel,
  Scale
} from "lucide-react";
import { getNavigationForRole, ROLE_LABELS } from "@/lib/auth/roles";
import type { NavigationItem } from "@/lib/auth/roles";
import type { UserRole } from "@/types";
import { useSidebarBadges } from "@/hooks/useSidebarBadges";
import type { SidebarBadges } from "@/hooks/useSidebarBadges";

// Icons map for role-based navigation layout strings
const icons: Record<NavigationItem["icon"], React.ComponentType<{ className?: string }>> = {
  home: Home,
  users: Users,
  settings: Settings,
  history: History,
  archive: Archive,
  shield: Shield,
  play: Play,
  building: Building2,
  treasury: Landmark,
  calendar: CalendarDays,
  "file-search": FileSearch,
  alert: AlertTriangle,
  clipboard: ClipboardList,
  upload: Upload,
  download: FileDown,
  gavel: Gavel,
};

const BADGE_HREF_MAP: Partial<Record<keyof SidebarBadges, string>> = {
  executePayroll: "/payroll/execute",
  compliance: "/compliance",
  employees: "/employees",
};

function SidebarBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      className="ml-auto bg-red-500 text-white text-xs font-bold rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none"
      aria-label={`${count} item${count === 1 ? "" : "s"} require attention`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}

// Global static layout links array including both branches' additions
const NAV_LINKS = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/employees", icon: Users, label: "Employees" },
  { href: "/employees/bulk-exceptions", icon: AlertTriangle, label: "Bulk Exceptions" },
  { href: "/payroll/schedule", icon: CalendarDays, label: "Payroll Schedule" },
  { href: "/payroll/execute", icon: Play, label: "Execute Payroll" },
  { href: "/payroll/verify", icon: ShieldCheck, label: "Verify Proof" },
  { href: "/history", icon: History, label: "History" },
  { href: "/history/archived", icon: Archive, label: "Archived Payrolls" },
  { href: "/exports", icon: FileDown, label: "Exports" },
  { href: "/treasury", icon: Landmark, label: "Treasury" },
  { href: "/reconciliation", icon: Scale, label: "Reconciliation" },
  { href: "/compliance", icon: Shield, label: "Compliance" },
  { href: "/setup", icon: Building2, label: "Company Setup" },
  { href: "/incidents", icon: AlertTriangle, label: "Incidents" },
  { href: "/settings", icon: Settings, label: "Settings" },
];

function NavLinks({ onClick, badges }: { onClick?: () => void; badges?: SidebarBadges }) {
  const pathname = usePathname() ?? "/";
  return (
    <nav aria-label="Main navigation" className="mt-6">
      {NAV_LINKS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || (href !== "/" && pathname.startsWith(href));
        const badgeKey = Object.entries(BADGE_HREF_MAP).find(([, h]) => h === href)?.[0] as keyof SidebarBadges | undefined;
        const count = badgeKey && badges ? badges[badgeKey] : 0;
        return (
          <a
            key={href}
            href={href}
            onClick={onClick}
            aria-current={active ? "page" : undefined}
            className={`flex items-center px-6 py-3 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
              active ? "bg-gray-100 text-gray-900 border-r-4 border-blue-500" : "text-gray-600"
            }`}
          >
            <Icon className="w-5 h-5 mr-3" aria-hidden="true" />
            {label}
            <SidebarBadge count={count} />
          </a>
        );
      })}
    </nav>
  );
}

export function DesktopRoleSidebar({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const items = getNavigationForRole(role);
  const badges = useSidebarBadges();

  return (
    <div className="hidden md:block w-64 bg-white shadow-md flex-shrink-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-800">ZK Payroll</h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-indigo-600">
          {ROLE_LABELS[role]} workspace
        </p>
      </div>
      <nav className="mt-6" aria-label={`${ROLE_LABELS[role]} navigation`}>
        {items.map((item) => {
          const Icon = icons[item.icon] || Home;
          const disabled = item.access?.[role] === "disabled";
          const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
          const badgeKey = Object.entries(BADGE_HREF_MAP).find(([, h]) => h === item.href)?.[0] as keyof SidebarBadges | undefined;
          const count = badgeKey ? badges[badgeKey] : 0;

          if (disabled) {
            return (
              <span
                key={item.href}
                className="flex items-center px-6 py-3 text-gray-400 cursor-not-allowed"
                aria-disabled="true"
                title={item.disabledReason?.[role]}
              >
                <Icon className="w-5 h-5 mr-3" aria-hidden="true" />
                {item.label}
              </span>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-6 py-3 text-gray-600 hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500 ${
                active
                  ? "bg-gray-100 border-r-4 border-blue-500 text-gray-700"
                  : ""
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="w-5 h-5 mr-3" aria-hidden="true" />
              {item.label}
              <SidebarBadge count={count} />
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export default function Sidebar({ role }: { role?: UserRole } = {}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const badges = useSidebarBadges();

  useEffect(() => {
    if (open) {
      closeBtnRef.current?.focus();
    }
  }, [open]);

  return (
    <>
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
              <h1 className="text-xl font-bold text-gray-800">ZK Payroll</h1>
              <button
                ref={closeBtnRef}
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded-md text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                aria-label="Close navigation menu"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <NavLinks onClick={() => setOpen(false)} badges={badges} />
          </div>
        </>
      )}

      {/* Desktop layout workspace logic toggle */}
      {role ? (
        <DesktopRoleSidebar role={role} />
      ) : (
        <div className="hidden md:block w-64 bg-white shadow-md flex-shrink-0">
          <div className="p-6">
            <h1 className="text-2xl font-bold text-gray-800">ZK Payroll</h1>
          </div>
          <NavLinks badges={badges} />
        </div>
      )}
    </>
  );
}