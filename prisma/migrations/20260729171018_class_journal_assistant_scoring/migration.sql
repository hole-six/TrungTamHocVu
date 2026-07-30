-- CreateTable
CREATE TABLE "class_session_journals" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "unit_lesson" TEXT,
    "homework_note" TEXT,
    "created_by_id" TEXT,
    "published_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "class_session_journals_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journal_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "homework_status" TEXT,
    "comment" TEXT,
    "notes" TEXT,
    CONSTRAINT "journal_entries_journal_id_fkey" FOREIGN KEY ("journal_id") REFERENCES "class_session_journals" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "journal_entries_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "journal_scores" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "entry_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "score" REAL,
    "max_score" REAL NOT NULL DEFAULT 10,
    CONSTRAINT "journal_scores_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "journal_entries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_cash_postings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_id" TEXT NOT NULL,
    "cash_transaction_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "posting_kind" TEXT NOT NULL DEFAULT 'RECEIPT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "payment_cash_postings_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_cash_postings_cash_transaction_id_fkey" FOREIGN KEY ("cash_transaction_id") REFERENCES "cash_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refund_cash_postings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "refund_id" TEXT NOT NULL,
    "cash_transaction_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "posting_kind" TEXT NOT NULL DEFAULT 'REFUND',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "refund_cash_postings_refund_id_fkey" FOREIGN KEY ("refund_id") REFERENCES "refunds" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "refund_cash_postings_cash_transaction_id_fkey" FOREIGN KEY ("cash_transaction_id") REFERENCES "cash_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_cash_postings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stock_transaction_id" TEXT NOT NULL,
    "cash_transaction_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "posting_kind" TEXT NOT NULL DEFAULT 'SUPPLIER_PAYMENT',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "stock_cash_postings_stock_transaction_id_fkey" FOREIGN KEY ("stock_transaction_id") REFERENCES "stock_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "stock_cash_postings_cash_transaction_id_fkey" FOREIGN KEY ("cash_transaction_id") REFERENCES "cash_transactions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assistant_score_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "event_date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "points" REAL NOT NULL,
    "reason" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_score_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "assistant_score_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "assistant_monthly_bonuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "bonus_percent" REAL NOT NULL,
    "notes" TEXT,
    "decided_by_id" TEXT,
    "decided_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assistant_monthly_bonuses_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_book_issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "book_id" TEXT NOT NULL,
    "class_id" TEXT,
    "student_id" TEXT NOT NULL,
    "charge_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'UNPAID',
    "issue_date" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "book_issues_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "book_issues_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "book_issues_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "book_issues_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_book_issues" ("amount", "book_id", "class_id", "id", "issue_date", "notes", "payment_status", "quantity", "student_id", "unit_price") SELECT "amount", "book_id", "class_id", "id", "issue_date", "notes", "payment_status", "quantity", "student_id", "unit_price" FROM "book_issues";
DROP TABLE "book_issues";
ALTER TABLE "new_book_issues" RENAME TO "book_issues";
CREATE INDEX "book_issues_charge_id_idx" ON "book_issues"("charge_id");
CREATE INDEX "book_issues_student_id_idx" ON "book_issues"("student_id");
CREATE TABLE "new_session_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hours" REAL,
    "deducted_hours" REAL NOT NULL DEFAULT 0,
    "added_hours" REAL NOT NULL DEFAULT 0,
    "adjustment_note" TEXT,
    "is_substitute_shift" BOOLEAN NOT NULL DEFAULT false,
    "hourly_rate" INTEGER,
    "amount" INTEGER,
    CONSTRAINT "session_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_session_assignments" ("added_hours", "adjustment_note", "amount", "deducted_hours", "employee_id", "hourly_rate", "hours", "id", "role", "session_id") SELECT "added_hours", "adjustment_note", "amount", "deducted_hours", "employee_id", "hourly_rate", "hours", "id", "role", "session_id" FROM "session_assignments";
DROP TABLE "session_assignments";
ALTER TABLE "new_session_assignments" RENAME TO "session_assignments";
CREATE INDEX "session_assignments_employee_id_idx" ON "session_assignments"("employee_id");
CREATE UNIQUE INDEX "session_assignments_session_id_employee_id_role_key" ON "session_assignments"("session_id", "employee_id", "role");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "class_session_journals_session_id_key" ON "class_session_journals"("session_id");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_journal_id_student_id_key" ON "journal_entries"("journal_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_cash_postings_payment_id_key" ON "payment_cash_postings"("payment_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_cash_postings_cash_transaction_id_key" ON "payment_cash_postings"("cash_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_cash_postings_refund_id_key" ON "refund_cash_postings"("refund_id");

-- CreateIndex
CREATE UNIQUE INDEX "refund_cash_postings_cash_transaction_id_key" ON "refund_cash_postings"("cash_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_cash_postings_stock_transaction_id_key" ON "stock_cash_postings"("stock_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_cash_postings_cash_transaction_id_key" ON "stock_cash_postings"("cash_transaction_id");

-- CreateIndex
CREATE INDEX "assistant_score_events_employee_id_event_date_idx" ON "assistant_score_events"("employee_id", "event_date");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_monthly_bonuses_employee_id_month_key" ON "assistant_monthly_bonuses"("employee_id", "month");
