import pg from "pg";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env variables
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const dbName = process.env.DB_NAME || "school_management";
const SCHEMA_PATH = path.join(__dirname, "..", "sql", "database.sql");
const DATA_PATH = path.join(__dirname, "..", "data.json");

function toUUID(str: any): number {
  if (str === null || str === undefined) return 0;
  const s = String(str).trim();
  if (/^\d+$/.test(s)) {
    const val = parseInt(s, 10);
    if (val > 0 && val <= 2147483647) return val;
  }
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    const char = s.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  const positiveHash = Math.abs(hash) || 1;
  return (positiveHash % 2147483647) + 1;
}

async function ensureDatabaseExists() {
  const tempPool = new pg.Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 5432),
    database: "postgres", // Connect to system database first
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "admin123",
  });

  try {
    const res = await tempPool.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (res.rowCount === 0) {
      console.log(`⏳ Database "${dbName}" does not exist. Creating...`);
      await tempPool.query(`CREATE DATABASE ${dbName}`);
      console.log(`✅ Database "${dbName}" created successfully.`);
    } else {
      console.log(`✅ Database "${dbName}" already exists.`);
    }
  } catch (err) {
    console.error("❌ Error checking/creating database:", err);
    throw err;
  } finally {
    await tempPool.end();
  }
}

