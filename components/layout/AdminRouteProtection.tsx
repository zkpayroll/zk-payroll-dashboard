"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlertTriangle, Lock, Shield } from "lucide-react";
import { canAccessPath } from "@/lib/auth/roles";
import type { UserRole } from "@/types";

interface AdminRouteProtection {
  children: React.ReactNode;
  requiredRole: "admin";
  fallbackPath?: string;
}

export function AdminRouteProtection({
  children,
  requiredRole,
  fallbackPath = "/",
}: AdminRouteProtection) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        if (!response.ok) {
          router.push("/login");
          return;
        }

        const data = await response.json();
        const userRole = data.user?.role as UserRole;

        if (userRole !== requiredRole) {
          setIsAuthorized(false);
          return;
        }

        if (!canAccessPath(userRole, pathname)) {
          router.push(fallbackPath);
          return;
        }

        setIsAuthorized(true);
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push("/login");
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [requiredRole, fallbackPath, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Checking Access Permissions</h2>
          <p className="text-gray-600">Verifying admin privileges...</p>
        </div>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
          <div className="text-center">
            <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              You don&apos;t have the required admin privileges to access this page.
            </p>
            <p className="text-sm text-gray-500">
              Please contact your system administrator to request access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
