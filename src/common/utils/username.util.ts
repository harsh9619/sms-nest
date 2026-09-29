import { EntityManager, Repository } from "typeorm";
import { User } from "../../entities/user.entity.js";

/**
 * Generates or verifies a unique user_name for user creation and updates.
 *
 * Logic:
 * 1. If explicit username provided, sanitize it (lowercase, trimmed, alphanumeric/dots/underscores/dashes).
 * 2. If no explicit username provided:
 *    - Base candidate = email prefix (if email available) or clean slug from full name.
 * 3. Checks DB for existing user with this user_name (excluding excludeUserId if updating).
 * 4. If collision exists, appends incrementing number suffix until a unique user_name is found.
 */
export async function generateUniqueUsername(
  managerOrRepo: EntityManager | Repository<User>,
  options: {
    explicitUsername?: string;
    email?: string;
    name?: string;
    role?: string;
    excludeUserId?: number;
  }
): Promise<string> {
  const { explicitUsername, email, name, role, excludeUserId } = options;

  let baseName = "";

  if (explicitUsername && String(explicitUsername).trim()) {
    baseName = String(explicitUsername).trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
  }

  if (!baseName && email && String(email).trim()) {
    const parts = String(email).trim().toLowerCase().split("@");
    if (parts[0]) {
      baseName = parts[0].replace(/[^a-z0-9._-]/g, "");
    }
  }

  if (!baseName && name && String(name).trim()) {
    baseName = String(name)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9._-]/g, "");
  }

  if (!baseName) {
    baseName = (role || "user").toLowerCase() + "_" + Math.floor(1000 + Math.random() * 9000);
  }

  const repo = "getRepository" in managerOrRepo
    ? (managerOrRepo as EntityManager).getRepository(User)
    : (managerOrRepo as Repository<User>);

  let candidate = baseName;
  let counter = 1;

  while (true) {
    const qb = repo.createQueryBuilder("u");

    qb.where("LOWER(u.user_name) = :candidate", { candidate });
    if (excludeUserId) {
      qb.andWhere("u.id != :excludeUserId", { excludeUserId });
    }

    const existing = await qb.getOne();
    if (!existing) {
      return candidate;
    }

    candidate = `${baseName}${counter}`;
    counter++;
  }
}
