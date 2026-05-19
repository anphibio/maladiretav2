import type { UserRole } from "@prisma/client";

export const permissions = {
  ADMIN: ["manage:users", "manage:settings", "view:all", "export:reports"],
  OPERATOR: ["create:campaigns", "send:campaigns", "view:own"],
  AUDITOR: ["view:all", "export:reports"]
} satisfies Record<UserRole, string[]>;

export function can(role: UserRole, permission: string): boolean {
  return permissions[role].includes(permission);
}
