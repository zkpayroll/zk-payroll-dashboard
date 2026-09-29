import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  findPaymentInstructionDuplicates,
  validatePaymentInstructions,
  isDuplicatePaymentInstruction,
  maskPaymentAddress,
  employeeToPaymentInstruction,
  findDuplicateEmployeeWarnings,
  getInstructionId,
  getInstructionRecipientId,
  getInstructionAddress,
  getInstructionAmount,
  getInstructionAsset,
  type PaymentInstruction,
} from "@/lib/duplicateDetection";
import { PaymentInstructionDuplicateWarning } from "@/components/features/payroll/PaymentInstructionDuplicateWarning";
import { DuplicateWarningPanel } from "@/components/employees/DuplicateWarningPanel";
import type { Employee } from "@/types/models";

// ─── Test Fixtures ────────────────────────────────────────────────────────────

const STELLAR_ADDR_1 = "GDQP2KPQGKIHYJGXNUIYOMHARUARCA7DJT5FO2FFOOKY3IFORW2A4W37";
const STELLAR_ADDR_2 = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";
const STELLAR_ADDR_3 = "GCKFJ32L5DOWM3L5BKYW67H3P45V4V6Z7K5YV3Q8M2N3L4P5Q6R7S8T9";

const SAMPLE_INSTRUCTIONS: PaymentInstruction[] = [
  {
    id: "INS-001",
    employeeId: "emp_001",
    name: "Alice Adams",
    recipientAddress: STELLAR_ADDR_1,
    amount: 5000,
    asset: "USDC",
    reference: "REF-2026-01",
  },
  {
    id: "INS-002",
    employeeId: "emp_002",
    name: "Bob Brown",
    recipientAddress: STELLAR_ADDR_2,
    amount: 6000,
    asset: "USDC",
    reference: "REF-2026-02",
  },
  {
    id: "INS-003",
    employeeId: "emp_003",
    name: "Charlie Clark",
    recipientAddress: STELLAR_ADDR_3,
    amount: 7000,
    asset: "USDC",
    reference: "REF-2026-03",
  },
];

const SAMPLE_EMPLOYEES: Employee[] = [
  {
    id: "emp_001",
    name: "Alice Adams",
    address: STELLAR_ADDR_1,
    salary: 5000,
  },
  {
    id: "emp_002",
    name: "Bob Brown",
    address: STELLAR_ADDR_2,
    salary: 6000,
  },
];

// ─── Unit Tests: Core Detection and Validation (#633) ─────────────────────────

