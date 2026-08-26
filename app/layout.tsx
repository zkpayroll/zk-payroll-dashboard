import type { Metadata } from "next";
import { StellarProvider } from '@/components/providers/StellarProvider';
import { StellarDebugPanel } from '@/components/debug/StellarDebugPanel';
import { MonitoringProvider } from '@/components/providers/MonitoringProvider';
import { Toaster } from "@/components/ui/sonner";
import { HelpDrawer } from "@/components/ui/HelpDrawer";
import { RetryToastCenter } from "@/components/features/network/RetryToastCenter";
import { ContractErrorDrawer } from "@/components/features/errors/ContractErrorDrawer";
import "./globals.css";
export const metadata: Metadata = {
  title: "ZK Payroll Dashboard",
  description: "A zero-knowledge payroll dashboard application.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StellarProvider>
          <MonitoringProvider />
          {children}
          <HelpDrawer />
          <RetryToastCenter />
          <ContractErrorDrawer />
          {process.env.NODE_ENV === 'development' && <StellarDebugPanel />}
          <Toaster />
        </StellarProvider>
      </body>
    </html>
  );
}

