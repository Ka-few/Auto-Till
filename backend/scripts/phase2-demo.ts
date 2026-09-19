import "dotenv/config";
import { prisma } from "../src/db.js";
import { applyIncomingPayment, createRule } from "../src/rules/service.js";

async function main() {
  const merchant = await prisma.merchant.create({
    data: {
      businessName: "Phase 2 Demo Merchant",
      tillNumber: `PHASE2-${Date.now()}`,
      encryptedDarajaCreds: "phase-2-placeholder-ciphertext",
    },
  });

  const highPriorityRule = await createRule(
    merchant.id,
    {
      name: "Large receipts split",
      priority: 1,
      triggerCondition: { type: "amount_threshold", minAmount: "1000.00" },
      allocations: [
        { bucketName: "Supplier Alpha", percentage: 60 },
        { bucketName: "Owner Draw", percentage: 40 },
      ],
      isDefault: false,
      isActive: true,
    },
    merchant.id,
  );

  const lowerPriorityRule = await createRule(
    merchant.id,
    {
      name: "General receipts split",
      priority: 10,
      triggerCondition: { type: "always" },
      allocations: [
        { bucketName: "Rent", percentage: 25 },
        { bucketName: "Operations", percentage: 75 },
      ],
      isDefault: true,
      isActive: true,
    },
    merchant.id,
  );

  const sourceTransactionId = `phase2-demo-${Date.now()}`;
  const result = await applyIncomingPayment(merchant.id, sourceTransactionId, "1250.00");
  const ledgerEntries = await prisma.ledgerEntry.findMany({
    where: { merchantId: merchant.id, sourceTransactionId },
    orderBy: { bucket: "asc" },
  });

  console.log(
    JSON.stringify(
      {
        merchantId: merchant.id,
        createdRules: [
          { id: highPriorityRule.id, name: highPriorityRule.name, priority: highPriorityRule.priority },
          { id: lowerPriorityRule.id, name: lowerPriorityRule.name, priority: lowerPriorityRule.priority },
        ],
        selectedRuleId: result.ruleId,
        selectedRuleName: result.ruleId === highPriorityRule.id ? highPriorityRule.name : lowerPriorityRule.name,
        allocations: result.allocations,
        ledgerEntries: ledgerEntries.map((entry) => ({
          bucket: entry.bucket,
          amount: entry.amount.toString(),
          entryType: entry.entryType,
          ruleId: entry.ruleId,
        })),
      },
      null,
      2,
    ),
  );
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
