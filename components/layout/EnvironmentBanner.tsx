"use client";

import { useState, useEffect } from "react";
import { AlertTriangle, Info, ShieldCheck, ShieldAlert } from "lucide-react";

export type AppEnvironment = "local" | "testnet" | "production";

export default function EnvironmentBanner() {
  const [env, setEnv] = useState<AppEnvironment>("local");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      if (host.includes("localhost") || host.includes("127.0.0.1")) {
        setEnv("local");
      } else if (host.includes("testnet") || host.includes("vercel") || host.includes("github.io")) {
        setEnv("testnet");
      } else {
        setEnv("production");
      }
    }
  }, []);

  const cycleEnvironment = () => {
    setEnv((current) => {
      if (current === "local") return "testnet";
      if (current === "testnet") return "production";
      return "local";
    });
  };

  const bannerStyles = {
    local: {
      bg: "bg-amber-500 text-white",
      hover: "hover:bg-amber-600",
      icon: AlertTriangle,
      text: "LOCAL ENVIRONMENT | Connected: Soroban Local Sandbox | Active Role: Admin",
      badge: "Low Risk Sandbox",
      badgeStyle: "bg-amber-700 text-amber-100",
    },
    testnet: {
      bg: "bg-indigo-600 text-white",
      hover: "hover:bg-indigo-700",
      icon: Info,
      text: "TESTNET ACTIVE | Connected: Stellar Testnet Verifier | RPC API Status: Online",
      badge: "Testing Network",
      badgeStyle: "bg-indigo-800 text-indigo-100",
    },
    production: {
      bg: "bg-emerald-600 text-white",
      hover: "hover:bg-emerald-700",
      icon: ShieldCheck,
      text: "PRODUCTION MODE | Connected: Stellar Mainnet | Security Level: ZK-Shield Maximum",
      badge: "Live Ledger",
      badgeStyle: "bg-emerald-800 text-emerald-100",
    },
  };

  const currentStyle = bannerStyles[env];
  const IconComponent = currentStyle.icon;

  return (
    <button
      type="button"
      onClick={cycleEnvironment}
      className={`cursor-pointer select-none transition-colors duration-200 text-xs px-4 py-1.5 flex items-center justify-center gap-2.5 font-medium shadow-inner ${currentStyle.bg} ${currentStyle.hover}`}
      title="Click to cycle environments (demo option)"
    >
      <IconComponent className="w-3.5 h-3.5 animate-pulse" aria-hidden="true" />
      <span className="tracking-wide">{currentStyle.text}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${currentStyle.badgeStyle}`}>
        {currentStyle.badge}
      </span>
      <span className="text-[10px] opacity-60 hidden sm:inline">(Click to toggle preview)</span>
    </button>
  );
}
