"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, Loader2, Users } from "lucide-react";
import { fetchRoleDirectory, type RoleGroup } from "@/lib/auth/roleDirectory";

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function CopyableAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable; ignore silently, address is still visible.
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-mono text-gray-600 hover:bg-gray-100 transition-colors"
      aria-label={`Copy wallet address ${address}`}
      title={address}
    >
      {shortenAddress(address)}
      {copied ? (
        <Check className="w-3 h-3 text-green-600" aria-hidden="true" />
      ) : (
        <Copy className="w-3 h-3 text-gray-400" aria-hidden="true" />
      )}
    </button>
  );
}

function RoleGroupCard({ group }: { group: RoleGroup }) {
  return (
    <section
      aria-labelledby={`role-group-${group.key}`}
      className="bg-white rounded-lg shadow-sm overflow-hidden"
    >
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 id={`role-group-${group.key}`} className="text-sm font-semibold text-gray-900">
          {group.label}
          <span className="ml-2 text-xs font-normal text-gray-400">
            {group.members.length}
          </span>
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">{group.description}</p>
      </div>

      {group.members.length === 0 ? (
        <div className="px-6 py-6 text-center text-sm text-gray-500">
          No {group.label.toLowerCase()} assigned yet.
        </div>
      ) : (
        <ul className="divide-y divide-gray-100">
          {group.members.map((member) => (
            <li key={member.id} className="px-6 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                <p className="text-xs text-gray-400">
                  Added {new Date(member.addedAt).toLocaleDateString()}
                </p>
              </div>
              <CopyableAddress address={member.walletAddress} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export function RoleViewer() {
  const [groups, setGroups] = useState<RoleGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = () => {
    setIsLoading(true);
    setError(null);
    fetchRoleDirectory()
      .then((result) => setGroups(result.groups))
      .catch(() => setError("Failed to load role directory. Please try again."))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <section aria-labelledby="role-viewer-heading" className="space-y-6">
      <div className="flex items-center gap-2">
        <Users className="w-5 h-5 text-indigo-600" aria-hidden="true" />
        <h2 id="role-viewer-heading" className="text-lg font-semibold text-gray-900">
          Admin Role Viewer
        </h2>
      </div>
      <p className="text-sm text-gray-500">
        Active payroll admins, operators, auditors, and compliance reviewers for this
        company. This page is read-only — role changes are managed on-chain.
      </p>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Loading role directory...
        </div>
      )}

      {!isLoading && error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-2 text-xs font-medium text-red-700 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!isLoading && !error && groups && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => (
            <RoleGroupCard key={group.key} group={group} />
          ))}
        </div>
      )}
    </section>
  );
}

export default RoleViewer;