async function ensureStudentExists(appQuery: any, studentId: string, name: string, rollNumber: string, className: string, sectionName: string, schoolId: string) {
  const studentUuid = toUUID(studentId);
  const res = await appQuery("SELECT 1 FROM students WHERE id = $1", [studentUuid]);
  if (res.rowCount > 0) return;

  console.log(`ℹ️ Student "${name}" (${studentId}) does not exist. Creating dynamically...`);
  const userUuid = toUUID("student_user_" + studentId);

  await appQuery(
    `INSERT INTO users (id, school_id, name, email, password, role, is_active)
     OVERRIDING SYSTEM VALUE
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [userUuid, toUUID(schoolId), name, `student_${studentId}@school.com`, "admin123", "student", true]
  );

  const schoolUuid = toUUID(schoolId);
  const sayId = await getSchoolAcadYearId(appQuery, schoolUuid, "2024-25");

  const classRes = await appQuery(
    "SELECT id FROM classes WHERE school_id = $1 AND name = $2 AND section = $3 LIMIT 1",
    [schoolUuid, className, sectionName]
  );
  const classId = classRes.rows[0]?.id || null;

  await appQuery(
    `INSERT INTO students (id, school_id, school_academic_year_id, user_id, class_id, roll_no, gender, admission_date)
     OVERRIDING SYSTEM VALUE
     VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
     ON CONFLICT (id) DO NOTHING`,
    [studentUuid, schoolUuid, sayId, userUuid, classId, rollNumber || studentId, "other"]
  );
}

async function ensureTeacherExists(appQuery: any, teacherId: string, name: string, schoolId: string) {
  const teacherUuid = toUUID(teacherId);
  const res = await appQuery("SELECT 1 FROM users WHERE id = $1 AND role = 'teacher'", [teacherUuid]);
  if (res.rowCount > 0) return;

  console.log(`ℹ️ Teacher "${name}" (${teacherId}) does not exist. Creating dynamically...`);
  await appQuery(
    `INSERT INTO users (id, school_id, name, email, password, role, is_active)
     OVERRIDING SYSTEM VALUE
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO NOTHING`,
    [teacherUuid, toUUID(schoolId), name, `teacher_${teacherId}@school.com`, "admin123", "teacher", true]
  );

  await appQuery(
    `INSERT INTO salary_structures (id, school_id, teacher_id, basic_salary, effective_from, is_active)
     OVERRIDING SYSTEM VALUE
     VALUES ($1, $2, $3, $4, CURRENT_DATE, TRUE)
     ON CONFLICT (id) DO NOTHING`,
    [toUUID("sal_struct_" + teacherId), toUUID(schoolId), teacherUuid, 50000]
  );
}

/**
 * Looks up (or creates) the school_academic_years row for a given school
 * and academic-year label, and returns its id.
 */
async function getSchoolAcadYearId(
  appQuery: any,
  schoolId: number,
  label: string
): Promise<number | null> {
  // Ensure master year exists
  const startYear = parseInt(label.split("-")[0], 10);
  const endYear = startYear + 1;
  await appQuery(
    `INSERT INTO academic_years (label, start_date, end_date)
     VALUES ($1, $2, $3)
     ON CONFLICT (label) DO NOTHING`,
    [label, `${startYear}-04-01`, `${endYear}-03-31`]
  );

  const ayRes = await appQuery(
    `SELECT id FROM academic_years WHERE label = $1`,
    [label]
  );
  const academicYearId = ayRes.rows[0]?.id;
  if (!academicYearId) return null;

  // Ensure school link exists
  await appQuery(
    `INSERT INTO school_academic_years (school_id, academic_year_id, is_current)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (school_id, academic_year_id) DO NOTHING`,
    [schoolId, academicYearId]
  );

  const sayRes = await appQuery(
    `SELECT id FROM school_academic_years WHERE school_id = $1 AND academic_year_id = $2`,
    [schoolId, academicYearId]
  );
  return sayRes.rows[0]?.id ?? null;

}

async function initializeDatabase() {
  console.log("🚀 Starting PostgreSQL initialization...");

  try {
    // 1. Ensure target database exists
    await ensureDatabaseExists();

    // 2. Connect to the actual application database
    const appPool = new pg.Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: dbName,
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD || "admin123",
    });

    const appQuery = async (text: string, params?: any[]) => {
      return appPool.query(text, params);
    };

    // 3. Drop existing tables for a clean slate
    console.log("⏳ Dropping existing public schema (if any) to ensure clean schema.sql application...");
    await appQuery(`
      DROP SCHEMA IF EXISTS public CASCADE;
    `);

    // 4. Read and execute schema.sql DDL
    console.log("⏳ Applying schema.sql DDL...");
    if (!fs.existsSync(SCHEMA_PATH)) {
      throw new Error(`schema.sql not found at ${SCHEMA_PATH}`);
    }
    const sql = fs.readFileSync(SCHEMA_PATH, "utf-8");
    await appQuery(sql);
    console.log("✅ Database schema initialized successfully.");

    // 4b. Ensure two-table academic year structure exists (additive migration)
    console.log("⏳ Ensuring academic_years (master) table...");
    await appQuery(`
      CREATE TABLE IF NOT EXISTS academic_years (
        id          SERIAL PRIMARY KEY,
        label       VARCHAR(20)  NOT NULL UNIQUE,
        start_date  DATE         NOT NULL,
        end_date    DATE         NOT NULL,
        created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
        updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
      );
    `);
    console.log("✅ academic_years (master) table ready.");

    console.log("⏳ Ensuring school_academic_years (per-school link) table...");
    await appQuery(`
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
      CREATE INDEX IF NOT EXISTS idx_school_academic_years_acad_id   ON school_academic_years(academic_year_id);
    `);
    console.log("✅ school_academic_years (per-school link) table ready.");

    // 5. Seed database from data.json if table is empty
    if (!fs.existsSync(DATA_PATH)) {
      console.log("ℹ️ No data.json found. Skipping data seeding.");
      await appPool.end();
      return;
    }

    console.log("⏳ Loading data.json for migration/seeding...");
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const data = JSON.parse(raw);

    const isTableEmpty = async (tableName: string): Promise<boolean> => {
      const res = await appQuery(`SELECT COUNT(*)::int as count FROM ${tableName}`);
      return res.rows[0].count === 0;
    };

    // --- Migrate Schools ---
    if (data.schools && (await isTableEmpty("schools"))) {
      console.log(`⏳ Seeding ${data.schools.length} schools...`);
      for (const s of data.schools) {
        const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        await appQuery(
          `INSERT INTO schools (id, name, slug, address, phone, email, logo_url, board, academic_year, is_active, subscription, max_students, theme, appearance_mode)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
           ON CONFLICT (id) DO NOTHING`,
          [
            toUUID(s.id),
            s.name,
            slug,
            s.address || null,
            s.phone || null,
            s.email || null,
            null,
            s.type || "CBSE School", // store type under board
            s.academicYear || "2024-25",
            true,
            "free",
            500,
            s.theme || "default",
            s.appearanceMode || "light",
          ]
        );
      }
      console.log("✅ Schools seeded.");
    }

    // --- Seed Academic Years (global master + per-school link) — must run before classes/attendance/etc. ---
    if (await isTableEmpty("academic_years")) {
      console.log("⏳ Seeding global academic_years + school_academic_years...");
      const schoolsRes = await appQuery("SELECT id, academic_year FROM schools");
      const labelSet = new Set<string>();
      for (const school of schoolsRes.rows) {
        labelSet.add(school.academic_year || "2024-25");
      }
      // Add one historical year
      const extra: string[] = [];
      for (const label of labelSet) {
        const sy = parseInt(label.split("-")[0], 10);
        extra.push(`${sy - 1}-${String(sy).slice(-2)}`);
      }
      for (const l of extra) labelSet.add(l);

      for (const label of Array.from(labelSet).sort()) {
        const sy = parseInt(label.split("-")[0], 10);
        await appQuery(
          `INSERT INTO academic_years (label, start_date, end_date)
           VALUES ($1, $2, $3) ON CONFLICT (label) DO NOTHING`,
          [label, `${sy}-04-01`, `${sy + 1}-03-31`]
        );
      }

      for (const school of schoolsRes.rows) {
        const currentLabel = school.academic_year || "2024-25";
        const ayRows = await appQuery(`SELECT id, label FROM academic_years ORDER BY label DESC`);
        for (const ay of ayRows.rows) {
          await appQuery(
            `INSERT INTO school_academic_years (school_id, academic_year_id, is_current)
             VALUES ($1, $2, $3)
             ON CONFLICT (school_id, academic_year_id) DO UPDATE SET is_current = EXCLUDED.is_current`,
            [school.id, ay.id, ay.label === currentLabel]
          );
        }
      }
      console.log("✅ Academic years + school links seeded.");
    }

    // --- Migrate Users (with ID mapping to prevent duplication mismatches) ---
    if (data.users && (await isTableEmpty("users"))) {
      console.log(`⏳ Seeding ${data.users.length} identity users...`);
      for (const u of data.users) {
        let role = u.role;
        let schoolId: any = null;
        if (role === "admin") {
          role = u.schoolIds && u.schoolIds.length === 1 ? "school_admin" : "super_admin";
          schoolId = u.schoolIds && u.schoolIds.length === 1 ? toUUID(u.schoolIds[0]) : null;
        } else {
          schoolId = u.schoolIds && u.schoolIds.length > 0 ? toUUID(u.schoolIds[0]) : null;
        }

        // Map ID to teacher list ID or student list ID if they match
        let userId = toUUID(u.id);
        if (role === "teacher") {
          const matchedTeacher = data.teachers?.find(
            (t: any) => t.email === u.email || t.name === u.name
          );
          if (matchedTeacher) {
            userId = toUUID(matchedTeacher.id);
          }
        } else if (role === "student") {
          const matchedStudent = data.students?.find(
            (s: any) => s.email === u.email || s.name === u.name
          );
          if (matchedStudent) {
            userId = toUUID("student_user_" + matchedStudent.id);
          }
        }

        await appQuery(
          `INSERT INTO users (id, school_id, name, email, password, role, phone, avatar_url, is_active)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO NOTHING`,
          [
            userId,
            schoolId,
            u.name,
            u.email,
            "admin123", // default password
            role,
            u.phone || null,
            u.avatar || null,
            true,
          ]
        );
      }
      console.log("✅ Users seeded.");
    }

    // --- Migrate Teachers ---
    if (data.teachers) {
      console.log(`⏳ Verifying and seeding ${data.teachers.length} teachers...`);
      for (const t of data.teachers) {
        const teacherUserId = toUUID(t.id);
        const userRes = await appQuery("SELECT 1 FROM users WHERE id = $1", [teacherUserId]);

        if (userRes.rowCount === 0) {
          await appQuery(
            `INSERT INTO users (id, school_id, name, email, password, role, phone, is_active)
             OVERRIDING SYSTEM VALUE
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [teacherUserId, toUUID(t.schoolId), t.name, t.email, "admin123", "teacher", t.phone || null, true]
          );
        } else {
          await appQuery(
            `UPDATE users SET school_id = $1, phone = COALESCE(phone, $2) WHERE id = $3`,
            [toUUID(t.schoolId), t.phone || null, teacherUserId]
          );
        }

        // Insert salary structure
        await appQuery(
          `INSERT INTO salary_structures (id, school_id, teacher_id, basic_salary, effective_from, is_active)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, CURRENT_DATE, TRUE)
           ON CONFLICT (id) DO NOTHING`,
          [toUUID("sal_struct_" + t.id), toUUID(t.schoolId), teacherUserId, t.salary || 0]
        );
      }
      console.log("✅ Teachers and salary structures seeded.");
    }

    // --- Seed Class Masters & Subject Masters (global lookup tables) ---
    if (await isTableEmpty("class_masters")) {
      console.log("⏳ Seeding class_masters...");
      const classMasters = [
        { id: 1,  name: "LKG",     grade_level: -2 },
        { id: 2,  name: "UKG",     grade_level: -1 },
        { id: 3,  name: "Class 1",  grade_level: 1  },
        { id: 4,  name: "Class 2",  grade_level: 2  },
        { id: 5,  name: "Class 3",  grade_level: 3  },
        { id: 6,  name: "Class 4",  grade_level: 4  },
        { id: 7,  name: "Class 5",  grade_level: 5  },
        { id: 8,  name: "Class 6",  grade_level: 6  },
        { id: 9,  name: "Class 7",  grade_level: 7  },
        { id: 10, name: "Class 8",  grade_level: 8  },
        { id: 11, name: "Class 9",  grade_level: 9  },
        { id: 12, name: "Class 10", grade_level: 10 },
        { id: 13, name: "Class 11", grade_level: 11 },
        { id: 14, name: "Class 12", grade_level: 12 },
      ];
      for (const cm of classMasters) {
        await appQuery(
          `INSERT INTO class_masters (id, name, grade_level)
           OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3)
           ON CONFLICT (id) DO NOTHING`,
          [cm.id, cm.name, cm.grade_level]
        );
      }
      console.log("✅ class_masters seeded.");
    }

    if (await isTableEmpty("subject_masters")) {
      console.log("⏳ Seeding subject_masters...");
      const subjectMasters = [
        { id: 1,  name: "English",              code: "ENG",    category: "language"   },
        { id: 2,  name: "Hindi",                code: "HIN",    category: "language"   },
        { id: 3,  name: "Sanskrit",             code: "SAN",    category: "language"   },
        { id: 4,  name: "Mathematics",          code: "MATH",   category: "science"    },
        { id: 5,  name: "Science",              code: "SCI",    category: "science"    },
        { id: 6,  name: "Physics",              code: "PHY",    category: "science"    },
        { id: 7,  name: "Chemistry",            code: "CHEM",   category: "science"    },
        { id: 8,  name: "Biology",              code: "BIO",    category: "science"    },
        { id: 9,  name: "Social Studies",       code: "SST",    category: "arts"       },
        { id: 10, name: "History",              code: "HIST",   category: "arts"       },
        { id: 11, name: "Geography",            code: "GEO",    category: "arts"       },
        { id: 12, name: "Civics",               code: "CIV",    category: "arts"       },
        { id: 13, name: "Economics",            code: "ECO",    category: "commerce"   },
        { id: 14, name: "Business Studies",     code: "BST",    category: "commerce"   },
        { id: 15, name: "Accountancy",          code: "ACC",    category: "commerce"   },
        { id: 16, name: "Computer Science",     code: "CS",     category: "science"    },
        { id: 17, name: "Information Technology",code: "IT",    category: "science"    },
        { id: 18, name: "Physical Education",   code: "PE",     category: "vocational" },
        { id: 19, name: "Art & Craft",          code: "ART",    category: "vocational" },
        { id: 20, name: "Music",                code: "MUS",    category: "vocational" },
        { id: 21, name: "English Literature",   code: "ENGLIT", category: "language"   },
      ];
      for (const sm of subjectMasters) {
        await appQuery(
          `INSERT INTO subject_masters (id, name, code, category)
           OVERRIDING SYSTEM VALUE VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO NOTHING`,
          [sm.id, sm.name, sm.code, sm.category]
        );
      }
      console.log("✅ subject_masters seeded.");
    }

    // --- Migrate Classes & Class Subjects ---
    if (data.classes && (await isTableEmpty("classes"))) {
      console.log(`⏳ Seeding ${data.classes.length} classes and subjects...`);
      for (const c of data.classes) {
        const schoolId = toUUID(c.schoolId);
        const schoolLabel: string = data.schools?.find((s: any) => toUUID(s.id) === schoolId)?.academic_year || "2024-25";
        const sayId = await getSchoolAcadYearId(appQuery, schoolId, schoolLabel);

        // Look up class_master_id by class name (e.g. '5' → 'Class 5')
        const cmLabel = isNaN(Number(c.name)) ? c.name : `Class ${c.name}`;
        const cmRes = await appQuery(
          `SELECT id FROM class_masters WHERE name = $1 LIMIT 1`, [cmLabel]
        );
        const classMasterId = cmRes.rows[0]?.id || null;

        const classId = toUUID(c.id);
        const teacherId = c.teacherId ? toUUID(c.teacherId) : null;

        await appQuery(
          `INSERT INTO classes (id, school_id, school_academic_year_id, class_master_id, name, section, teacher_id)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            classId,
            schoolId,
            sayId,
            classMasterId,
            c.name,
            c.section,
            teacherId,
          ]
        );

        // Populate school_classes
        await appQuery(
          `INSERT INTO school_classes (id, school_id, school_academic_year_id, class_master_id, class_id, name, division)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (id) DO NOTHING`,
          [
            classId,
            schoolId,
            sayId,
            classMasterId,
            classId,
            c.name,
            c.section,
          ]
        );

        // Populate class_teachers
        if (teacherId) {
          await appQuery(
            `INSERT INTO class_teachers (class_id, teacher_id, is_primary)
             VALUES ($1, $2, TRUE)
             ON CONFLICT DO NOTHING`,
            [classId, teacherId]
          );
        }

        if (c.subjects && Array.isArray(c.subjects)) {
          for (const sub of c.subjects) {
            // Look up subject_master_id by subject name
            const smRes = await appQuery(
              `SELECT id FROM subject_masters WHERE name = $1 LIMIT 1`, [sub]
            );
            const subjectMasterId = smRes.rows[0]?.id || null;
            const subjectId = toUUID(c.id + "_" + sub);

            await appQuery(
              `INSERT INTO subjects (id, school_id, subject_master_id, name, code, class_id, teacher_id)
               OVERRIDING SYSTEM VALUE
               VALUES ($1, $2, $3, $4, $5, $6, $7)
               ON CONFLICT (id) DO NOTHING`,
              [
                subjectId,
                schoolId,
                subjectMasterId,
                sub,
                sub.toUpperCase(),
                classId,
                teacherId,
              ]
            );

            // Populate class_subjects
            await appQuery(
              `INSERT INTO class_subjects (class_id, subject_id)
               VALUES ($1, $2)
               ON CONFLICT DO NOTHING`,
              [classId, subjectId]
            );

            // Populate subject_teachers if teacher assigned
            if (teacherId) {
              await appQuery(
                `INSERT INTO subject_teachers (subject_id, teacher_id, class_id)
                 VALUES ($1, $2, $3)
                 ON CONFLICT DO NOTHING`,
                [subjectId, teacherId, classId]
              );
            }
          }
        }
      }
      console.log("✅ Classes, subjects, and bridge tables seeded.");
    }

    // --- Migrate Students & Student User accounts ---
    if (data.students && (await isTableEmpty("students"))) {
      console.log(`⏳ Seeding ${data.students.length} students and user accounts...`);
      for (const s of data.students) {
        const schoolId = toUUID(s.schoolId);
        const schoolLabel: string = data.schools?.find((sch: any) => toUUID(sch.id) === schoolId)?.academic_year || "2024-25";
        const sayId = await getSchoolAcadYearId(appQuery, schoolId, schoolLabel);

        const userUuid = toUUID("student_user_" + s.id);
        const userRes = await appQuery("SELECT 1 FROM users WHERE id = $1", [userUuid]);

        if (userRes.rowCount === 0) {
          await appQuery(
            `INSERT INTO users (id, school_id, name, email, password, role, phone, is_active)
             OVERRIDING SYSTEM VALUE
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (id) DO NOTHING`,
            [userUuid, schoolId, s.name, s.email, "admin123", "student", s.phone || null, true]
          );
        } else {
          await appQuery(
            `UPDATE users SET school_id = $1, phone = COALESCE(phone, $2) WHERE id = $3`,
            [schoolId, s.phone || null, userUuid]
          );
        }

        // Lookup matching class ID
        const classRes = await appQuery(
          "SELECT id FROM classes WHERE school_id = $1 AND name = $2 AND section = $3 LIMIT 1",
          [schoolId, s.class, s.section]
        );
        const classId = classRes.rows[0]?.id || null;

        // Clean gender
        let gender: string | null = s.gender ? s.gender.toLowerCase() : null;
        if (gender !== "male" && gender !== "female" && gender !== "other") {
          gender = "other";
        }

        // Insert student profile
        await appQuery(
          `INSERT INTO students (id, school_id, school_academic_year_id, user_id, class_id, roll_no, dob, gender, blood_group, address, guardian_name, guardian_phone, admission_date)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           ON CONFLICT (id) DO NOTHING`,
          [
            toUUID(s.id),
            schoolId,
            sayId,
            userUuid,
            classId,
            s.rollNumber,
            s.dateOfBirth || null,
            gender,
            s.bloodGroup || null,
            s.address || null,
            s.parentName || null,
            s.parentPhone || null,
            s.admissionDate || s.joinDate || null,
          ]
        );
      }
      console.log("✅ Students seeded.");
    }

    // --- Migrate Attendance ---
    if (data.attendance && (await isTableEmpty("attendance"))) {
      console.log(`⏳ Seeding ${data.attendance.length} attendance records...`);
      for (const a of data.attendance) {
        // Guarantee referential integrity for student
        await ensureStudentExists(appQuery, a.studentId, a.studentName || "Student " + a.studentId, a.rollNumber, a.class || "5", a.section || "A", a.schoolId);

        const schoolId = toUUID(a.schoolId);
        const schoolLabel: string = data.schools?.find((s: any) => toUUID(s.id) === schoolId)?.academic_year || "2024-25";
        const sayId = await getSchoolAcadYearId(appQuery, schoolId, schoolLabel);

        const classRes = await appQuery(
          "SELECT id FROM classes WHERE school_id = $1 AND name = $2 AND section = $3 LIMIT 1",
          [schoolId, a.class, a.section]
        );
        const classId = classRes.rows[0]?.id || null;

        let status = a.status ? a.status.toLowerCase() : "present";
        if (status !== "present" && status !== "absent" && status !== "late" && status !== "excused") {
          status = "present";
        }

        let markedByUuid: any = null;
        if (a.markedBy) {
          const teacherRes = await appQuery("SELECT id FROM users WHERE name = $1 LIMIT 1", [a.markedBy]);
          markedByUuid = teacherRes.rows[0]?.id || null;
        }

        await appQuery(
          `INSERT INTO attendance (id, school_id, school_academic_year_id, student_id, class_id, date, status, marked_by)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO NOTHING`,
          [toUUID(a.id), schoolId, sayId, toUUID(a.studentId), classId, a.date, status, markedByUuid]
        );
      }
      console.log("✅ Attendance seeded.");
    }

    // --- Migrate Fees ---
    if (data.fees && (await isTableEmpty("fees"))) {
      console.log(`⏳ Seeding ${data.fees.length} fee records...`);
      for (const f of data.fees) {
        // Guarantee referential integrity for student
        await ensureStudentExists(appQuery, f.studentId, f.studentName || "Student " + f.studentId, f.rollNumber, f.class || "5", f.section || "A", f.schoolId);

        const schoolId = toUUID(f.schoolId);
        const schoolLabel: string = data.schools?.find((s: any) => toUUID(s.id) === schoolId)?.academic_year || "2024-25";
        const sayId = await getSchoolAcadYearId(appQuery, schoolId, schoolLabel);

        const validFeeTypes = ["tuition", "exam", "sports", "library", "transport", "other"];
        const dbFeeType = validFeeTypes.includes(f.feeType) ? f.feeType : "other";
        const description = f.feeType !== dbFeeType ? f.feeType : null;

        let status = f.status ? f.status.toLowerCase() : "pending";
        if (status !== "pending" && status !== "paid" && status !== "overdue" && status !== "waived") {
          status = "pending";
        }

        await appQuery(
          `INSERT INTO fees (id, school_id, school_academic_year_id, student_id, amount, fee_type, description, due_date, status, paid_at)
           OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (id) DO NOTHING`,
          [
            toUUID(f.id),
            schoolId,
            sayId,
            toUUID(f.studentId),
            f.amount,
            dbFeeType,
            description,
            f.dueDate,
            status,
            f.paidDate || null,
          ]
        );
      }
      console.log("✅ Fees seeded.");
    }

    // --- Migrate Salaries ---
    if (data.salaries && (await isTableEmpty("salary_records"))) {
      console.log(`⏳ Seeding ${data.salaries.length} salary records...`);
      for (const sa of data.salaries) {
        // Guarantee referential integrity for teacher
        await ensureTeacherExists(appQuery, sa.teacherId, sa.teacherName || "Teacher " + sa.teacherId, sa.schoolId);

        const schoolId = toUUID(sa.schoolId);
        const schoolLabel: string = data.schools?.find((s: any) => toUUID(s.id) === schoolId)?.academic_year || "2024-25";
        const sayId = await getSchoolAcadYearId(appQuery, schoolId, schoolLabel);

        let status = sa.status ? sa.status.toLowerCase() : "pending";
        if (status !== "pending" && status !== "approved" && status !== "paid" && status !== "on_hold") {
          status = "pending";
        }

        const baseSalary = sa.baseSalary || 0;
        const allowances = sa.allowances || 0;
        const deductions = sa.deductions || 0;
        const grossSalary = baseSalary + allowances;
        const netSalary = grossSalary - deductions;

        // Convert month: accept integer, numeric string, or month name ("May" → 5)
        const MONTH_NAMES: Record<string, number> = {
          january: 1, february: 2, march: 3, april: 4,
          may: 5, june: 6, july: 7, august: 8,
          september: 9, october: 10, november: 11, december: 12,
          jan: 1, feb: 2, mar: 3, apr: 4,
          jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
        };
        const rawMonth = sa.month;
        let monthInt: number;
        if (typeof rawMonth === "number") {
          monthInt = rawMonth;
        } else {
          const parsed = parseInt(String(rawMonth), 10);
          if (!isNaN(parsed)) {
            monthInt = parsed;
          } else {
            monthInt = MONTH_NAMES[String(rawMonth).toLowerCase().trim()] ?? 1;
          }
        }
        if (monthInt < 1 || monthInt > 12) monthInt = 1;

        await appQuery(
          `INSERT INTO salary_records (
             id, school_id, school_academic_year_id, teacher_id, salary_structure_id, month, year,
             basic_salary, other_allowances, other_deductions,
             gross_salary, total_deductions, net_salary, status, paid_at
           ) OVERRIDING SYSTEM VALUE
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
           ON CONFLICT (id) DO NOTHING`,
          [
            toUUID(sa.id),
            schoolId,
            sayId,
            toUUID(sa.teacherId),
            toUUID("sal_struct_" + sa.teacherId),
            monthInt,
            sa.year,
            baseSalary,
            allowances,
            deductions,
            grossSalary,
            deductions,
            netSalary,
            status,
            sa.paidDate || null,
          ]
        );
      }
      console.log("✅ Salary records seeded.");
    }

    // --- Seed Notices ---
    if (await isTableEmpty("notices")) {
      console.log("⏳ Seeding notice board...");
      const notices = [
        {
          title: "Annual Sports Day 2026",
          content: "The annual sports meet will be held on June 25th. All students are invited to participate in track and field events.",
          audience: "all",
          is_pinned: true,
          schoolId: "1"
        },
        {
          title: "Staff Meeting",
          content: "A mandatory staff meeting is scheduled for Monday at 3:30 PM in the conference hall to discuss terminal exams.",
          audience: "teacher",
          is_pinned: false,
          schoolId: "1"
        },
        {
          title: "Fee Clearance Notice",
          content: "All students are requested to clear their pending tuition fees for Term 1 before June 20th to avoid late fines.",
          audience: "student",
          is_pinned: true,
          schoolId: "1"
        }
      ];

      for (const n of notices) {
        await appQuery(
          `INSERT INTO notices (school_id, title, content, audience, is_pinned)
           VALUES ($1, $2, $3, $4, $5)`,
          [toUUID(n.schoolId), n.title, n.content, n.audience, n.is_pinned]
        );
      }
      console.log("✅ Notices seeded.");
    }

    // --- Seed Marks ---
    if (data.examResults && (await isTableEmpty("marks"))) {
      console.log("⏳ Seeding student marks...");
      for (const er of data.examResults) {
        const studentId = toUUID(er.studentId);
        const schoolId = toUUID(er.schoolId);
        const schoolLabel: string = data.schools?.find((s: any) => toUUID(s.id) === schoolId)?.academic_year || "2024-25";
        const sayId = await getSchoolAcadYearId(appQuery, schoolId, schoolLabel);

        for (const [subjName, score] of Object.entries(er.marks)) {
          const subRes = await appQuery(
            "SELECT id FROM subjects WHERE school_id = $1 AND name = $2 LIMIT 1",
            [schoolId, subjName]
          );
          const subjectId = subRes.rows[0]?.id;
          if (subjectId) {
            await appQuery(
              `INSERT INTO marks (school_id, school_academic_year_id, student_id, subject_id, exam_type, score, max_score, exam_date)
               VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE)
               ON CONFLICT DO NOTHING`,
              [schoolId, sayId, studentId, subjectId, 'final', score, 50]
            );
          }
        }
      }
      console.log("✅ Marks seeded.");
    }

    // --- Seed Timetables ---
    if (await isTableEmpty("timetables")) {
      console.log("⏳ Seeding timetable slots...");
      const schoolId = toUUID("1");
      const sayId = await getSchoolAcadYearId(appQuery, schoolId, "2024-25");
      const classRes = await appQuery("SELECT id FROM classes WHERE school_id = $1 LIMIT 1", [schoolId]);
      const classId = classRes.rows[0]?.id;

      if (classId) {
        const subRes = await appQuery("SELECT id, name FROM subjects WHERE school_id = $1 AND class_id = $2", [schoolId, classId]);
        const subjects = subRes.rows;

        if (subjects.length > 0) {
          const days = ["monday", "tuesday", "wednesday", "thursday", "friday"];
          const timeSlots = [
            { start: "08:30:00", end: "09:30:00" },
            { start: "09:30:00", end: "10:30:00" },
            { start: "11:00:00", end: "12:00:00" },
            { start: "12:00:00", end: "13:00:00" }
          ];

          for (const day of days) {
            for (let idx = 0; idx < timeSlots.length; idx++) {
              const subject = subjects[idx % subjects.length];
              const slot = timeSlots[idx];
              await appQuery(
                `INSERT INTO timetables (school_id, school_academic_year_id, class_id, subject_id, day_of_week, start_time, end_time, classroom)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 ON CONFLICT DO NOTHING`,
                [schoolId, sayId, classId, subject.id, day, slot.start, slot.end, `Room ${100 + idx}`]
              );
            }
          }
        }
      }
      console.log("✅ Timetable slots seeded.");
    }

    // --- Seed Homework ---
    if (await isTableEmpty("homework")) {
      console.log("⏳ Seeding homework assignments...");
      const schoolId = toUUID("1");
      const sayId = await getSchoolAcadYearId(appQuery, schoolId, "2024-25");
      const classRes = await appQuery("SELECT id, teacher_id FROM classes WHERE school_id = $1 LIMIT 1", [schoolId]);
      const classId = classRes.rows[0]?.id;
      const teacherId = classRes.rows[0]?.teacher_id;

      if (classId) {
        const subRes = await appQuery("SELECT id FROM subjects WHERE school_id = $1 AND class_id = $2 LIMIT 2", [schoolId, classId]);
        const subjects = subRes.rows;

        if (subjects.length > 0) {
          await appQuery(
            `INSERT INTO homework (school_id, school_academic_year_id, class_id, subject_id, teacher_id, title, description, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE + INTERVAL '3 days')`,
            [schoolId, sayId, classId, subjects[0].id, teacherId, "Algebraic Equations", "Solve problems 1 to 10 on page 42 of your Maths textbook."]
          );
        }
        if (subjects.length > 1) {
          await appQuery(
            `INSERT INTO homework (school_id, school_academic_year_id, class_id, subject_id, teacher_id, title, description, due_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_DATE + INTERVAL '5 days')`,
            [schoolId, sayId, classId, subjects[1].id, teacherId, "Water Cycle Essay", "Write a 500-word essay explaining the different stages of the water cycle with diagrams."]
          );
        }
      }
      console.log("✅ Homework assignments seeded.");
    }

    // --- Seed Academic Years (global master + per-school link) ---
    if (await isTableEmpty("academic_years")) {
      console.log("⏳ Seeding global academic_years master table...");

      // Collect all unique academic-year labels from the schools table
      const schoolsRes = await appQuery("SELECT id, academic_year FROM schools");
      const labelSet = new Set<string>();
      for (const school of schoolsRes.rows) {
        labelSet.add(school.academic_year || "2024-25");
      }

      // Also seed one historical year behind each current label
      const extraLabels = new Set<string>();
      for (const label of labelSet) {
        const startYear = parseInt(label.split("-")[0], 10);
        extraLabels.add(`${startYear - 1}-${String(startYear).slice(-2)}`);
      }
      for (const label of extraLabels) labelSet.add(label);

      // Insert each unique label into the master table once
      for (const label of Array.from(labelSet).sort()) {
        const startYear = parseInt(label.split("-")[0], 10);
        const endYear = startYear + 1;
        await appQuery(
          `INSERT INTO academic_years (label, start_date, end_date)
           VALUES ($1, $2, $3)
           ON CONFLICT (label) DO NOTHING`,
          [label, `${startYear}-04-01`, `${endYear}-03-31`]
        );
      }
      console.log("✅ Global academic_years master seeded.");

      // Link each school to its academic years via school_academic_years
      console.log("⏳ Seeding school_academic_years links...");
      for (const school of schoolsRes.rows) {
        const currentLabel = school.academic_year || "2024-25";

        // Fetch all master year IDs that belong to this school's label set
        const ayRes = await appQuery(
          `SELECT id, label FROM academic_years ORDER BY label DESC`
        );

        for (const ay of ayRes.rows) {
          const isCurrent = ay.label === currentLabel;
          await appQuery(
            `INSERT INTO school_academic_years (school_id, academic_year_id, is_current)
             VALUES ($1, $2, $3)
             ON CONFLICT (school_id, academic_year_id) DO UPDATE SET is_current = EXCLUDED.is_current`,
            [school.id, ay.id, isCurrent]
          );
        }
      }
      console.log("✅ school_academic_years links seeded.");
    }

    console.log("⏳ Syncing identity sequences...");
    const tables = [
      "schools", "users", "classes", "subjects", "students", "timetables",
      "attendance", "class_subjects", "fees", "homework", "marks",
      "salary_structures", "salary_records", "notices",
      "academic_years", "school_academic_years",
      "class_masters", "subject_masters"
    ];
    for (const table of tables) {
      await appQuery(`
        SELECT setval(
          pg_get_serial_sequence('public.${table}', 'id'), 
          COALESCE(MAX(id), 1), 
          MAX(id) IS NOT NULL
        ) FROM public.${table};
      `);
    }
    console.log("✅ Identity sequences synced.");

    console.log("🎉 Database initialization and seeding completed successfully!");
    await appPool.end();
  } catch (error) {
    console.error("❌ Error initializing database:", error);
    process.exit(1);
  }
}

initializeDatabase();
