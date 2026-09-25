"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Globe, AlertCircle, Loader2, ShieldAlert, XCircle, ExternalLink } from "lucide-react";
import { useEnvironmentStore, BUILTIN_PROFILES, type EnvironmentProfile, type EnvironmentProfileType, type CustomProfileData } from "@/stores/environment";
import { useWalletStore } from "@/stores/walletStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import WarningBanner from "@/components/ui/WarningBanner";
import { cn } from "@/lib/utils";

const PROFILE_ORDER: EnvironmentProfileType[] = ["testnet", "mainnet", "localnet", "custom"];

const PROFILE_ICONS: Record<EnvironmentProfileType, React.ReactNode> = {
  testnet: <Globe className="w-4 h-4 text-indigo-600" />,
  mainnet: <Globe className="w-4 h-4 text-emerald-600" />,
  localnet: <Globe className="w-4 h-4 text-amber-600" />,
  custom: <Globe className="w-4 h-4 text-blue-600" />,
};

const PROFILE_DESCRIPTIONS: Record<EnvironmentProfileType, string> = {
  testnet: "Stellar Testnet — Safe testing with real network conditions",
  mainnet: "Stellar Mainnet — Production network with real assets",
  localnet: "Local Soroban Sandbox — Offline development environment",
  custom: "Custom RPC endpoint — Configure your own network connection",
};

const CAPABILITY_WARNINGS: Partial<Record<EnvironmentProfileType, { severity: "info" | "warning" | "critical"; title: string; message: string }>> = {
  localnet: {
    severity: "warning",
    title: "Localnet not verified",
    message: "This local sandbox hasn't been verified as reachable. Contract deployments and features may not be available.",
  },
  custom: {
    severity: "info",
    title: "Custom network",
    message: "Using a custom RPC endpoint. Ensure the network matches your contract deployments and has required capabilities.",
  },
};

