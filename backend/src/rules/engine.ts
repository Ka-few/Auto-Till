import { z } from "zod";
import { allocationSchema, triggerConditionSchema } from "../schemas/models.js";

export const ruleForEngineSchema = z.object({
  id: z.string(),
  priority: z.number().int(),
  triggerCondition: triggerConditionSchema,
  allocations: z.array(allocationSchema).min(1),
  isDefault: z.boolean(),
  isActive: z.boolean(),
});

export type RuleForEngine = z.infer<typeof ruleForEngineSchema>;

export type Allocation = {
  bucketName: string;
  amount: string;
};

const parseMoneyToMinorUnits = (amount: string): number => {
  if (!/^\d+(\.\d{1,2})?$/.test(amount)) {
    throw new Error("Amount must be a positive decimal with at most two places");
  }

  const [whole, decimal = ""] = amount.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
};

const formatMinorUnits = (amountInMinorUnits: number): string => {
  const sign = amountInMinorUnits < 0 ? "-" : "";
  const absolute = Math.abs(amountInMinorUnits);
  const whole = Math.floor(absolute / 100);
  const decimal = String(absolute % 100).padStart(2, "0");

  return `${sign}${whole}.${decimal}`;
};

const conditionMatches = (rule: RuleForEngine, incomingAmount: string): boolean => {
  const amount = parseMoneyToMinorUnits(incomingAmount);
  const condition = rule.triggerCondition;

  if (condition.type === "always") {
    return true;
  }

  if (condition.type === "amount_threshold") {
    return amount >= parseMoneyToMinorUnits(condition.minAmount);
  }

  const minAmount =
    condition.minAmount === undefined ? Number.NEGATIVE_INFINITY : parseMoneyToMinorUnits(condition.minAmount);
  const maxAmount =
    condition.maxAmount === undefined ? Number.POSITIVE_INFINITY : parseMoneyToMinorUnits(condition.maxAmount);

  return amount >= minAmount && amount <= maxAmount;
};

export const resolveRule = (rules: RuleForEngine[], incomingAmount: string): RuleForEngine | null => {
  const activeRules = rules.filter((rule) => rule.isActive);
  const matchingRules = activeRules
    .filter((rule) => !rule.isDefault && conditionMatches(rule, incomingAmount))
    .sort((left, right) => left.priority - right.priority);

  if (matchingRules[0] !== undefined) {
    return matchingRules[0];
  }

  return activeRules
    .filter((rule) => rule.isDefault)
    .sort((left, right) => left.priority - right.priority)[0] ?? null;
};

export const applyRule = (rule: RuleForEngine, incomingAmount: string): Allocation[] => {
  const total = parseMoneyToMinorUnits(incomingAmount);
  const rawAllocations = rule.allocations.map((allocation, index) => {
    const rawAmount = (total * allocation.percentage) / 100;
    const roundedDown = Math.floor(rawAmount);

    return {
      bucketName: allocation.bucketName,
      roundedDown,
      fractionalRemainder: rawAmount - roundedDown,
      index,
    };
  });

  const allocated = rawAllocations.reduce((sum, allocation) => sum + allocation.roundedDown, 0);
  let remainder = total - allocated;
  const remainderOrder = [...rawAllocations].sort((left, right) => {
    if (right.fractionalRemainder !== left.fractionalRemainder) {
      return right.fractionalRemainder - left.fractionalRemainder;
    }

    return left.index - right.index;
  });

  const increments = new Map<number, number>();
  for (const allocation of remainderOrder) {
    if (remainder <= 0) {
      break;
    }

    increments.set(allocation.index, (increments.get(allocation.index) ?? 0) + 1);
    remainder -= 1;
  }

  return rawAllocations.map((allocation) => ({
    bucketName: allocation.bucketName,
    amount: formatMinorUnits(allocation.roundedDown + (increments.get(allocation.index) ?? 0)),
  }));
};

export const createUnallocatedFallbackRule = (): RuleForEngine => ({
  id: "unallocated-fallback",
  priority: Number.MAX_SAFE_INTEGER,
  triggerCondition: { type: "always" },
  allocations: [{ bucketName: "Unallocated", percentage: 100 }],
  isDefault: true,
  isActive: true,
});
