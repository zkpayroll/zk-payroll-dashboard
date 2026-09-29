export interface RoleHandoffParams {
  currentRole: string;
  targetRole: string;
  userAddress: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export class HandoffValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown>
  ) {
    super(message);
    this.name = 'HandoffValidationError';
  }
}

export interface PermissionBoundary {
  roles: string[];
  timestamp: number;
}

export interface RoleConfig {
  allowHandoff: boolean;
  minApprovalThreshold?: number;
  handoffCooldown?: number;
}