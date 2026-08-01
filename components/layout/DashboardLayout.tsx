
"use client";

import { useEffect, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";
import EnvironmentBanner from "./EnvironmentBanner";
import CommandPalette from "./CommandPalette";
import PrintAuditReport from "../features/transactions/PrintAuditReport";
import AuditorAccessExpirationBanner from "../features/compliance/AuditorAccessExpirationBanner";

function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isPaletteOpen, setIsPaletteOpen] = useState(false);

  useEffect(() => {
    const handleOpen = () => setIsPaletteOpen(true);
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === "k") {
        e.preventDefault();
        setIsPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("open-command-palette", handleOpen);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("open-command-palette", handleOpen);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <>
      <div className="flex h-screen bg-gray-100 print:hidden">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-md focus:shadow-lg"
        >
          Skip to main content
        </a>
        <Sidebar />
        <div className="flex-1 flex flex-col overflow-hidden">
          <EnvironmentBanner />
          <div className="px-6 pt-4 print:hidden" data-testid="auditor-expiration-banner-wrapper">
            <AuditorAccessExpirationBanner />
          </div>
          <Header />
          <main
            id="main-content"
            className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-6"
            tabIndex={-1}
          >
            {children}
          </main>
        </div>
      </div>

      <CommandPalette isOpen={isPaletteOpen} onClose={() => setIsPaletteOpen(false)} />
      <PrintAuditReport />
    </>
  );
}

export default DashboardLayout;
