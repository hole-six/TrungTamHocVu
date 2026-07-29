-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "tax_code" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "organization_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "branches_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "key" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'branch',
    "description" TEXT
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    CONSTRAINT "role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "permissions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "employee_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "short_name" TEXT NOT NULL,
    "dob" DATETIME,
    "position" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "hometown" TEXT,
    "permanent_address" TEXT,
    "id_number" TEXT,
    "id_issue_date" DATETIME,
    "id_issue_place" TEXT,
    "resign_date" DATETIME,
    "work_status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "teaching_hourly_rate" INTEGER,
    "assistant_hourly_rate" INTEGER,
    "pay_mode" TEXT NOT NULL DEFAULT 'HOURLY',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "employment_contracts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "contract_no" TEXT,
    "sign_date" DATETIME,
    "expiry_date" DATETIME,
    "contract_type" TEXT,
    "base_salary" INTEGER,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employment_contracts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pay_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employee_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "rate_type" TEXT NOT NULL,
    "rate_amount" INTEGER NOT NULL,
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    "notes" TEXT,
    CONSTRAINT "pay_policies_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "guardians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "full_name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "lead_code" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "gender" TEXT,
    "dob" DATETIME,
    "guardian_id" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "meet_date" DATETIME,
    "interested_class_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "expected_start_date" DATETIME,
    "actual_enroll_date" DATETIME,
    "source" TEXT,
    "notes" TEXT,
    "notes_2" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "leads_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "leads_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "leads_interested_class_id_fkey" FOREIGN KEY ("interested_class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lead_interactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "type" TEXT NOT NULL,
    "content" TEXT,
    "occurred_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "lead_interactions_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "lead_interactions_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "scheduled_at" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "notes" TEXT,
    CONSTRAINT "appointments_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appointments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "placement_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "lead_id" TEXT NOT NULL,
    "test_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "suggested_class" TEXT,
    "result" TEXT,
    "notes" TEXT,
    CONSTRAINT "placement_tests_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "students" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "student_code" TEXT NOT NULL,
    "student_display_id" TEXT,
    "full_name" TEXT NOT NULL,
    "lead_id" TEXT,
    "gender" TEXT,
    "dob" DATETIME,
    "phone" TEXT,
    "address" TEXT,
    "enroll_date" DATETIME,
    "leave_date" DATETIME,
    "leave_reason" TEXT,
    "evaluation" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "students_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "students_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "student_guardians" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "guardian_id" TEXT NOT NULL,
    "relation" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "student_guardians_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_guardians_guardian_id_fkey" FOREIGN KEY ("guardian_id") REFERENCES "guardians" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrollment_status_history" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "enrollment_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT NOT NULL,
    "reason" TEXT,
    "changed_by_id" TEXT,
    "changed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "enrollment_status_history_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollment_status_history_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tuition_per_session" INTEGER NOT NULL,
    "sessions_per_week" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "courses_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "classes" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "course_id" TEXT,
    "class_code" TEXT NOT NULL,
    "class_group" TEXT,
    "class_name" TEXT NOT NULL,
    "total_sessions" INTEGER,
    "start_date" DATETIME,
    "expected_end_date" DATETIME,
    "sessions_per_week" INTEGER,
    "tuition_per_session" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "classes_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "classes_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "schedule_rules" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "room" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "schedule_rules_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "class_sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "class_id" TEXT NOT NULL,
    "session_date" DATETIME NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "room" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "completed_at" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "class_sessions_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "session_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "hours" REAL,
    "hourly_rate" INTEGER,
    "amount" INTEGER,
    CONSTRAINT "session_assignments_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "session_assignments_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "enroll_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "enrollments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "enrollments_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "student_attendances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PRESENT',
    "notes" TEXT,
    CONSTRAINT "student_attendances_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "class_sessions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_attendances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "timesheet_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "period_name" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "approved_at" DATETIME,
    "locked_at" DATETIME,
    CONSTRAINT "timesheet_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "timesheet_entries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "period_id" TEXT,
    "employee_id" TEXT NOT NULL,
    "work_date" DATETIME NOT NULL,
    "check_in_am" TEXT,
    "check_out_am" TEXT,
    "check_in_pm" TEXT,
    "check_out_pm" TEXT,
    "hours" REAL,
    "days" REAL,
    "late_minutes" INTEGER,
    "overtime_hours" REAL,
    "notes" TEXT,
    CONSTRAINT "timesheet_entries_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "timesheet_periods" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "timesheet_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "fee_policies" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT,
    "class_id" TEXT,
    "tuition_per_session" INTEGER NOT NULL,
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    "notes" TEXT,
    CONSTRAINT "fee_policies_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "fee_policies_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "billing_periods" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "period_name" TEXT NOT NULL,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "posted_at" DATETIME,
    "closed_at" DATETIME,
    CONSTRAINT "billing_periods_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "charges" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "billing_period_id" TEXT NOT NULL,
    "session_count" INTEGER NOT NULL DEFAULT 0,
    "absent_count" INTEGER NOT NULL DEFAULT 0,
    "deducted_count" INTEGER NOT NULL DEFAULT 0,
    "unit_price" INTEGER NOT NULL,
    "tuition_amount" INTEGER NOT NULL,
    "materials_amount" INTEGER NOT NULL DEFAULT 0,
    "opening_balance" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "charges_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "charges_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "charges_billing_period_id_fkey" FOREIGN KEY ("billing_period_id") REFERENCES "billing_periods" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "charge_id" TEXT NOT NULL,
    "invoice_no" TEXT NOT NULL,
    "issued_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "invoices_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "payment_no" TEXT NOT NULL,
    "paid_date" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT,
    "received_by_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_id" TEXT NOT NULL,
    "charge_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payment_allocations_charge_id_fkey" FOREIGN KEY ("charge_id") REFERENCES "charges" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "scholarships" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "percentage" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    CONSTRAINT "scholarships_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "adjustments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "percentage" REAL NOT NULL DEFAULT 0,
    "reason" TEXT,
    "effective_from" DATETIME NOT NULL,
    "effective_to" DATETIME,
    CONSTRAINT "adjustments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "credit_balances" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "student_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "used_at" DATETIME,
    CONSTRAINT "credit_balances_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "refunds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payment_id" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT,
    "refunded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_by_id" TEXT,
    CONSTRAINT "refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "books" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "book_code" TEXT,
    "name" TEXT NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "usage_status" TEXT,
    "notes" TEXT,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "books_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_locations" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "stock_locations_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "book_id" TEXT NOT NULL,
    "location_id" TEXT,
    "class_id" TEXT,
    "type" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "received_by_id" TEXT,
    "handed_by_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "txn_date" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "stock_transactions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_transactions_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "stock_locations" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "book_issues" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "book_id" TEXT NOT NULL,
    "class_id" TEXT,
    "student_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "payment_status" TEXT NOT NULL DEFAULT 'UNPAID',
    "issue_date" DATETIME NOT NULL,
    "notes" TEXT,
    CONSTRAINT "book_issues_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "book_issues_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "book_issues_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "transaction_categories" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "detail" TEXT,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "cash_transactions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "category_id" TEXT,
    "type" TEXT NOT NULL,
    "txn_date" DATETIME NOT NULL,
    "detail" TEXT,
    "description" TEXT,
    "amount" INTEGER NOT NULL,
    "handled_by_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "attachment_url" TEXT,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "cash_transactions_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "cash_transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "transaction_categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payroll_runs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT NOT NULL,
    "period_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "calculated_at" DATETIME,
    "approved_at" DATETIME,
    "locked_at" DATETIME,
    "paid_at" DATETIME,
    CONSTRAINT "payroll_runs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payroll_lines" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "payroll_run_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "teaching_hours" REAL NOT NULL DEFAULT 0,
    "teaching_amount" INTEGER NOT NULL DEFAULT 0,
    "assistant_hours" REAL NOT NULL DEFAULT 0,
    "assistant_amount" INTEGER NOT NULL DEFAULT 0,
    "staff_days" REAL NOT NULL DEFAULT 0,
    "base_salary_amount" INTEGER NOT NULL DEFAULT 0,
    "bonus" INTEGER NOT NULL DEFAULT 0,
    "penalty" INTEGER NOT NULL DEFAULT 0,
    "total_amount" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    CONSTRAINT "payroll_lines_payroll_run_id_fkey" FOREIGN KEY ("payroll_run_id") REFERENCES "payroll_runs" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "payroll_lines_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "related_type" TEXT,
    "related_id" TEXT,
    "assigned_to_id" TEXT,
    "due_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "related_type" TEXT NOT NULL,
    "related_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT,
    "branch_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "before" TEXT,
    "after" TEXT,
    "reason" TEXT,
    "correlation_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "audit_logs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branch_id" TEXT,
    "source_file" TEXT NOT NULL,
    "target_entity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_rows" INTEGER NOT NULL DEFAULT 0,
    "error_rows" INTEGER NOT NULL DEFAULT 0,
    "error_log" TEXT,
    "created_by_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "import_jobs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "integration_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "system" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "role_id" TEXT,
    "branch_id" TEXT,
    "employee_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "roles" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "users_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("created_at", "email", "full_name", "id", "password_hash", "role", "updated_at") SELECT "created_at", "email", "full_name", "id", "password_hash", "role", "updated_at" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_employee_id_key" ON "users"("employee_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

-- CreateIndex
CREATE UNIQUE INDEX "employees_employee_code_key" ON "employees"("employee_code");

-- CreateIndex
CREATE INDEX "employees_work_status_idx" ON "employees"("work_status");

-- CreateIndex
CREATE UNIQUE INDEX "leads_lead_code_key" ON "leads"("lead_code");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "leads"("status");

-- CreateIndex
CREATE INDEX "lead_interactions_lead_id_idx" ON "lead_interactions"("lead_id");

-- CreateIndex
CREATE UNIQUE INDEX "students_student_code_key" ON "students"("student_code");

-- CreateIndex
CREATE UNIQUE INDEX "students_lead_id_key" ON "students"("lead_id");

-- CreateIndex
CREATE INDEX "students_status_idx" ON "students"("status");

-- CreateIndex
CREATE UNIQUE INDEX "student_guardians_student_id_guardian_id_key" ON "student_guardians"("student_id", "guardian_id");

-- CreateIndex
CREATE UNIQUE INDEX "courses_branch_id_code_key" ON "courses"("branch_id", "code");

-- CreateIndex
CREATE UNIQUE INDEX "classes_class_code_key" ON "classes"("class_code");

-- CreateIndex
CREATE INDEX "classes_status_idx" ON "classes"("status");

-- CreateIndex
CREATE INDEX "class_sessions_class_id_session_date_idx" ON "class_sessions"("class_id", "session_date");

-- CreateIndex
CREATE INDEX "session_assignments_employee_id_idx" ON "session_assignments"("employee_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_assignments_session_id_employee_id_role_key" ON "session_assignments"("session_id", "employee_id", "role");

-- CreateIndex
CREATE INDEX "enrollments_status_idx" ON "enrollments"("status");

-- CreateIndex
CREATE INDEX "student_attendances_student_id_idx" ON "student_attendances"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_attendances_session_id_student_id_key" ON "student_attendances"("session_id", "student_id");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_periods_branch_id_period_name_key" ON "timesheet_periods"("branch_id", "period_name");

-- CreateIndex
CREATE UNIQUE INDEX "timesheet_entries_employee_id_work_date_key" ON "timesheet_entries"("employee_id", "work_date");

-- CreateIndex
CREATE UNIQUE INDEX "billing_periods_branch_id_period_name_key" ON "billing_periods"("branch_id", "period_name");

-- CreateIndex
CREATE INDEX "charges_billing_period_id_idx" ON "charges"("billing_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "charges_student_id_class_id_billing_period_id_key" ON "charges"("student_id", "class_id", "billing_period_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_charge_id_key" ON "invoices"("charge_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_no_key" ON "invoices"("invoice_no");

-- CreateIndex
CREATE UNIQUE INDEX "payments_payment_no_key" ON "payments"("payment_no");

-- CreateIndex
CREATE INDEX "payments_student_id_idx" ON "payments"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_allocations_payment_id_charge_id_key" ON "payment_allocations"("payment_id", "charge_id");

-- CreateIndex
CREATE INDEX "stock_transactions_book_id_txn_date_idx" ON "stock_transactions"("book_id", "txn_date");

-- CreateIndex
CREATE INDEX "book_issues_student_id_idx" ON "book_issues"("student_id");

-- CreateIndex
CREATE INDEX "cash_transactions_type_txn_date_idx" ON "cash_transactions"("type", "txn_date");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_runs_branch_id_period_name_key" ON "payroll_runs"("branch_id", "period_name");

-- CreateIndex
CREATE UNIQUE INDEX "payroll_lines_payroll_run_id_employee_id_key" ON "payroll_lines"("payroll_run_id", "employee_id");

-- CreateIndex
CREATE INDEX "tasks_related_type_related_id_idx" ON "tasks"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "attachments_related_type_related_id_idx" ON "attachments"("related_type", "related_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
