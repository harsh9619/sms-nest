export type Action = "read" | "create" | "update" | "delete" | "export";

export interface ModulePermission {
  moduleKey: string;
  moduleName: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canExport: boolean;
}

export const DEFAULT_ROLE_PERMISSIONS: Record<
  string,
  Record<string, { read: boolean; create: boolean; update: boolean; delete: boolean; export: boolean }>
> = {
  admin: {
    dashboard: { read: true, create: true, update: true, delete: true, export: true },
    students: { read: true, create: true, update: true, delete: true, export: true },
    teachers: { read: true, create: true, update: true, delete: true, export: true },
    users: { read: true, create: true, update: true, delete: true, export: true },
    classes: { read: true, create: true, update: true, delete: true, export: true },
    "subject-teacher-config": { read: true, create: true, update: true, delete: true, export: true },
    attendance: { read: true, create: true, update: true, delete: true, export: true },
    timetable: { read: true, create: true, update: true, delete: true, export: true },
    "reports/fees": { read: true, create: true, update: true, delete: true, export: true },
    "reports/salaries": { read: true, create: true, update: true, delete: true, export: true },
    "schools/create": { read: true, create: true, update: true, delete: true, export: true },
    "class-subject-config": { read: true, create: true, update: true, delete: true, export: true },
    settings: { read: true, create: true, update: true, delete: true, export: true },
  },
  principal: {
    dashboard: { read: true, create: false, update: false, delete: false, export: true },
    students: { read: true, create: true, update: true, delete: false, export: true },
    teachers: { read: true, create: false, update: false, delete: false, export: true },
    users: { read: true, create: false, update: false, delete: false, export: true },
    classes: { read: true, create: true, update: true, delete: false, export: true },
    "subject-teacher-config": { read: true, create: true, update: true, delete: false, export: true },
    attendance: { read: true, create: true, update: true, delete: false, export: true },
    timetable: { read: true, create: true, update: true, delete: false, export: true },
    "my-salary": { read: true, create: false, update: false, delete: false, export: true },
    "reports/fees": { read: true, create: false, update: false, delete: false, export: true },
    "reports/salaries": { read: true, create: false, update: false, delete: false, export: true },
  },
  teacher: {
    dashboard: { read: true, create: false, update: false, delete: false, export: false },
    students: { read: true, create: false, update: false, delete: false, export: true },
    classes: { read: true, create: false, update: false, delete: false, export: false },
    "subject-teacher-config": { read: false, create: false, update: false, delete: false, export: false },
    attendance: { read: true, create: true, update: true, delete: false, export: true },
    timetable: { read: true, create: false, update: false, delete: false, export: false },
    "my-salary": { read: true, create: false, update: false, delete: false, export: true },
  },
  student: {
    dashboard: { read: true, create: false, update: false, delete: false, export: false },
    timetable: { read: true, create: false, update: false, delete: false, export: false },
    "my-fees": { read: true, create: false, update: false, delete: false, export: true },
  },
  parent: {
    dashboard: { read: true, create: false, update: false, delete: false, export: false },
    timetable: { read: true, create: false, update: false, delete: false, export: false },
    "my-fees": { read: true, create: false, update: false, delete: false, export: true },
  },
};

export function getPermissionsForRole(role: string): ModulePermission[] {
  const normRole = (role || "").toLowerCase();
  const effectiveRole =
    normRole === "super_admin" || normRole === "school_admin" ? "admin" : normRole;
  const rolePerms = DEFAULT_ROLE_PERMISSIONS[effectiveRole] || DEFAULT_ROLE_PERMISSIONS["student"];

  return Object.entries(rolePerms).map(([moduleKey, perms]) => ({
    moduleKey,
    moduleName: moduleKey,
    canRead: perms.read,
    canCreate: perms.create,
    canUpdate: perms.update,
    canDelete: perms.delete,
    canExport: perms.export,
  }));
}
