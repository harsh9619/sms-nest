-- =============================================================
-- School Management System — Seed Data
-- seed.sql
-- Run AFTER database.sql to populate sample data.
-- All passwords are stored as plain text here for demo purposes.
-- In production, store bcrypt hashes instead.
-- =============================================================

-- =======================
-- SCHOOLS
-- =======================

INSERT INTO schools (id, name, slug, address, phone, email, logo_url, board, academic_year, is_active, subscription, max_students)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'Greenwood Public School', 'greenwood-public-school', '12 Oak Lane, Mumbai, Maharashtra 400001', '9876543210', 'info@greenwood.edu.in', 'default', 'CBSE School', '2024-25', TRUE, 'premium', 1000),
  (2, 'Sunrise Academy',         'sunrise-academy',          '45 Sunrise Road, Delhi 110001',            '9123456780', 'admin@sunrise.edu.in',  'default', 'ICSE School', '2024-25', TRUE, 'basic',   600)
ON CONFLICT (id) DO NOTHING;

-- Sync sequence
SELECT setval(pg_get_serial_sequence('public.schools', 'id'), MAX(id), TRUE) FROM public.schools;

-- ==============================
-- ACADEMIC YEARS (global master)
-- ==============================

INSERT INTO academic_years (id, label, start_date, end_date)
OVERRIDING SYSTEM VALUE VALUES
  (1, '2024-25', '2024-04-01', '2025-03-31'),
  (2, '2023-24', '2023-04-01', '2024-03-31'),
  (3, '2022-23', '2022-04-01', '2023-03-31')
ON CONFLICT (label) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.academic_years', 'id'), MAX(id), TRUE) FROM public.academic_years;

-- ==============================
-- SCHOOL ACADEMIC YEARS (per-school link)
-- ==============================

INSERT INTO school_academic_years (school_id, academic_year_id, is_current) VALUES
  -- Greenwood Public School
  (1, 1, TRUE),   -- 2024-25 is current
  (1, 2, FALSE),  -- 2023-24 historical
  (1, 3, FALSE),  -- 2022-23 historical

  -- Sunrise Academy
  (2, 1, TRUE),   -- 2024-25 is current
  (2, 2, FALSE)   -- 2023-24 historical
ON CONFLICT (school_id, academic_year_id) DO NOTHING;

-- =======================
-- USERS
-- Super admins, school admins, teachers, students
-- =======================

