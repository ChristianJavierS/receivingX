export const ROLES = {
  ADMIN: "admin",
  RECEIVER: "receiver",
  SALES: "sales",
  ACCOUNTING: "accounting",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLES: Role[] = Object.values(ROLES);
