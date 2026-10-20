import { describe, expect, it, beforeEach } from "vitest";
import {
  createPolicyNode,
  addDependency,
  removeDependency,
  markDependenciesReviewed,
  evaluateDependencyMap,
  type CompensationPolicyNode,
} from "@/payroll/compensationPolicyDependencyMapping";

const NOW = Date.now();

describe("Compensation Policy Dependency Mapping", () => {
  let policyNode: CompensationPolicyNode;

  beforeEach(() => {
    policyNode = createPolicyNode({
      id: "comp_2025q1",
      name: "Q1 2025 Compensation Schedule",
      effectiveDate: "2025-01-01",
      status: "scheduled",
      now: NOW,
    });
  });

  it("creates a policy node in independent status", () => {
    expect(policyNode.id).toBe("comp_2025q1");
    expect(policyNode.dependencyStatus).toBe("independent");
    expect(policyNode.dependencies).toEqual([]);
    expect(policyNode.mappedAt).toBe(NOW);
  });

  it("adds dependency relationships to a policy", () => {
    const updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Replaces previous quarter policy");

    expect(updated.dependencies.length).toBe(1);
    expect(updated.dependencies[0].targetId).toBe("comp_2025q0");
    expect(updated.dependencyStatus).toBe("dependency_conflict");
  });

  it("adds multiple different dependencies", () => {
    let updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Replaces previous policy");
    updated = addDependency(updated, "asset_usd", "shared_asset", "Uses primary USD asset");
    updated = addDependency(updated, "comp_2024q4", "compensation_level_reference", "References prior rate baseline");

    expect(updated.dependencies.length).toBe(3);
    expect(updated.dependencyStatus).toContain("dependencies");
  });

  it("prevents duplicate dependencies with same type", () => {
    let updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "First description");
    updated = addDependency(updated, "comp_2025q0", "successor_policy", "Updated description");

    expect(updated.dependencies.length).toBe(1);
    expect(updated.dependencies[0].description).toBe("Updated description");
  });

  it("allows same target with different dependency types", () => {
    let updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Successor relation");
    updated = addDependency(updated, "comp_2025q0", "compensation_level_reference", "Reference relation");

    expect(updated.dependencies.length).toBe(2);
  });

  it("validates required fields during creation", () => {
    expect(() =>
      createPolicyNode({
        id: "",
        name: "Policy Name",
        effectiveDate: "2025-01-01",
        status: "active",
      }),
    ).toThrow("id must be provided");

    expect(() =>
      createPolicyNode({
        id: "policy_1",
        name: "",
        effectiveDate: "2025-01-01",
        status: "active",
      }),
    ).toThrow("name must be provided");
  });

  it("marks dependencies as reviewed", () => {
    let updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Successor");
    expect(updated.reviewedAt).toBeUndefined();

    updated = markDependenciesReviewed(updated, "reviewer_001", NOW);
    expect(updated.reviewedAt).toBe(NOW);
    expect(updated.reviewedBy).toBe("reviewer_001");
  });

  it("updates status to validated after review when no critical conflicts", () => {
    let updated = addDependency(policyNode, "asset_usd", "shared_asset", "Info-level dependency");
    updated = markDependenciesReviewed(updated, "reviewer_001", NOW);
    expect(updated.dependencyStatus).toBe("validated");
  });

  it("keeps conflict status even after review if critical dependencies exist", () => {
    let updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Critical successor");
    updated = markDependenciesReviewed(updated, "reviewer_001", NOW);
    expect(updated.dependencyStatus).toBe("dependency_conflict");
  });

  it("removes dependencies from a policy", () => {
    let updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Successor");
    updated = addDependency(updated, "asset_usd", "shared_asset", "Shared asset");

    expect(updated.dependencies.length).toBe(2);

    updated = removeDependency(updated, "comp_2025q0", "successor_policy");
    expect(updated.dependencies.length).toBe(1);
    expect(updated.dependencies[0].targetId).toBe("asset_usd");
  });

  it("updates status after removing dependencies", () => {
    let updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Successor");
    expect(updated.dependencyStatus).toBe("dependency_conflict");

    updated = removeDependency(updated, "comp_2025q0", "successor_policy");
    expect(updated.dependencyStatus).toBe("independent");
  });

  it("evaluates dependency map correctly", () => {
    const evaluation = evaluateDependencyMap(policyNode);
    expect(evaluation.totalDependencies).toBe(0);
    expect(evaluation.criticalDependencies).toBe(0);
    expect(evaluation.hasDependencyConflicts).toBe(false);
    expect(evaluation.requiresReview).toBe(true);
  });

  it("reports critical dependencies in evaluation", () => {
    const updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Critical successor");
    const evaluation = evaluateDependencyMap(updated);

    expect(evaluation.criticalDependencies).toBe(1);
    expect(evaluation.hasDependencyConflicts).toBe(true);
    expect(evaluation.blockedActions.length).toBeGreaterThan(0);
  });

  it("lists blocked actions when dependencies exist", () => {
    const updated = addDependency(policyNode, "comp_2025q0", "successor_policy", "Successor");
    const evaluation = evaluateDependencyMap(updated);

    expect(evaluation.blockedActions.some((a) => a.includes("deactivate"))).toBe(true);
  });

  it("clears review requirement after successful review", () => {
    let updated = addDependency(policyNode, "asset_usd", "shared_asset", "Shared asset");
    let evaluation = evaluateDependencyMap(updated);
    expect(evaluation.requiresReview).toBe(true);

    updated = markDependenciesReviewed(updated, "reviewer_001", NOW);
    evaluation = evaluateDependencyMap(updated);
    expect(evaluation.requiresReview).toBe(false);
  });
});
