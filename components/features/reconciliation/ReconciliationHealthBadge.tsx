import { CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ReconciliationHealthStatus } from "@/lib/sdk/reconciliation";

const HEALTH_CONFIG: Record<
  ReconciliationHealthStatus,
  { label: string; variant: "success" | "warning" | "error"; icon: React.ComponentType<{ className?: string }> }
> = {
  healthy: { label: "Healthy", variant: "success", icon: CheckCircle2 },
  warning: { label: "Warning", variant: "warning", icon: AlertTriangle },
  blocked: { label: "Blocked", variant: "error", icon: ShieldAlert },
};

export function ReconciliationHealthBadge({ health }: { health: ReconciliationHealthStatus }) {
  const config = HEALTH_CONFIG[health];
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-medium rounded-full border"
      role="status"
      aria-label={`Reconciliation health: ${config.label}`}
    >
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{config.label}</span>
    </Badge>
  );
}

export default ReconciliationHealthBadge;
