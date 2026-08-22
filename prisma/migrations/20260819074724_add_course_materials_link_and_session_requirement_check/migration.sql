-- AlterTable
ALTER TABLE "class_roadmap_items" ADD COLUMN "teacher_requirement" TEXT;

-- AlterTable
ALTER TABLE "courses" ADD COLUMN "materials_link" TEXT;

-- CreateTable
CREATE TABLE "session_requirement_checks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "requirement_text" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score_event_id" TEXT,
    "checked_by_id" TEXT NOT NULL,
    "checked_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "session_requirement_checks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_requirement_checks_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "session_requirement_checks_score_event_id_fkey" FOREIGN KEY ("score_event_id") REFERENCES "assistant_score_events" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "session_requirement_checks_session_id_key" ON "session_requirement_checks"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_requirement_checks_score_event_id_key" ON "session_requirement_checks"("score_event_id");
