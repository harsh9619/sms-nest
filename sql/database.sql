-- =============================================================
-- School Management System — PostgreSQL DDL
-- database.sql
-- Run this file first to set up the full schema from scratch.
-- =============================================================

-- Ensure the public schema exists (fresh slate when needed)
CREATE SCHEMA IF NOT EXISTS public;

-- =======================
-- ENUM TYPES
-- =======================

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'super_admin', 'school_admin', 'teacher', 'student'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM (
    'present', 'absent', 'late', 'excused'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fee_type AS ENUM (
    'tuition', 'exam', 'sports', 'library', 'transport', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE fee_status AS ENUM (
    'pending', 'paid', 'overdue', 'waived'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE salary_status AS ENUM (
    'pending', 'approved', 'paid', 'on_hold'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notice_audience AS ENUM (
    'all', 'teacher', 'student'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM (
    'male', 'female', 'other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE exam_type AS ENUM (
    'unit_test', 'midterm', 'final', 'assignment'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE day_of_week AS ENUM (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM (
    'free', 'basic', 'premium', 'enterprise'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =======================
-- TABLE: master_themes
-- =======================

CREATE TABLE IF NOT EXISTS master_themes (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  label       TEXT NOT NULL,
  color       TEXT NOT NULL,
  is_active   BOOL NOT NULL DEFAULT TRUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO master_themes (name, label, color, sort_order) VALUES
  ('default', 'Ocean Blue',    '#3b82f6', 1),
  ('emerald', 'Emerald',       '#10b981', 2),
  ('purple',  'Royal Purple',  '#8b5cf6', 3),
  ('rose',    'Rose',          '#f43f5e', 4),
  ('amber',   'Sunset Amber',  '#f97316', 5)
ON CONFLICT (name) DO NOTHING;

-- =======================
-- TABLE: schools
-- =======================

CREATE TABLE IF NOT EXISTS schools (
  id               SERIAL PRIMARY KEY,
  name             VARCHAR(200)      NOT NULL,
  slug             VARCHAR(200)      NOT NULL UNIQUE,
  address          TEXT,
  phone            VARCHAR(20),
  email            VARCHAR(150),
  logo_url         VARCHAR(500),
  board            VARCHAR(100),
  academic_year    VARCHAR(20)       NOT NULL DEFAULT '2024-25',
  is_active        BOOLEAN           NOT NULL DEFAULT TRUE,
  subscription     subscription_plan NOT NULL DEFAULT 'free',
  max_students     INT               NOT NULL DEFAULT 500,
  theme            TEXT              NOT NULL DEFAULT 'default' CHECK (theme IN ('default','emerald','purple','rose','amber')),
  appearance_mode  TEXT              NOT NULL DEFAULT 'light' CHECK (appearance_mode IN ('light','dark')),
  created_at       TIMESTAMPTZ       NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ       NOT NULL DEFAULT now()
);

-- =======================
-- TABLE: users
-- =======================

CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  school_id    INT           REFERENCES schools(id) ON DELETE SET NULL,
  name         VARCHAR(150)  NOT NULL,
  email        VARCHAR(150)  NOT NULL UNIQUE,
  password     VARCHAR(255)  NOT NULL,
  role         user_role     NOT NULL,
  phone        VARCHAR(20),
  avatar_url   VARCHAR(500),
  is_active    BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_school_id ON users(school_id);
CREATE INDEX IF NOT EXISTS idx_users_role      ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email     ON users(email);

-- ===================================
-- TABLE: academic_years  (global master)
-- Defines the label and date range for
-- each academic year, independent of any
-- particular school.
-- ===================================

CREATE TABLE IF NOT EXISTS academic_years (
  id          SERIAL PRIMARY KEY,
  label       VARCHAR(20)  NOT NULL UNIQUE,   -- e.g. '2024-25'
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ===================================
-- TABLE: school_academic_years
-- Links each school to the academic years
-- it participates in, and marks which one
-- is currently active for that school.
-- ===================================

CREATE TABLE IF NOT EXISTS school_academic_years (
  id               SERIAL PRIMARY KEY,
  school_id        INT         NOT NULL REFERENCES schools(id)        ON DELETE CASCADE,
  academic_year_id INT         NOT NULL REFERENCES academic_years(id) ON DELETE CASCADE,
  is_current       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, academic_year_id)
);

CREATE INDEX IF NOT EXISTS idx_school_academic_years_school_id ON school_academic_years(school_id);
-- ============================================
-- TABLE: class_masters  (global class reference)
-- Canonical list of grade/class levels used
-- across all schools (e.g. LKG, UKG, 1–12).
-- ============================================

CREATE TABLE IF NOT EXISTS class_masters (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(50)  NOT NULL UNIQUE,   -- e.g. 'Class 1', 'LKG'
  grade_level  INT          NOT NULL UNIQUE,   -- sort order: LKG=-2, UKG=-1, 1-12
  description  TEXT,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE: subject_masters  (global subject reference)
-- Canonical list of subjects that schools can
-- pick from when defining their curriculum.
-- ============================================

CREATE TABLE IF NOT EXISTS subject_masters (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL UNIQUE,   -- e.g. 'Mathematics'
  code        VARCHAR(20)  NOT NULL UNIQUE,   -- e.g. 'MATH'
  category    VARCHAR(50),                    -- 'science' | 'arts' | 'commerce' | 'language' | 'vocational'
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_subject_masters_category ON subject_masters(category);

-- ============================================
-- TABLE: division_masters  (global division reference)
-- Canonical list of divisions/sections (e.g. A, B, C, D)
-- ============================================

CREATE TABLE IF NOT EXISTS division_masters (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,   -- e.g. 'A', 'B'
  code        VARCHAR(20)  NOT NULL UNIQUE,   -- e.g. 'DIV_A', 'DIV_B'
  description TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ============================================
-- TABLE: school_classes
-- Map of classes/divisions per school and academic year
-- ============================================

CREATE TABLE IF NOT EXISTS school_classes (
  id                      SERIAL PRIMARY KEY,
  school_id               INT          NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT          REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_master_id         INT          REFERENCES class_masters(id)          ON DELETE SET NULL,
  division_master_id      INT          REFERENCES division_masters(id)       ON DELETE SET NULL,
  name                    VARCHAR(50)  NOT NULL,
  division                VARCHAR(10),
  teacher_id              INT          REFERENCES users(id) ON DELETE SET NULL,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (school_id, school_academic_year_id, name, division)
);

CREATE INDEX IF NOT EXISTS idx_school_classes_school_id          ON school_classes(school_id);
CREATE INDEX IF NOT EXISTS idx_school_classes_class_master_id    ON school_classes(class_master_id);
CREATE INDEX IF NOT EXISTS idx_school_classes_division_master_id ON school_classes(division_master_id);

-- =======================
-- TABLE: school_class_subjects  (many-to-many bridge)
-- =======================

CREATE TABLE IF NOT EXISTS school_class_subjects (
  id                      SERIAL PRIMARY KEY,
  school_id               INT         NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT         REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_id                INT         NOT NULL REFERENCES school_classes(id)       ON DELETE CASCADE,
  subject_master_id       INT         NOT NULL REFERENCES subject_masters(id)      ON DELETE CASCADE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, school_academic_year_id, class_id, subject_master_id)
);

CREATE INDEX IF NOT EXISTS idx_school_class_subjects_school_id ON school_class_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_school_class_subjects_class_id  ON school_class_subjects(class_id);
CREATE INDEX IF NOT EXISTS idx_school_class_subjects_subj_id   ON school_class_subjects(subject_master_id);

-- =======================
-- TABLE: school_class_teachers
-- Mapping of class leads / class teachers
-- =======================

CREATE TABLE IF NOT EXISTS school_class_teachers (
  id                      SERIAL PRIMARY KEY,
  school_id               INT         NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT         REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_id                INT         NOT NULL REFERENCES school_classes(id)       ON DELETE CASCADE,
  division_master_id      INT         REFERENCES division_masters(id)       ON DELETE SET NULL,
  teacher_id              INT         NOT NULL REFERENCES users(id)                ON DELETE CASCADE,
  is_primary              BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (school_id, school_academic_year_id, class_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_school_class_teachers_school_id          ON school_class_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_school_class_teachers_class_id           ON school_class_teachers(class_id);
CREATE INDEX IF NOT EXISTS idx_school_class_teachers_division_master_id ON school_class_teachers(division_master_id);
CREATE INDEX IF NOT EXISTS idx_school_class_teachers_teacher_id         ON school_class_teachers(teacher_id);

-- =======================
-- TABLE: school_subject_teachers
-- Mapping of subject teachers per subject / class
-- =======================

CREATE TABLE IF NOT EXISTS school_subject_teachers (
  id                      SERIAL PRIMARY KEY,
  school_id               INT         NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT         REFERENCES school_academic_years(id) ON DELETE SET NULL,
  subject_master_id       INT         NOT NULL REFERENCES subject_masters(id)      ON DELETE CASCADE,
  division_master_id      INT         REFERENCES division_masters(id)       ON DELETE SET NULL,
  teacher_id              INT         NOT NULL REFERENCES users(id)                ON DELETE CASCADE,
  class_id                INT         REFERENCES school_classes(id)          ON DELETE CASCADE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_school_subject_teachers_school_id          ON school_subject_teachers(school_id);
CREATE INDEX IF NOT EXISTS idx_school_subject_teachers_subj_id            ON school_subject_teachers(subject_master_id);
CREATE INDEX IF NOT EXISTS idx_school_subject_teachers_division_master_id ON school_subject_teachers(division_master_id);
CREATE INDEX IF NOT EXISTS idx_school_subject_teachers_teacher_id         ON school_subject_teachers(teacher_id);
CREATE INDEX IF NOT EXISTS idx_school_subject_teachers_class_id           ON school_subject_teachers(class_id);

-- =======================
-- TABLE: students
-- =======================

CREATE TABLE IF NOT EXISTS students (
  id                      SERIAL PRIMARY KEY,
  school_id               INT           NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT           REFERENCES school_academic_years(id) ON DELETE SET NULL,
  user_id                 INT           NOT NULL REFERENCES users(id)               ON DELETE CASCADE,
  class_id                INT           REFERENCES school_classes(id) ON DELETE SET NULL,
  division_master_id      INT           REFERENCES division_masters(id) ON DELETE SET NULL,
  roll_no                 VARCHAR(20),
  dob                     DATE,
  gender                  gender_type,
  blood_group             VARCHAR(5),
  address                 TEXT,
  guardian_name           VARCHAR(150),
  guardian_phone          VARCHAR(20),
  admission_date          DATE,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_school_id           ON students(school_id);
CREATE INDEX IF NOT EXISTS idx_students_school_acad_year_id ON students(school_academic_year_id);
CREATE INDEX IF NOT EXISTS idx_students_class_id            ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_students_division_master_id ON students(division_master_id);
CREATE INDEX IF NOT EXISTS idx_students_user_id             ON students(user_id);

-- =======================
-- TABLE: attendance
-- =======================

CREATE TABLE IF NOT EXISTS attendance (
  id                      SERIAL PRIMARY KEY,
  school_id               INT               NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT               REFERENCES school_academic_years(id) ON DELETE SET NULL,
  student_id              INT               NOT NULL REFERENCES students(id)             ON DELETE CASCADE,
  class_id                INT               REFERENCES school_classes(id) ON DELETE SET NULL,
  date                    DATE              NOT NULL,
  status                  attendance_status NOT NULL DEFAULT 'present',
  marked_by               INT               REFERENCES users(id) ON DELETE SET NULL,
  remarks                 TEXT,
  created_at              TIMESTAMPTZ       NOT NULL DEFAULT now(),
  UNIQUE (student_id, date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_school_id  ON attendance(school_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date        ON attendance(date);

-- =======================
-- TABLE: timetables
-- =======================

CREATE TABLE IF NOT EXISTS timetables (
  id                      SERIAL PRIMARY KEY,
  school_id               INT         NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT         REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_id                INT         NOT NULL REFERENCES school_classes(id)       ON DELETE CASCADE,
  subject_master_id       INT         NOT NULL REFERENCES subject_masters(id)      ON DELETE CASCADE,
  teacher_id              INT         REFERENCES users(id) ON DELETE SET NULL,
  day_of_week             day_of_week NOT NULL,
  start_time              TIME        NOT NULL,
  end_time                TIME        NOT NULL,
  classroom               VARCHAR(50),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, day_of_week, start_time)
);

CREATE INDEX IF NOT EXISTS idx_timetables_school_id ON timetables(school_id);
CREATE INDEX IF NOT EXISTS idx_timetables_class_id  ON timetables(class_id);

-- =======================
-- TABLE: homework
-- =======================

CREATE TABLE IF NOT EXISTS homework (
  id                      SERIAL PRIMARY KEY,
  school_id               INT         NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT         REFERENCES school_academic_years(id) ON DELETE SET NULL,
  class_id                INT         NOT NULL REFERENCES school_classes(id)       ON DELETE CASCADE,
  subject_master_id       INT         NOT NULL REFERENCES subject_masters(id)      ON DELETE CASCADE,
  teacher_id              INT         REFERENCES users(id) ON DELETE SET NULL,
  title                   VARCHAR(200) NOT NULL,
  description             TEXT,
  due_date                DATE,
  created_at              TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_homework_school_id ON homework(school_id);
CREATE INDEX IF NOT EXISTS idx_homework_class_id  ON homework(class_id);

-- =======================
-- TABLE: marks
-- =======================

CREATE TABLE IF NOT EXISTS marks (
  id                      SERIAL PRIMARY KEY,
  school_id               INT       NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT       REFERENCES school_academic_years(id) ON DELETE SET NULL,
  student_id              INT       NOT NULL REFERENCES students(id)             ON DELETE CASCADE,
  subject_master_id       INT       NOT NULL REFERENCES subject_masters(id)      ON DELETE CASCADE,
  exam_type               exam_type NOT NULL DEFAULT 'final',
  score                   NUMERIC(6,2),
  max_score               NUMERIC(6,2) NOT NULL DEFAULT 100,
  exam_date               DATE,
  remarks                 TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, subject_master_id, exam_type, exam_date)
);

CREATE INDEX IF NOT EXISTS idx_marks_school_id  ON marks(school_id);
CREATE INDEX IF NOT EXISTS idx_marks_student_id ON marks(student_id);
CREATE INDEX IF NOT EXISTS idx_marks_subject_master_id ON marks(subject_master_id);

-- =======================
-- TABLE: fees
-- =======================

CREATE TABLE IF NOT EXISTS fees (
  id                      SERIAL PRIMARY KEY,
  school_id               INT        NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT        REFERENCES school_academic_years(id) ON DELETE SET NULL,
  student_id              INT        NOT NULL REFERENCES students(id)             ON DELETE CASCADE,
  amount                  NUMERIC(10,2) NOT NULL,
  fee_type                fee_type      NOT NULL DEFAULT 'tuition',
  description             TEXT,
  due_date                DATE,
  status                  fee_status    NOT NULL DEFAULT 'pending',
  paid_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fees_school_id  ON fees(school_id);
CREATE INDEX IF NOT EXISTS idx_fees_student_id ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_status     ON fees(status);

-- =======================
-- TABLE: salary_structures
-- =======================

CREATE TABLE IF NOT EXISTS salary_structures (
  id               SERIAL PRIMARY KEY,
  school_id        INT           NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  teacher_id       INT           NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  basic_salary     NUMERIC(12,2) NOT NULL DEFAULT 0,
  hra              NUMERIC(12,2) NOT NULL DEFAULT 0,
  da               NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_allowance  NUMERIC(12,2) NOT NULL DEFAULT 0,
  pf_deduction     NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_deduction    NUMERIC(12,2) NOT NULL DEFAULT 0,
  effective_from   DATE          NOT NULL DEFAULT CURRENT_DATE,
  is_active        BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_salary_structures_school_id  ON salary_structures(school_id);
CREATE INDEX IF NOT EXISTS idx_salary_structures_teacher_id ON salary_structures(teacher_id);

-- =======================
-- TABLE: salary_records
-- =======================

CREATE TABLE IF NOT EXISTS salary_records (
  id                      SERIAL PRIMARY KEY,
  school_id               INT           NOT NULL REFERENCES schools(id)              ON DELETE CASCADE,
  school_academic_year_id INT           REFERENCES school_academic_years(id) ON DELETE SET NULL,
  teacher_id              INT           NOT NULL REFERENCES users(id)               ON DELETE CASCADE,
  salary_structure_id     INT           REFERENCES salary_structures(id)    ON DELETE SET NULL,
  month                   INT           NOT NULL CHECK (month BETWEEN 1 AND 12),
  year                    INT           NOT NULL,
  basic_salary            NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_allowances        NUMERIC(12,2) NOT NULL DEFAULT 0,
  other_deductions        NUMERIC(12,2) NOT NULL DEFAULT 0,
  gross_salary            NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_deductions        NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary              NUMERIC(12,2) NOT NULL DEFAULT 0,
  status                  salary_status NOT NULL DEFAULT 'pending',
  paid_at                 TIMESTAMPTZ,
  remarks                 TEXT,
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, month, year)
);

CREATE INDEX IF NOT EXISTS idx_salary_records_school_id  ON salary_records(school_id);
CREATE INDEX IF NOT EXISTS idx_salary_records_teacher_id ON salary_records(teacher_id);

-- =======================
-- TABLE: notices
-- =======================

CREATE TABLE IF NOT EXISTS notices (
  id          SERIAL PRIMARY KEY,
  school_id   INT             NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  title       VARCHAR(250)    NOT NULL,
  content     TEXT            NOT NULL,
  audience    notice_audience NOT NULL DEFAULT 'all',
  is_pinned   BOOLEAN         NOT NULL DEFAULT FALSE,
  created_by  INT             REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notices_school_id ON notices(school_id);
CREATE INDEX IF NOT EXISTS idx_notices_audience  ON notices(audience);

-- =======================
-- UPDATED_AT TRIGGER FUNCTION
-- =======================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to all relevant tables
DO $$ DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'schools', 'users', 'academic_years', 'school_academic_years',
    'class_masters', 'subject_masters', 'division_masters',
    'school_classes', 'school_class_subjects', 'school_class_teachers', 'school_subject_teachers',
    'students', 'timetables', 'homework', 'fees',
    'salary_structures', 'salary_records', 'notices'
  ]
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS set_updated_at ON %I;
      CREATE TRIGGER set_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    ', t, t);
  END LOOP;
END $$;
