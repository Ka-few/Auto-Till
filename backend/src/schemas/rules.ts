import { z } from "zod";
import { allocationSchema, triggerConditionSchema } from "./models.js";

const allocationsTotalOneHundred = (allocations: Array<{ percentage: number }>) => {
  const basisPoints = allocations.reduce((sum, allocation) => {
    return sum + Math.round(allocation.percentage * 100);
  }, 0);

  return basisPoints === 10_000;
};

const ruleInputShape = z.object({
  name: z.string().min(1),
  priority: z.number().int(),
  triggerCondition: triggerConditionSchema,
  allocations: z.array(allocationSchema).min(1),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const ruleInputSchema = ruleInputShape.superRefine((value, ctx) => {
    if (!allocationsTotalOneHundred(value.allocations)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["allocations"],
        message: "Allocation percentages must sum to 100",
      });
    }
  });

export const ruleUpdateSchema = ruleInputShape.partial().superRefine((value, ctx) => {
  if (value.allocations !== undefined && !allocationsTotalOneHundred(value.allocations)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["allocations"],
      message: "Allocation percentages must sum to 100",
    });
  }
});

export type RuleInput = z.infer<typeof ruleInputSchema>;
export type RuleUpdate = z.infer<typeof ruleUpdateSchema>;
