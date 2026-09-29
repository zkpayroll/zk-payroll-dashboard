import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AttachmentMetadataViewer from "@/components/features/attachments/AttachmentMetadataViewer";

const metadata = {
  fileName: "approval-note.pdf",
  uploadedAt: "2025-03-28T10:31:00Z",
  owner: "Treasury Reviewer",
  checksum: "sha256:abc123",
  accessScope: "read-only" as const,
};

describe("AttachmentMetadataViewer", () => {
  it("reveals metadata without exposing file contents", () => {
    render(<AttachmentMetadataViewer metadata={metadata} />);

    fireEvent.click(
      screen.getByRole("button", { name: /view attachment metadata/i }),
    );

    expect(screen.getByText("approval-note.pdf")).toBeInTheDocument();
    expect(screen.getByText("Treasury Reviewer")).toBeInTheDocument();
    expect(screen.getByText("sha256:abc123")).toBeInTheDocument();
    expect(screen.getByText("Read-only")).toBeInTheDocument();
    expect(
      screen.getByText(/restricted file contents are not available/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows a clear state when metadata is unavailable", () => {
    render(<AttachmentMetadataViewer metadata={null} />);

    expect(
      screen.getByText("Attachment metadata unavailable"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
