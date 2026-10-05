import { zkPayrollClient } from '../zkPayrollClient';
import { RoleHandoffParams, HandoffValidationError } from '../types/dashboard';
import { generateAuditEvent } from '../utils/audit';

export async function validateRoleHandoff(params: RoleHandoffParams): Promise<void> {
  const { currentRole, targetRole, userAddress, timestamp } = params;

  // 1. Current role ownership validation
  const currentRoleOwner = await zkPayrollClient.getRoleOwner(currentRole);
  if (currentRoleOwner !== userAddress) {
    throw new HandoffValidationError(
      'INSUFFICIENT_PERMISSIONS',
      'User does not own current role',
      { expectedOwner: currentRoleOwner, actualOwner: userAddress }
    );
  }

  // 2. Target role eligibility check
  const targetRoleConfig = await zkPayrollClient.getRoleConfig(targetRole);
  if (!targetRoleConfig.allowHandoff) {
    throw new HandoffValidationError(
      'ROLE_HANDOFF_DISABLED',
      'Target role does not allow handoffs',
      { role: targetRole }
    );
  }

  // 3. Permission boundary validation
  const permissionBoundary = await zkPayrollClient.getPermissionBoundary(userAddress);
  if (!permissionBoundary.includes(targetRole)) {
    throw new HandoffValidationError(
      'PERMISSION_BOUNDARY_VIOLATION',
      'Target role exceeds user permission boundaries',
      { role: targetRole, boundaries: permissionBoundary }
    );
  }

  // 4. Audit trail consistency
  const previousHandoff = await zkPayrollClient.getLastHandoff(targetRole);
  if (previousHandoff &&
      previousHandoff.timestamp > timestamp &&
      previousHandoff.userAddress !== userAddress) {
    throw new HandoffValidationError(
      'HANDOFF_CONFLICT',
      'Potential handoff conflict detected',
      { conflictingHandoff: previousHandoff }
    );
  }

  // Generate audit event
  generateAuditEvent({
    type: 'ROLE_HANDOFF_VALIDATION',
    metadata: {
      userAddress,
      currentRole,
      targetRole,
      timestamp,
      status: 'VALID'
    }
  });
}