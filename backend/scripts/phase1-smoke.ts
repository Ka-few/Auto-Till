import "dotenv/config";
import { prisma } from "../src/db.js";

async function main() {
  const merchant = await prisma.merchant.create({
    data: {
      businessName: "Phase 1 Smoke Test Merchant",
      tillNumber: `SMOKE-${Date.now()}`,
      encryptedDarajaCreds: "phase-1-placeholder-ciphertext",
    },
  });

  const fetched = await prisma.merchant.findUniqueOrThrow({
    where: { id: merchant.id },
  });

  console.log(
    JSON.stringify(
      {
        insertedMerchantId: merchant.id,
        fetchedBusinessName: fetched.businessName,
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
  .catch(async (error) => {
    console.error(error);
    process.exitCode = 1;
  });