export default function EnvironmentSwitcher() {
  const {
    activeProfile,
    customProfile,
    validationError,
    isConnecting,
    connectionStatus,
    getActiveProfileConfig,
    switchToProfile,
    setCustomProfile,
    setValidationError,
  } = useEnvironmentStore();

  const { network: walletNetwork, setNetwork } = useWalletStore();
  const [isOpen, setIsOpen] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customFormData, setCustomFormData] = useState<CustomProfileData>({
    horizonUrl: customProfile?.horizonUrl ?? "https://",
    sorobanRpcUrl: customProfile?.sorobanRpcUrl ?? "https://",
    networkPassphrase: customProfile?.networkPassphrase ?? "",
    stellarNetwork: customProfile?.stellarNetwork ?? "TESTNET",
  });
  const [customFormErrors, setCustomFormErrors] = useState<Partial<Record<keyof CustomProfileData, string>>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCustomForm(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeConfig = getActiveProfileConfig();

  const handleProfileSelect = async (profile: EnvironmentProfileType) => {
    if (profile === "custom") {
      setShowCustomForm(true);
      return;
    }
    const success = await switchToProfile(profile);
    if (success) {
      setIsOpen(false);
      const selectedConfig = BUILTIN_PROFILES[profile];
      setNetwork(selectedConfig.stellarNetwork, selectedConfig.networkPassphrase);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await switchToProfile("custom", customFormData);
    if (success) {
      setShowCustomForm(false);
      setIsOpen(false);
      setNetwork(customFormData.stellarNetwork, customFormData.networkPassphrase);
    }
  };

  const handleCustomInputChange = (field: keyof CustomProfileData, value: string) => {
    setCustomFormData((prev) => ({ ...prev, [field]: value }));
    if (customFormErrors[field]) {
      setCustomFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleCustomInputBlur = (field: keyof CustomProfileData, value: string) => {
    const error = validateField(field, value);
    if (error) {
      setCustomFormErrors((prev) => ({ ...prev, [field]: error }));
    }
  };

  const validateField = (field: keyof CustomProfileData, value: string): string | undefined => {
    switch (field) {
      case "horizonUrl":
      case "sorobanRpcUrl":
        try {
          new URL(value);
          if (!value.startsWith("https://") && !value.startsWith("http://localhost")) {
            return "Must use HTTPS (or http://localhost)";
          }
        } catch {
          return "Invalid URL format";
        }
        return undefined;
      case "networkPassphrase":
        return value.trim().length === 0 ? "Required" : undefined;
      case "stellarNetwork":
        return ["TESTNET", "PUBLIC", "FUTURENET"].includes(value) ? undefined : "Must be TESTNET, PUBLIC, or FUTURENET";
    }
  };

  const getConnectionStatusBadge = () => {
    switch (connectionStatus) {
      case "connected":
        return <Badge variant="success" className="gap-1"><CheckCircle2 className="w-3 h-3" /> Connected</Badge>;
      case "disconnected":
        return <Badge variant="error" className="gap-1"><AlertCircle className="w-3 h-3" /> Disconnected</Badge>;
      case "checking":
        return <Badge variant="info" className="gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Checking...</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><AlertCircle className="w-3 h-3" /> Unknown</Badge>;
    }
  };

  const capabilityWarning = CAPABILITY_WARNINGS[activeProfile];

  if (!mounted) {
    return (
      <div className="relative inline-block" data-testid="environment-switcher">
        <button className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700" disabled>
          <Loader2 className="w-4 h-4 animate-spin" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative inline-block" data-testid="environment-switcher" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={cn(
          "inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium transition-colors",
          "hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
          connectionStatus === "disconnected" && "border-red-300 text-red-700",
          connectionStatus === "connected" && "border-emerald-300 text-emerald-700"
        )}
        disabled={isConnecting}
      >
        {PROFILE_ICONS[activeProfile]}
        <span className="hidden sm:inline">{activeConfig.label}</span>
        {getConnectionStatusBadge()}
        {!showCustomForm && <ChevronDown className="h-3.5 w-3.5 text-gray-400" />}
      </button>

      {isOpen && (
        <>
          <button
            className="fixed inset-0 z-40"
            onClick={() => { setIsOpen(false); setShowCustomForm(false); }}
            aria-label="Close environment switcher"
          />
          <div className="absolute z-50 mt-1 w-80 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
            {showCustomForm ? (
              <CustomProfileForm
                formData={customFormData}
                errors={customFormErrors}
                onChange={handleCustomInputChange}
                onBlur={handleCustomInputBlur}
                onSubmit={handleCustomSubmit}
                onCancel={() => { setShowCustomForm(false); setCustomFormData(customProfile ?? { horizonUrl: "https://", sorobanRpcUrl: "https://", networkPassphrase: "", stellarNetwork: "TESTNET" }); }}
                isSubmitting={isConnecting}
                validationError={validationError}
              />
            ) : (
              <ProfileList
                activeProfile={activeProfile}
                onSelect={handleProfileSelect}
                isConnecting={isConnecting}
                connectionStatus={connectionStatus}
              />
            )}
          </div>
        </>
      )}

      {capabilityWarning && (
        <WarningBanner
          severity={capabilityWarning.severity}
          title={capabilityWarning.title}
          message={capabilityWarning.message}
          className="mt-2 max-w-xs absolute z-50 right-0"
        />
      )}

      {validationError && !showCustomForm && (
        <div
          role="alert"
          className="absolute z-50 mt-1 flex w-80 items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
        >
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}
    </div>
  );
}

function ChevronDown({ className }: { className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>;
}

interface ProfileListProps {
  activeProfile: EnvironmentProfileType;
  onSelect: (profile: EnvironmentProfileType) => void;
  isConnecting: boolean;
  connectionStatus: "connected" | "disconnected" | "checking" | "unknown";
}

function ProfileList({ activeProfile, onSelect, isConnecting, connectionStatus }: ProfileListProps) {
  return (
    <ul role="listbox" aria-label="Environment profiles" className="py-1">
      {PROFILE_ORDER.map((profile) => {
        const config = profile === "custom" ? { ...BUILTIN_PROFILES.testnet, type: "custom", label: "Custom", isCustom: true } as EnvironmentProfile : BUILTIN_PROFILES[profile];
        const isActive = profile === activeProfile;
        const warning = CAPABILITY_WARNINGS[profile];
        return (
          <li key={profile}>
            <button
              type="button"
              role="option"
              aria-selected={isActive}
              onClick={() => onSelect(profile)}
              disabled={isConnecting || isActive}
              className={cn(
                "flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-gray-50",
                isActive && "bg-gray-50 text-gray-900"
              )}
            >
              <div className="flex-shrink-0 mt-0.5">{PROFILE_ICONS[profile]}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{config.label}</span>
                  {isActive && <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-600" />}
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{PROFILE_DESCRIPTIONS[profile]}</p>
                {warning && (
                  <Badge variant={warning.severity === "critical" ? "error" : warning.severity === "warning" ? "warning" : "info"} className="mt-1.5 text-[10px]">
                    {warning.title}
                  </Badge>
                )}
              </div>
              {connectionStatus === "checking" && profile === activeProfile && (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface CustomProfileFormProps {
  formData: CustomProfileData;
  errors: Partial<Record<keyof CustomProfileData, string>>;
  onChange: (field: keyof CustomProfileData, value: string) => void;
  onBlur: (field: keyof CustomProfileData, value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  validationError: string | null;
}

function CustomProfileForm({ formData, errors, onChange, onBlur, onSubmit, onCancel, isSubmitting, validationError }: CustomProfileFormProps) {
  const fields: Array<{ key: keyof CustomProfileData; label: string; type: string; placeholder: string; help?: string }> = [
    { key: "horizonUrl", label: "Horizon URL", type: "url", placeholder: "https://horizon.example.com", help: "Stellar Horizon API endpoint" },
    { key: "sorobanRpcUrl", label: "Soroban RPC URL", type: "url", placeholder: "https://rpc.example.com", help: "Soroban RPC endpoint for contract calls" },
    { key: "networkPassphrase", label: "Network Passphrase", type: "text", placeholder: "Test SDF Network ; September 2015", help: "Exact network passphrase for transaction signing" },
    { key: "stellarNetwork", label: "Stellar Network", type: "select", placeholder: "", help: "Network type for wallet compatibility" },
  ];

  return (
    <form onSubmit={onSubmit} className="p-3 space-y-3">
      <div className="flex items-center justify-between px-2 py-1">
        <h3 className="text-sm font-medium text-gray-900">Custom Network</h3>
        <button type="button" onClick={onCancel} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Cancel">
          <XCircle className="w-4 h-4" />
        </button>
      </div>
      <div className="border-t" />

      {fields.map(({ key, label, type, placeholder, help }) => (
        <div key={key} className="px-2">
          <label htmlFor={key} className="block text-xs font-medium text-gray-700 mb-1">
            {label}
          </label>
          {type === "select" ? (
            <select
              id={key}
              value={formData[key]}
              onChange={(e) => onChange(key, e.target.value)}
              onBlur={(e) => onBlur(key, e.target.value)}
              className={cn(
                "w-full px-2 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500",
                errors[key] && "border-red-300 focus:border-red-500 focus:ring-red-200"
              )}
            >
              <option value="TESTNET">TESTNET</option>
              <option value="PUBLIC">PUBLIC (Mainnet)</option>
              <option value="FUTURENET">FUTURENET</option>
            </select>
          ) : (
            <input
              id={key}
              type={type}
              value={formData[key]}
              onChange={(e) => onChange(key, e.target.value)}
              onBlur={(e) => onBlur(key, e.target.value)}
              placeholder={placeholder}
              className={cn(
                "w-full px-2 py-1.5 text-sm border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500",
                errors[key] && "border-red-300 focus:border-red-500 focus:ring-red-200"
              )}
              disabled={isSubmitting}
            />
          )}
          {help && <p className="text-[10px] text-gray-500 mt-0.5">{help}</p>}
          {errors[key] && <p className="text-[10px] text-red-600 mt-0.5">{errors[key]}</p>}
        </div>
      ))}

      {validationError && (
        <div className="px-2 flex items-start gap-2 text-xs text-red-700 bg-red-50 border border-red-200 rounded p-2">
          <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>{validationError}</span>
        </div>
      )}

      <div className="flex items-center gap-2 px-2 pt-1 border-t">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={isSubmitting} className="ml-auto">
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save & Connect"}
        </Button>
      </div>
    </form>
  );
}