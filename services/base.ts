import type { Role } from "@/lib/auth/roles";

export class ServiceError extends Error {
  code: string;
  cause?: unknown;

  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = "ServiceError";
    this.code = code;
    this.cause = cause;
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
