import type {
  Employee,
  PaymentInstruction,
  PaymentInstructionDuplicateKind,
  PaymentInstructionDuplicateGroup,
  PaymentInstructionDuplicateOptions,
  PaymentInstructionValidationResult,
} from "@/types/models";

export type {
  PaymentInstruction,
  PaymentInstructionDuplicateKind,
  PaymentInstructionDuplicateGroup,
  PaymentInstructionDuplicateOptions,
  PaymentInstructionValidationResult,
};

/**
 * Duplicate employee-id / wallet-address detection for payroll draft input
 * (issue #366).
 *
 * Kept as a pure function so the grouping rules are testable without
 * rendering the warning panel, and so the same predicate can back any other
 * screen that assembles a payroll draft from an employee list.
 */

export type DuplicateWarningKind = "id" | "address";

export interface DuplicateWarningGroup {
  kind: DuplicateWarningKind;
  /** The id or address value that repeats. */
  value: string;
  /** The draft rows sharing that value, in the order they appear in the input. */
  employees: Employee[];
}

/**
 * Groups employees that share the same `id` or the same `address` (wallet).
 *
 * A shared `id` almost always means the same row was added to the draft
 * twice (e.g. a bulk-select or CSV-merge bug). A shared `address` across
 * *different* employee ids is a distinct, more serious case — it means two
 * employee records would be paid to the same wallet, which is worth
 * flagging even though the ids themselves are unique.
 */
export function findDuplicateEmployeeWarnings(
  employees: Employee[],
): DuplicateWarningGroup[] {
  const groups: DuplicateWarningGroup[] = [];

  const byId = groupBy(employees, (e) => e.id);
  Array.from(byId.entries()).forEach(([id, rows]) => {
    if (rows.length > 1) {
      groups.push({ kind: "id", value: id, employees: rows });
    }
  });

  const byAddress = groupBy(employees, (e) => e.address);
  Array.from(byAddress.entries()).forEach(([address, rows]) => {
    // Only flag as an address duplicate when the underlying employee ids
    // differ — two rows that already matched on id are reported once, as
    // an id duplicate, not twice.
    const distinctIds = new Set(rows.map((r: Employee) => r.id));
    if (rows.length > 1 && distinctIds.size > 1) {
      groups.push({ kind: "address", value: address, employees: rows });
    }
  });

  return groups;
}

// ─── Payment Instruction Duplicate Detection (#633) ──────────────────────────

/**
 * Privacy-safe masking for Stellar public keys / addresses (`GDQP2K…4W37`).
 */
export function maskPaymentAddress(address?: string | null): string {
  if (!address || typeof address !== "string") return "";
  const trimmed = address.trim();
  if (trimmed.length <= 12) return trimmed;
  const upper = trimmed.toUpperCase();
  return `${upper.slice(0, 6)}…${upper.slice(-4)}`;
}

/**
 * Helper accessors extracting uniform fields regardless of property aliasing.
 */
export function getInstructionId(
  instruction?: PaymentInstruction | null,
  fallbackIndex?: number,
): string {
  if (instruction?.id && instruction.id.trim()) {
    return instruction.id.trim();
  }
  return fallbackIndex !== undefined ? `inst_${fallbackIndex + 1}` : "";
}

export function getInstructionRecipientId(
  instruction?: PaymentInstruction | null,
): string {
  if (!instruction) return "";
  return (instruction.employeeId || instruction.name || "").trim();
}

export function getInstructionAddress(
  instruction?: PaymentInstruction | null,
): string {
  if (!instruction) return "";
  return (
    instruction.recipientAddress ||
    instruction.address ||
    instruction.walletAddress ||
    ""
  ).trim();
}

export function getInstructionAmount(
  instruction?: PaymentInstruction | null,
): number {
  if (!instruction) return 0;
  if (typeof instruction.amount === "number" && Number.isFinite(instruction.amount)) {
    return instruction.amount;
  }
  if (typeof instruction.salary === "number" && Number.isFinite(instruction.salary)) {
    return instruction.salary;
  }
  return 0;
}

export function getInstructionAsset(
  instruction?: PaymentInstruction | null,
): string {
  if (!instruction) return "USDC";
  return (instruction.asset || instruction.assetCode || "USDC").trim().toUpperCase();
}

/**
 * Converts an Employee model into a PaymentInstruction for seamless interoperability.
 */
export function employeeToPaymentInstruction(employee: Employee): PaymentInstruction {
  return {
    id: employee.id,
    employeeId: employee.id,
    name: employee.name,
    recipientAddress: employee.address,
    address: employee.address,
    amount: employee.salary,
    salary: employee.salary,
    asset: "USDC",
    assetCode: "USDC",
    department: employee.department,
  };
}

