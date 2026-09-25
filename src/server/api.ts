import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import type { ZodError } from "zod";
import { getSessionUser } from "@/server/session";
import type { SessionUser } from "@/server/rbac";

export function jsonError(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export function validationError(err: ZodError) {
  return jsonError(400, "VALIDATION_ERROR", { details: err.flatten() });
}

type Guarded = { user: SessionUser; response?: undefined } | { user?: undefined; response: NextResponse };

/** Resolves the session for an API route and enforces the role allow-list (server-side RBAC). */
export async function requireApiUser(roles?: Role[]): Promise<Guarded> {
  const user = await getSessionUser();
  if (!user) return { response: jsonError(401, "UNAUTHORIZED") };
  if (roles && !roles.includes(user.role)) return { response: jsonError(403, "FORBIDDEN") };
  return { user };
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
