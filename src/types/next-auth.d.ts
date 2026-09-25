import type { DefaultSession } from "next-auth";
import type { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: Role;
      organizationId?: string | null;
      stateId?: string | null;
    };
  }

  interface User {
    role: Role;
    organizationId?: string | null;
    stateId?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: Role;
    organizationId?: string | null;
    stateId?: string | null;
  }
}
