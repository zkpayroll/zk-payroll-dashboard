/// <reference types="vitest/globals" />
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";
import EnvironmentSwitcher from "@/components/features/network/EnvironmentSwitcher";
import { useEnvironmentStore } from "@/stores/environment";
import { useWalletStore } from "@/stores/walletStore";

describe("EnvironmentSwitcher", () => {
  beforeEach(() => {
    useEnvironmentStore.setState({
      activeProfile: "testnet",
      customProfile: null,
      validationError: null,
      isConnecting: false,
      connectionStatus: "unknown",
    });
    useWalletStore.setState({
      network: "TESTNET",
      networkPassphrase: "Test SDF Network ; September 2015",
      publicKey: null,
      isConnected: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the active profile label and connection status", () => {
    render(<EnvironmentSwitcher />);
    expect(screen.getByTestId("environment-switcher")).toBeInTheDocument();
    expect(screen.getByText("Testnet")).toBeInTheDocument();
    expect(screen.getByText("Unknown")).toBeInTheDocument();
  });

  it("opens the profile list on click", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
    expect(screen.getByText("Mainnet")).toBeInTheDocument();
    expect(screen.getByText("Localnet")).toBeInTheDocument();
    expect(screen.getByText("Custom")).toBeInTheDocument();
  });

  it("switches to mainnet and updates wallet store", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Mainnet"));

    await waitFor(() => {
      expect(useWalletStore.getState().network).toBe("PUBLIC");
      expect(useWalletStore.getState().networkPassphrase).toBe("Public Global Stellar Network ; September 2015");
    });
    expect(useEnvironmentStore.getState().activeProfile).toBe("mainnet");
  });

  it("switches to localnet and updates wallet store", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Localnet"));

    await waitFor(() => {
      expect(useWalletStore.getState().network).toBe("TESTNET");
    });
    expect(useEnvironmentStore.getState().activeProfile).toBe("localnet");
  });

  it("shows custom form when custom is selected", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => {
      expect(screen.getByText("Custom Network")).toBeInTheDocument();
      expect(screen.getByLabelText("Horizon URL")).toBeInTheDocument();
      expect(screen.getByLabelText("Soroban RPC URL")).toBeInTheDocument();
      expect(screen.getByLabelText("Network Passphrase")).toBeInTheDocument();
      expect(screen.getByLabelText("Stellar Network")).toBeInTheDocument();
    });
  });

  it("validates custom profile - rejects invalid horizon URL", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => screen.getByLabelText("Horizon URL"));
    const horizonInput = screen.getByLabelText("Horizon URL");
    fireEvent.change(horizonInput, { target: { value: "not-a-url" } });
    fireEvent.blur(horizonInput);

    expect(screen.getByText("Invalid URL format")).toBeInTheDocument();
  });

  it("validates custom profile - rejects non-HTTPS horizon URL", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => screen.getByLabelText("Horizon URL"));
    const horizonInput = screen.getByLabelText("Horizon URL");
    fireEvent.change(horizonInput, { target: { value: "http://example.com" } });
    fireEvent.blur(horizonInput);

    expect(screen.getByText("Must use HTTPS (or http://localhost)")).toBeInTheDocument();
  });

  it("validates custom profile - allows http://localhost for horizon", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => screen.getByLabelText("Horizon URL"));
    const horizonInput = screen.getByLabelText("Horizon URL");
    fireEvent.change(horizonInput, { target: { value: "http://localhost:8000" } });
    fireEvent.blur(horizonInput);

    expect(screen.queryByText("Must use HTTPS")).not.toBeInTheDocument();
  });

  it("validates custom profile - requires network passphrase", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => screen.getByLabelText("Network Passphrase"));
    const passphraseInput = screen.getByLabelText("Network Passphrase");
    fireEvent.change(passphraseInput, { target: { value: "" } });
    fireEvent.blur(passphraseInput);

    expect(screen.getByText("Required")).toBeInTheDocument();
  });

  it("validates custom profile - requires valid stellar network", async () => {
    const { validateCustomProfile } = useEnvironmentStore.getState();
    expect(validateCustomProfile({
      horizonUrl: "https://horizon.example.com",
      sorobanRpcUrl: "https://rpc.example.com",
      networkPassphrase: "Test",
      stellarNetwork: "INVALID" as any,
    })).toBe("Stellar network must be TESTNET, PUBLIC, or FUTURENET");
  });

  it("blocks custom profile switch on validation error", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => screen.getByLabelText("Horizon URL"));
    fireEvent.change(screen.getByLabelText("Horizon URL"), { target: { value: "not-a-url" } });
    fireEvent.blur(screen.getByLabelText("Horizon URL"));
    fireEvent.change(screen.getByLabelText("Soroban RPC URL"), { target: { value: "https://rpc.example.com" } });
    fireEvent.change(screen.getByLabelText("Network Passphrase"), { target: { value: "Test Passphrase" } });
    fireEvent.change(screen.getByLabelText("Stellar Network"), { target: { value: "TESTNET" } });

    fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

    await waitFor(() => {
      expect(screen.getByText("Invalid URL format")).toBeInTheDocument();
    });
    expect(useEnvironmentStore.getState().activeProfile).toBe("testnet");
  });

  it("successfully switches to valid custom profile", async () => {
    (global.fetch as any).mockResolvedValueOnce({ ok: true });

    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => screen.getByLabelText("Horizon URL"));
    fireEvent.change(screen.getByLabelText("Horizon URL"), { target: { value: "https://custom-horizon.example.com" } });
    fireEvent.change(screen.getByLabelText("Soroban RPC URL"), { target: { value: "https://custom-rpc.example.com" } });
    fireEvent.change(screen.getByLabelText("Network Passphrase"), { target: { value: "Custom Network ; January 2024" } });
    fireEvent.change(screen.getByLabelText("Stellar Network"), { target: { value: "TESTNET" } });

    fireEvent.click(screen.getByRole("button", { name: /save & connect/i }));

    await waitFor(() => {
      expect(useEnvironmentStore.getState().activeProfile).toBe("custom");
      expect(useWalletStore.getState().network).toBe("TESTNET");
    });
  });

  it("shows capability warning for localnet", async () => {
    useEnvironmentStore.setState({ activeProfile: "localnet" });
    render(<EnvironmentSwitcher />);

    expect(screen.getByText("Localnet not verified")).toBeInTheDocument();
    expect(screen.getByText(/hasn.t been verified as reachable/i)).toBeInTheDocument();
  });

  it("shows capability warning for custom", async () => {
    useEnvironmentStore.setState({ activeProfile: "custom", customProfile: {
      horizonUrl: "https://custom.example.com",
      sorobanRpcUrl: "https://custom-rpc.example.com",
      networkPassphrase: "Custom Network ; January 2024",
      stellarNetwork: "TESTNET",
    }});
    render(<EnvironmentSwitcher />);

    expect(screen.getByText("Custom network")).toBeInTheDocument();
    expect(screen.getByText(/Using a custom RPC endpoint/i)).toBeInTheDocument();
  });

  it("shows disconnected status when RPC is unreachable", async () => {
    useEnvironmentStore.setState({ activeProfile: "testnet", connectionStatus: "disconnected" });
    render(<EnvironmentSwitcher />);

    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("shows connected status when RPC is reachable", async () => {
    useEnvironmentStore.setState({ activeProfile: "testnet", connectionStatus: "connected" });
    render(<EnvironmentSwitcher />);

    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("displays validation error banner when present", () => {
    useEnvironmentStore.setState({ validationError: "Custom profile data is required" });
    render(<EnvironmentSwitcher />);

    expect(screen.getByText("Custom profile data is required")).toBeInTheDocument();
  });

  it("cancels custom form and returns to profile list", async () => {
    render(<EnvironmentSwitcher />);
    fireEvent.click(screen.getByRole("button", { name: /testnet/i }));
    await waitFor(() => screen.getByRole("listbox"));
    fireEvent.click(screen.getByText("Custom"));

    await waitFor(() => screen.getByText("Custom Network"));
    fireEvent.click(screen.getByText("Cancel"));

    await waitFor(() => {
      expect(screen.getByRole("listbox")).toBeInTheDocument();
    });
  });
});

describe("Environment Store", () => {
  beforeEach(() => {
    useEnvironmentStore.setState({
      activeProfile: "testnet",
      customProfile: null,
      validationError: null,
      isConnecting: false,
      connectionStatus: "unknown",
    });
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns correct config for built-in profiles", () => {
    const { getActiveProfileConfig } = useEnvironmentStore.getState();
    useEnvironmentStore.setState({ activeProfile: "testnet" });
    expect(getActiveProfileConfig().label).toBe("Testnet");
    expect(getActiveProfileConfig().stellarNetwork).toBe("TESTNET");

    useEnvironmentStore.setState({ activeProfile: "mainnet" });
    expect(getActiveProfileConfig().label).toBe("Mainnet");
    expect(getActiveProfileConfig().stellarNetwork).toBe("PUBLIC");

    useEnvironmentStore.setState({ activeProfile: "localnet" });
    expect(getActiveProfileConfig().label).toBe("Localnet");
    expect(getActiveProfileConfig().stellarNetwork).toBe("TESTNET");
  });

  it("returns custom config when custom profile is active", () => {
    const customData = {
      horizonUrl: "https://custom-horizon.example.com",
      sorobanRpcUrl: "https://custom-rpc.example.com",
      networkPassphrase: "Custom Network ; January 2024",
      stellarNetwork: "PUBLIC" as const,
    };
    useEnvironmentStore.setState({ activeProfile: "custom", customProfile: customData });
    const { getActiveProfileConfig } = useEnvironmentStore.getState();
    const config = getActiveProfileConfig();
    expect(config.label).toBe("Custom");
    expect(config.horizonUrl).toBe(customData.horizonUrl);
    expect(config.sorobanRpcUrl).toBe(customData.sorobanRpcUrl);
    expect(config.networkPassphrase).toBe(customData.networkPassphrase);
    expect(config.stellarNetwork).toBe(customData.stellarNetwork);
    expect(config.isCustom).toBe(true);
  });

  it("validates custom profile - rejects invalid URLs", () => {
    const { validateCustomProfile } = useEnvironmentStore.getState();
    expect(validateCustomProfile({
      horizonUrl: "not-a-url",
      sorobanRpcUrl: "https://rpc.example.com",
      networkPassphrase: "Test",
      stellarNetwork: "TESTNET",
    })).toBe("Horizon URL must be a valid URL (e.g., https://horizon.example.com)");

    expect(validateCustomProfile({
      horizonUrl: "https://horizon.example.com",
      sorobanRpcUrl: "not-a-url",
      networkPassphrase: "Test",
      stellarNetwork: "TESTNET",
    })).toBe("Soroban RPC URL must be a valid URL (e.g., https://rpc.example.com)");
  });

  it("validates custom profile - rejects non-HTTPS URLs", () => {
    const { validateCustomProfile } = useEnvironmentStore.getState();
    expect(validateCustomProfile({
      horizonUrl: "http://horizon.example.com",
      sorobanRpcUrl: "https://rpc.example.com",
      networkPassphrase: "Test",
      stellarNetwork: "TESTNET",
    })).toBe("Horizon URL must use HTTPS (or http://localhost for local development)");

    expect(validateCustomProfile({
      horizonUrl: "https://horizon.example.com",
      sorobanRpcUrl: "http://rpc.example.com",
      networkPassphrase: "Test",
      stellarNetwork: "TESTNET",
    })).toBe("Soroban RPC URL must use HTTPS (or http://localhost for local development)");
  });

  it("validates custom profile - allows localhost HTTP", () => {
    const { validateCustomProfile } = useEnvironmentStore.getState();
    expect(validateCustomProfile({
      horizonUrl: "http://localhost:8000",
      sorobanRpcUrl: "http://localhost:8000/soroban/rpc",
      networkPassphrase: "Standalone Network ; February 2017",
      stellarNetwork: "TESTNET",
    })).toBeNull();
  });

  it("validates custom profile - requires network passphrase", () => {
    const { validateCustomProfile } = useEnvironmentStore.getState();
    expect(validateCustomProfile({
      horizonUrl: "https://horizon.example.com",
      sorobanRpcUrl: "https://rpc.example.com",
      networkPassphrase: "",
      stellarNetwork: "TESTNET",
    })).toBe("Network passphrase is required");
  });

  it("validates custom profile - requires valid stellar network", () => {
    const { validateCustomProfile } = useEnvironmentStore.getState();
    expect(validateCustomProfile({
      horizonUrl: "https://horizon.example.com",
      sorobanRpcUrl: "https://rpc.example.com",
      networkPassphrase: "Test",
      stellarNetwork: "INVALID" as any,
    })).toBe("Stellar network must be TESTNET, PUBLIC, or FUTURENET");
  });

  it("persists active profile to localStorage", () => {
    useEnvironmentStore.setState({ activeProfile: "mainnet" });
    const stored = localStorage.getItem("zk-payroll-environment");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.activeProfile).toBe("mainnet");
  });

  it("persists custom profile to localStorage", () => {
    const customData = {
      horizonUrl: "https://custom-horizon.example.com",
      sorobanRpcUrl: "https://custom-rpc.example.com",
      networkPassphrase: "Custom Network ; January 2024",
      stellarNetwork: "TESTNET" as const,
    };
    useEnvironmentStore.setState({ customProfile: customData });
    // The persist middleware is synchronous in tests
    const stored = localStorage.getItem("zk-payroll-environment");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.customProfile).toEqual(customData);
  });
});