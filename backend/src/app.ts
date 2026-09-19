import cors from "cors";
import express from "express";
import { ZodError } from "zod";
import { prisma } from "./db.js";
import { rulesRouter } from "./rules/routes.js";
import { incomingPaymentsRouter } from "./ledger/routes.js";

export const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  }),
);
app.use(express.json());

app.get("/health", async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({ status: "ok" });
  } catch (error) {
    next(error);
  }
});

app.use("/merchants/:merchantId/rules", rulesRouter);
app.use("/merchants/:merchantId/incoming-payments", incomingPaymentsRouter);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (error instanceof ZodError) {
    res.status(400).json({ error: "Validation failed", issues: error.issues });
    return;
  }

  if (error instanceof Error && error.message === "Merchant already has an active default rule") {
    res.status(409).json({ error: error.message });
    return;
  }

  console.error(error instanceof Error ? error.message : "Unexpected application error");
  res.status(500).json({ error: "Internal server error" });
});