INSERT INTO users (id, school_id, name, email, password, role, phone, is_active)
OVERRIDING SYSTEM VALUE VALUES
  -- Super Admin
  (1,  NULL, 'Super Admin',      'superadmin@sms.com',          'admin123', 'super_admin',  '9000000000', TRUE),

  -- School Admins
  (2,  1,    'Rajesh Sharma',    'admin@greenwood.edu.in',       'admin123', 'school_admin', '9876543210', TRUE),
  (3,  2,    'Priya Patel',      'admin@sunrise.edu.in',         'admin123', 'school_admin', '9123456780', TRUE),

  -- Teachers — Greenwood (school 1)
  (10, 1,    'Anita Verma',      'anita.verma@greenwood.edu.in', 'admin123', 'teacher',      '9800000001', TRUE),
  (11, 1,    'Rohit Kumar',      'rohit.kumar@greenwood.edu.in', 'admin123', 'teacher',      '9800000002', TRUE),
  (12, 1,    'Sunita Rao',       'sunita.rao@greenwood.edu.in',  'admin123', 'teacher',      '9800000003', TRUE),
  (13, 1,    'Vikram Singh',     'vikram.singh@greenwood.edu.in','admin123', 'teacher',      '9800000004', TRUE),

  -- Teachers — Sunrise (school 2)
  (20, 2,    'Meena Joshi',      'meena.joshi@sunrise.edu.in',   'admin123', 'teacher',      '9700000001', TRUE),
  (21, 2,    'Arjun Nair',       'arjun.nair@sunrise.edu.in',    'admin123', 'teacher',      '9700000002', TRUE),

  -- Students — Greenwood user accounts
  (100, 1,   'Aarav Mehta',      'student_101@greenwood.edu.in', 'admin123', 'student',      '9600000001', TRUE),
  (101, 1,   'Diya Shah',        'student_102@greenwood.edu.in', 'admin123', 'student',      '9600000002', TRUE),
  (102, 1,   'Kabir Gupta',      'student_103@greenwood.edu.in', 'admin123', 'student',      '9600000003', TRUE),
  (103, 1,   'Priya Iyer',       'student_104@greenwood.edu.in', 'admin123', 'student',      '9600000004', TRUE),
  (104, 1,   'Aryan Joshi',      'student_105@greenwood.edu.in', 'admin123', 'student',      '9600000005', TRUE),
  (105, 1,   'Neha Pillai',      'student_106@greenwood.edu.in', 'admin123', 'student',      '9600000006', TRUE),

  -- Students — Sunrise user accounts
  (110, 2,   'Ravi Menon',       'student_201@sunrise.edu.in',   'admin123', 'student',      '9500000001', TRUE),
  (111, 2,   'Ananya Das',       'student_202@sunrise.edu.in',   'admin123', 'student',      '9500000002', TRUE),
  (112, 2,   'Siddharth Roy',    'student_203@sunrise.edu.in',   'admin123', 'student',      '9500000003', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.users', 'id'), MAX(id), TRUE) FROM public.users;

-- ==========================
-- CLASS MASTERS (global)
-- ==========================

INSERT INTO class_masters (id, name, grade_level, description)
OVERRIDING SYSTEM VALUE VALUES
  (1,  'LKG',     -2, 'Lower Kindergarten'),
  (2,  'UKG',     -1, 'Upper Kindergarten'),
  (3,  'Class 1',  1, 'Grade 1 — Primary'),
  (4,  'Class 2',  2, 'Grade 2 — Primary'),
  (5,  'Class 3',  3, 'Grade 3 — Primary'),
  (6,  'Class 4',  4, 'Grade 4 — Primary'),
  (7,  'Class 5',  5, 'Grade 5 — Primary'),
  (8,  'Class 6',  6, 'Grade 6 — Middle'),
  (9,  'Class 7',  7, 'Grade 7 — Middle'),
  (10, 'Class 8',  8, 'Grade 8 — Middle'),
  (11, 'Class 9',  9, 'Grade 9 — Secondary'),
  (12, 'Class 10', 10, 'Grade 10 — Secondary (Board)'),
  (13, 'Class 11', 11, 'Grade 11 — Senior Secondary'),
  (14, 'Class 12', 12, 'Grade 12 — Senior Secondary (Board)')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.class_masters', 'id'), MAX(id), TRUE) FROM public.class_masters;

-- ==========================
-- SUBJECT MASTERS (global)
-- ==========================

INSERT INTO subject_masters (id, name, code, category, description)
OVERRIDING SYSTEM VALUE VALUES
  -- Core / Language
  (1,  'English',              'ENG',    'language',   'English Language & Literature'),
  (2,  'Hindi',                'HIN',    'language',   'Hindi Language & Literature'),
  (3,  'Sanskrit',             'SAN',    'language',   'Sanskrit Language'),
  -- Mathematics
  (4,  'Mathematics',          'MATH',   'science',    'Mathematics — Arithmetic to Calculus'),
  -- Sciences
  (5,  'Science',              'SCI',    'science',    'General Science (Primary/Middle)'),
  (6,  'Physics',              'PHY',    'science',    'Physics'),
  (7,  'Chemistry',            'CHEM',   'science',    'Chemistry'),
  (8,  'Biology',              'BIO',    'science',    'Biology'),
  -- Social / Humanities
  (9,  'Social Studies',       'SST',    'arts',       'Social Studies (Primary/Middle)'),
  (10, 'History',              'HIST',   'arts',       'History'),
  (11, 'Geography',            'GEO',    'arts',       'Geography'),
  (12, 'Civics',               'CIV',    'arts',       'Civics & Political Science'),
  (13, 'Economics',            'ECO',    'commerce',   'Economics'),
  (14, 'Business Studies',     'BST',    'commerce',   'Business Studies'),
  (15, 'Accountancy',          'ACC',    'commerce',   'Accountancy'),
  -- Technology
  (16, 'Computer Science',     'CS',     'science',    'Computer Science & Programming'),
  (17, 'Information Technology','IT',    'science',    'Information Technology'),
  -- Arts & PE
  (18, 'Physical Education',   'PE',     'vocational', 'Physical Education & Sports'),
  (19, 'Art & Craft',          'ART',    'vocational', 'Visual Arts & Craft'),
  (20, 'Music',                'MUS',    'vocational', 'Music'),
  -- Others
  (21, 'English Literature',   'ENGLIT', 'language',   'English Literature (detailed study)')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.subject_masters', 'id'), MAX(id), TRUE) FROM public.subject_masters;

-- ==========================
-- DIVISION MASTERS (global)
-- ==========================

INSERT INTO division_masters (id, name, code, description)
OVERRIDING SYSTEM VALUE VALUES
  (1, 'A', 'DIV_A', 'Division A'),
  (2, 'B', 'DIV_B', 'Division B'),
  (3, 'C', 'DIV_C', 'Division C'),
  (4, 'D', 'DIV_D', 'Division D')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.division_masters', 'id'), MAX(id), TRUE) FROM public.division_masters;

-- =======================
-- SCHOOL CLASSES
-- =======================

INSERT INTO school_classes (id, school_id, school_academic_year_id, class_master_id, division_master_id, name, division, teacher_id)
OVERRIDING SYSTEM VALUE VALUES
  -- Greenwood classes  (school_academic_year_id=1 → 2024-25 for school 1)
  (1, 1, 1, 7,  1, '5',  'A', 10),   -- class_master_id 7 = Class 5, division_master_id 1 = A
  (2, 1, 1, 7,  2, '5',  'B', 11),   -- division_master_id 2 = B
  (3, 1, 1, 10, 1, '8',  'A', 12),   -- class_master_id 10 = Class 8
  (4, 1, 1, 12, 1, '10', 'A', 13),   -- class_master_id 12 = Class 10

  -- Sunrise classes  (school_academic_year_id=3 → 2024-25 for school 2)
  (5, 2, 3, 8,  1, '6',  'A', 20),   -- class_master_id 8 = Class 6
  (6, 2, 3, 11, 1, '9',  'A', 21)    -- class_master_id 11 = Class 9
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.school_classes', 'id'), MAX(id), TRUE) FROM public.school_classes;

-- =======================
-- SCHOOL CLASS SUBJECTS
-- =======================

INSERT INTO school_class_subjects (id, school_id, school_academic_year_id, class_id, subject_master_id)
OVERRIDING SYSTEM VALUE VALUES
  -- Greenwood 5A (class_id=1, say_id=1)
  (1,  1, 1, 1, 4),   -- Mathematics
  (2,  1, 1, 1, 1),   -- English
  (3,  1, 1, 1, 5),   -- Science
  (4,  1, 1, 1, 9),   -- Social Studies
  (24, 1, 1, 1, 2),   -- Hindi
  (25, 1, 1, 1, 16),  -- Computer Science

  -- Greenwood 5B (class_id=2, say_id=1)
  (5,  1, 1, 2, 4),   -- Mathematics
  (6,  1, 1, 2, 1),   -- English
  (7,  1, 1, 2, 5),   -- Science
  (26, 1, 1, 2, 19),  -- Art & Craft

  -- Greenwood 8A (class_id=3, say_id=1)
  (8,  1, 1, 3, 4),   -- Mathematics
  (9,  1, 1, 3, 6),   -- Physics
  (10, 1, 1, 3, 7),   -- Chemistry
  (11, 1, 1, 3, 8),   -- Biology
  (12, 1, 1, 3, 21),  -- English Literature
  (27, 1, 1, 3, 18),  -- Physical Education

  -- Greenwood 10A (class_id=4, say_id=1)
  (13, 1, 1, 4, 4),   -- Mathematics
  (14, 1, 1, 4, 6),   -- Physics
  (15, 1, 1, 4, 7),   -- Chemistry
  (16, 1, 1, 4, 16),  -- Computer Science
  (17, 1, 1, 4, 1),   -- English
  (28, 1, 1, 4, 13),  -- Economics

  -- Sunrise 6A (class_id=5, say_id=3)
  (18, 2, 3, 5, 4),   -- Mathematics
  (19, 2, 3, 5, 1),   -- English
  (20, 2, 3, 5, 5),   -- Science

  -- Sunrise 9A (class_id=6, say_id=3)
  (21, 2, 3, 6, 4),   -- Mathematics
  (22, 2, 3, 6, 6),   -- Physics
  (23, 2, 3, 6, 10)   -- History
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.school_class_subjects', 'id'), MAX(id), TRUE) FROM public.school_class_subjects;

-- =======================
-- SCHOOL CLASS TEACHERS
-- =======================

INSERT INTO school_class_teachers (id, school_id, school_academic_year_id, class_id, division_master_id, teacher_id, is_primary)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 1, 1, 10, TRUE),   -- class 5A → division_master_id 1 (A)
  (2, 1, 1, 2, 2, 11, TRUE),   -- class 5B → division_master_id 2 (B)
  (3, 1, 1, 3, 1, 12, TRUE),   -- class 8A → division_master_id 1 (A)
  (4, 1, 1, 4, 1, 13, TRUE),   -- class 10A → division_master_id 1 (A)
  (5, 2, 3, 5, 1, 20, TRUE),   -- class 6A → division_master_id 1 (A)
  (6, 2, 3, 6, 1, 21, TRUE)    -- class 9A → division_master_id 1 (A)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.school_class_teachers', 'id'), MAX(id), TRUE) FROM public.school_class_teachers;

