import { describe, expect, it } from "vitest";
import { summarizeMultiBatchProgress } from "@/src/payroll/multiBatchProgress";

describe("summarizeMultiBatchProgress", () => {
  it("aggregates active and completed batches", () => {
    expect(summarizeMultiBatchProgress([
      { batchId: "batch-1", status: "completed", completedItems: 10, totalItems: 10 },
      { batchId: "batch-2", status: "running", completedItems: 5, totalItems: 10 },
    ])).toMatchObject({
      totalBatches: 2,
      completedBatches: 1,
      activeBatches: 1,
      completedItems: 15,
      totalItems: 20,
      percentComplete: 75,
      status: "running",
    });
  });

  it("prioritizes failure state", () => {
    expect(summarizeMultiBatchProgress([
      { batchId: "batch-1", status: "failed", completedItems: 2, totalItems: 10 },
      { batchId: "batch-2", status: "completed", completedItems: 10, totalItems: 10 },
    ]).status).toBe("failed");
  });

  it("keeps a completed batch pending until every recipient settles", () => {
    expect(summarizeMultiBatchProgress([
      { batchId: "batch-1", status: "completed", completedItems: 9, totalItems: 10 },
    ]).status).toBe("pending");

    expect(summarizeMultiBatchProgress([
      { batchId: "batch-1", status: "completed", completedItems: 10, totalItems: 10 },
    ]).status).toBe("completed");
  });

  it("handles an empty batch list without division by zero", () => {
    expect(summarizeMultiBatchProgress([])).toMatchObject({
      totalBatches: 0,
      totalItems: 0,
      percentComplete: 0,
      status: "pending",
    });
  });
});