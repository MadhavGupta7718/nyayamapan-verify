import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/db/client";
import type { Role } from "@prisma/client";
import { writeAudit } from "@/server/audit";
import { clientIp, rateLimit } from "@/server/rate-limit";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 8 },
  pages: {
    signIn: "/en/login",
  },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        const ip = request?.headers ? clientIp(request.headers) : "unknown";
        if (!rateLimit(`login:${ip}`, 30, 15 * 60_000).ok || !rateLimit(`login:${email}`, 8, 15 * 60_000).ok) {
          return null;
        }
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || user.status !== "ACTIVE" || user.deletedAt) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          await writeAudit({ actorId: user.id, action: "LOGIN_FAILED", entity: "User", entityId: user.id, ip });
          return null;
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await writeAudit({ actorId: user.id, action: "LOGIN", entity: "User", entityId: user.id, ip });
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          stateId: user.stateId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: Role }).role;
        token.organizationId = (user as { organizationId?: string }).organizationId;
        token.stateId = (user as { stateId?: string }).stateId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub!;
        (session.user as { role: Role }).role = token.role as Role;
        (session.user as { organizationId?: string }).organizationId =
          token.organizationId as string | undefined;
        (session.user as { stateId?: string }).stateId =
          token.stateId as string | undefined;
      }
      return session;
    },
  },
});
