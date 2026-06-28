import { create } from "zustand";
import type { UserRole } from "@/types";

const ROLE_COOKIE = "zk-payroll-role";

function getRoleFromCookie(): UserRole | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${ROLE_COOKIE}=([^;]*)`),
  );
  return (match?.[1] as UserRole) ?? null;
}

function setRoleCookie(role: UserRole | null): void {
  if (typeof document === "undefined") return;
  if (role) {
    document.cookie = `${ROLE_COOKIE}=${role};path=/;max-age=86400;samesite=lax`;
  } else {
    document.cookie = `${ROLE_COOKIE}=;path=/;max-age=0`;
  }
}

export interface AuthState {
  publicKey: string | null;
  role: UserRole | null;
  isConnected: boolean;
  setSession: (publicKey: string, role: UserRole) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  publicKey: null,
  role: getRoleFromCookie(),
  isConnected: false,

  setSession: (publicKey, role) => {
    setRoleCookie(role);
    set({ publicKey, role, isConnected: true });
  },

  clearSession: () => {
    setRoleCookie(null);
    set({ publicKey: null, role: null, isConnected: false });
  },
}));
