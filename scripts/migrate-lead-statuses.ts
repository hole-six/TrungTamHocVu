/**
 * Script to migrate Lead statuses to simplified version
 * Run: npx tsx scripts/migrate-lead-statuses.ts
 */

import { prisma } from "../lib/prisma";

async function main() {
  console.log("🚀 Starting Lead status migration...\n");

  // Count current statuses
  const before = await prisma.lead.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  console.log("📊 Current status distribution:");
  before.forEach((row) => {
    console.log(`  ${row.status}: ${row._count._all}`);
  });
  console.log();

  // Migrate OLD statuses to CONTACTING
  const oldStatuses = ["NEW", "APPOINTED", "TESTED", "UNQUALIFIED"];
  const result = await prisma.lead.updateMany({
    where: {
      status: { in: oldStatuses },
    },
    data: {
      status: "CONTACTING",
    },
  });

  console.log(`✅ Migrated ${result.count} leads to CONTACTING\n`);

  // Count after migration
  const after = await prisma.lead.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  console.log("📊 New status distribution:");
  after.forEach((row) => {
    console.log(`  ${row.status}: ${row._count._all}`);
  });

  console.log("\n✨ Migration completed successfully!");
}

main()
  .catch((error) => {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
