"use client";

import { Bell, Search, User } from "lucide-react";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

function Header({ role }: { role: UserRole }) {
  const triggerPalette = () => {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  };

  return (
    <header className="flex items-center justify-between pl-16 pr-6 py-4 md:px-6 bg-white shadow-sm border-b">
      <button
        type="button"
        onClick={triggerPalette}
        className="flex items-center text-left bg-gray-50 border border-gray-200 hover:border-gray-300 rounded-lg px-3 py-1.5 w-64 text-gray-400 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        aria-label="Search actions (shortcut: Command + K)"
      >
        <Search className="w-4 h-4 text-gray-400 shrink-0 mr-2" aria-hidden="true" />
        <span className="text-xs flex-1 text-gray-500">Search commands...</span>
        <span className="hidden sm:flex items-center gap-0.5 text-[9px] font-bold text-gray-400 bg-white border px-1.5 py-0.5 rounded shadow-sm shrink-0">
          <span>⌘</span><span>K</span>
        </span>
      </button>

      <div className="flex items-center space-x-4">
        <button
          className="text-gray-600 hover:text-gray-800 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none focus-visible:rounded"
          aria-label="Notifications"
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
        </button>
        <div
          className="flex items-center space-x-2"
          role="group"
          aria-label="User profile"
        >
          <div
            className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0"
            aria-hidden="true"
          >
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <span className="hidden sm:inline text-sm font-medium text-gray-700">{ROLE_LABELS[role]}</span>
        </div>
      </div>
    </header>
  );
}

export default Header;
