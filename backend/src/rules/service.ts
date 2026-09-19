import type { Prisma, Rule } from "@prisma/client";
import { prisma } from "../db.js";
import { applyRule, createUnallocatedFallbackRule, resolveRule, type Allocation, type RuleForEngine } from "./engine.js";
import type { RuleInput, RuleUpdate } from "../schemas/rules.js";

const toEngineRule = (rule: Rule): RuleForEngine => ({
  id: rule.id,
  priority: rule.priority,
  triggerCondition: rule.triggerCondition as RuleForEngine["triggerCondition"],
  allocations: rule.allocations as RuleForEngine["allocations"],
  isDefault: rule.isDefault,
  isActive: rule.isActive,
});

const ensureSingleDefaultRule = async (
  tx: Prisma.TransactionClient,
  merchantId: string,
  nextIsDefault: boolean | undefined,
  currentRuleId?: string,
) => {
  if (!nextIsDefault) {
    return;
  }

  const existingDefault = await tx.rule.findFirst({
    where: {
      merchantId,
      isDefault: true,
      isActive: true,
      id: currentRuleId === undefined ? undefined : { not: currentRuleId },
    },
  });

  if (existingDefault !== null) {
    throw new Error("Merchant already has an active default rule");
  }
};

export const listRules = async (merchantId: string) => {
  return prisma.rule.findMany({
    where: { merchantId },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
  });
};

export const createRule = async (merchantId: string, input: RuleInput, actorId: string) => {
  return prisma.$transaction(async (tx) => {
    await ensureSingleDefaultRule(tx, merchantId, input.isDefault);

    const rule = await tx.rule.create({
      data: {
        merchantId,
        name: input.name,
        priority: input.priority,
        triggerCondition: input.triggerCondition,
        allocations: input.allocations,
        isDefault: input.isDefault,
        isActive: input.isActive,
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "rule.created",
        entityType: "rule",
        entityId: rule.id,
        diff: { after: input },
      },
    });

    return rule;
  });
};

export const updateRule = async (merchantId: string, ruleId: string, input: RuleUpdate, actorId: string) => {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.rule.findFirstOrThrow({
      where: { id: ruleId, merchantId },
    });

    const nextIsDefault = input.isDefault ?? existing.isDefault;
    const nextIsActive = input.isActive ?? existing.isActive;
    await ensureSingleDefaultRule(tx, merchantId, nextIsActive ? nextIsDefault : false, ruleId);

    const rule = await tx.rule.update({
      where: { id: ruleId },
      data: {
        ...input,
        deactivatedAt: nextIsActive ? null : (existing.deactivatedAt ?? new Date()),
      },
    });

    await tx.auditLog.create({
      data: {
        actorId,
        action: "rule.updated",
        entityType: "rule",
        entityId: rule.id,
        diff: { before: existing, after: rule },
      },
    });

    return rule;
  });
};

export const deactivateRule = async (merchantId: string, ruleId: string, actorId: string) => {
  return updateRule(merchantId, ruleId, { isActive: false }, actorId);
};

export type AppliedPaymentResult = {
  ruleId: string | null;
  allocations: Allocation[];
};

export const applyIncomingPayment = async (
  merchantId: string,
  sourceTransactionId: string,
  incomingAmount: string,
): Promise<AppliedPaymentResult> => {
  return prisma.$transaction(async (tx) => {
    const rules = await tx.rule.findMany({
      where: { merchantId, isActive: true },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });
    const engineRules = rules.map(toEngineRule);
    const selectedRule = resolveRule(engineRules, incomingAmount) ?? createUnallocatedFallbackRule();
    const allocations = applyRule(selectedRule, incomingAmount);
    const persistedRuleId = selectedRule.id === "unallocated-fallback" ? null : selectedRule.id;

    await tx.ledgerEntry.createMany({
      data: allocations.map((allocation) => ({
        merchantId,
        bucket: allocation.bucketName,
        amount: allocation.amount,
        entryType: "credit",
        sourceTransactionId,
        ruleId: persistedRuleId,
      })),
    });

    await tx.auditLog.create({
      data: {
        actorId: merchantId,
        action: "funds.allocated",
        entityType: "ledgerEntry",
        entityId: sourceTransactionId,
        diff: { amount: incomingAmount, ruleId: persistedRuleId, allocations },
      },
    });

    return {
      ruleId: persistedRuleId,
      allocations,
    };
  });
};
