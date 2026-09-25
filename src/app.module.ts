import { Module, MiddlewareConsumer, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import path from "path";

import { School } from "./entities/school.entity.js";
import { User } from "./entities/user.entity.js";
import { AcademicYear } from "./entities/academic-year.entity.js";
import { SchoolAcademicYear } from "./entities/school-academic-year.entity.js";
import { ClassMaster } from "./entities/class-master.entity.js";
import { SubjectMaster } from "./entities/subject-master.entity.js";
import { Class } from "./entities/class.entity.js";
import { Subject } from "./entities/subject.entity.js";
import { Student } from "./entities/student.entity.js";
import { Attendance } from "./entities/attendance.entity.js";
import { Timetable } from "./entities/timetable.entity.js";
import { Homework } from "./entities/homework.entity.js";
import { Mark } from "./entities/mark.entity.js";
import { Fee } from "./entities/fee.entity.js";
import { FeeReceipt } from "./entities/fee-receipt.entity.js";
import { SalaryStructure } from "./entities/salary-structure.entity.js";
import { SalaryRecord } from "./entities/salary-record.entity.js";
import { Notice } from "./entities/notice.entity.js";
import { MasterTheme } from "./entities/master-theme.entity.js";
import { SchoolClass } from "./entities/school-class.entity.js";
import { ClassSubject } from "./entities/class-subject.entity.js";
import { ClassTeacher } from "./entities/class-teacher.entity.js";
import { SubjectTeacher } from "./entities/subject-teacher.entity.js";
import { DivisionMaster } from "./entities/division-master.entity.js";
import { RoleMaster } from "./entities/role-master.entity.js";
import { CasteMaster } from "./entities/caste-master.entity.js";
import { SchoolClassFeeStructure } from "./entities/class-fee-structure.entity.js";

import { AuthModule } from "./modules/auth/auth.module.js";
import { SchoolModule } from "./modules/school/school.module.js";
import { StudentModule } from "./modules/student/student.module.js";
import { TeacherModule } from "./modules/teacher/teacher.module.js";
import { ClassModule } from "./modules/class/class.module.js";
import { SubjectModule } from "./modules/subject/subject.module.js";
import { AttendanceModule } from "./modules/attendance/attendance.module.js";
import { UserModule } from "./modules/user/user.module.js";
import { FeeModule } from "./modules/fee/fee.module.js";
import { SalaryModule } from "./modules/salary/salary.module.js";
import { TimetableModule } from "./modules/timetable/timetable.module.js";
import { HomeworkModule } from "./modules/homework/homework.module.js";
import { NoticeModule } from "./modules/notice/notice.module.js";
import { MarkModule } from "./modules/mark/mark.module.js";
import { AcademicYearModule } from "./modules/academic-year/academic-year.module.js";
import { CasteModule } from "./modules/caste/caste.module.js";

import { LoggerMiddleware } from "./common/middleware/logger.middleware.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.join(process.cwd(), ".env"),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connectionString = configService.get<string>("DATABASE_URL");
        if (connectionString) {
          return {
            type: "postgres",
            url: connectionString,
            entities: [
              School,
              User,
              AcademicYear,
              SchoolAcademicYear,
              ClassMaster,
              SubjectMaster,
              Class,
              Subject,
              Student,
              Attendance,
              Timetable,
              Homework,
              Mark,
              Fee,
              FeeReceipt,
              SalaryStructure,
              SalaryRecord,
              Notice,
              MasterTheme,
              SchoolClass,
              ClassSubject,
              ClassTeacher,
              SubjectTeacher,
              DivisionMaster,
              RoleMaster,
              CasteMaster,
              SchoolClassFeeStructure,
            ],
            synchronize: false,
            extra: {
              max: 20,
              idleTimeoutMillis: 30000,
              connectionTimeoutMillis: 2000,
            },
          };
        }

        return {
          type: "postgres",
          host: configService.get<string>("DB_HOST") || "localhost",
          port: Number(configService.get<number>("DB_PORT") || 5432),
          database: configService.get<string>("DB_NAME") || "school_management",
          username: configService.get<string>("DB_USER") || "postgres",
          password: configService.get<string>("DB_PASSWORD") || "admin123",
          entities: [
            School,
            User,
            AcademicYear,
            SchoolAcademicYear,
            ClassMaster,
            SubjectMaster,
            Class,
            Subject,
            Student,
            Attendance,
            Timetable,
            Homework,
            Mark,
            Fee,
            FeeReceipt,
            SalaryStructure,
            SalaryRecord,
            Notice,
            MasterTheme,
            SchoolClass,
            ClassSubject,
            ClassTeacher,
            SubjectTeacher,
            DivisionMaster,
            RoleMaster,
            CasteMaster,
            SchoolClassFeeStructure,
          ],
          synchronize: false,
          extra: {
            max: 20,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 2000,
          },
        };
      },
    }),
    AuthModule,
    SchoolModule,
    StudentModule,
    TeacherModule,
    ClassModule,
    SubjectModule,
    AttendanceModule,
    UserModule,
    FeeModule,
    SalaryModule,
    TimetableModule,
    HomeworkModule,
    NoticeModule,
    MarkModule,
    AcademicYearModule,
    CasteModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(LoggerMiddleware).forRoutes("*");
  }
}
