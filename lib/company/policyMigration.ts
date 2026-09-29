import {
  CONFIG_SCHEMA_V2_INCOMPATIBILITIES,
  CURRENT_CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG_SCHEMA_VERSION,
  type CompanyConfig,
  type ConfigSchemaV2Incompatibility,
} from "@/types";
import {
  validateCompanyConfig,
  type ConfigCheck,
  type ValidationResult,
} from "@/lib/validateCompanyConfig";

/**
 * High-level state of an organization policy with respect to the current
 * configuration schema:
 *
 * - `current`              – policy already uses the latest schema version and
 *                            passes validation; no migration is needed.
 * - `migratable`           – policy uses an older (but supported) schema
 *                            version and is valid, so it may be migrated.
 * - `unsupported-version`  – policy declares a schema version newer than the
 *                            dashboard supports (or a corrupt value); the
 *                            dashboard must not migrate or accept it.
 * - `invalid-legacy-policy`– legacy policy exists but fails the baseline
 *                            `validateCompanyConfig` checks, so migration
 *                            would copy broken state forward and is blocked.
 */
export type PolicyMigrationStatus =
  | "current"
  | "migratable"
  | "unsupported-version"
  | "invalid-legacy-policy";

export type PolicyMigrationCheck = ConfigCheck & {
  status: ConfigCheck["status"];
  /** Populated for schema-incompatibility errors, absent otherwise. */
  incompatibility?: ConfigSchemaV2Incompatibility;
};

export interface PolicyMigrationValidationResult {
  /** Whether the policy may be used / migrated as-is. */
  valid: boolean;
  status: PolicyMigrationStatus;
  /** Resolved schema version (`DEFAULT_CONFIG_SCHEMA_VERSION` when absent). */
  schemaVersion: number;
  /** True when the policy already uses the current schema version. */
  alreadyCurrent: boolean;
  /** Baseline config checks from the existing validation system. */
  checks: PolicyMigrationCheck[];
  /** Schema-incompatibility checks discovered during migration validation. */
  incompatibilities: PolicyMigrationCheck[];
  /** Single actionable message summarizing the result (for UI/toasts). */
  message: string;
}

const MESSAGES: Record<PolicyMigrationStatus, string> = {
  current:
    "Organization policy is already on the current schema version. No migration is required.",
  migratable: `Organization policy uses schema version {version} and is valid. It can be migrated to schema version ${CURRENT_CONFIG_SCHEMA_VERSION}.`,
  "unsupported-version": `Organization policy schema version {version} is not supported by this dashboard (supported range: ${DEFAULT_CONFIG_SCHEMA_VERSION}–${CURRENT_CONFIG_SCHEMA_VERSION}). Upgrade the dashboard or re-export the configuration before migrating.`,
  "invalid-legacy-policy":
    "Organization policy cannot be migrated because its configuration is invalid. Fix the listed configuration issues first, then retry the migration.",
};

function formatMessage(status: PolicyMigrationStatus, schemaVersion: number): string {
  return MESSAGES[status].replace("{version}", String(schemaVersion));
}

/**
 * Detect v2 schema incompatibilities — combinations of policy settings that
 * are individually valid but cannot coexist under the current schema.
 * Returns one failed check per incompatibility (empty when none).
 */
function detectSchemaIncompatibilities(
  config: CompanyConfig,
): PolicyMigrationCheck[] {
  const found: PolicyMigrationCheck[] = [];
  const push = (incompatibility: ConfigSchemaV2Incompatibility, label: string) => {
    found.push({
      id: `migration-${incompatibility}`,
      label,
      status: "error",
      message: CONFIG_SCHEMA_V2_INCOMPATIBILITIES[incompatibility],
      incompatibility,
    });
  };

  if (
    config.network === "PUBLIC" &&
    config.auditSettings?.enabled &&
    config.auditSettings.requireAuditorApproval
  ) {
    push("audit-settings-on-public-network", "Audit / mainnet combination");
  }

  if (config.isActive === false) {
    push("inactive-company", "Company status");
  }

  return found;
}

/**
 * Validate an organization policy for migration.
 *
 * Reuses the existing `validateCompanyConfig` baseline checks and adds
 * migration-specific rules: schema version bounds, schema incompatibilities,
 * and the already-current short-circuit. The returned shape extends the
 * established `ValidationResult` conventions so existing UI patterns can
 * render it without a parallel system.
 */
export function validateCompanyConfigMigration(
  config: CompanyConfig,
): PolicyMigrationValidationResult {
  const rawVersion = config.configSchemaVersion;
  const schemaVersion =
    rawVersion === undefined ? DEFAULT_CONFIG_SCHEMA_VERSION : rawVersion;

  // 1. Corrupt / out-of-bounds version values (including non-integers).
  const versionIsSupported =
    Number.isInteger(schemaVersion) &&
    schemaVersion >= DEFAULT_CONFIG_SCHEMA_VERSION &&
    schemaVersion <= CURRENT_CONFIG_SCHEMA_VERSION;

  if (!versionIsSupported) {
    return {
      valid: false,
      status: "unsupported-version",
      schemaVersion,
      alreadyCurrent: false,
      checks: [],
      incompatibilities: [],
      message: formatMessage("unsupported-version", schemaVersion),
    };
  }

  const alreadyCurrent = schemaVersion === CURRENT_CONFIG_SCHEMA_VERSION;

  // 2. Baseline policy validation (existing system) — applies to all versions.
  const baseline: ValidationResult = validateCompanyConfig(config);
  const checks: PolicyMigrationCheck[] = baseline.checks.map((check) => ({ ...check }));

  // 3. Schema incompatibilities only gate the *current* schema; legacy policies
  //    are allowed to carry these combinations until they are migrated.
  const incompatibilities = alreadyCurrent
    ? detectSchemaIncompatibilities(config)
    : [];

  const hasErrors =
    checks.some((c) => c.status === "error") ||
    incompatibilities.some((c) => c.status === "error");

  if (alreadyCurrent) {
    // 4. Already-current state: only schema incompatibilities can block it.
    if (hasErrors) {
      const first = incompatibilities.find((c) => c.status === "error");
      return {
        valid: false,
        status: "current",
        schemaVersion,
        alreadyCurrent: true,
        checks,
        incompatibilities,
        message: `Organization policy is on the current schema version but is invalid: ${first?.message ?? "configuration errors detected."} Fix the listed issues before running payroll.`,
      };
    }
    return {
      valid: baseline.valid,
      status: "current",
      schemaVersion,
      alreadyCurrent: true,
      checks,
      incompatibilities,
      message: formatMessage("current", schemaVersion),
    };
  }

  // 5. Legacy policy: must pass baseline validation before migration.
  if (hasErrors) {
    const first = checks.find((c) => c.status === "error");
    return {
      valid: false,
      status: "invalid-legacy-policy",
      schemaVersion,
      alreadyCurrent: false,
      checks,
      incompatibilities,
      message: `${formatMessage("invalid-legacy-policy", schemaVersion)} First issue: ${first?.message ?? "configuration errors detected."}`,
    };
  }

  return {
    valid: true,
    status: "migratable",
    schemaVersion,
    alreadyCurrent: false,
    checks,
    incompatibilities,
    message: formatMessage("migratable", schemaVersion),
  };
}
