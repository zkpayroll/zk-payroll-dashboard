import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn().mockResolvedValue({ isConnected: false }),
  isAllowed: vi.fn().mockResolvedValue({ isAllowed: false }),
  setAllowed: vi.fn().mockResolvedValue({ isAllowed: false }),
  getAddress: vi.fn().mockResolvedValue({ address: null, error: "not connected" }),
  getNetwork: vi
    .fn()
    .mockResolvedValue({ network: "TESTNET", networkPassphrase: "Test SDF Network ; September 2015" }),
  signTransaction: vi.fn(),
}));

vi.mock("@stellar/stellar-sdk", () => ({
  Contract: vi.fn(),
  TransactionBuilder: vi.fn(),
  BASE_FEE: "100",
}));

vi.mock("@stellar/stellar-sdk/rpc", () => ({
  Api: { isSimulationError: vi.fn().mockReturnValue(false) },
  assembleTransaction: vi.fn(),
  Server: vi.fn(),
}));

describe("Environment Store: expected network from active profile", () => {
  const ORIGINAL_NETWORK_ENV = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  afterEach(() => {
    if (ORIGINAL_NETWORK_ENV === undefined) {
      delete process.env.NEXT_PUBLIC_STELLAR_NETWORK;
    } else {
      process.env.NEXT_PUBLIC_STELLAR_NETWORK = ORIGINAL_NETWORK_ENV;
    }
    vi.resetModules();
  });

  it("defaults to TESTNET when no profile is set", async () => {
    const { useEnvironmentStore } = await import("@/stores/environment");
    const expectedNetwork = useEnvironmentStore.getState().getActiveProfileConfig().stellarNetwork;
    expect(expectedNetwork).toBe("TESTNET");
  });

  it("returns PUBLIC when mainnet profile is active", async () => {
    const { useEnvironmentStore } = await import("@/stores/environment");
    useEnvironmentStore.setState({ activeProfile: "mainnet" });
    const expectedNetwork = useEnvironmentStore.getState().getActiveProfileConfig().stellarNetwork;
    expect(expectedNetwork).toBe("PUBLIC");
  });

  it("returns TESTNET when testnet profile is active", async () => {
    const { useEnvironmentStore } = await import("@/stores/environment");
    useEnvironmentStore.setState({ activeProfile: "testnet" });
    const expectedNetwork = useEnvironmentStore.getState().getActiveProfileConfig().stellarNetwork;
    expect(expectedNetwork).toBe("TESTNET");
  });

  it("returns TESTNET when localnet profile is active", async () => {
    const { useEnvironmentStore } = await import("@/stores/environment");
    useEnvironmentStore.setState({ activeProfile: "localnet" });
    const expectedNetwork = useEnvironmentStore.getState().getActiveProfileConfig().stellarNetwork;
    expect(expectedNetwork).toBe("TESTNET");
  });

  it("returns custom network when custom profile is active", async () => {
    const { useEnvironmentStore } = await import("@/stores/environment");
    useEnvironmentStore.setState({
      activeProfile: "custom",
      customProfile: {
        horizonUrl: "https://custom-horizon.example.com",
        sorobanRpcUrl: "https://custom-rpc.example.com",
        networkPassphrase: "Custom Network ; January 2024",
        stellarNetwork: "FUTURENET",
      },
    });
    const expectedNetwork = useEnvironmentStore.getState().getActiveProfileConfig().stellarNetwork;
    expect(expectedNetwork).toBe("FUTURENET");
  });
});