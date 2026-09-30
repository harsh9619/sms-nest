import { UserRole } from "../../entities/user.entity.js";

export const ROLE_ID_MAP: Record<string, number> = {
  [UserRole.SUPER_ADMIN]: 1,
  "admin": 2,
  [UserRole.SCHOOL_ADMIN]: 3,
  [UserRole.PRINCIPAL]: 4,
  [UserRole.TEACHER]: 5,
  [UserRole.STUDENT]: 6,
  [UserRole.PARENT]: 7,
};

export function getRoleId(role: string): number {
  return ROLE_ID_MAP[role] || 6; // default to student if unknown
}