/**
 * Pure evaluation function that detects duplicate payment instructions in a payroll draft.
 *
 * Evaluates:
 * 1. Duplicate instruction identifiers (`instruction_id`) — blocking.
 * 2. Collision with previously confirmed or executed instruction identifiers (`collision`) — blocking.
 * 3. Multiple payment instructions for the same recipient (`recipient`) — blocking.
 * 4. Exact duplicate payment instructions with matching recipient, address, asset, and amount (`exact_match`) — blocking.
 * 5. Destination wallet address shared across distinct recipients (`address`) — warning by default, blocking in strict mode.
 *
 * Privacy Guarantees:
 * - Stellar addresses in messages and values are masked (`GDQP2K…4W37`).
 * - Raw salaries and financial values are not exposed in error titles or logs.
 */
export function findPaymentInstructionDuplicates(
  instructions: PaymentInstruction[],
  options: PaymentInstructionDuplicateOptions = {},
): PaymentInstructionDuplicateGroup[] {
  if (!instructions || !Array.isArray(instructions) || instructions.length === 0) {
    return [];
  }

  const validInstructions = instructions.filter(
    (inst): inst is PaymentInstruction => Boolean(inst && typeof inst === "object"),
  );

  if (validInstructions.length === 0) {
    return [];
  }

  const groups: PaymentInstructionDuplicateGroup[] = [];

  // 1. Collision check against existing historical/confirmed instructions
  if (options.existingInstructionIds && options.existingInstructionIds.length > 0) {
    const existingIds = new Set(
      options.existingInstructionIds.map((id) => id.trim().toLowerCase()),
    );
    const collidingInstructions: PaymentInstruction[] = [];

    for (const inst of validInstructions) {
      const id = inst.id?.trim();
      if (id && existingIds.has(id.toLowerCase())) {
        collidingInstructions.push(inst);
      }
    }

    if (collidingInstructions.length > 0) {
      const byCollidingId = groupBy(collidingInstructions, (inst) =>
        (inst.id || "").trim().toLowerCase(),
      );
      Array.from(byCollidingId.entries()).forEach(([normalizedId, rows]) => {
        const rawId = rows[0].id?.trim() || normalizedId;
        groups.push({
          kind: "collision",
          value: rawId,
          message: `Payment instruction '${rawId}' matches an already executed instruction from a previous payroll run.`,
          actionableRemediation:
            "Assign a fresh instruction identifier before continuing to avoid duplicate execution.",
          isBlocking: true,
          instructions: rows,
        });
      });
    }
  }

  // 1b. Collision check against existing batch references if provided
  if (options.existingReferences && options.existingReferences.length > 0) {
    const existingRefs = new Set(
      options.existingReferences.map((ref) => ref.trim().toLowerCase()),
    );
    const collidingRefs = validInstructions.filter((inst) => {
      const ref = inst.reference?.trim();
      return ref && existingRefs.has(ref.toLowerCase());
    });

    if (collidingRefs.length > 0) {
      const byRef = groupBy(collidingRefs, (inst) =>
        (inst.reference || "").trim().toLowerCase(),
      );
      Array.from(byRef.entries()).forEach(([normalizedRef, rows]) => {
        const rawRef = rows[0].reference?.trim() || normalizedRef;
        groups.push({
          kind: "collision",
          value: rawRef,
          message: `Payment instruction reference '${rawRef}' matches an existing payroll reference.`,
          actionableRemediation:
            "Assign a unique payment reference to ensure clean ledger reconciliation.",
          isBlocking: true,
          instructions: rows,
        });
      });
    }
  }

  // If there's only 1 instruction, internal batch duplicates cannot occur
  if (validInstructions.length <= 1) {
    return groups;
  }

  // 2. Duplicate Instruction IDs within the draft
  const withExplicitId = validInstructions.filter(
    (inst) => typeof inst.id === "string" && inst.id.trim().length > 0,
  );
  const byInstructionId = groupBy(withExplicitId, (inst) =>
    (inst.id || "").trim().toLowerCase(),
  );

  Array.from(byInstructionId.entries()).forEach(([normalizedId, rows]) => {
    if (rows.length > 1) {
      const displayId = rows[0].id?.trim() || normalizedId;
      groups.push({
        kind: "instruction_id",
        value: displayId,
        message: `Payment instruction ID '${displayId}' is duplicated across ${rows.length} instructions. Each instruction must have a unique identifier.`,
        actionableRemediation:
          "Assign a distinct ID to each payment instruction before continuing.",
        isBlocking: true,
        instructions: rows,
      });
    }
  });

  // 3. Exact Match Duplicates (same recipient, address, asset, and amount)
  const byExactSignature = groupBy(validInstructions, (inst) => {
    const rId = getInstructionRecipientId(inst).toLowerCase();
    const addr = getInstructionAddress(inst).toUpperCase();
    const asset = getInstructionAsset(inst);
    const amt = getInstructionAmount(inst);
    if (!rId && !addr) return "";
    return `${rId}::${addr}::${asset}::${amt}`;
  });

  Array.from(byExactSignature.entries()).forEach(([signature, rows]) => {
    if (rows.length > 1 && signature) {
      const recipientId = getInstructionRecipientId(rows[0]);
      const asset = getInstructionAsset(rows[0]);
      groups.push({
        kind: "exact_match",
        value: `${recipientId || "recipient"} (${asset})`,
        message: `Identical payment instructions detected for recipient '${recipientId || "unknown"}' in asset ${asset}.`,
        actionableRemediation:
          "Remove duplicate payment instructions to avoid executing identical transfers twice.",
        isBlocking: true,
        instructions: rows,
      });
    }
  });

  // 4. Duplicate Recipient IDs within the batch
  const byRecipient = groupBy(validInstructions, (inst) =>
    getInstructionRecipientId(inst).toLowerCase(),
  );

  Array.from(byRecipient.entries()).forEach(([normalizedRecipient, rows]) => {
    if (rows.length > 1 && normalizedRecipient) {
      const rawRecipient = getInstructionRecipientId(rows[0]);

      // If multi-asset for the same recipient is allowed, check whether assets differ
      if (options.allowMultiAssetForSameRecipient) {
        const assets = new Set(rows.map(getInstructionAsset));
        if (assets.size === rows.length) {
          // All assets are distinct, allowed under multi-asset configuration
          return;
        }
      }

      // Avoid double-flagging if it's already reported under exact_match
      const isAlreadyExactMatch = groups.some(
        (g) =>
          g.kind === "exact_match" &&
          g.instructions.some(
            (inst) =>
              getInstructionRecipientId(inst).toLowerCase() === normalizedRecipient,
          ),
      );

      if (!isAlreadyExactMatch) {
        groups.push({
          kind: "recipient",
          value: rawRecipient,
          message: `Recipient '${rawRecipient}' has ${rows.length} payment instructions in this payroll draft.`,
          actionableRemediation:
            "Consolidate multiple payouts for the same employee into a single instruction or remove redundant rows to prevent double payout.",
          isBlocking: true,
          instructions: rows,
        });
      }
    }
  });

  // 5. Destination Wallet Address Duplication across distinct recipients
  const byAddress = groupBy(validInstructions, (inst) =>
    getInstructionAddress(inst).toUpperCase(),
  );

  Array.from(byAddress.entries()).forEach(([normalizedAddress, rows]) => {
    if (rows.length > 1 && normalizedAddress) {
      const distinctRecipients = new Set(
        rows
          .map((r) => getInstructionRecipientId(r) || getInstructionId(r))
          .filter(Boolean),
      );

      // Only flag as an address duplicate when different recipients share the address
      if (distinctRecipients.size > 1) {
        const rawAddress = getInstructionAddress(rows[0]) || normalizedAddress;
        const masked = maskPaymentAddress(rawAddress);
        const recipientList = Array.from(distinctRecipients).join(", ");
        const isStrict = options.strictAddressUniqueness ?? false;

        groups.push({
          kind: "address",
          value: masked,
          message: `Destination wallet address ${masked} is assigned to ${distinctRecipients.size} different recipients (${recipientList}).`,
          actionableRemediation:
            "Verify destination wallet addresses to confirm whether multiple payouts to the same wallet are intentional.",
          isBlocking: isStrict,
          instructions: rows,
        });
      }
    }
  });

  return groups;
}

