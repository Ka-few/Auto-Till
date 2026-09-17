import { z } from "zod";

const moneyStringSchema = z
  .string()
  .regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive decimal with at most two places");

export const merchantSchema = z.object({
  id: z.string().cuid(),
  businessName: z.string().min(1),
  tillNumber: z.string().min(1),
  encryptedDarajaCreds: z.string().min(1),
  createdAt: z.coerce.date(),
});

export const triggerConditionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("always") }),
  z.object({ type: z.literal("amount_threshold"), minAmount: moneyStringSchema }),
  z.object({
    type: z.literal("amount_range"),
    minAmount: moneyStringSchema.optional(),
    maxAmount: moneyStringSchema.optional(),
  }),
]);

export const allocationSchema = z.object({
  bucketName: z.string().min(1),
  percentage: z.number().positive().max(100),
});

export const ruleSchema = z.object({
  id: z.string().cuid(),
  merchantId: z.string().cuid(),
  name: z.string().min(1),
  priority: z.number().int(),
  triggerCondition: triggerConditionSchema,
  allocations: z.array(allocationSchema).min(1),
  isDefault: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.coerce.date(),
  deactivatedAt: z.coerce.date().nullable(),
});

export const ledgerEntrySchema = z.object({
  id: z.string().cuid(),
  merchantId: z.string().cuid(),
  bucket: z.string().min(1),
  amount: moneyStringSchema,
  entryType: z.enum(["credit", "debit"]),
  sourceTransactionId: z.string().min(1),
  ruleId: z.string().cuid().nullable(),
  createdAt: z.coerce.date(),
});

export const payoutBatchSchema = z.object({
  id: z.string().cuid(),
  merchantId: z.string().cuid(),
  bucket: z.string().min(1),
  destination: z.string().min(1),
  amount: moneyStringSchema,
  status: z.enum(["pending", "success", "failed_retrying", "failed_escrowed"]),
  darajaTransactionRef: z.string().min(1).nullable(),
  retryCount: z.number().int().nonnegative(),
  createdAt: z.coerce.date(),
  resolvedAt: z.coerce.date().nullable(),
});

export const auditLogSchema = z.object({
  id: z.string().cuid(),
  actorId: z.string().min(1),
  action: z.string().min(1),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  diff: z.record(z.unknown()),
  createdAt: z.coerce.date(),
});

export type Merchant = z.infer<typeof merchantSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type PayoutBatch = z.infer<typeof payoutBatchSchema>;
export type AuditLog = z.infer<typeof auditLogSchema>;
