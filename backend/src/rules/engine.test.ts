import { describe, expect, it } from "vitest";
import { applyRule, resolveRule, type RuleForEngine } from "./engine.js";

const rule = (overrides: Partial<RuleForEngine>): RuleForEngine => ({
  id: "rule-1",
  priority: 10,
  triggerCondition: { type: "always" },
  allocations: [
    { bucketName: "Owner Draw", percentage: 50 },
    { bucketName: "Rent", percentage: 50 },
  ],
  isDefault: false,
  isActive: true,
  ...overrides,
});

describe("applyRule", () => {
  it("splits an amount evenly", () => {
    expect(applyRule(rule({}), "100.00")).toEqual([
      { bucketName: "Owner Draw", amount: "50.00" },
      { bucketName: "Rent", amount: "50.00" },
    ]);
  });

  it("distributes rounding remainders deterministically", () => {
    expect(
      applyRule(
        rule({
          allocations: [
            { bucketName: "VAT", percentage: 33.33 },
            { bucketName: "Supplier", percentage: 33.33 },
            { bucketName: "Operations", percentage: 33.34 },
          ],
        }),
        "10.00",
      ),
    ).toEqual([
      { bucketName: "VAT", amount: "3.33" },
      { bucketName: "Supplier", amount: "3.33" },
      { bucketName: "Operations", amount: "3.34" },
    ]);
  });
});

describe("resolveRule", () => {
  it("uses the lowest priority number when overlapping rules match", () => {
    const selected = resolveRule(
      [
        rule({ id: "lower-priority", priority: 20, triggerCondition: { type: "amount_threshold", minAmount: "50.00" } }),
        rule({ id: "higher-priority", priority: 1, triggerCondition: { type: "amount_range", minAmount: "75.00" } }),
      ],
      "100.00",
    );

    expect(selected?.id).toBe("higher-priority");
  });

  it("falls back to the default rule when no non-default rule matches", () => {
    const selected = resolveRule(
      [
        rule({ id: "threshold", priority: 1, triggerCondition: { type: "amount_threshold", minAmount: "500.00" } }),
        rule({ id: "default", priority: 100, isDefault: true }),
      ],
      "100.00",
    );

    expect(selected?.id).toBe("default");
  });
});