describe("Payment Instruction Duplicate Detection (#633)", () => {
  describe("Success Paths", () => {
    it("returns valid and no duplicates for an empty instruction list", () => {
      const result = validatePaymentInstructions([]);
      expect(result.isValid).toBe(true);
      expect(result.hasDuplicates).toBe(false);
      expect(result.isBlocking).toBe(false);
      expect(result.duplicateGroups).toHaveLength(0);
      expect(result.summaryMessage).toBeNull();
    });

    it("returns valid and no duplicates for a single instruction", () => {
      const result = validatePaymentInstructions([SAMPLE_INSTRUCTIONS[0]]);
      expect(result.isValid).toBe(true);
      expect(result.hasDuplicates).toBe(false);
      expect(result.duplicateGroups).toHaveLength(0);
    });

    it("returns valid for a batch of distinct, unique payment instructions", () => {
      const result = validatePaymentInstructions(SAMPLE_INSTRUCTIONS);
      expect(result.isValid).toBe(true);
      expect(result.hasDuplicates).toBe(false);
      expect(result.isBlocking).toBe(false);
      expect(result.duplicateGroups).toHaveLength(0);
      expect(result.summaryMessage).toBeNull();
    });

    it("allows multi-asset instructions for the same recipient when configured", () => {
      const multiAssetInstructions: PaymentInstruction[] = [
        {
          id: "INS-001-USDC",
          employeeId: "emp_001",
          recipientAddress: STELLAR_ADDR_1,
          amount: 5000,
          asset: "USDC",
        },
        {
          id: "INS-001-XLM",
          employeeId: "emp_001",
          recipientAddress: STELLAR_ADDR_1,
          amount: 1500,
          asset: "XLM",
        },
      ];

      const result = validatePaymentInstructions(multiAssetInstructions, {
        allowMultiAssetForSameRecipient: true,
      });

      expect(result.isValid).toBe(true);
      expect(result.hasDuplicates).toBe(false);
    });

    it("maps an Employee model to PaymentInstruction seamlessly", () => {
      const instruction = employeeToPaymentInstruction(SAMPLE_EMPLOYEES[0]);
      expect(instruction.id).toBe("emp_001");
      expect(instruction.employeeId).toBe("emp_001");
      expect(instruction.name).toBe("Alice Adams");
      expect(instruction.recipientAddress).toBe(STELLAR_ADDR_1);
      expect(instruction.amount).toBe(5000);
      expect(instruction.asset).toBe("USDC");
    });

    it("handles property aliasing (address, walletAddress, salary, assetCode)", () => {
      const aliasedInstruction: PaymentInstruction = {
        id: "INS-ALIAS",
        employeeId: "emp_alias",
        address: STELLAR_ADDR_1,
        salary: 4500,
        assetCode: "USDC",
      };

      const result = validatePaymentInstructions([aliasedInstruction]);
      expect(result.isValid).toBe(true);
      expect(result.hasDuplicates).toBe(false);
    });

    it("helper accessors safely return defaults for null or undefined instructions", () => {
      expect(getInstructionId(null, 0)).toBe("inst_1");
      expect(getInstructionId(undefined, 2)).toBe("inst_3");
      expect(getInstructionRecipientId(null)).toBe("");
      expect(getInstructionAddress(null)).toBe("");
      expect(getInstructionAmount(null)).toBe(0);
      expect(getInstructionAsset(null)).toBe("USDC");
    });
  });

  describe("Failure Paths", () => {
    it("detects duplicate instruction IDs (blocking)", () => {
      const duplicateIdInstructions: PaymentInstruction[] = [
        { ...SAMPLE_INSTRUCTIONS[0], id: "INS-SAME" },
        { ...SAMPLE_INSTRUCTIONS[1], id: "INS-SAME" },
      ];

      const result = validatePaymentInstructions(duplicateIdInstructions);
      expect(result.isValid).toBe(false);
      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(true);

      const group = result.duplicateGroups.find((g) => g.kind === "instruction_id");
      expect(group).toBeDefined();
      expect(group?.isBlocking).toBe(true);
      expect(group?.value).toBe("INS-SAME");
      expect(group?.message).toMatch(/Payment instruction ID 'INS-SAME' is duplicated/i);
      expect(group?.actionableRemediation).toMatch(/Assign a distinct ID/i);
      expect(group?.instructions).toHaveLength(2);
    });

    it("detects duplicate recipients in the same draft (blocking)", () => {
      const duplicateRecipientInstructions: PaymentInstruction[] = [
        { ...SAMPLE_INSTRUCTIONS[0], id: "INS-001", employeeId: "emp_001" },
        { ...SAMPLE_INSTRUCTIONS[1], id: "INS-002", employeeId: "emp_001" },
      ];

      const result = validatePaymentInstructions(duplicateRecipientInstructions);
      expect(result.isValid).toBe(false);
      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(true);

      const group = result.duplicateGroups.find((g) => g.kind === "recipient");
      expect(group).toBeDefined();
      expect(group?.value).toBe("emp_001");
      expect(group?.message).toMatch(/Recipient 'emp_001' has 2 payment instructions/i);
      expect(group?.actionableRemediation).toMatch(/Consolidate multiple payouts/i);
    });

    it("blocks multi-asset instructions for the same recipient by default", () => {
      const multiAssetInstructions: PaymentInstruction[] = [
        {
          id: "INS-001-USDC",
          employeeId: "emp_001",
          recipientAddress: STELLAR_ADDR_1,
          amount: 5000,
          asset: "USDC",
        },
        {
          id: "INS-001-XLM",
          employeeId: "emp_001",
          recipientAddress: STELLAR_ADDR_2,
          amount: 1500,
          asset: "XLM",
        },
      ];

      // allowMultiAssetForSameRecipient is omitted (defaults to false)
      const result = validatePaymentInstructions(multiAssetInstructions);
      expect(result.isValid).toBe(false);
      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(true);
      const group = result.duplicateGroups.find((g) => g.kind === "recipient");
      expect(group).toBeDefined();
    });

    it("detects exact duplicate payment instructions (blocking)", () => {
      const exactDuplicateInstructions: PaymentInstruction[] = [
        { ...SAMPLE_INSTRUCTIONS[0], id: "INS-001" },
        { ...SAMPLE_INSTRUCTIONS[0], id: "INS-002" }, // same recipient, addr, asset, amount
      ];

      const result = validatePaymentInstructions(exactDuplicateInstructions);
      expect(result.isValid).toBe(false);
      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(true);

      const exactGroup = result.duplicateGroups.find((g) => g.kind === "exact_match");
      expect(exactGroup).toBeDefined();
      expect(exactGroup?.message).toMatch(/Identical payment instructions detected/i);
      expect(exactGroup?.actionableRemediation).toMatch(/Remove duplicate payment instructions/i);
    });

    it("detects shared destination address across different recipients (warning by default)", () => {
      const sharedAddressInstructions: PaymentInstruction[] = [
        { ...SAMPLE_INSTRUCTIONS[0], recipientAddress: STELLAR_ADDR_1, employeeId: "emp_001" },
        { ...SAMPLE_INSTRUCTIONS[1], recipientAddress: STELLAR_ADDR_1, employeeId: "emp_002" },
      ];

      const result = validatePaymentInstructions(sharedAddressInstructions);
      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(false); // warning by default
      expect(result.isValid).toBe(true);

      const group = result.duplicateGroups.find((g) => g.kind === "address");
      expect(group).toBeDefined();
      expect(group?.isBlocking).toBe(false);
      expect(group?.message).toMatch(/Destination wallet address/i);
      expect(group?.actionableRemediation).toMatch(/Verify destination wallet addresses/i);
      expect(group?.instructions).toHaveLength(2);
      expect(result.summaryMessage).toMatch(/1 duplicate payment instruction warning detected/i);
    });

    it("treats shared destination address as blocking when strictAddressUniqueness is enabled", () => {
      const sharedAddressInstructions: PaymentInstruction[] = [
        { ...SAMPLE_INSTRUCTIONS[0], recipientAddress: STELLAR_ADDR_1, employeeId: "emp_001" },
        { ...SAMPLE_INSTRUCTIONS[1], recipientAddress: STELLAR_ADDR_1, employeeId: "emp_002" },
      ];

      const result = validatePaymentInstructions(sharedAddressInstructions, {
        strictAddressUniqueness: true,
      });

      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(true);
      expect(result.isValid).toBe(false);
      expect(result.summaryMessage).toMatch(/1 duplicate payment instruction error must be resolved/i);
    });

    it("detects collision against existing executed instruction IDs (blocking)", () => {
      const result = validatePaymentInstructions(SAMPLE_INSTRUCTIONS, {
        existingInstructionIds: ["INS-002", "INS-HISTORICAL"],
      });

      expect(result.isValid).toBe(false);
      expect(result.isBlocking).toBe(true);

      const group = result.duplicateGroups.find((g) => g.kind === "collision");
      expect(group).toBeDefined();
      expect(group?.value).toBe("INS-002");
      expect(group?.message).toMatch(/matches an already executed instruction/i);
      expect(group?.actionableRemediation).toMatch(/Assign a fresh instruction identifier/i);
    });

    it("detects collision against existing batch references (blocking)", () => {
      const result = validatePaymentInstructions(SAMPLE_INSTRUCTIONS, {
        existingReferences: ["REF-2026-01"],
      });

      expect(result.isValid).toBe(false);
      const group = result.duplicateGroups.find((g) => g.kind === "collision");
      expect(group).toBeDefined();
      expect(group?.value).toBe("REF-2026-01");
      expect(group?.message).toMatch(/matches an existing payroll reference/i);
    });
  });

  describe("Edge Cases", () => {
    it("handles case-insensitive instruction IDs and whitespace trimming", () => {
      const instructions: PaymentInstruction[] = [
        { ...SAMPLE_INSTRUCTIONS[0], id: "  ins-001  " },
        { ...SAMPLE_INSTRUCTIONS[1], id: "INS-001" },
      ];

      const result = validatePaymentInstructions(instructions);
      expect(result.isBlocking).toBe(true);
      const group = result.duplicateGroups.find((g) => g.kind === "instruction_id");
      expect(group).toBeDefined();
    });

    it("handles case-insensitive and whitespace-padded destination addresses", () => {
      const instructions: PaymentInstruction[] = [
        {
          id: "INS-1",
          employeeId: "emp_1",
          recipientAddress: "  " + STELLAR_ADDR_1.toLowerCase() + "  ",
          amount: 1000,
        },
        {
          id: "INS-2",
          employeeId: "emp_2",
          recipientAddress: STELLAR_ADDR_1.toUpperCase(),
          amount: 2000,
        },
      ];

      const result = validatePaymentInstructions(instructions);
      expect(result.hasDuplicates).toBe(true);
      const group = result.duplicateGroups.find((g) => g.kind === "address");
      expect(group).toBeDefined();
      expect(group?.value).toBe("GDQP2K…4W37");
    });

    it("handles case-insensitive existing instruction ID collision check", () => {
      const instructions: PaymentInstruction[] = [
        { ...SAMPLE_INSTRUCTIONS[0], id: "ins-new-001" },
      ];

      const result = validatePaymentInstructions(instructions, {
        existingInstructionIds: ["  INS-NEW-001  "],
      });

      expect(result.isBlocking).toBe(true);
      const group = result.duplicateGroups.find((g) => g.kind === "collision");
      expect(group).toBeDefined();
      expect(group?.value).toBe("ins-new-001");
    });

    it("safely handles nullish or non-object elements in instructions array", () => {
      const sparseInstructions = [
        SAMPLE_INSTRUCTIONS[0],
        null as unknown as PaymentInstruction,
        undefined as unknown as PaymentInstruction,
        SAMPLE_INSTRUCTIONS[1],
      ];

      const result = validatePaymentInstructions(sparseInstructions);
      expect(result.isValid).toBe(true);
      expect(result.hasDuplicates).toBe(false);
    });

    it("handles multiple duplicate types occurring simultaneously in a single batch", () => {
      const mixedInstructions: PaymentInstruction[] = [
        // Duplicate ID pair:
        { id: "INS-DUP", employeeId: "emp_001", recipientAddress: STELLAR_ADDR_1, amount: 1000 },
        { id: "INS-DUP", employeeId: "emp_002", recipientAddress: STELLAR_ADDR_2, amount: 2000 },
        // Shared address pair:
        { id: "INS-003", employeeId: "emp_003", recipientAddress: STELLAR_ADDR_3, amount: 3000 },
        { id: "INS-004", employeeId: "emp_004", recipientAddress: STELLAR_ADDR_3, amount: 4000 },
      ];

      const result = validatePaymentInstructions(mixedInstructions);
      expect(result.hasDuplicates).toBe(true);
      expect(result.isBlocking).toBe(true);
      expect(result.duplicateGroups.length).toBeGreaterThanOrEqual(2);

      const hasIdDup = result.duplicateGroups.some((g) => g.kind === "instruction_id");
      const hasAddrDup = result.duplicateGroups.some((g) => g.kind === "address");
      expect(hasIdDup).toBe(true);
      expect(hasAddrDup).toBe(true);

      expect(result.summaryMessage).toMatch(/1 duplicate instruction error and 1 warning detected/i);
    });

    it("isDuplicatePaymentInstruction returns correct boolean status", () => {
      const existing = [SAMPLE_INSTRUCTIONS[0]];
      const duplicateInst = { ...SAMPLE_INSTRUCTIONS[1], id: "INS-001" }; // id collides with existing
      const uniqueInst = { ...SAMPLE_INSTRUCTIONS[1], id: "INS-002" };

      expect(isDuplicatePaymentInstruction(duplicateInst, existing)).toBe(true);
      expect(isDuplicatePaymentInstruction(uniqueInst, existing)).toBe(false);
    });

    it("maskPaymentAddress properly handles long, short, whitespace, and nullish addresses", () => {
      expect(maskPaymentAddress(STELLAR_ADDR_1)).toBe("GDQP2K…4W37");
      expect(maskPaymentAddress("  " + STELLAR_ADDR_1 + "  ")).toBe("GDQP2K…4W37");
      expect(maskPaymentAddress("short")).toBe("short");
      expect(maskPaymentAddress("123456789012")).toBe("123456789012");
      expect(maskPaymentAddress("")).toBe("");
      expect(maskPaymentAddress(null)).toBe("");
      expect(maskPaymentAddress(undefined)).toBe("");
    });

    it("guarantees privacy: error messages and values never expose raw salary amounts or unmasked keys", () => {
      const duplicates: PaymentInstruction[] = [
        {
          id: "INS-SECRET-DUP",
          employeeId: "emp_998",
          recipientAddress: STELLAR_ADDR_1,
          amount: 999999,
          asset: "USDC",
        },
        {
          id: "INS-SECRET-DUP",
          employeeId: "emp_999",
          recipientAddress: STELLAR_ADDR_1,
          amount: 999999,
          asset: "USDC",
        },
      ];

      const result = validatePaymentInstructions(duplicates);
      expect(result.duplicateGroups.length).toBeGreaterThanOrEqual(2);

      const addressGroup = result.duplicateGroups.find((g) => g.kind === "address");
      expect(addressGroup).toBeDefined();
      expect(addressGroup?.value).toBe("GDQP2K…4W37");

      for (const group of result.duplicateGroups) {
        // Must never leak raw salary amount in message or remediation
        expect(group.message).not.toMatch(/999999/);
        expect(group.actionableRemediation).not.toMatch(/999999/);
        // Stellar addresses in messages must be masked
        expect(group.message).not.toContain(STELLAR_ADDR_1);
      }
    });

    it("preserves backward compatibility with findDuplicateEmployeeWarnings (#366)", () => {
      const duplicateEmployees: Employee[] = [
        { id: "emp_001", name: "Alice", address: STELLAR_ADDR_1, salary: 5000 },
        { id: "emp_001", name: "Alice Dupe", address: STELLAR_ADDR_1, salary: 5000 },
      ];

      const warnings = findDuplicateEmployeeWarnings(duplicateEmployees);
      expect(warnings).toHaveLength(1);
      expect(warnings[0].kind).toBe("id");
      expect(warnings[0].value).toBe("emp_001");
      expect(warnings[0].employees).toHaveLength(2);
    });
  });
});

