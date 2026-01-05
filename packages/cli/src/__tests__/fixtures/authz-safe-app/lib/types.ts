// Role types - indicating RBAC is intended
export type Role = "admin" | "user" | "moderator";

export interface User {
  id: string;
  email: string;
  role: Role;
}

export const ROLES = {
  ADMIN: "admin",
  USER: "user",
  MODERATOR: "moderator",
} as const;
