import { describe, it, expect, beforeEach } from "vitest";
import {
  createPayrollEditSession,
  isSessionExpired,
  isSessionHeartbeatStale,
  heartbeatPayrollEditSession,
  maskOperatorIdentifier,
  evaluateConcurrentPayrollEdits,
  assertNoConcurrentPayrollConflict,
  sanitizeConcurrentWarningForAudit,
  ConcurrentPayrollEditError,
  DEFAULT_EDIT_SESSION_TTL_MS,
  DEFAULT_HEARTBEAT_TIMEOUT_MS,
} from "@/src/payroll/concurrentPayrollEditWarning";
import { usePayrollConcurrencyStore } from "@/stores/payrollConcurrency";

describe("concurrentPayrollEditWarning domain logic", () => {
  const PAYROLL_ID = "pr_2026_10_alpha";
  const OPERATOR_A = "op_admin_9876";
  const OPERATOR_B = "op_finance_5432";
  const STELLAR_ADDR = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

  describe("maskOperatorIdentifier", () => {
    it("masks Stellar address to first 4 and last 4 characters", () => {
      expect(maskOperatorIdentifier(STELLAR_ADDR)).toBe("GBBD...FLA5");
    });

    it("masks standard operator string preserving privacy", () => {
      expect(maskOperatorIdentifier("op_finance_john_doe")).toBe("op_f..._doe");
    });

    it("handles short, empty, or null strings gracefully", () => {
      expect(maskOperatorIdentifier("")).toBe("Unknown Operator");
      expect(maskOperatorIdentifier(null)).toBe("Unknown Operator");
      expect(maskOperatorIdentifier("admin")).toBe("admin");
    });
  });

  describe("session lifecycle and heartbeats", () => {
    it("creates an active session with opaque session token and metadata", () => {
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1);
      expect(session.sessionId).toMatch(/^pes_\d+_[a-z0-9]+$/);
      expect(session.payrollId).toBe(PAYROLL_ID);
      expect(session.baseVersion).toBe(1);
      expect(session.status).toBe("active");
      expect(session.openedAt).toBeDefined();
      expect(session.lastHeartbeatAt).toBeDefined();
    });

    it("correctly identifies unexpired vs expired sessions", () => {
      const now = 1000000;
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, undefined, now);

      expect(isSessionExpired(session, now + 1000)).toBe(false);
      expect(isSessionExpired(session, now + DEFAULT_EDIT_SESSION_TTL_MS - 1)).toBe(false);
      expect(isSessionExpired(session, now + DEFAULT_EDIT_SESSION_TTL_MS + 10)).toBe(true);
    });

    it("detects stale heartbeat when operator abandons tab", () => {
      const now = 2000000;
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, undefined, now);

      expect(isSessionHeartbeatStale(session, now + 30000)).toBe(false);
      expect(isSessionHeartbeatStale(session, now + DEFAULT_HEARTBEAT_TIMEOUT_MS + 1000)).toBe(true);
    });

    it("updates heartbeat timestamp on active session", () => {
      const t1 = 3000000;
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, undefined, t1);
      const t2 = t1 + 60000;
      const refreshed = heartbeatPayrollEditSession(session, t2);

      expect(new Date(refreshed.lastHeartbeatAt).getTime()).toBe(t2);
      expect(refreshed.status).toBe("active");
    });
  });

  describe("evaluateConcurrentPayrollEdits", () => {
    it("successful path: single operator editing with no conflict", () => {
      const now = 1000000;
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, "tab_1", now);

      const result = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: session,
        latestRemoteVersion: 1,
        activeSessions: [session],
        now,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.canSubmit).toBe(true);
      expect(result.highestSeverity).toBeNull();
      expect(result.warnings).toHaveLength(0);
      expect(result.blockingWarning).toBeNull();
      expect(result.activeEditorCount).toBe(1);
    });

    it("failure path 1: version mismatch creates critical blocking warning", () => {
      const now = 1000000;
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, "tab_1", now);

      const result = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: session,
        latestRemoteVersion: 2,
        latestRemoteEditorId: OPERATOR_B,
        now,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.canSubmit).toBe(false);
      expect(result.highestSeverity).toBe("critical");
      expect(result.blockingWarning).not.toBeNull();
      expect(result.blockingWarning?.conflictType).toBe("version_mismatch");
      expect(result.blockingWarning?.recommendedAction).toBe("reload_latest");
      expect(result.blockingWarning?.lastEditedByMasked).toBe(maskOperatorIdentifier(OPERATOR_B));
    });

    it("failure path 2: session expiration creates critical blocking warning", () => {
      const openTime = 1000000;
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, "tab_1", openTime);
      const expiredNow = openTime + DEFAULT_EDIT_SESSION_TTL_MS + 5000;

      const result = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: session,
        latestRemoteVersion: 1,
        now: expiredNow,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.canSubmit).toBe(false);
      expect(result.highestSeverity).toBe("critical");
      expect(result.blockingWarning?.conflictType).toBe("session_expired");
      expect(result.blockingWarning?.recommendedAction).toBe("renew_session");
    });

    it("edge case 1: concurrent active peer editing same payroll creates advisory warning", () => {
      const now = 1000000;
      const mySession = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, "tab_1", now);
      const peerSession = createPayrollEditSession(PAYROLL_ID, OPERATOR_B, 1, "tab_2", now);

      const result = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: mySession,
        latestRemoteVersion: 1,
        activeSessions: [mySession, peerSession],
        now,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.canSubmit).toBe(true); // Non-blocking presence warning
      expect(result.highestSeverity).toBe("warning");
      expect(result.activeEditorCount).toBe(2);

      const warning = result.warnings[0];
      expect(warning.conflictType).toBe("concurrent_active_editor");
      expect(warning.blocking).toBe(false);
      expect(warning.message).toContain(maskOperatorIdentifier(OPERATOR_B));
    });

    it("edge case 2: abandoned peer sessions with timed-out heartbeat are excluded", () => {
      const now = 1000000;
      const mySession = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, "tab_1", now);
      // Peer opened 5 minutes ago with no recent heartbeat
      const abandonedPeer = createPayrollEditSession(PAYROLL_ID, OPERATOR_B, 1, "tab_2", now - 300000);

      const result = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: mySession,
        latestRemoteVersion: 1,
        activeSessions: [mySession, abandonedPeer],
        now,
      });

      expect(result.hasConflict).toBe(false);
      expect(result.activeEditorCount).toBe(1);
    });

    it("edge case 3: detects remote timestamp update when version matches", () => {
      const now = 1000000;
      const baseUpdatedAt = new Date(now - 60000).toISOString();
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1, "tab_1", now, baseUpdatedAt);
      const remoteUpdatedAt = new Date(now - 10000).toISOString();

      const result = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: session,
        latestRemoteVersion: 1,
        latestRemoteUpdatedAt: remoteUpdatedAt,
        latestRemoteEditorId: OPERATOR_B,
        now,
      });

      expect(result.hasConflict).toBe(true);
      expect(result.highestSeverity).toBe("warning");
      const timeWarning = result.warnings.find((w) => w.conflictType === "stale_timestamp");
      expect(timeWarning).toBeDefined();
      expect(timeWarning?.blocking).toBe(false);
    });
  });

  describe("assertNoConcurrentPayrollConflict", () => {
    it("does not throw when evaluation permits submission", () => {
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1);
      const evaluation = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: session,
        latestRemoteVersion: 1,
      });

      expect(() => assertNoConcurrentPayrollConflict(evaluation)).not.toThrow();
    });

    it("throws ConcurrentPayrollEditError when submission is blocked", () => {
      const session = createPayrollEditSession(PAYROLL_ID, OPERATOR_A, 1);
      const evaluation = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: session,
        latestRemoteVersion: 2,
      });

      expect(() => assertNoConcurrentPayrollConflict(evaluation)).toThrow(
        ConcurrentPayrollEditError,
      );
    });
  });

  describe("Privacy guarantees", () => {
    it("ensures warnings and audit summaries never leak salary data, recipient identities, or keys", () => {
      const session = createPayrollEditSession(PAYROLL_ID, STELLAR_ADDR, 1);
      const evaluation = evaluateConcurrentPayrollEdits({
        payrollId: PAYROLL_ID,
        currentSession: session,
        latestRemoteVersion: 2,
        latestRemoteEditorId: "SECRET_EMPLOYEE_ID_JOHN_DOE",
      });

      const warning = evaluation.blockingWarning!;
      const auditPayload = sanitizeConcurrentWarningForAudit(warning);

      const serializedWarning = JSON.stringify(warning);
      const serializedAudit = JSON.stringify(auditPayload);

      // Verify no salary amounts or secret keys
      expect(serializedWarning).not.toMatch(/\$|\bamount\b|\bsalary\b/i);
      expect(serializedAudit).not.toMatch(/\$|\bamount\b|\bsalary\b/i);

      // Verify operator identity is masked
      expect(serializedWarning).not.toContain("SECRET_EMPLOYEE_ID_JOHN_DOE");
      expect(serializedWarning).toContain("SECR..._DOE");
    });
  });

  describe("usePayrollConcurrencyStore", () => {
    beforeEach(() => {
      usePayrollConcurrencyStore.getState().reset();
    });

    it("starts session and stores evaluation in Zustand store", () => {
      const store = usePayrollConcurrencyStore.getState();
      const session = store.startSession(PAYROLL_ID, OPERATOR_A, 1);

      expect(session).toBeDefined();
      const evalResult = usePayrollConcurrencyStore.getState().evaluations[PAYROLL_ID];
      expect(evalResult).toBeDefined();
      expect(evalResult.canSubmit).toBe(true);
    });

    it("updates evaluation on remote change", () => {
      const store = usePayrollConcurrencyStore.getState();
      store.startSession(PAYROLL_ID, OPERATOR_A, 1);

      store.recordRemoteChange(PAYROLL_ID, 2, new Date().toISOString(), OPERATOR_B);

      const evalResult = usePayrollConcurrencyStore.getState().evaluations[PAYROLL_ID];
      expect(evalResult.hasConflict).toBe(true);
      expect(evalResult.canSubmit).toBe(false);
      expect(evalResult.highestSeverity).toBe("critical");
    });

    it("allows dismissing warnings and resetting store", () => {
      const store = usePayrollConcurrencyStore.getState();
      store.startSession(PAYROLL_ID, OPERATOR_A, 1);
      store.dismissWarning(PAYROLL_ID);

      expect(usePayrollConcurrencyStore.getState().dismissedPayrollIds[PAYROLL_ID]).toBe(true);

      store.reset();
      expect(Object.keys(usePayrollConcurrencyStore.getState().sessions)).toHaveLength(0);
    });
  });
});
