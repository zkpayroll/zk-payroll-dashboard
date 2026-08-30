import { describe, it, expect } from "vitest";
import {
  normalizeEvidencePointerReference,
  validateEvidencePointerReference,
} from "@/lib/validation/evidencePointer";

describe("normalizeEvidencePointerReference", () => {
  it("trims surrounding whitespace", () => {
    expect(normalizeEvidencePointerReference("  abc123  ")).toBe("abc123");
  });

  it("strips embedded whitespace from paste artifacts", () => {
    expect(normalizeEvidencePointerReference("abc\n123 def")).toBe("abc123def");
  });
});

describe("validateEvidencePointerReference", () => {
  it("rejects an empty reference for any type", () => {
    const result = validateEvidencePointerReference("url", "   ");
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("A reference is required.");
  });

  describe("url", () => {
    it("accepts a well-formed https URL", () => {
      const result = validateEvidencePointerReference("url", "https://example.com/case/4471");
      expect(result.isValid).toBe(true);
    });

    it("accepts a well-formed http URL", () => {
      const result = validateEvidencePointerReference("url", "http://example.com");
      expect(result.isValid).toBe(true);
    });

    it("rejects a non-URL string", () => {
      const result = validateEvidencePointerReference("url", "not-a-valid-url");
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("not a valid URL");
    });

    it("rejects a non-http(s) protocol", () => {
      const result = validateEvidencePointerReference("url", "ftp://example.com/file");
      expect(result.isValid).toBe(false);
    });
  });

  describe("ipfs", () => {
    it("accepts a valid CIDv0", () => {
      const result = validateEvidencePointerReference(
        "ipfs",
        "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
      );
      expect(result.isValid).toBe(true);
    });

    it("accepts a valid CIDv1", () => {
      const result = validateEvidencePointerReference(
        "ipfs",
        "bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi",
      );
      expect(result.isValid).toBe(true);
    });

    it("rejects a malformed CID", () => {
      const result = validateEvidencePointerReference("ipfs", "not-a-cid");
      expect(result.isValid).toBe(false);
      expect(result.message).toContain("not a valid IPFS CID");
    });
  });

  describe("document-hash", () => {
    it("accepts a 0x-prefixed hex hash", () => {
      const result = validateEvidencePointerReference(
        "document-hash",
        "0x8f3a1c9d4e5b6a7f8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b",
      );
      expect(result.isValid).toBe(true);
    });

    it("accepts a bare hex hash without 0x prefix", () => {
      const result = validateEvidencePointerReference(
        "document-hash",
        "8f3a1c9d4e5b6a7f8c9d0e1f2a3b4c5d",
      );
      expect(result.isValid).toBe(true);
    });

    it("rejects a hash containing non-hex characters", () => {
      const result = validateEvidencePointerReference("document-hash", "0xnothexadecimal");
      expect(result.isValid).toBe(false);
    });

    it("rejects a hash that is too short", () => {
      const result = validateEvidencePointerReference("document-hash", "0xabc");
      expect(result.isValid).toBe(false);
    });
  });

  describe("case-reference", () => {
    it("accepts a well-formed case reference", () => {
      const result = validateEvidencePointerReference("case-reference", "EXT-CASE-2025-4471");
      expect(result.isValid).toBe(true);
    });

    it("rejects a case reference that is too short", () => {
      const result = validateEvidencePointerReference("case-reference", "ab");
      expect(result.isValid).toBe(false);
    });

    it("rejects a case reference with invalid characters", () => {
      const result = validateEvidencePointerReference("case-reference", "case/2025#4471");
      expect(result.isValid).toBe(false);
    });
  });
});