-- =======================
-- SCHOOL SUBJECT TEACHERS
-- =======================

INSERT INTO school_subject_teachers (id, school_id, school_academic_year_id, class_id, division_master_id, subject_master_id, teacher_id)
OVERRIDING SYSTEM VALUE VALUES
  -- Greenwood 5A (division A = 1)
  (1,  1, 1, 1, 1, 4,  10), (2,  1, 1, 1, 1, 1,  12), (3,  1, 1, 1, 1, 5,  11), (4,  1, 1, 1, 1, 9,  13),
  -- Greenwood 5B (division B = 2)
  (5,  1, 1, 2, 2, 4,  11), (6,  1, 1, 2, 2, 1,  12), (7,  1, 1, 2, 2, 5,  10),
  -- Greenwood 8A (division A = 1)
  (8,  1, 1, 3, 1, 4,  10), (9,  1, 1, 3, 1, 6,  11), (10, 1, 1, 3, 1, 7,  12), (11, 1, 1, 3, 1, 8,  13), (12, 1, 1, 3, 1, 21, 12),
  -- Greenwood 10A (division A = 1)
  (13, 1, 1, 4, 1, 4,  13), (14, 1, 1, 4, 1, 6,  11), (15, 1, 1, 4, 1, 7,  12), (16, 1, 1, 4, 1, 16, 10), (17, 1, 1, 4, 1, 1,  12),
  -- Sunrise 6A (division A = 1)
  (18, 2, 3, 5, 1, 4,  20), (19, 2, 3, 5, 1, 1,  21),
  -- Sunrise 9A (division A = 1)
  (20, 2, 3, 6, 1, 4,  21), (21, 2, 3, 6, 1, 6,  20)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.school_subject_teachers', 'id'), MAX(id), TRUE) FROM public.school_subject_teachers;

