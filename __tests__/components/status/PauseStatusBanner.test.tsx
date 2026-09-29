import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { PauseStatusBanner } from "@/components/status/PauseStatusBanner";
import type { PauseStatus } from "@/lib/sdk/pauseStatus";

vi.mock("@/lib/sdk/pauseStatus", () => ({
  fetchPauseStatus: vi.fn(),
}));

import { fetchPauseStatus } from "@/lib/sdk/pauseStatus";
const mockFetch = fetchPauseStatus as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PauseStatusBanner", () => {
  it("renders nothing when pause is inactive", async () => {
    mockFetch.mockReturnValue({ paused: false, categories: [] } as PauseStatus);
    const { container } = render(<PauseStatusBanner />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders banner when pause is active", async () => {
    mockFetch.mockReturnValue({
      paused: true,
      categories: ["payroll", "treasury"],
    } as PauseStatus);
    render(<PauseStatusBanner />);
    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByText(/Payroll processing/i)).toBeInTheDocument();
    expect(screen.getByText(/Treasury operations/i)).toBeInTheDocument();
  });

  it("shows all four categories when categories array is empty but paused=true", async () => {
    mockFetch.mockReturnValue({
      paused: true,
      categories: [],
    } as PauseStatus);
    render(<PauseStatusBanner />);
    await waitFor(() => screen.getByRole("alert"));
    expect(screen.getByText(/Payroll processing/i)).toBeInTheDocument();
    expect(screen.getByText(/Treasury operations/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit submissions/i)).toBeInTheDocument();
    expect(screen.getByText(/Admin actions/i)).toBeInTheDocument();
  });

  it("dismisses banner on dismiss button click", async () => {
    mockFetch.mockReturnValue({
      paused: true,
      categories: ["payroll"],
    } as PauseStatus);
    render(<PauseStatusBanner />);
    await waitFor(() => screen.getByRole("alert"));
    fireEvent.click(screen.getByLabelText(/dismiss/i));
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("calls refresh on refresh button click", async () => {
    mockFetch.mockReturnValue({
      paused: true,
      categories: ["admin"],
    } as PauseStatus);
    render(<PauseStatusBanner />);
    await waitFor(() => screen.getByRole("alert"));
    fireEvent.click(screen.getByLabelText(/refresh/i));
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(2));
  });

  it("renders nothing when SDK fetch fails", async () => {
    mockFetch.mockImplementation(() => {
      throw new Error("network error");
    });
    const { container } = render(<PauseStatusBanner />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("displays custom reason when provided", async () => {
    mockFetch.mockReturnValue({
      paused: true,
      categories: ["payroll"],
      reason: "Scheduled maintenance",
    } as PauseStatus);
    render(<PauseStatusBanner />);
    await waitFor(() =>
      expect(
        screen.getByText(/Scheduled maintenance/i),
      ).toBeInTheDocument(),
    );
  });
});
