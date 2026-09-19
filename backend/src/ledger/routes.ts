import { Router } from "express";
import { z } from "zod";
import { applyIncomingPayment } from "../rules/service.js";

export const incomingPaymentsRouter = Router({ mergeParams: true });

const paramsSchema = z.object({
  merchantId: z.string().cuid(),
});

const incomingPaymentSchema = z.object({
  sourceTransactionId: z.string().min(1),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Amount must be a positive decimal with at most two places"),
});

incomingPaymentsRouter.post("/", async (req, res, next) => {
  try {
    const { merchantId } = paramsSchema.parse(req.params);
    const input = incomingPaymentSchema.parse(req.body);
    const result = await applyIncomingPayment(merchantId, input.sourceTransactionId, input.amount);

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});
