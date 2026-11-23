/**
 * Compensation policy dependency mapping (#716).
 *
 * Maps and validates interdependencies between compensation policies,
 * identifying shared resources, cascading effects, and potential conflicts
 * when policies are modified or superseded. Prevents accidental breakage
 * of tightly-coupled policy configurations.
 *
 * Privacy guarantees: Raw employee identities and compensation values are
 * never logged or exposed. Policy relationships are described abstractly.
 */

export type DependencyStatus = "independent" | "has_dependencies" | "dependency_conflict" | "validated" | "requires_review";

export type DependencyType = "successor_policy" | "shared_asset" | "effective_date_clash" | "compensation_level_reference";

export interface PolicyDependency {
  sourceId: string;
  targetId: string;
  type: DependencyType;
  severity: "info" | "warning" | "critical";
  description: string;
}

export interface DependencyMappingPolicy {
  detectSuccessorPolicies: boolean;
  validateSharedAssets: boolean;
  checkEffectiveDateClashes: boolean;
  requireDependencyReview: boolean;
}

export const DEFAULT_DEPENDENCY_MAPPING_POLICY: DependencyMappingPolicy = {
  detectSuccessorPolicies: true,
  validateSharedAssets: true,
  checkEffectiveDateClashes: true,
  requireDependencyReview: true,
};

export interface CompensationPolicyNode {
  id: string;
  name: string;
  effectiveDate: string;
  status: "active" | "scheduled" | "archived";
  dependencies: PolicyDependency[];
  dependencyStatus: DependencyStatus;
  mappedAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
}

export interface CreatePolicyNodeInput {
  id: string;
  name: string;
  effectiveDate: string;
  status: "active" | "scheduled" | "archived";
  now?: number;
  policy?: Partial<DependencyMappingPolicy>;
}

export interface DependencyMapEvaluation {
  totalDependencies: number;
  criticalDependencies: number;
  hasDependencyConflicts: boolean;
  status: DependencyStatus;
  message: string;
  requiresReview: boolean;
  blockedActions: string[];
}

/**
 * Extracts dependency severity from policy relationship.
 */
function deriveDependencySeverity(type: DependencyType): "info" | "warning" | "critical" {
  switch (type) {
    case "successor_policy":
    case "effective_date_clash":
      return "critical";
    case "compensation_level_reference":
      return "warning";
    case "shared_asset":
      return "info";
  }
}

/**
 * Creates a new compensation policy node.
 */
export function createPolicyNode(input: CreatePolicyNodeInput): CompensationPolicyNode {
  if (!input.id || input.id.trim().length === 0) {
    throw new Error("Policy id must be provided");
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new Error("Policy name must be provided");
  }
  if (!input.effectiveDate || input.effectiveDate.trim().length === 0) {
    throw new Error("Effective date must be provided");
  }

  const policy = { ...DEFAULT_DEPENDENCY_MAPPING_POLICY, ...input.policy };

  return {
    id: input.id.trim(),
    name: input.name.trim(),
    effectiveDate: input.effectiveDate,
    status: input.status,
    dependencies: [],
    dependencyStatus: "independent",
    mappedAt: input.now ?? Date.now(),
  };
}

/**
 * Adds a dependency relationship to a policy node.
 */
export function addDependency(
  node: CompensationPolicyNode,
  targetId: string,
  type: DependencyType,
  description: string,
): CompensationPolicyNode {
  if (!targetId || targetId.trim().length === 0) {
    throw new Error("Target policy id must be provided");
  }
  if (!description || description.trim().length === 0) {
    throw new Error("Dependency description must be provided");
  }

  const dependency: PolicyDependency = {
    sourceId: node.id,
    targetId: targetId.trim(),
    type,
    severity: deriveDependencySeverity(type),
    description,
  };

  const updatedDeps = [...node.dependencies];
  const existing = updatedDeps.findIndex((d) => d.targetId === targetId && d.type === type);
  if (existing >= 0) {
    updatedDeps[existing] = dependency;
  } else {
    updatedDeps.push(dependency);
  }

  const hasCritical = updatedDeps.some((d) => d.severity === "critical");
  const dependencyStatus: DependencyStatus = updatedDeps.length === 0 ? "independent" : hasCritical ? "dependency_conflict" : "has_dependencies";

  return {
    ...node,
    dependencies: updatedDeps,
    dependencyStatus,
  };
}

/**
 * Marks a policy node as reviewed for dependency compliance.
 */
export function markDependenciesReviewed(
  node: CompensationPolicyNode,
  reviewedBy: string,
  now = Date.now(),
): CompensationPolicyNode {
  if (!reviewedBy || reviewedBy.trim().length === 0) {
    throw new Error("Reviewer id must be provided");
  }

  const hasCritical = node.dependencies.some((d) => d.severity === "critical");

  return {
    ...node,
    reviewedAt: now,
    reviewedBy,
    dependencyStatus: hasCritical ? "dependency_conflict" : "validated",
  };
}

/**
 * Evaluates the dependency map for a policy node.
 */
export function evaluateDependencyMap(
  node: CompensationPolicyNode,
  policy: DependencyMappingPolicy = DEFAULT_DEPENDENCY_MAPPING_POLICY,
): DependencyMapEvaluation {
  const criticalDeps = node.dependencies.filter((d) => d.severity === "critical");
  const hasCritical = criticalDeps.length > 0;
  const isReviewed = node.reviewedAt !== undefined;

  const blockedActions: string[] = [];
  if (hasCritical) {
    blockedActions.push("Cannot deactivate until dependencies are resolved");
  }
  if (!isReviewed && policy.requireDependencyReview) {
    blockedActions.push("Dependency review required before policy activation");
  }

  let message = "";
  if (node.dependencyStatus === "independent") {
    message = "Policy has no documented dependencies.";
  } else if (node.dependencyStatus === "has_dependencies") {
    message = `Policy has ${node.dependencies.length} documented dependency(ies).`;
  } else if (node.dependencyStatus === "dependency_conflict") {
    message = `${criticalDeps.length} critical dependency conflict(s) detected.`;
  } else if (node.dependencyStatus === "validated") {
    message = "Dependencies validated and cleared for policy activation.";
  } else if (node.dependencyStatus === "requires_review") {
    message = "Policy dependencies require manual review before proceeding.";
  }

  return {
    totalDependencies: node.dependencies.length,
    criticalDependencies: criticalDeps.length,
    hasDependencyConflicts: hasCritical,
    status: node.dependencyStatus,
    message,
    requiresReview: policy.requireDependencyReview && !isReviewed,
    blockedActions,
  };
}

/**
 * Removes a dependency relationship from a policy node.
 */
export function removeDependency(
  node: CompensationPolicyNode,
  targetId: string,
  type: DependencyType,
): CompensationPolicyNode {
  const updatedDeps = node.dependencies.filter((d) => !(d.targetId === targetId && d.type === type));

  const hasCritical = updatedDeps.some((d) => d.severity === "critical");
  const dependencyStatus: DependencyStatus = updatedDeps.length === 0 ? "independent" : hasCritical ? "dependency_conflict" : "has_dependencies";

  return {
    ...node,
    dependencies: updatedDeps,
    dependencyStatus,
  };
}
