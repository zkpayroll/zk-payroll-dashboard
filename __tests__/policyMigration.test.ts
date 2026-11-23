import { describe, it, expect } from 'vitest';
import {
  validateCompanyConfigMigration,
  type PolicyMigrationStatus,
} from '@/lib/company/policyMigration';
import {
  CURRENT_CONFIG_SCHEMA_VERSION,
  DEFAULT_CONFIG_SCHEMA_VERSION,
  type CompanyConfig,
} from '@/types';

const VALID_STELLAR = 'G' + 'A'.repeat(55);
const VALID_STELLAR_2 = 'G' + 'B'.repeat(55);
const VALID_CONTRACT = 'C' + 'A'.repeat(55);

const validContracts = {
  registry: VALID_CONTRACT,
  commitment: VALID_CONTRACT,
  verifier: VALID_CONTRACT,
  executor: VALID_CONTRACT,
  audit: VALID_CONTRACT,
};

const validConfig: CompanyConfig = {
  id: '1',
  name: 'Test Co',
  admin: VALID_STELLAR,
  treasury: VALID_STELLAR_2,
  employeeCount: 0,
  isActive: true,
  network: 'TESTNET',
  contracts: validContracts,
};

function expectStatus(result: { status: PolicyMigrationStatus }, status: PolicyMigrationStatus) {
  expect(result.status).toBe(status);
}

describe('validateCompanyConfigMigration', () => {
  describe('already-current policy (no migration needed)', () => {
    it('accepts a valid current-version policy and reports alreadyCurrent', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
      });
      expectStatus(result, 'current');
      expect(result.valid).toBe(true);
      expect(result.alreadyCurrent).toBe(true);
      expect(result.schemaVersion).toBe(CURRENT_CONFIG_SCHEMA_VERSION);
      expect(result.message).toContain('already on the current schema version');
      // No migration-relevant errors surfaced.
      expect(result.checks.every((c) => c.status !== 'error')).toBe(true);
      expect(result.incompatibilities).toHaveLength(0);
    });

    it('does not require migration for a config without a version marker (defaults to v1)', () => {
      const result = validateCompanyConfigMigration(validConfig);
      expectStatus(result, 'migratable');
      expect(result.alreadyCurrent).toBe(false);
      expect(result.schemaVersion).toBe(DEFAULT_CONFIG_SCHEMA_VERSION);
      expect(result.valid).toBe(true);
    });

    it('rejects a current-version policy with a v2-incompatible combination', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
        network: 'PUBLIC',
        auditSettings: { enabled: true, requireAuditorApproval: true },
      });
      expect(result.valid).toBe(false);
      expectStatus(result, 'current');
      expect(result.alreadyCurrent).toBe(true);
      expect(result.incompatibilities.map((c) => c.incompatibility)).toContain(
        'audit-settings-on-public-network',
      );
      expect(result.message).toContain('current schema version but is invalid');
    });
  });

  describe('legacy policy migration', () => {
    it('accepts a valid legacy policy as migratable', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: DEFAULT_CONFIG_SCHEMA_VERSION,
      });
      expectStatus(result, 'migratable');
      expect(result.valid).toBe(true);
      expect(result.alreadyCurrent).toBe(false);
      expect(result.message).toContain('can be migrated');
    });

    it('blocks migration when the legacy policy fails baseline validation', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: DEFAULT_CONFIG_SCHEMA_VERSION,
        admin: 'NOTVALID',
      });
      expect(result.valid).toBe(false);
      expectStatus(result, 'invalid-legacy-policy');
      expect(result.checks.some((c) => c.status === 'error')).toBe(true);
      expect(result.message).toContain('cannot be migrated');
      expect(result.message).toContain('First issue:');
    });

    it('lists schema-incompatible legacy settings as non-blocking migration context (not errors)', () => {
      // Legacy policies are allowed to carry v2-incompatible combinations until
      // they are migrated; these must NOT block a v1 migration.
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: DEFAULT_CONFIG_SCHEMA_VERSION,
        network: 'PUBLIC',
        auditSettings: { enabled: true, requireAuditorApproval: true },
      });
      expect(result.valid).toBe(true);
      expectStatus(result, 'migratable');
      expect(result.incompatibilities).toHaveLength(0);
    });
  });

  describe('unsupported / corrupt schema versions', () => {
    it('rejects a schema version newer than the dashboard supports', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: CURRENT_CONFIG_SCHEMA_VERSION + 1,
      });
      expect(result.valid).toBe(false);
      expectStatus(result, 'unsupported-version');
      expect(result.message).toContain('not supported');
      expect(result.message).toContain(`supported range: ${DEFAULT_CONFIG_SCHEMA_VERSION}–${CURRENT_CONFIG_SCHEMA_VERSION}`);
    });

    it('rejects a corrupt (zero) schema version', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: 0,
      });
      expect(result.valid).toBe(false);
      expectStatus(result, 'unsupported-version');
    });

    it('rejects a non-integer (corrupt) schema version', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: 1.5,
      });
      expect(result.valid).toBe(false);
      expectStatus(result, 'unsupported-version');
    });
  });

  describe('edge cases', () => {
    it('does not surface migration checks when everything is valid and current', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: CURRENT_CONFIG_SCHEMA_VERSION,
      });
      expect(result.checks.filter((c) => c.status !== 'ok')).toHaveLength(0);
      expect(result.incompatibilities).toHaveLength(0);
    });

    it('keeps the legacy PUBLIC warning non-blocking (warning, not error)', () => {
      const result = validateCompanyConfigMigration({
        ...validConfig,
        configSchemaVersion: DEFAULT_CONFIG_SCHEMA_VERSION,
        network: 'PUBLIC',
      });
      const warning = result.checks.find((c) => c.id === 'network-mainnet-confirm');
      expect(warning?.status).toBe('warning');
      expect(result.valid).toBe(true);
      expectStatus(result, 'migratable');
    });
  });
});
