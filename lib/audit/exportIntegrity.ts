import type { ExportFormat } from "@/stores/auditExport";

export interface AuditExportIntegrityMarker {
  version: 1;
  format: ExportFormat;
  recordCount: number;
  checksum: string;
  generatedAt: string;
  algorithm: "sha256";
}

export interface IntegrityVerificationResult {
  valid: boolean;
  reason: string | null;
  details: {
    expectedChecksum: string;
    actualChecksum: string;
    recordCount: number;
    format: ExportFormat;
  } | null;
}

export interface ExportPayload {
  entries: Array<{
    id: string;
    type: string;
    title: string;
    date: string;
    summary: string;
    fields: string[];
    metadata?: Record<string, unknown>;
  }>;
  format: ExportFormat;
  generatedAt: string;
  metadata?: {
    dateRange?: { from: string; to: string };
    includeMetadata?: boolean;
  };
}

function serializePayload(payload: ExportPayload): string {
  return JSON.stringify({
    version: 1,
    entries: payload.entries,
    format: payload.format,
    generatedAt: payload.generatedAt,
    metadata: payload.metadata ?? null,
  });
}

async function computeSha256(data: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(data),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function createAuditExportIntegrityMarker(
  payload: ExportPayload,
): Promise<AuditExportIntegrityMarker> {
  if (!payload.entries || payload.entries.length === 0) {
    throw new Error(
      "Cannot create an integrity marker for an empty audit export. Select at least one record.",
    );
  }

  if (!payload.format || !["csv", "json", "pdf"].includes(payload.format)) {
    throw new Error(
      "Invalid export format. Expected csv, json, or pdf.",
    );
  }

  const serialized = serializePayload(payload);
  const checksum = await computeSha256(serialized);

  return {
    version: 1,
    format: payload.format,
    recordCount: payload.entries.length,
    checksum,
    generatedAt: payload.generatedAt,
    algorithm: "sha256",
  };
}

export async function verifyAuditExportIntegrity(
  payload: ExportPayload,
  marker: AuditExportIntegrityMarker,
): Promise<IntegrityVerificationResult> {
  if (marker.version !== 1) {
    return {
      valid: false,
      reason: "Unsupported integrity marker version.",
      details: null,
    };
  }

  if (marker.algorithm !== "sha256") {
    return {
      valid: false,
      reason: "Unsupported integrity algorithm.",
      details: null,
    };
  }

  if (marker.format !== payload.format) {
    return {
      valid: false,
      reason: `Export format mismatch: marker was created for ${marker.format} but payload is ${payload.format}.`,
      details: null,
    };
  }

  if (marker.recordCount !== payload.entries.length) {
    return {
      valid: false,
      reason: `Record count mismatch: marker covers ${marker.recordCount} records but payload has ${payload.entries.length}.`,
      details: null,
    };
  }

  const serialized = serializePayload(payload);
  const actualChecksum = await computeSha256(serialized);

  if (actualChecksum !== marker.checksum) {
    return {
      valid: false,
      reason:
        "Export integrity check failed. The exported data does not match the integrity marker. The file may have been tampered with or corrupted.",
      details: {
        expectedChecksum: marker.checksum,
        actualChecksum,
        recordCount: payload.entries.length,
        format: payload.format,
      },
    };
  }

  return {
    valid: true,
    reason: null,
    details: {
      expectedChecksum: marker.checksum,
      actualChecksum,
      recordCount: payload.entries.length,
      format: payload.format,
    },
  };
}

export function formatIntegrityMarkerForExport(
  marker: AuditExportIntegrityMarker,
): string {
  return JSON.stringify(marker, null, 2);
}

export function parseIntegrityMarker(
  raw: string,
): AuditExportIntegrityMarker | null {
  try {
    const parsed = JSON.parse(raw) as AuditExportIntegrityMarker;
    if (
      parsed.version === 1 &&
      parsed.algorithm === "sha256" &&
      typeof parsed.checksum === "string" &&
      parsed.checksum.length === 64 &&
      typeof parsed.recordCount === "number" &&
      parsed.recordCount > 0 &&
      ["csv", "json", "pdf"].includes(parsed.format) &&
      typeof parsed.generatedAt === "string"
    ) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}