// ─── Component Tests: PaymentInstructionDuplicateWarning ──────────────────────

describe("PaymentInstructionDuplicateWarning Component Tests (#633)", () => {
  it("renders nothing when instructions have no duplicates", () => {
    const { container } = render(
      <PaymentInstructionDuplicateWarning instructions={SAMPLE_INSTRUCTIONS} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders an accessible warning alert when duplicate instructions are detected", () => {
    const duplicateInstructions: PaymentInstruction[] = [
      { ...SAMPLE_INSTRUCTIONS[0], id: "INS-DUP" },
      { ...SAMPLE_INSTRUCTIONS[1], id: "INS-DUP" },
    ];

    render(
      <PaymentInstructionDuplicateWarning instructions={duplicateInstructions} />,
    );

    const banner = screen.getByTestId("payment-instruction-duplicate-warning");
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveAttribute("role", "alert");
    expect(
      screen.getByRole("heading", { name: /duplicate payment instruction/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Blocking")).toBeInTheDocument();
    expect(screen.getByText(/Duplicate Instruction ID/i)).toBeInTheDocument();
    expect(screen.getByText("INS-DUP")).toBeInTheDocument();
  });

  it("renders actionable remediation advice and affected instruction chips", () => {
    const duplicateInstructions: PaymentInstruction[] = [
      { id: "INS-001", employeeId: "emp_001", name: "Alice", recipientAddress: STELLAR_ADDR_1, amount: 5000 },
      { id: "INS-002", employeeId: "emp_001", name: "Alice", recipientAddress: STELLAR_ADDR_1, amount: 6000 }, // differing amounts
    ];

    render(
      <PaymentInstructionDuplicateWarning instructions={duplicateInstructions} />,
    );

    expect(screen.getByText(/Remediation:/i)).toBeInTheDocument();
    expect(screen.getByText(/Consolidate multiple payouts/i)).toBeInTheDocument();
    expect(screen.getByText(/Affected instructions:/i)).toBeInTheDocument();
    expect(screen.getByText("INS-001:")).toBeInTheDocument();
    expect(screen.getByText("INS-002:")).toBeInTheDocument();
    expect(screen.getAllByText("Alice").length).toBeGreaterThanOrEqual(1);
  });

  it("renders fallback index labels when instructions lack explicit IDs", () => {
    const duplicateInstructions: PaymentInstruction[] = [
      { employeeId: "emp_001", name: "Alice", recipientAddress: STELLAR_ADDR_1, amount: 5000 },
      { employeeId: "emp_001", name: "Alice", recipientAddress: STELLAR_ADDR_1, amount: 6000 },
    ];

    render(
      <PaymentInstructionDuplicateWarning instructions={duplicateInstructions} />,
    );

    expect(screen.getByText("inst_1:")).toBeInTheDocument();
    expect(screen.getByText("inst_2:")).toBeInTheDocument();
  });

  it("renders properly when duplicateGroups prop is passed directly", () => {
    const mockGroups = [
      {
        kind: "instruction_id" as const,
        value: "INS-DIRECT",
        message: "Duplicate instruction ID INS-DIRECT detected.",
        actionableRemediation: "Assign a unique ID.",
        isBlocking: true,
        instructions: [SAMPLE_INSTRUCTIONS[0]],
      },
    ];

    render(
      <PaymentInstructionDuplicateWarning duplicateGroups={mockGroups} />,
    );

    expect(screen.getByTestId("payment-instruction-duplicate-warning")).toBeInTheDocument();
    expect(screen.getByText("INS-DIRECT")).toBeInTheDocument();
    expect(screen.getByText("Blocking")).toBeInTheDocument();
  });

  it("renders properly when validationResult prop is passed directly", () => {
    const mockResult = {
      isValid: false,
      hasDuplicates: true,
      isBlocking: true,
      duplicateGroups: [
        {
          kind: "collision" as const,
          value: "INS-CONFIRMED",
          message: "Matches previously executed instruction.",
          actionableRemediation: "Choose a new identifier.",
          isBlocking: true,
          instructions: [SAMPLE_INSTRUCTIONS[0]],
        },
      ],
      summaryMessage: "1 duplicate payment instruction error must be resolved before proceeding.",
    };

    render(
      <PaymentInstructionDuplicateWarning validationResult={mockResult} />,
    );

    expect(screen.getByText("Execution Collision")).toBeInTheDocument();
    expect(screen.getByText("INS-CONFIRMED")).toBeInTheDocument();
    expect(screen.getByText(/1 duplicate payment instruction error must be resolved/i)).toBeInTheDocument();
  });

  it("triggers onResolveDuplicate callback when clicking resolve", () => {
    const duplicateInstructions: PaymentInstruction[] = [
      { ...SAMPLE_INSTRUCTIONS[0], id: "INS-DUP" },
      { ...SAMPLE_INSTRUCTIONS[1], id: "INS-DUP" },
    ];

    const onResolve = vi.fn();
    render(
      <PaymentInstructionDuplicateWarning
        instructions={duplicateInstructions}
        onResolveDuplicate={onResolve}
      />,
    );

    const resolveBtn = screen.getByRole("button", { name: /Resolve/i });
    fireEvent.click(resolveBtn);
    expect(onResolve).toHaveBeenCalledTimes(1);
    expect(onResolve).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "instruction_id" }),
    );
  });

  it("triggers onDismiss callback when clicking close button", () => {
    const duplicateInstructions: PaymentInstruction[] = [
      { ...SAMPLE_INSTRUCTIONS[0], id: "INS-DUP" },
      { ...SAMPLE_INSTRUCTIONS[1], id: "INS-DUP" },
    ];

    const onDismiss = vi.fn();
    render(
      <PaymentInstructionDuplicateWarning
        instructions={duplicateInstructions}
        onDismiss={onDismiss}
      />,
    );

    const dismissBtn = screen.getByRole("button", {
      name: /Dismiss duplicate payment instruction warning/i,
    });
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("guarantees privacy in rendered DOM: full address is masked and amounts are never exposed", () => {
    const duplicateInstructions: PaymentInstruction[] = [
      {
        id: "INS-1",
        employeeId: "emp_001",
        recipientAddress: STELLAR_ADDR_1,
        amount: 88888,
      },
      {
        id: "INS-2",
        employeeId: "emp_002",
        recipientAddress: STELLAR_ADDR_1,
        amount: 88888,
      },
    ];

    render(
      <PaymentInstructionDuplicateWarning instructions={duplicateInstructions} />,
    );

    // Full 56-character Stellar address should NEVER appear in DOM text
    expect(document.body.textContent).not.toContain(STELLAR_ADDR_1);
    // Masked address should appear
    expect(document.body.textContent).toContain("GDQP2K…4W37");
    // Raw salary amount must not be leaked into DOM text
    expect(document.body.textContent).not.toContain("88888");
  });
});

// ─── Component Tests: DuplicateWarningPanel Backward Compatibility ───────────

describe("DuplicateWarningPanel Backward Compatibility (#366, #633)", () => {
  it("renders employee duplicate warnings when passed employees prop", () => {
    const duplicateEmployees: Employee[] = [
      { id: "emp_001", name: "Alice", address: STELLAR_ADDR_1, salary: 5000 },
      { id: "emp_001", name: "Alice Dupe", address: STELLAR_ADDR_1, salary: 5000 },
    ];

    render(<DuplicateWarningPanel employees={duplicateEmployees} />);

    expect(screen.getByText(/1 duplicate found in this draft/i)).toBeInTheDocument();
    expect(screen.getByText(/Duplicate employee/i)).toBeInTheDocument();
  });

  it("delegates to PaymentInstructionDuplicateWarning when passed instructions prop", () => {
    const duplicateInstructions: PaymentInstruction[] = [
      { ...SAMPLE_INSTRUCTIONS[0], id: "INS-DUP" },
      { ...SAMPLE_INSTRUCTIONS[1], id: "INS-DUP" },
    ];

    render(<DuplicateWarningPanel instructions={duplicateInstructions} />);

    expect(screen.getByTestId("payment-instruction-duplicate-warning")).toBeInTheDocument();
    expect(screen.getByText(/Duplicate Instruction ID/i)).toBeInTheDocument();
  });

  it("renders nothing when instructions prop is empty or has no duplicates", () => {
    const { container: emptyContainer } = render(
      <DuplicateWarningPanel instructions={[]} />,
    );
    expect(emptyContainer).toBeEmptyDOMElement();

    const { container: cleanContainer } = render(
      <DuplicateWarningPanel instructions={SAMPLE_INSTRUCTIONS} />,
    );
    expect(cleanContainer).toBeEmptyDOMElement();
  });
});
