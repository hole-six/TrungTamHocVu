import { prisma } from "@/lib/prisma";
import { computeSessionBaseHours } from "@/lib/server/payroll-rules";

export const CLASS_ASSIGNMENT_ROLES = ["TEACHER", "ASSISTANT", "ASSISTANT2"] as const;

export function isValidClassAssignmentRole(role: string): role is (typeof CLASS_ASSIGNMENT_ROLES)[number] {
  return CLASS_ASSIGNMENT_ROLES.includes(role as (typeof CLASS_ASSIGNMENT_ROLES)[number]);
}

function buildSessionAssignmentSnapshot(input: {
  sessionId: string;
  employeeId: string;
  role: string;
  startTime: string | null;
  endTime: string | null;
  payMode: string;
  teachingHourlyRate: number | null;
  assistantHourlyRate: number | null;
}) {
  const hours = computeSessionBaseHours(input.payMode, input.startTime, input.endTime);
  const hourlyRate = input.role === "TEACHER" ? input.teachingHourlyRate ?? 0 : input.assistantHourlyRate ?? 0;
  return {
    sessionId: input.sessionId,
    employeeId: input.employeeId,
    role: input.role,
    hours,
    hourlyRate,
    amount: Math.round(hours * hourlyRate),
  };
}

export async function applyClassDefaultAssignmentsToSession(sessionId: string) {
  const session = await prisma.classSession.findUnique({
    where: { id: sessionId },
    include: {
      assignments: true,
      class: {
        include: {
          defaultAssignments: {
            where: { isActive: true },
            include: { employee: true },
            orderBy: [{ role: "asc" }, { createdAt: "asc" }],
          },
        },
      },
    },
  });

  if (!session) return { created: 0 };

  const existingRoles = new Set(session.assignments.map((assignment) => assignment.role));
  const toCreate = session.class.defaultAssignments
    .filter((assignment) => !existingRoles.has(assignment.role))
    .map((assignment) =>
      buildSessionAssignmentSnapshot({
        sessionId: session.id,
        employeeId: assignment.employeeId,
        role: assignment.role,
        startTime: session.startTime,
        endTime: session.endTime,
        payMode: assignment.employee.payMode,
        teachingHourlyRate: assignment.employee.teachingHourlyRate,
        assistantHourlyRate: assignment.employee.assistantHourlyRate,
      }),
    );

  if (toCreate.length === 0) return { created: 0 };

  await prisma.sessionAssignment.createMany({ data: toCreate });
  return { created: toCreate.length };
}

export async function applyClassDefaultAssignmentsToExistingSessions(classId: string) {
  const sessions = await prisma.classSession.findMany({
    where: {
      classId,
      status: { in: ["PLANNED", "CONFIRMED"] },
    },
    select: { id: true },
  });

  let created = 0;
  for (const session of sessions) {
    const result = await applyClassDefaultAssignmentsToSession(session.id);
    created += result.created;
  }

  return { created, sessionsChecked: sessions.length };
}
