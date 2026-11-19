/**
 * Payroll event schema versioning for audit exports.
 *
 * Tracks schema versions across audit events to support evolution of event
 * formats while maintaining backward compatibility and audit trail integrity.
 * Privacy-safe: only versions are tracked, no event content is exposed.
 */

export type AuditEventType =
  | "payroll_run"
  | "payroll_approval"
  | "settlement_transaction"
  | "commitment_amendment"
  | "audit_access_grant"
  | "treasury_movement";

export interface EventSchemaVersion {
  version: string;
  releaseDate: string;
  description: string;
  compatibleWithVersions: string[];
}

export interface AuditEventMetadata {
  eventId: string;
  eventType: AuditEventType;
  schemaVersion: string;
  timestamp: string;
  operatorId: string;
}

export interface AuditEventWithSchema {
  metadata: AuditEventMetadata;
  data: Record<string, unknown>;
}

const SCHEMA_VERSION_REGISTRY: Record<AuditEventType, EventSchemaVersion[]> = {
  payroll_run: [
    {
      version: "1.0.0",
      releaseDate: "2024-01-01",
      description: "Initial payroll run event schema",
      compatibleWithVersions: ["1.0.0"],
    },
    {
      version: "2.0.0",
      releaseDate: "2025-06-01",
      description: "Added segregation of duties tracking and proof metadata",
      compatibleWithVersions: ["1.0.0", "2.0.0"],
    },
  ],
  payroll_approval: [
    {
      version: "1.0.0",
      releaseDate: "2024-01-01",
      description: "Initial approval event schema",
      compatibleWithVersions: ["1.0.0"],
    },
    {
      version: "1.1.0",
      releaseDate: "2024-09-01",
      description: "Added approval reason and audit trail fields",
      compatibleWithVersions: ["1.0.0", "1.1.0"],
    },
  ],
  settlement_transaction: [
    {
      version: "1.0.0",
      releaseDate: "2024-01-01",
      description: "Initial settlement transaction schema",
      compatibleWithVersions: ["1.0.0"],
    },
  ],
  commitment_amendment: [
    {
      version: "1.0.0",
      releaseDate: "2024-06-01",
      description: "Commitment amendment event schema",
      compatibleWithVersions: ["1.0.0"],
    },
  ],
  audit_access_grant: [
    {
      version: "1.0.0",
      releaseDate: "2024-03-01",
      description: "Audit access grant schema",
      compatibleWithVersions: ["1.0.0"],
    },
    {
      version: "1.1.0",
      releaseDate: "2025-01-01",
      description: "Added grant scope and expiration tracking",
      compatibleWithVersions: ["1.0.0", "1.1.0"],
    },
  ],
  treasury_movement: [
    {
      version: "1.0.0",
      releaseDate: "2024-02-01",
      description: "Treasury movement schema",
      compatibleWithVersions: ["1.0.0"],
    },
  ],
};

export function getEventSchemaVersions(
  eventType: AuditEventType,
): EventSchemaVersion[] {
  return SCHEMA_VERSION_REGISTRY[eventType] ?? [];
}

export function getCurrentSchemaVersion(
  eventType: AuditEventType,
): EventSchemaVersion | null {
  const versions = getEventSchemaVersions(eventType);
  return versions.length > 0 ? versions[versions.length - 1] : null;
}

export function isSchemaVersionSupported(
  eventType: AuditEventType,
  version: string,
): boolean {
  const versions = getEventSchemaVersions(eventType);
  return versions.some((v) => v.version === version);
}

export function getSchemaVersionCompatibility(
  eventType: AuditEventType,
  version: string,
): string[] {
  const versions = getEventSchemaVersions(eventType);
  const schema = versions.find((v) => v.version === version);
  return schema?.compatibleWithVersions ?? [];
}

export function validateEventSchemaVersion(
  eventType: AuditEventType,
  version: string,
): { valid: boolean; message: string } {
  if (!isSchemaVersionSupported(eventType, version)) {
    const supported = getEventSchemaVersions(eventType).map((v) => v.version);
    return {
      valid: false,
      message: `Unsupported schema version "${version}" for event type "${eventType}". Supported versions: ${supported.join(", ")}`,
    };
  }

  return { valid: true, message: "Schema version is valid" };
}

export { SCHEMA_VERSION_REGISTRY };
