import type { Role } from "@/lib/auth/roles";

export class ServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
  }
}

export function assertRole(actorRole: Role | undefined, allowed: Role[]): void {
  if (!actorRole || !allowed.includes(actorRole)) {
    throw new ServiceError(
      "FORBIDDEN",
      "You do not have permission to perform this action.",
    );
  }
}