-- =======================
-- STUDENTS
-- =======================

INSERT INTO students (id, school_id, school_academic_year_id, user_id, class_id, division_master_id, roll_no, dob, gender, blood_group, address, guardian_name, guardian_phone, admission_date)
OVERRIDING SYSTEM VALUE VALUES
  -- Class 5A Greenwood  (say_id=1 → 2024-25 school 1)
  (101, 1, 1, 100, 1, 1, '5A-001', '2014-03-15', 'male',   'B+',  '22 Park St, Mumbai',    'Suresh Mehta',  '9601111001', '2020-06-01'),
  (102, 1, 1, 101, 1, 1, '5A-002', '2014-07-22', 'female', 'O+',  '8 Garden Rd, Mumbai',   'Ramesh Shah',   '9601111002', '2020-06-01'),
  -- Class 5B Greenwood  (division B = 2)
  (103, 1, 1, 102, 2, 2, '5B-001', '2014-01-10', 'male',   'A+',  '15 Hill Top, Mumbai',   'Mohan Gupta',   '9601111003', '2020-06-01'),
  -- Class 8A Greenwood  (division A = 1)
  (104, 1, 1, 103, 3, 1, '8A-001', '2010-11-05', 'female', 'AB+', '3 River Ave, Mumbai',   'Kiran Iyer',    '9601111004', '2018-06-01'),
  -- Class 10A Greenwood  (division A = 1)
  (105, 1, 1, 104, 4, 1, 'X-001',  '2008-08-18', 'male',   'B-',  '10 Lake Rd, Mumbai',    'Nilesh Joshi',  '9601111005', '2016-06-01'),
  (106, 1, 1, 105, 4, 1, 'X-002',  '2009-02-25', 'female', 'O-',  '55 Crown Rd, Mumbai',   'Ganesh Pillai', '9601111006', '2016-06-01'),

  -- Sunrise students  (say_id=3 → 2024-25 school 2)
  (201, 2, 3, 110, 5, 1, '6A-001', '2013-05-12', 'male',   'A+',  '7 Sea View, Delhi',     'Rajiv Menon',   '9501111001', '2021-04-01'),
  (202, 2, 3, 111, 5, 1, '6A-002', '2013-09-30', 'female', 'B+',  '19 Green Park, Delhi',  'Tapas Das',     '9501111002', '2021-04-01'),
  (203, 2, 3, 112, 6, 1, '9A-001', '2010-12-01', 'male',   'O+',  '33 Connaught Pl, Delhi','Ashok Roy',     '9501111003', '2019-04-01')
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.students', 'id'), MAX(id), TRUE) FROM public.students;

