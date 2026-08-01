import { describe, it, expect } from 'vitest';
import { validateCompanyConfig } from '@/lib/validateCompanyConfig';
import type { CompanyConfig } from '@/types';

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

describe('validateCompanyConfig', () => {
  it('returns valid: true and all ok checks for a valid config', () => {
    const result = validateCompanyConfig(validConfig);
    expect(result.valid).toBe(true);
    expect(result.checks.every((c) => c.status !== 'error')).toBe(true);
  });

  it('returns an error check when admin address is missing', () => {
    const result = validateCompanyConfig({ ...validConfig, admin: '' });
    const check = result.checks.find((c) => c.id === 'role-admin-set');
    expect(check?.status).toBe('error');
    expect(result.valid).toBe(false);
  });

  it('returns an error check when admin address has invalid format', () => {
    const result = validateCompanyConfig({ ...validConfig, admin: 'NOTVALID' });
    const check = result.checks.find((c) => c.id === 'role-admin-set');
    expect(check?.status).toBe('error');
    expect(result.valid).toBe(false);
  });

  it('returns an error check when admin and treasury are the same address', () => {
    const result = validateCompanyConfig({ ...validConfig, treasury: VALID_STELLAR });
    const check = result.checks.find((c) => c.id === 'role-admin-treasury-distinct');
    expect(check?.status).toBe('error');
    expect(result.valid).toBe(false);
  });

  it('returns an error check when a contract ID has invalid format', () => {
    const result = validateCompanyConfig({
      ...validConfig,
      contracts: { ...validContracts, registry: 'BADCONTRACT' },
    });
    const check = result.checks.find((c) => c.id === 'contract-registry');
    expect(check?.status).toBe('error');
    expect(result.valid).toBe(false);
  });

  it('returns a warning but valid: true for MAINNET (PUBLIC) network', () => {
    const result = validateCompanyConfig({ ...validConfig, network: 'PUBLIC' });
    const warning = result.checks.find((c) => c.id === 'network-mainnet-confirm');
    expect(warning?.status).toBe('warning');
    expect(result.valid).toBe(true);
  });

  it('returns an error check for an unknown network value', () => {
    const result = validateCompanyConfig({
      ...validConfig,
      network: 'DEVNET' as CompanyConfig['network'],
    });
    const check = result.checks.find((c) => c.id === 'network-known');
    expect(check?.status).toBe('error');
    expect(result.valid).toBe(false);
  });
});
