import { describe, it, expect, beforeEach } from '@vest/runner';

import {
  validateLedgerExportConsistency,
  LedgerExportConsistencyError,
  type LedgerEntry,
  type LedgerExportPayload,
} from '../src/dashboard/ledger-export-consistency';

function entry(overrides: Partial<LedgerEntry> = {}): LedgerEntry {
  return {
    id: 'ldg-001',
    timestamp: '2024-01-01T00:00:00.000Z',
    amount: 1000,
    currency: 'USD',
    type: 'payroll',
    status: 'settled',
    txHash: '0xabc',
    ...overrides,
  };
}

function payload(
  entries: LedgerEntry[],
  overrides: Partial<LedgerExportPayload> = {},
): LedgerExportPayload {
  const total = entries.reduce((acc, e) => acc + e.amount, 0);
  return {
    exportId: 'export-123',
    generatedAt: '2024-01-02T00:00:00.000Z',
    entries,
    totals: { USD: total },
    checksum: 'checksum-abc',
    ...overrides,
  };
}

describe('dashboard ledger export consistency validation', () => {
  let baseEntries: LedgerEntry[];

  beforeEach(() => {
    baseEntries = [
      entry({ id: 'ldg-001', amount: 1000 }),
      entry({ id: 'ldg-002', amount: 250, type: 'fee', txHash: '0xdef' }),
    ];
  });

  it('accepts a consistent export payload', () => {
    const result = validateLedgerExportConsistency(payload(baseEntries));
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.normalizedTotals.USD).toBe(1250);
  });

  it('rejects an export whose totals do not match the entries', () => {
    const bad = payload(baseEntries, { totals: { USD: 999 } });
    expect(() => validateLedgerExportConsistency(bad)).toThrow(LedgerExportConsistencyError);
    try {
      validateLedgerExportConsistency(bad);
    } catch (err) {
      const e = err as LedgerExportConsistencyError;
      expect(e.code).toBe('TOTALS_MISMATCH');
      expect(e.details.expected).toEqual(1250);
      expect(e.details.actual).toEqual(999);
    }
  });

  it('detects duplicate ledger entry ids as an edge case', () => {
    const dups = [
      entry({ id: 'ldg-001', amount: 1000 }),
      entry({ id: 'ldg-001', amount: 1000 }),
    ];
    const bad = payload(dups);
    try {
      validateLedgerExportConsistency(bad);
      throw new Error('expected validation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(LedgerExportConsistencyError);
      const e = err as LedgerExportConsistencyError;
      expect(e.code).toBe('DUPLICATE_ENTRY_ID');
      expect(e.details.id).toBe('ldg-001');
    }
  });

  it('reports missing currency totals for entries', () => {
    const entries = [entry({ id: 'ldg-001', currency: 'EUR', amount: 500 })];
    const bad = payload(entries, { totals: { USD: 500 } });
    try {
      validateLedgerExportConsistency(bad);
      throw new Error('expected validation to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(LedgerExportConsistencyError);
      const e = err as LedgerExportConsistencyError;
      expect(e.code).toBe('MISSING_CURRENCY_TOTAL');
      expect(e.details.currency).toBe('EUR');
    }
  });
});
