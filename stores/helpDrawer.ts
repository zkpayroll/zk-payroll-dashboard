import { create } from "zustand";

export interface HelpContent {
  title: string;
  description: string;
  sections: Array<{
    heading: string;
    content: string;
  }>;
  tips?: string[];
}

interface HelpDrawerStore {
  isOpen: boolean;
  currentPage: string | null;
  content: HelpContent | null;
  openHelp: (page: string, content: HelpContent) => void;
  closeHelp: () => void;
}

export const useHelpDrawer = create<HelpDrawerStore>((set) => ({
  isOpen: false,
  currentPage: null,
  content: null,
  openHelp: (page, content) =>
    set({ isOpen: true, currentPage: page, content }),
  closeHelp: () => set({ isOpen: false, currentPage: null, content: null }),
}));

export const HELP_CONTENT: Record<string, HelpContent> = {
  payroll: {
    title: "Payroll Processing Help",
    description: "Learn how to initiate and manage payroll runs.",
    sections: [
      {
        heading: "Getting Started",
        content:
          "To start a payroll run, navigate to the Payroll section and click Start Payroll. Select the employees to include and verify the amounts.",
      },
      {
        heading: "Proof Generation",
        content:
          "The system generates a zero-knowledge proof to ensure payroll integrity without revealing sensitive data. This process may take a few moments.",
      },
      {
        heading: "Submission",
        content:
          "After proof generation, review the final summary and confirm to submit the payroll on-chain.",
      },
    ],
    tips: [
      "Always review employee list before initiating payroll",
      "Ensure sufficient wallet balance for transaction fees",
      "Keep your wallet connected throughout the process",
    ],
  },
  compliance: {
    title: "Compliance & Auditing Help",
    description: "Understand compliance features and audit procedures.",
    sections: [
      {
        heading: "View Keys",
        content:
          "Generate view keys to grant auditors read-only access to payroll records without compromising security.",
      },
      {
        heading: "Audit Logs",
        content:
          "All transactions and changes are logged and can be accessed for compliance verification.",
      },
      {
        heading: "Recovery",
        content:
          "Use the recovery mechanism to correct payroll discrepancies. This creates an immutable record of corrections.",
      },
    ],
    tips: [
      "Rotate view keys regularly for security",
      "Document all recovery actions for audit purposes",
      "Review compliance reports monthly",
    ],
  },
  filters: {
    title: "Saved Filters Help",
    description: "Create and manage filters to organize your data.",
    sections: [
      {
        heading: "Creating Filters",
        content:
          "Click the filter icon and set your criteria. Save the filter with a descriptive name for future use.",
      },
      {
        heading: "Managing Filters",
        content:
          "Access saved filters from the filter menu. Edit or delete filters as needed.",
      },
    ],
  },
  export: {
    title: "Export Center Help",
    description: "Export data in various formats for analysis and reporting.",
    sections: [
      {
        heading: "Export Formats",
        content: "Choose from CSV, JSON, or PDF formats depending on your needs.",
      },
      {
        heading: "Export Options",
        content:
          "Select date ranges and fields to include in your export for customized reports.",
      },
    ],
  },
  "wallet-signing": {
    title: "Wallet Signing Recovery",
    description:
      "Step-by-step recovery for the four high-priority wallet signing failure modes: rejection, wrong network, expired session, and malformed transaction data.",
    sections: [
      {
        heading: "Transaction rejected",
        content:
          "Symptom: the dashboard shows the '🚫 Transaction Rejected' overlay. Cause: Freighter's signing prompt was declined or closed. Recovery: verify the transaction details on the dashboard, click Retry, and click Approve in Freighter without closing the popup. No funds were moved. See the Operator Handbook for the full Wallet Signing Recovery Guide.",
      },
      {
        heading: "Wrong network at signing",
        content:
          "Symptom: the dashboard shows the '⚠️ Wrong Network' overlay during signing. Cause: Freighter's active network no longer matches the dashboard's expected network (e.g. dashboard is on Testnet but Freighter is on Public). Recovery: open Freighter → Settings → Network, select the expected network, return to the dashboard, and Retry.",
      },
      {
        heading: "Session expired",
        content:
          "Symptom: '🔒 Session Expired' overlay or Freighter shows its lock screen. Cause: Freighter was locked by inactivity, the browser restarted, or the access grant was revoked. Recovery: unlock Freighter with your password, re-connect from the header button, verify the account and network, and Retry. Treat unexpected re-auth prompts on admin accounts as a possible security event.",
      },
      {
        heading: "Invalid transaction data",
        content:
          "Symptom: '🔧 Invalid Transaction Data' overlay. Cause: the dashboard's XDR could not be decoded — usually stale browser state, an SDK mismatch, or a server-side issue. Recovery: do not retry blindly, perform a hard refresh (Cmd/Ctrl + Shift + R), retry in an incognito window, and escalate with the captured console error and run ID if the failure persists.",
      },
    ],
    tips: [
      "Never close the Freighter popup until the dashboard confirms submission.",
      "Capture the exact browser console error and the payroll run ID before escalating.",
      "Compare the connected Freighter account against the configured ADMIN_PUBLIC_KEY after every recovery.",
      "For admin accounts, treat unexpected re-auth prompts as a possible security event.",
    ],
  },
  print: {
    title: "Printable Reports Help",
    description: "Generate formatted reports ready for printing.",
    sections: [
      {
        heading: "Report Types",
        content:
          "Select from payroll summary, employee details, or compliance reports.",
      },
      {
        heading: "Printing",
        content:
          "Use your browser print function (Ctrl+P or Cmd+P) to save as PDF or print directly.",
      },
    ],
  },
  "network-remediation": {
    title: "Network & RPC Remediation Guide",
    description:
      "Troubleshoot and safely recover from RPC timeouts, network congestion, and retry exhaustion during payroll operations.",
    sections: [
      {
        heading: "RPC retry exhaustion",
        content:
          "When automated retries fail, Soroban RPC or Horizon nodes may be experiencing rate limits (HTTP 429), congestion, or temporary downtime. Wait 30 seconds for rate limit windows to reset before attempting manual retries.",
      },
      {
        heading: "Handling non-idempotent operations",
        content:
          "For transaction submissions, verify whether your transaction was already included in a ledger before resubmitting. Check the Pending Transaction Monitor or Stellar Expert explorer to avoid duplicate payments.",
      },
      {
        heading: "Switching RPC endpoints or networks",
        content:
          "Ensure your wallet is connected to the expected network (Testnet/Public) and has sufficient XLM for transaction fees. If network errors persist, check dashboard status notices or contact system maintainers.",
      },
    ],
    tips: [
      "Always check the Pending Transaction Monitor before re-submitting payroll batches",
      "Do not spam the submit button during high network latency",
      "Ensure Freighter is unlocked and set to the expected network",
    ],
  },
};

