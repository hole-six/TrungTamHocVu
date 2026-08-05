-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_class_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "session_date" DATETIME NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "completed_at" DATETIME,
    "notes" TEXT,
    "is_makeup" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "replaces_session_id" TEXT,
    CONSTRAINT "class_sessions_replaces_session_id_fkey" FOREIGN KEY ("replaces_session_id") REFERENCES "class_sessions" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_class_sessions" ("class_id", "completed_at", "created_at", "end_time", "id", "notes", "replaces_session_id", "room", "session_date", "start_time", "status", "updated_at") SELECT "class_id", "completed_at", "created_at", "end_time", "id", "notes", "replaces_session_id", "room", "session_date", "start_time", "status", "updated_at" FROM "class_sessions";
DROP TABLE "class_sessions";
ALTER TABLE "new_class_sessions" RENAME TO "class_sessions";
CREATE UNIQUE INDEX "class_sessions_replaces_session_id_key" ON "class_sessions"("replaces_session_id");
CREATE INDEX "class_sessions_class_id_session_date_idx" ON "class_sessions"("class_id", "session_date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

