import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { PauseStatusBanner } from "@/components/status/PauseStatusBanner";
import type { PauseStatus } from "@/lib/sdk/pauseStatus";

vi.mock("@/lib/sdk/pauseStatus", () => ({
  fetchPauseStatus: vi.fn(),
}));

import { fetchPauseStatus } from "@/lib/sdk/pauseStatus";
import { useCompanyWarningsStore } from "@/stores/companyWarnings";
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

describe("PauseStatusBanner long-lived page refresh (#842)", () => {
  const PAUSED = { paused: true, categories: ["payroll"] } as PauseStatus;
  const ACTIVE = { paused: false, categories: [] } as PauseStatus;

  const flush = () => act(async () => {});
  const advance = (ms: number) =>
    act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  const setVisibility = (state: "visible" | "hidden") => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    setVisibility("visible");
  });

  it("keeps the same banner element while a background poll runs", async () => {
    mockFetch.mockReturnValue(PAUSED);
    render(<PauseStatusBanner />);
    await flush();
    const banner = screen.getByRole("alert");

    await advance(30_000);

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Same node: it was not unmounted and re-announced by the poll.
    expect(screen.getByRole("alert")).toBe(banner);
  });

  it("hides the banner when a later poll reports the pause lifted", async () => {
    mockFetch.mockReturnValue(PAUSED);
    render(<PauseStatusBanner />);
    await flush();
    expect(screen.getByRole("alert")).toBeInTheDocument();

    mockFetch.mockReturnValue(ACTIVE);
    await advance(30_000);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the banner again if the page is re-paused after a dismissal and a resume", async () => {
    mockFetch.mockReturnValue(PAUSED);
    render(<PauseStatusBanner />);
    await flush();
    fireEvent.click(screen.getByLabelText(/dismiss/i));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    mockFetch.mockReturnValue(ACTIVE);
    await advance(30_000);
    mockFetch.mockReturnValue(PAUSED);
    await advance(30_000);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("keeps a dismissal while the same pause is still active", async () => {
    mockFetch.mockReturnValue(PAUSED);
    render(<PauseStatusBanner />);
    await flush();
    fireEvent.click(screen.getByLabelText(/dismiss/i));

    await advance(60_000);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refreshes immediately when the tab becomes visible again", async () => {
    mockFetch.mockReturnValue(ACTIVE);
    render(<PauseStatusBanner />);
    await flush();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    mockFetch.mockReturnValue(PAUSED);
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("refreshes when the window regains focus", async () => {
    mockFetch.mockReturnValue(ACTIVE);
    render(<PauseStatusBanner />);
    await flush();

    mockFetch.mockReturnValue(PAUSED);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("does not refresh when the visibility change is to hidden", async () => {
    mockFetch.mockReturnValue(ACTIVE);
    render(<PauseStatusBanner />);
    await flush();
    mockFetch.mockClear();

    setVisibility("hidden");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await flush();

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("re-reads persisted state and refetches when another tab changes it", async () => {
    const rehydrate = vi
      .spyOn(useCompanyWarningsStore.persist, "rehydrate")
      .mockResolvedValue(undefined);
    mockFetch.mockReturnValue(ACTIVE);
    render(<PauseStatusBanner />);
    await flush();
    mockFetch.mockClear();

    mockFetch.mockReturnValue(PAUSED);
    await act(async () => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "zk-payroll-company-warnings" }),
      );
    });
    await flush();

    expect(rehydrate).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("ignores storage events for unrelated keys", async () => {
    const rehydrate = vi
      .spyOn(useCompanyWarningsStore.persist, "rehydrate")
      .mockResolvedValue(undefined);
    mockFetch.mockReturnValue(ACTIVE);
    render(<PauseStatusBanner />);
    await flush();
    mockFetch.mockClear();

    await act(async () => {
      window.dispatchEvent(new StorageEvent("storage", { key: "some-other-key" }));
    });
    await flush();

    expect(rehydrate).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("still refetches if rehydrating persisted state fails", async () => {
    vi.spyOn(useCompanyWarningsStore.persist, "rehydrate").mockRejectedValue(
      new Error("storage unavailable"),
    );
    mockFetch.mockReturnValue(ACTIVE);
    render(<PauseStatusBanner />);
    await flush();
    mockFetch.mockClear();

    mockFetch.mockReturnValue(PAUSED);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("keeps showing the last known pause when a background refresh fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockFetch.mockReturnValue(PAUSED);
    render(<PauseStatusBanner />);
    await flush();

    mockFetch.mockImplementation(() => {
      throw new Error("transient failure");
    });
    await advance(30_000);

    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("stops polling and removes listeners on unmount", async () => {
    mockFetch.mockReturnValue(PAUSED);
    const { unmount } = render(<PauseStatusBanner />);
    await flush();
    unmount();
    mockFetch.mockClear();

    await advance(60_000);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    await flush();

    expect(mockFetch).not.toHaveBeenCalled();
  });
});