-- =======================
-- SALARY STRUCTURES
-- =======================

INSERT INTO salary_structures (id, school_id, teacher_id, basic_salary, hra, da, other_allowance, pf_deduction, tax_deduction, effective_from, is_active)
OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 10, 55000, 13750, 5500, 2000, 6600, 3000, '2024-04-01', TRUE),
  (2, 1, 11, 50000, 12500, 5000, 2000, 6000, 2500, '2024-04-01', TRUE),
  (3, 1, 12, 60000, 15000, 6000, 2000, 7200, 3500, '2024-04-01', TRUE),
  (4, 1, 13, 58000, 14500, 5800, 2000, 6960, 3200, '2024-04-01', TRUE),
  (5, 2, 20, 48000, 12000, 4800, 1500, 5760, 2200, '2024-04-01', TRUE),
  (6, 2, 21, 52000, 13000, 5200, 1500, 6240, 2800, '2024-04-01', TRUE)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('public.salary_structures', 'id'), MAX(id), TRUE) FROM public.salary_structures;

-- =======================
-- SALARY RECORDS (April–June 2024)
-- =======================

INSERT INTO salary_records (school_id, teacher_id, salary_structure_id, month, year, basic_salary, other_allowances, other_deductions, gross_salary, total_deductions, net_salary, status, paid_at) VALUES
  -- Teacher 10 (Anita Verma)
  (1, 10, 1, 4, 2024, 55000, 21250, 0, 76250, 9600, 66650, 'paid',    '2024-04-30 10:00:00+05:30'),
  (1, 10, 1, 5, 2024, 55000, 21250, 0, 76250, 9600, 66650, 'paid',    '2024-05-31 10:00:00+05:30'),
  (1, 10, 1, 6, 2024, 55000, 21250, 0, 76250, 9600, 66650, 'pending', NULL),

  -- Teacher 11 (Rohit Kumar)
  (1, 11, 2, 4, 2024, 50000, 19500, 0, 69500, 8500, 61000, 'paid',    '2024-04-30 10:00:00+05:30'),
  (1, 11, 2, 5, 2024, 50000, 19500, 0, 69500, 8500, 61000, 'pending', NULL),

  -- Teacher 20 (Meena Joshi — Sunrise)
  (2, 20, 5, 4, 2024, 48000, 18300, 0, 66300, 7960, 58340, 'paid',    '2024-04-30 10:00:00+05:30')
