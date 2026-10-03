-- CreateTable
CREATE TABLE "book_issue_batches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "class_id" TEXT,
    "issued_by_id" TEXT,
    "issue_date" DATETIME NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "book_issue_batches_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "book_issue_batches_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "book_issue_batches_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- AlterTable
ALTER TABLE "book_issues" ADD COLUMN "batch_id" TEXT REFERENCES "book_issue_batches" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "book_issue_batches_branch_id_issue_date_idx" ON "book_issue_batches"("branch_id", "issue_date");

-- CreateIndex
CREATE INDEX "book_issue_batches_class_id_issue_date_idx" ON "book_issue_batches"("class_id", "issue_date");

-- CreateIndex
CREATE INDEX "book_issues_batch_id_idx" ON "book_issues"("batch_id");
