import { Router } from "express";
import { z } from "zod";
import { ruleInputSchema, ruleUpdateSchema } from "../schemas/rules.js";
import { createRule, deactivateRule, listRules, updateRule } from "./service.js";

export const rulesRouter = Router({ mergeParams: true });

const paramsSchema = z.object({
  merchantId: z.string().cuid(),
});

const ruleParamsSchema = paramsSchema.extend({
  ruleId: z.string().cuid(),
});

const actorIdFromRequest = (merchantId: string, actorId: unknown) => {
  return typeof actorId === "string" && actorId.trim() !== "" ? actorId : merchantId;
};

rulesRouter.get("/", async (req, res, next) => {
  try {
    const { merchantId } = paramsSchema.parse(req.params);
    const rules = await listRules(merchantId);
    res.json({ rules });
  } catch (error) {
    next(error);
  }
});

rulesRouter.post("/", async (req, res, next) => {
  try {
    const { merchantId } = paramsSchema.parse(req.params);
    const input = ruleInputSchema.parse(req.body);
    const rule = await createRule(merchantId, input, actorIdFromRequest(merchantId, req.header("x-actor-id")));
    res.status(201).json({ rule });
  } catch (error) {
    next(error);
  }
});

rulesRouter.patch("/:ruleId", async (req, res, next) => {
  try {
    const { merchantId, ruleId } = ruleParamsSchema.parse(req.params);
    const input = ruleUpdateSchema.parse(req.body);
    const rule = await updateRule(merchantId, ruleId, input, actorIdFromRequest(merchantId, req.header("x-actor-id")));
    res.json({ rule });
  } catch (error) {
    next(error);
  }
});

rulesRouter.post("/:ruleId/deactivate", async (req, res, next) => {
  try {
    const { merchantId, ruleId } = ruleParamsSchema.parse(req.params);
    const rule = await deactivateRule(merchantId, ruleId, actorIdFromRequest(merchantId, req.header("x-actor-id")));
    res.json({ rule });
  } catch (error) {
    next(error);
  }
});
