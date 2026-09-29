import { validateRoleHandoff } from '../../src/dashboard/roleHandoff';
import { HandoffValidationError } from '../../src/types/dashboard';
import { mockZkPayrollClient } from '../testUtils';

describe('Role Handoff Validation', () => {
  const mockClient = new mockZkPayrollClient();

  beforeEach(() => {
    mockClient.reset();
  });

  it('should validate successful handoff', async () => {
    mockClient.setRoleOwner('admin', '0xUser1');
    mockClient.setRoleConfig('finance', { allowHandoff: true });
    mockClient.setPermissionBoundary('0xUser1', ['admin', 'finance']);

    await expect(
      validateRoleHandoff({
        currentRole: 'admin',
        targetRole: 'finance',
        userAddress: '0xUser1',
        timestamp: Date.now()
      })
    ).resolves.not.toThrow();
  });

  it('should reject non-owner handoff', async () => {
    mockClient.setRoleOwner('admin', '0xUser2');
    mockClient.setPermissionBoundary('0xUser1', ['admin']);

    await expect(
      validateRoleHandoff({
        currentRole: 'admin',
        targetRole: 'finance',
        userAddress: '0xUser1',
        timestamp: Date.now()
      })
    ).rejects.toThrow(HandoffValidationError);
  });

  it('should reject handoff to disabled role', async () => {
    mockClient.setRoleOwner('admin', '0xUser1');
    mockClient.setRoleConfig('finance', { allowHandoff: false });

    await expect(
      validateRoleHandoff({
        currentRole: 'admin',
        targetRole: 'finance',
        userAddress: '0xUser1',
        timestamp: Date.now()
      })
    ).rejects.toThrow(HandoffValidationError);
  });

  it('should detect permission boundary violations', async () => {
    mockClient.setRoleOwner('admin', '0xUser1');
    mockClient.setPermissionBoundary('0xUser1', ['admin']);

    await expect(
      validateRoleHandoff({
        currentRole: 'admin',
        targetRole: 'finance',
        userAddress: '0xUser1',
        timestamp: Date.now()
      })
    ).rejects.toThrow(HandoffValidationError);
  });

  it('should detect handoff conflicts', async () => {
    mockClient.setRoleOwner('admin', '0xUser1');
    mockClient.setRoleConfig('finance', { allowHandoff: true });
    mockClient.setPermissionBoundary('0xUser1', ['admin', 'finance']);
    mockClient.setLastHandoff('finance', {
      userAddress: '0xUser2',
      timestamp: Date.now() + 1000
    });

    await expect(
      validateRoleHandoff({
        currentRole: 'admin',
        targetRole: 'finance',
        userAddress: '0xUser1',
        timestamp: Date.now()
      })
    ).rejects.toThrow(HandoffValidationError);
  });
});