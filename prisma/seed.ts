import { PrismaClient } from "@prisma/client";
import { seedRolesAndPermissions } from "./seeds/roles-permissions";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seeding...\n");

  try {
    // Seed roles and permissions
    await seedRolesAndPermissions();

    console.log("\n✨ All seeds completed successfully!");
  } catch (error) {
    console.error("\n❌ Error during seeding:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
