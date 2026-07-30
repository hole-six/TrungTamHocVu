import { PrismaClient } from "@prisma/client";
import {
  syncBookQuantityOnHand,
  syncClassDerivedFields,
  syncLeadDerivedFields,
  syncStudentDerivedFields,
  syncTimesheetEntryPeriod,
} from "@/lib/server/database-sync";

const prisma = new PrismaClient();

async function main() {
  const [classes, students, leads, timesheetEntries, books] = await Promise.all([
    prisma.class.findMany({ select: { id: true } }),
    prisma.student.findMany({ select: { id: true } }),
    prisma.lead.findMany({ select: { id: true } }),
    prisma.timesheetEntry.findMany({ select: { id: true } }),
    prisma.book.findMany({ select: { id: true } }),
  ]);

  for (const item of classes) {
    await syncClassDerivedFields(item.id, prisma);
  }

  for (const item of students) {
    await syncStudentDerivedFields(item.id, prisma);
  }

  for (const item of leads) {
    await syncLeadDerivedFields(item.id, prisma);
  }

  for (const item of timesheetEntries) {
    await syncTimesheetEntryPeriod(item.id, prisma);
  }

  for (const item of books) {
    await syncBookQuantityOnHand(item.id, prisma);
  }

  console.log(
    JSON.stringify(
      {
        syncedAt: new Date().toISOString(),
        classes: classes.length,
        students: students.length,
        leads: leads.length,
        timesheetEntries: timesheetEntries.length,
        books: books.length,
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