ON CONFLICT DO NOTHING;

-- =======================
-- ATTENDANCE (Sample: May 2024)
-- =======================

INSERT INTO attendance (school_id, student_id, class_id, date, status, marked_by) VALUES
  (1, 101, 1, '2024-05-06', 'present', 10),
  (1, 101, 1, '2024-05-07', 'present', 10),
  (1, 101, 1, '2024-05-08', 'absent',  10),
  (1, 101, 1, '2024-05-09', 'present', 10),
  (1, 101, 1, '2024-05-10', 'late',    10),

  (1, 102, 1, '2024-05-06', 'present', 10),
  (1, 102, 1, '2024-05-07', 'absent',  10),
  (1, 102, 1, '2024-05-08', 'present', 10),
  (1, 102, 1, '2024-05-09', 'present', 10),
  (1, 102, 1, '2024-05-10', 'present', 10),

  (1, 103, 2, '2024-05-06', 'present', 11),
  (1, 103, 2, '2024-05-07', 'present', 11),
  (1, 103, 2, '2024-05-08', 'present', 11),
  (1, 103, 2, '2024-05-09', 'excused', 11),
  (1, 103, 2, '2024-05-10', 'present', 11),

  (1, 104, 3, '2024-05-06', 'present', 12),
  (1, 104, 3, '2024-05-07', 'late',    12),
  (1, 104, 3, '2024-05-08', 'present', 12),

  (2, 201, 5, '2024-05-06', 'present', 20),
  (2, 201, 5, '2024-05-07', 'present', 20),
  (2, 201, 5, '2024-05-08', 'absent',  20),

  (2, 203, 6, '2024-05-06', 'present', 21),
  (2, 203, 6, '2024-05-07', 'present', 21)
ON CONFLICT (student_id, date) DO NOTHING;

-- =======================
-- FEES
-- =======================

INSERT INTO fees (school_id, student_id, amount, fee_type, description, due_date, status, paid_at) VALUES
  -- Greenwood students
  (1, 101, 15000, 'tuition',   NULL,              '2024-04-15', 'paid',    '2024-04-10 09:00:00+05:30'),
  (1, 101,  2000, 'exam',      'Term 1 Exam Fee', '2024-05-01', 'paid',    '2024-04-28 09:00:00+05:30'),
  (1, 101,  1500, 'sports',    NULL,              '2024-06-01', 'pending', NULL),
  (1, 102, 15000, 'tuition',   NULL,              '2024-04-15', 'overdue', NULL),
  (1, 102,  2000, 'exam',      'Term 1 Exam Fee', '2024-05-01', 'pending', NULL),
  (1, 103, 15000, 'tuition',   NULL,              '2024-04-15', 'paid',    '2024-04-12 09:00:00+05:30'),
  (1, 104, 18000, 'tuition',   NULL,              '2024-04-15', 'paid',    '2024-04-08 09:00:00+05:30'),
  (1, 104,  3000, 'transport', NULL,              '2024-04-15', 'pending', NULL),
  (1, 105, 20000, 'tuition',   NULL,              '2024-04-15', 'paid',    '2024-04-05 09:00:00+05:30'),
  (1, 106, 20000, 'tuition',   NULL,              '2024-04-15', 'overdue', NULL),

  -- Sunrise students
  (2, 201, 12000, 'tuition',   NULL,              '2024-04-15', 'paid',    '2024-04-09 09:00:00+05:30'),
  (2, 202, 12000, 'tuition',   NULL,              '2024-04-15', 'pending', NULL),
  (2, 203, 14000, 'tuition',   NULL,              '2024-04-15', 'paid',    '2024-04-07 09:00:00+05:30')