/**
 * Validates a list of payment instructions and produces an actionable result.
 */
export function validatePaymentInstructions(
  instructions: PaymentInstruction[],
  options: PaymentInstructionDuplicateOptions = {},
): PaymentInstructionValidationResult {
  const duplicateGroups = findPaymentInstructionDuplicates(instructions, options);
  const hasDuplicates = duplicateGroups.length > 0;
  const isBlocking = duplicateGroups.some((g) => g.isBlocking);
  const blockingCount = duplicateGroups.filter((g) => g.isBlocking).length;
  const warningCount = duplicateGroups.length - blockingCount;

  let summaryMessage: string | null = null;
  if (hasDuplicates) {
    if (blockingCount > 0 && warningCount > 0) {
      summaryMessage = `${blockingCount} duplicate instruction error${
        blockingCount === 1 ? "" : "s"
      } and ${warningCount} warning${
        warningCount === 1 ? "" : "s"
      } detected across payment instructions.`;
    } else if (blockingCount > 0) {
      summaryMessage = `${blockingCount} duplicate payment instruction error${
        blockingCount === 1 ? "" : "s"
      } must be resolved before proceeding.`;
    } else {
      summaryMessage = `${warningCount} duplicate payment instruction warning${
        warningCount === 1 ? "" : "s"
      } detected. Review details before proceeding.`;
    }
  }

  return {
    isValid: !isBlocking,
    hasDuplicates,
    isBlocking,
    duplicateGroups,
    summaryMessage,
  };
}

/**
 * Checks whether adding a new instruction to an existing set produces duplicates.
 */
export function isDuplicatePaymentInstruction(
  instruction: PaymentInstruction,
  existingInstructions: PaymentInstruction[],
  options: PaymentInstructionDuplicateOptions = {},
): boolean {
  const result = validatePaymentInstructions(
    [...existingInstructions, instruction],
    options,
  );
  return result.hasDuplicates;
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    if (!k) continue; // blank/missing values aren't meaningful duplicates
    const existing = map.get(k);
    if (existing) {
      existing.push(item);
    } else {
      map.set(k, [item]);
    }
  }
  return map;
}
