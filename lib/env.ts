import { z } from "zod";
import { createLogger } from "./logger";

const log = createLogger("env");

const urlString = z
  .string()
  .refine((val) => { try { new URL(val); return true; } catch { return false; } },
    { message: "Invalid URL" }
  );

const envSchema = z.object({
  NEXT_PUBLIC_STELLAR_NETWORK: z.enum(["TESTNET", "PUBLIC"]),
  NEXT_PUBLIC_HORIZON_URL: urlString,
  NEXT_PUBLIC_SOROBAN_RPC_URL: urlString,
  SESSION_SECRET: z.string().min(32),
  ADMIN_PUBLIC_KEY: z.string().min(1),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_STELLAR_NETWORK: process.env.NEXT_PUBLIC_STELLAR_NETWORK,
  NEXT_PUBLIC_HORIZON_URL: process.env.NEXT_PUBLIC_HORIZON_URL,
  NEXT_PUBLIC_SOROBAN_RPC_URL: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL,
  SESSION_SECRET: process.env.SESSION_SECRET,
  ADMIN_PUBLIC_KEY: process.env.ADMIN_PUBLIC_KEY,
});

if (!parsed.success) {
  log.fatal("Invalid environment variables", {
    errors: z.treeifyError(parsed.error),
  });
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
