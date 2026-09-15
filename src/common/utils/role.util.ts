import { UserRole } from "../../entities/user.entity.js";

export const ROLE_ID_MAP: Record<string, number> = {
  [UserRole.SUPER_ADMIN]: 1,
  [UserRole.SCHOOL_ADMIN]: 2,
  [UserRole.TEACHER]: 3,
  [UserRole.STUDENT]: 4,
  [UserRole.PARENT]: 5,
};

export function getRoleId(role: string): number {
  return ROLE_ID_MAP[role] || 4; // default to student if unknown
}
