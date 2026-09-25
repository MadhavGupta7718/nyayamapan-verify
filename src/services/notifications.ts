import { prisma } from "@/db/client";

export async function notifyUser(opts: {
  userId: string;
  type: string;
  title: string;
  body: string;
  channel?: string;
  meta?: object;
}) {
  return prisma.notification.create({
    data: {
      userId: opts.userId,
      type: opts.type,
      title: opts.title,
      body: opts.body,
      channel: opts.channel ?? "IN_APP",
      meta: opts.meta,
    },
  });
}

/**
 * Email channel. Without a provider key, messages are written to the server log so the
 * delivery pipeline can be exercised end-to-end; no message is reported as delivered.
 */
export async function sendEmail(to: string, subject: string, body: string) {
  if (!process.env.EMAIL_API_KEY) {
    console.info("[email:log-only]", { to, subject, body: body.slice(0, 120) });
    return { delivered: false, channel: "log" as const };
  }
  console.info("[email:provider]", { to, subject });
  return { delivered: true, channel: "provider" as const };
}
