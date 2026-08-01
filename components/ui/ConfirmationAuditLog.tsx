"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Shield, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminPublicKey: string;
  action: string;
  targetType: "payroll" | "employee" | "treasury" | "audit" | "system";
  targetId?: string;
  reason?: string;
  status: "success" | "failed" | "pending";
  signature?: string;
}

interface ConfirmationContext {
  action: string;
  adminPublicKey: string;
  targetType: string;
  targetId?: string;
  reason?: string;
  status: "success" | "failed" | "pending";
  signature?: string;
  timestamp: string;
}

export function useConfirmationAudit() {
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const logConfirmation = useCallback(async (context: ConfirmationContext) => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/audit-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to log confirmation");
      }

      const newEntry: AuditLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        adminPublicKey: context.adminPublicKey,
        action: context.action,
        targetType: context.targetType as "payroll" | "employee" | "treasury" | "audit" | "system",
        targetId: context.targetId,
        reason: context.reason,
        status: context.status,
        signature: context.signature,
      };

      setAuditLogs(prev => [newEntry, ...prev]);
      return newEntry;
    } catch (error) {
      console.error("Audit logging failed:", error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async (filters?: {
    action?: string;
    admin?: string;
    from?: string;
    to?: string;
    targetType?: string;
  }) => {
    setIsLoading(true);
    try {
      const searchParams = new URLSearchParams();
      if (filters?.action) searchParams.append("action", filters.action);
      if (filters?.admin) searchParams.append("admin", filters.admin);
      if (filters?.from) searchParams.append("from", filters.from);
      if (filters?.to) searchParams.append("to", filters.to);
      if (filters?.targetType) searchParams.append("targetType", filters.targetType);

      const response = await fetch(`/api/audit-log?${searchParams.toString()}`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to fetch audit logs");
      }

      const data = await response.json();
      setAuditLogs(data.logs);
      return data.logs;
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    auditLogs,
    isLoading,
    logConfirmation,
    fetchAuditLogs,
  };
}

function getStatusIcon(status: string) {
  switch (status) {
    case "success": return CheckCircle;
    case "failed": return XCircle;
    default: return Clock;
  }
}

function getStatusColor(status: string) {
  switch (status) {
    case "success": return "text-green-600 bg-green-50 border-green-200";
    case "failed": return "text-red-600 bg-red-50 border-red-200";
    default: return "text-amber-600 bg-amber-50 border-amber-200";
  }
}

export function ConfirmationAuditLog() {
  const { auditLogs, isLoading, fetchAuditLogs } = useConfirmationAudit();
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isExpanded) {
      fetchAuditLogs();
    }
  }, [fetchAuditLogs, isExpanded]);

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const groupedLogs = auditLogs.reduce((acc, log) => {
    const today = new Date().toDateString();
    const logDate = new Date(log.timestamp).toDateString();
    const dateKey = logDate === today ? 'Today' : logDate;
    
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(log);
    return acc;
  }, {} as Record<string, AuditLogEntry[]>);

  return (
    <div className="space-y-4">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-4 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-indigo-600" />
          <span className="font-medium text-gray-900">Confirmation Audit Log</span>
          <span className="text-sm text-gray-500">({auditLogs.length} entries)</span>
        </div>
        <div className="text-sm text-indigo-600">
          {isExpanded ? 'Hide' : 'Show'}
        </div>
      </button>

      {isExpanded && (
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full mx-auto mb-2" />
              <p className="text-sm text-gray-500">Loading audit logs...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Shield className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>No confirmation logs yet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedLogs).map(([date, logs]) => (
                <div key={date}>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">
                    {date}
                  </h4>
                  <div className="space-y-3">
                    {logs.map((log) => {
                      const Icon = getStatusIcon(log.status);
                      const statusStyles = getStatusColor(log.status);
                      
                      return (
                        <div
                          key={log.id}
                          className="flex items-start gap-3 p-3 bg-white rounded-lg border hover:bg-gray-50 transition-colors"
                        >
                          <div className={`p-2 rounded-lg ${statusStyles} flex-shrink-0`}>
                            <Icon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900">
                                {log.action.replace(/([A-Z])/g, ' $1').trim()}
                              </p>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${statusStyles}`}>
                                {log.status}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatTimestamp(log.timestamp)}
                            </p>
                            <p className="text-xs text-gray-600 mt-1">
                              Admin: <span className="font-mono">{log.adminPublicKey.substring(0, 8)}...</span>
                            </p>
                            {log.targetId && (
                              <p className="text-xs text-gray-500 mt-1">
                                Target: {log.targetType} - <span className="font-mono">{log.targetId}</span>
                              </p>
                            )}
                            {log.reason && (
                              <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-600">
                                <span className="font-medium">Reason:</span> {log.reason}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ConfirmationAuditLog;
