import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { webcrypto } from "node:crypto";
import {
  createAuditExportIntegrityMarker,
  verifyAuditExportIntegrity,
  formatIntegrityMarkerForExport,
  parseIntegrityMarker,
  type ExportPayload,
} from "@/lib/audit/exportIntegrity";

const samplePayload: ExportPayload = {
  entries: [
    {
      id: "entry-001",
      type: "payroll_run",
      title: "Payroll Run 2025-01",
      date: "2025-01-15T00:00:00Z",
      summary: "Monthly payroll disbursement",
      fields: ["id", "type", "date", "summary"],
    },
    {
      id: "entry-002",
      type: "transaction",
      title: "TX 2025-01-001",
      date: "2025-01-15T00:01:00Z",
      summary: "ZK proof verified",
      fields: ["id", "type", "date"],
    },
  ],
  format: "json",
  generatedAt: "2025-01-15T12:00:00Z",
  metadata: {
    dateRange: { from: "2025-01-01", to: "2025-01-31" },
    includeMetadata: true,
  },
};

describe("createAuditExportIntegrityMarker", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it("creates a valid integrity marker with correct fields", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);

    expect(marker.version).toBe(1);
    expect(marker.algorithm).toBe("sha256");
    expect(marker.format).toBe("json");
    expect(marker.recordCount).toBe(2);
    expect(marker.checksum).toMatch(/^[a-f0-9]{64}$/);
    expect(marker.generatedAt).toBe("2025-01-15T12:00:00Z");
  });

  it("produces the same checksum for identical payloads", async () => {
    const marker1 = await createAuditExportIntegrityMarker(samplePayload);
    const marker2 = await createAuditExportIntegrityMarker(samplePayload);

    expect(marker1.checksum).toBe(marker2.checksum);
  });

  it("produces different checksums when entries change", async () => {
    const marker1 = await createAuditExportIntegrityMarker(samplePayload);
    const modifiedPayload: ExportPayload = {
      ...samplePayload,
      entries: [
        ...samplePayload.entries,
        {
          id: "entry-003",
          type: "compliance_event",
          title: "Compliance Check",
          date: "2025-01-16T00:00:00Z",
          summary: "Quarterly review",
          fields: ["id", "type"],
        },
      ],
    };
    const marker2 = await createAuditExportIntegrityMarker(modifiedPayload);

    expect(marker1.checksum).not.toBe(marker2.checksum);
    expect(marker2.recordCount).toBe(3);
  });

  it("throws for an empty entries array", async () => {
    await expect(
      createAuditExportIntegrityMarker({ ...samplePayload, entries: [] }),
    ).rejects.toThrow(/empty audit export/i);
  });

  it("throws for an invalid format", async () => {
    await expect(
      createAuditExportIntegrityMarker({
        ...samplePayload,
        format: "xml" as ExportPayload["format"],
      }),
    ).rejects.toThrow(/invalid export format/i);
  });
});

describe("verifyAuditExportIntegrity", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it("returns valid for a matching payload and marker", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);
    const result = await verifyAuditExportIntegrity(samplePayload, marker);

    expect(result.valid).toBe(true);
    expect(result.reason).toBeNull();
    expect(result.details).not.toBeNull();
    expect(result.details!.expectedChecksum).toBe(marker.checksum);
    expect(result.details!.actualChecksum).toBe(marker.checksum);
  });

  it("returns invalid when the payload has been tampered with", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);
    const tamperedPayload: ExportPayload = {
      ...samplePayload,
      entries: [
        {
          ...samplePayload.entries[0],
          summary: "Tampered summary",
        },
        ...samplePayload.entries.slice(1),
      ],
    };

    const result = await verifyAuditExportIntegrity(tamperedPayload, marker);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/integrity check failed/i);
    expect(result.details).not.toBeNull();
    expect(result.details!.expectedChecksum).toBe(marker.checksum);
    expect(result.details!.actualChecksum).not.toBe(marker.checksum);
  });

  it("returns invalid when the format does not match", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);
    const csvPayload: ExportPayload = { ...samplePayload, format: "csv" };

    const result = await verifyAuditExportIntegrity(csvPayload, marker);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/format mismatch/i);
  });

  it("returns invalid when the record count does not match", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);
    const fewerEntriesPayload: ExportPayload = {
      ...samplePayload,
      entries: samplePayload.entries.slice(0, 1),
    };

    const result = await verifyAuditExportIntegrity(fewerEntriesPayload, marker);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/record count mismatch/i);
  });

  it("returns invalid for an unsupported marker version", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);
    const badMarker = { ...marker, version: 2 as unknown as 1 };

    const result = await verifyAuditExportIntegrity(samplePayload, badMarker);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unsupported.*version/i);
  });

  it("returns invalid for an unsupported algorithm", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);
    const badMarker = { ...marker, algorithm: "md5" as unknown as "sha256" };

    const result = await verifyAuditExportIntegrity(samplePayload, badMarker);

    expect(result.valid).toBe(false);
    expect(result.reason).toMatch(/unsupported.*algorithm/i);
  });
});

describe("formatIntegrityMarkerForExport / parseIntegrityMarker", () => {
  beforeEach(() => vi.stubGlobal("crypto", webcrypto));
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips a valid marker through JSON serialization", async () => {
    const marker = await createAuditExportIntegrityMarker(samplePayload);
    const serialized = formatIntegrityMarkerForExport(marker);
    const parsed = parseIntegrityMarker(serialized);

    expect(parsed).not.toBeNull();
    expect(parsed!.checksum).toBe(marker.checksum);
    expect(parsed!.format).toBe(marker.format);
    expect(parsed!.recordCount).toBe(marker.recordCount);
  });

  it("returns null for malformed JSON", () => {
    expect(parseIntegrityMarker("not json")).toBeNull();
  });

  it("returns null for a marker with invalid fields", () => {
    const badMarker = JSON.stringify({
      version: 1,
      algorithm: "sha256",
      checksum: "too-short",
      recordCount: 0,
      format: "invalid",
      generatedAt: "2025-01-01",
    });
    expect(parseIntegrityMarker(badMarker)).toBeNull();
  });

  it("returns null for a marker with wrong version", () => {
    const badMarker = JSON.stringify({
      version: 99,
      algorithm: "sha256",
      checksum: "a".repeat(64),
      recordCount: 1,
      format: "json",
      generatedAt: "2025-01-01",
    });
    expect(parseIntegrityMarker(badMarker)).toBeNull();
  });
});
