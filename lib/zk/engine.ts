import type {
  PayrollProof,
  PayrollPublicInputs,
  ProofVerificationResult,
  ZkArtifacts,
  ZkEngine,
  ZkEngineInitConfig,
  ZkProofRequest,
} from "@/types";
import type { MockProver } from "./mockProver";
import { createLogger } from "@/lib/logger";
import { startPerformanceMark, endPerformanceMark } from "@/lib/monitoring";

const log = createLogger("zk-engine");

const DEFAULT_INIT_CONFIG: Required<ZkEngineInitConfig> = {
  verificationKeyPath: "/zk/verification_key.json",
  circuitWasmPath: "/zk/payroll.wasm",
};

async function fetchOptionalJson(path: string): Promise<unknown | null> {
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
      log.warn("Verification key missing; using mock fallback", { path });
      return null;
    }

    return await response.json();
  } catch (error) {
    log.warn("Failed to fetch verification key; using mock fallback", { path, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

async function fetchOptionalWasm(path: string): Promise<ArrayBuffer | null> {
  try {
    const response = await fetch(path, { cache: "force-cache" });
    if (!response.ok) {
      log.warn("Circuit WASM missing; using mock fallback", { path });
      return null;
    }

    return await response.arrayBuffer();
  } catch (error) {
    log.warn("Failed to fetch circuit WASM; using mock fallback", { path, error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

class MockZkEngine implements ZkEngine {
  private static instance: MockZkEngine | null = null;

  private initialized = false;
  private initPromise: Promise<void> | null = null;
  private proverPromise: Promise<MockProver> | null = null;
  private config: Required<ZkEngineInitConfig> = { ...DEFAULT_INIT_CONFIG };
  private artifacts: ZkArtifacts = {
    verificationKey: null,
    circuitWasm: null,
  };

  static getInstance(): MockZkEngine {
    if (!MockZkEngine.instance) {
      MockZkEngine.instance = new MockZkEngine();
    }

    return MockZkEngine.instance;
  }

  async init(config: ZkEngineInitConfig = {}): Promise<void> {
    if (typeof window === "undefined") {
      throw new Error("ZkEngine can only be initialized in the browser");
    }

    this.config = {
      ...this.config,
      ...config,
    };

    if (this.initialized) {
      return;
    }

    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }

    await this.initPromise;
  }

  async generateProof(request: ZkProofRequest): Promise<PayrollProof> {
    await this.init();
    startPerformanceMark("zk-proof-generation");
    const prover = await this.getProver();
    const proof = await prover.generateProof(request, this.artifacts);
    endPerformanceMark("zk-proof-generation");
    return proof;
  }

  async verifyProof(
    proof: PayrollProof,
    publicInputs: PayrollPublicInputs
  ): Promise<ProofVerificationResult> {
    await this.init();
    const prover = await this.getProver();
    const isValid = await prover.verifyProof(
      proof,
      publicInputs,
      this.artifacts.verificationKey
    );

    return {
      isValid,
      verifiedAt: new Date().toISOString(),
      error: isValid ? undefined : "Mock proof verification failed",
    };
  }

  resetForTests(): void {
    this.initialized = false;
    this.initPromise = null;
    this.proverPromise = null;
    this.config = { ...DEFAULT_INIT_CONFIG };
    this.artifacts = {
      verificationKey: null,
      circuitWasm: null,
    };
  }

  private async initialize(): Promise<void> {
    try {
      const [verificationKey, circuitWasm] = await Promise.all([
        fetchOptionalJson(this.config.verificationKeyPath),
        fetchOptionalWasm(this.config.circuitWasmPath),
      ]);

      this.artifacts = {
        verificationKey,
        circuitWasm,
      };

      await this.getProver();
      this.initialized = true;
    } finally {
      this.initPromise = null;
    }
  }

  private async getProver(): Promise<MockProver> {
    if (!this.proverPromise) {
      this.proverPromise = import("./mockProver").then((mod) => mod.createMockProver());
    }

    return this.proverPromise;
  }
}

export const zkEngine = MockZkEngine.getInstance();

export async function initializeZkEngine(config?: ZkEngineInitConfig): Promise<void> {
  await zkEngine.init(config);
}

export function resetZkEngineForTests(): void {
  zkEngine.resetForTests();
}