ON CONFLICT DO NOTHING;

-- =======================
-- MARKS (Final exam scores)
-- =======================

INSERT INTO marks (school_id, student_id, subject_master_id, exam_type, score, max_score, exam_date) VALUES
  -- Student 101 (Class 5A)
  (1, 101, 4,  'final', 42, 50, '2024-03-20'),
  (1, 101, 1,  'final', 45, 50, '2024-03-21'),
  (1, 101, 5,  'final', 38, 50, '2024-03-22'),
  (1, 101, 9,  'final', 40, 50, '2024-03-23'),

  -- Student 102 (Class 5A)
  (1, 102, 4,  'final', 35, 50, '2024-03-20'),
  (1, 102, 1,  'final', 47, 50, '2024-03-21'),
  (1, 102, 5,  'final', 43, 50, '2024-03-22'),
  (1, 102, 9,  'final', 39, 50, '2024-03-23'),

  -- Student 104 (Class 8A)
  (1, 104, 4,  'final', 44, 50, '2024-03-18'),
  (1, 104, 6,  'final', 40, 50, '2024-03-19'),
  (1, 104, 7,  'final', 37, 50, '2024-03-20'),
  (1, 104, 8,  'final', 46, 50, '2024-03-21'),

  -- Student 105 (Class 10A)
  (1, 105, 4,  'final', 48, 50, '2024-03-15'),
  (1, 105, 6,  'final', 41, 50, '2024-03-16'),
  (1, 105, 7,  'final', 43, 50, '2024-03-17'),
  (1, 105, 16, 'final', 49, 50, '2024-03-18'),

  -- Sunrise students
  (2, 201, 4,  'final', 38, 50, '2024-03-20'),
  (2, 201, 1,  'final', 44, 50, '2024-03-21'),
  (2, 203, 4,  'final', 45, 50, '2024-03-19'),
  (2, 203, 6,  'final', 42, 50, '2024-03-20')
ON CONFLICT DO NOTHING;

-- =======================
-- TIMETABLES
-- =======================

INSERT INTO timetables (school_id, class_id, subject_master_id, teacher_id, day_of_week, start_time, end_time, classroom) VALUES
  -- Class 5A Greenwood — Monday
  (1, 1, 4, 10, 'monday',    '08:30:00', '09:30:00', 'Room 101'),
  (1, 1, 1, 10, 'monday',    '09:30:00', '10:30:00', 'Room 101'),
  (1, 1, 5, 10, 'monday',    '11:00:00', '12:00:00', 'Room 101'),
  (1, 1, 9, 10, 'monday',    '12:00:00', '13:00:00', 'Room 101'),
  -- Class 5A Greenwood — Tuesday
  (1, 1, 1, 10, 'tuesday',   '08:30:00', '09:30:00', 'Room 101'),
  (1, 1, 4, 10, 'tuesday',   '09:30:00', '10:30:00', 'Room 101'),
  (1, 1, 9, 10, 'tuesday',   '11:00:00', '12:00:00', 'Room 101'),
  (1, 1, 5, 10, 'tuesday',   '12:00:00', '13:00:00', 'Room 101'),

  -- Class 10A Greenwood — Monday
  (1, 4, 4,  13, 'monday',   '08:30:00', '09:30:00', 'Room 301'),
  (1, 4, 6,  13, 'monday',   '09:30:00', '10:30:00', 'Lab 1'),
  (1, 4, 7,  13, 'monday',   '11:00:00', '12:00:00', 'Lab 2'),
  (1, 4, 16, 13, 'monday',   '12:00:00', '13:00:00', 'Computer Lab'),

  -- Sunrise Class 6A — Monday
  (2, 5, 4,  20, 'monday',   '08:30:00', '09:30:00', 'Room 201'),
  (2, 5, 1,  20, 'monday',   '09:30:00', '10:30:00', 'Room 201'),
  (2, 5, 5,  20, 'monday',   '11:00:00', '12:00:00', 'Room 201')
