import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NoteHashPreview } from "@/components/payroll/NoteHashPreview";
import { generateNoteHash, validateNoteHash } from "@/lib/privacy/noteHash";

const validHash = "0x8f2a9c3d4e5f60718293a4b5c6d7e8f90123456789abcdef0123456789abcdef";

describe("NoteHashPreview Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders note hash in preview mode when provided and hides raw note text", () => {
    render(
      <NoteHashPreview
        noteHash={validHash}
        rawNote="Secret annual executive compensation memo"
      />
    );

    // Hash should be visible
    expect(screen.getByTestId("hash-preview-display")).toBeInTheDocument();
    expect(screen.getByText(validHash)).toBeInTheDocument();

    // Raw note text must NOT be visible
    expect(
      screen.queryByText("Secret annual executive compensation memo")
    ).not.toBeInTheDocument();

    // Privacy notice should be visible
    expect(
      screen.getByText(/Confidential employee notes or bonus rationales/i)
    ).toBeInTheDocument();
  });

  it("generates SHA-256 hash from note text, displays hash, and removes raw note from view", async () => {
    const user = userEvent.setup();
    const handleHashChange = vi.fn();

    render(
      <NoteHashPreview
        onHashChange={handleHashChange}
      />
    );

    const noteInput = screen.getByPlaceholderText(/Q3 Performance Bonus/i);
    await user.type(noteInput, "Q3 Performance Bonus batch #4");

    const generateBtn = screen.getByTestId("generate-note-hash-btn");
    await user.click(generateBtn);

    await waitFor(() => {
      expect(screen.getByTestId("hash-preview-display")).toBeInTheDocument();
      expect(handleHashChange).toHaveBeenCalled();
    });

    // Raw note input should not be visible in preview mode
    expect(screen.queryByPlaceholderText(/Q3 Performance Bonus/i)).not.toBeInTheDocument();
  });

  it("shows validation error on invalid hash input", async () => {
    const user = userEvent.setup();

    render(<NoteHashPreview />);

    const hashInput = screen.getByPlaceholderText("0x...");
    await user.type(hashInput, "0x" + "z".repeat(64));

    expect(screen.getByTestId("note-hash-error")).toBeInTheDocument();
    expect(screen.getByText(/Invalid characters in note hash/i)).toBeInTheDocument();
  });

  it("copies note hash to clipboard with copied feedback", async () => {
    const user = userEvent.setup();
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: writeTextMock,
      },
      configurable: true,
      writable: true,
    });

    render(<NoteHashPreview noteHash={validHash} />);

    const copyBtn = screen.getByTestId("copy-note-hash-btn");
    await user.click(copyBtn);

    expect(writeTextMock).toHaveBeenCalledWith(validHash);
    expect(screen.getByText("Copied!")).toBeInTheDocument();
  });

  it("allows switching back to input mode using Change Note button", async () => {
    const user = userEvent.setup();
    const handleHashChange = vi.fn();

    render(
      <NoteHashPreview
        noteHash={validHash}
        onHashChange={handleHashChange}
      />
    );

    const changeBtn = screen.getByRole("button", { name: /Change Note/i });
    await user.click(changeBtn);

    expect(screen.getByPlaceholderText(/Q3 Performance Bonus/i)).toBeInTheDocument();
    expect(handleHashChange).toHaveBeenCalledWith("");
  });
});
