import { describe, expect, it } from "vitest";

import { ServiceError, assertRole } from "@/services/base";
import {
  evaluateGuardians,
  type Guardian,
  type GuardianContext,
} from "@/lib/security/guardians";

describe("assertRole", () => {
  it("allows an authorized role", () => {
    expect(() => assertRole("admin", ["admin"])).not.toThrow();
  });

  it("rejects an unauthorized role", () => {
    expect(() => assertRole("customer", ["admin"])).toThrow(ServiceError);
    expect(() => assertRole("customer", ["admin"])).toThrow(
      /do not have permission/i,
    );
  });
});

describe("evaluateGuardians", () => {
  const allowAll: Guardian = {
    name: "allow",
    evaluate: async () => ({ allowed: true, risk: "low", requiresApproval: false }),
  };

  const requireApproval: Guardian = {
    name: "approval",
    evaluate: async () => ({ allowed: true, risk: "high", requiresApproval: true }),
  };

  const block: Guardian = {
    name: "block",
    evaluate: async () => ({
      allowed: false,
      risk: "high",
      requiresApproval: false,
      reason: "blocked by test",
    }),
  };

  it("allows when all guardians allow", async () => {
    const ctx: GuardianContext = { action: "test" };
    const decision = await evaluateGuardians([allowAll], ctx);
    expect(decision.allowed).toBe(true);
    expect(decision.risk).toBe("low");
  });

  it("propagates approval flags across guardians", async () => {
    const decision = await evaluateGuardians([allowAll, requireApproval], {
      action: "test",
    });
    expect(decision.allowed).toBe(true);
    expect(decision.requiresApproval).toBe(true);
  });

  it("blocks when any guardian blocks", async () => {
    const decision = await evaluateGuardians([allowAll, block], { action: "test" });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toBe("blocked by test");
  });
});
