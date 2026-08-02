-- CreateTable
CREATE TABLE "course_book_requirements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "course_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "course_book_requirements_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "course_book_requirements_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "student_book_requirements" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enrollment_id" TEXT NOT NULL,
    "student_id" TEXT NOT NULL,
    "class_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "course_book_requirement_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_snapshot" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "confirmed_at" DATETIME,
    "declined_at" DATETIME,
    "book_issue_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "student_book_requirements_enrollment_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_book_requirements_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "students" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_book_requirements_class_id_fkey" FOREIGN KEY ("class_id") REFERENCES "classes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_book_requirements_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "student_book_requirements_course_book_requirement_id_fkey" FOREIGN KEY ("course_book_requirement_id") REFERENCES "course_book_requirements" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "student_book_requirements_book_issue_id_fkey" FOREIGN KEY ("book_issue_id") REFERENCES "book_issues" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "course_book_requirements_book_id_idx" ON "course_book_requirements"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_book_requirements_course_id_book_id_key" ON "course_book_requirements"("course_id", "book_id");

-- CreateIndex
CREATE UNIQUE INDEX "student_book_requirements_book_issue_id_key" ON "student_book_requirements"("book_issue_id");

-- CreateIndex
CREATE INDEX "student_book_requirements_student_id_status_idx" ON "student_book_requirements"("student_id", "status");

-- CreateIndex
CREATE INDEX "student_book_requirements_class_id_status_idx" ON "student_book_requirements"("class_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "student_book_requirements_enrollment_id_book_id_key" ON "student_book_requirements"("enrollment_id", "book_id");