ON CONFLICT (class_id, day_of_week, start_time) DO NOTHING;

-- =======================
-- HOMEWORK
-- =======================

INSERT INTO homework (school_id, class_id, subject_master_id, teacher_id, title, description, due_date) VALUES
  (1, 1, 4, 10, 'Algebraic Expressions',
   'Solve exercises 1–15 on page 82 of your Mathematics textbook. Show all working clearly.',
   CURRENT_DATE + INTERVAL '3 days'),

  (1, 1, 1, 10, 'Creative Writing',
   'Write a short story (minimum 300 words) on the topic: "A Day Without Technology".',
   CURRENT_DATE + INTERVAL '5 days'),

  (1, 3, 4, 12, 'Linear Equations Practice',
   'Complete worksheet 4 on simultaneous linear equations. Attempt all three methods.',
   CURRENT_DATE + INTERVAL '4 days'),

  (1, 4, 6, 13, 'Laws of Motion Problems',
   'Solve Newton''s Laws problems from Chapter 5, questions 10–20.',
   CURRENT_DATE + INTERVAL '7 days'),

  (2, 5, 4, 20, 'Fractions Worksheet',
   'Complete problems 1–20 on addition and subtraction of fractions from page 55.',
   CURRENT_DATE + INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- =======================
-- NOTICES
-- =======================

INSERT INTO notices (school_id, title, content, audience, is_pinned) VALUES
  (1, 'Annual Sports Day 2024',
   'The annual sports meet will be held on June 25, 2024. All students are encouraged to participate in track, field, and indoor events. Registration forms available at the admin office.',
   'all', TRUE),

  (1, 'Mandatory Staff Meeting',
   'All teaching staff are required to attend a meeting on Monday, June 10 at 3:30 PM in the conference hall. Agenda: Terminal exam logistics and result review process.',
   'teacher', FALSE),

  (1, 'Term 1 Fee Clearance Notice',
   'Students with pending Term 1 tuition and exam fees are requested to clear dues before June 20, 2024 to avoid a late payment fine of Rs. 500.',
   'student', TRUE),

  (1, 'Parent-Teacher Meeting',
   'A Parent-Teacher Meeting is scheduled for June 15, 2024. Parents are requested to collect slot tokens from the school reception by June 12.',
   'all', FALSE),

  (2, 'Mid-Term Examination Schedule',
   'Mid-term exams for all classes will begin from July 1, 2024. Detailed time-tables have been uploaded to the student portal.',
   'all', TRUE),

  (2, 'Library Books Return Reminder',
   'All students who have borrowed books from the school library must return them before June 30 to avoid a fine.',
   'student', FALSE)
ON CONFLICT DO NOTHING;

-- =======================
-- SYNC ALL SEQUENCES
-- =======================

SELECT setval(pg_get_serial_sequence('public.attendance',            'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.attendance;
SELECT setval(pg_get_serial_sequence('public.fees',                  'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.fees;
SELECT setval(pg_get_serial_sequence('public.marks',                 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.marks;
SELECT setval(pg_get_serial_sequence('public.timetables',            'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.timetables;
SELECT setval(pg_get_serial_sequence('public.homework',              'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.homework;
SELECT setval(pg_get_serial_sequence('public.notices',               'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.notices;
SELECT setval(pg_get_serial_sequence('public.salary_records',        'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.salary_records;
SELECT setval(pg_get_serial_sequence('public.academic_years',        'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.academic_years;
SELECT setval(pg_get_serial_sequence('public.school_class_subjects', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.school_class_subjects;
SELECT setval(pg_get_serial_sequence('public.school_classes',        'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.school_classes;
SELECT setval(pg_get_serial_sequence('public.school_class_teachers', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.school_class_teachers;
SELECT setval(pg_get_serial_sequence('public.school_subject_teachers','id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM public.school_subject_teachers;
