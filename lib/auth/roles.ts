/**
 * Application roles. Authentication (who you are) is separate from
 * authorization (what you may do). Being logged in does not grant an
 * elevated role.
 */
export const ROLES = {
  ADMIN: "admin",
  CUSTOMER: "customer",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];
