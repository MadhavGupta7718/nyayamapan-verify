import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/db/client";
import { jsonError, readJson, requireApiUser, validationError } from "@/server/api";
import { applicationScope } from "@/server/scope";
import {
  APPLICATION_ACTIONS,
  WorkflowError,
  availableActions,
  missingRequiredDocuments,
  transitionApplication,
  type ApplicationAction,
} from "@/services/application-workflow";
import { autoAssign } from "@/services/assignment";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const app = await prisma.application.findFirst({
    where: { AND: [{ id }, applicationScope(user)] },
    select: {
      id: true,
      applicationNumber: true,
      status: true,
      verificationType: true,
      preferredDate: true,
      preferredSlot: true,
      createdAt: true,
      updatedAt: true,
      instrument: { select: { id: true, instrumentCode: true, serialNumber: true, manufacturer: true, modelName: true } },
      statusHistory: { orderBy: { changedAt: "asc" }, select: { newStatus: true, changedAt: true, reason: true } },
    },
  });
  if (!app) return jsonError(404, "NOT_FOUND");
  return NextResponse.json({ data: app });
}

const patchSchema = z.object({
  action: z.enum(Object.keys(APPLICATION_ACTIONS) as [ApplicationAction, ...ApplicationAction[]]),
  reason: z.string().trim().max(1000).optional(),
  declarationAccepted: z.boolean().optional(),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireApiUser();
  if (response) return response;
  const { id } = await ctx.params;
  const body = patchSchema.safeParse(await readJson(req));
  if (!body.success) return validationError(body.error);

  const app = await prisma.application.findFirst({
    where: { AND: [{ id }, applicationScope(user)] },
    select: { id: true, status: true, createdById: true, organizationId: true, declarationAccepted: true },
  });
  if (!app) return jsonError(404, "NOT_FOUND");

  const isOwner = app.createdById === user.id || (!!user.organizationId && app.organizationId === user.organizationId);
  const allowed = availableActions(app.status, user.role, isOwner);
  if (!allowed.includes(body.data.action)) return jsonError(403, "ACTION_NOT_ALLOWED");

  const def = APPLICATION_ACTIONS[body.data.action];
  if ("requiresReason" in def && def.requiresReason && (!body.data.reason || body.data.reason.length < 5)) {
    return jsonError(400, "REASON_REQUIRED");
  }
  if (body.data.action === "submit") {
    if (!app.declarationAccepted && !body.data.declarationAccepted) return jsonError(400, "DECLARATION_REQUIRED");
    const missing = await missingRequiredDocuments(app.id);
    if (missing.length) return jsonError(400, "DOCUMENTS_MISSING", { missing });
    if (!app.declarationAccepted) {
      await prisma.application.update({ where: { id: app.id }, data: { declarationAccepted: true } });
    }
  }
  if (body.data.action === "approve") {
    const missing = await missingRequiredDocuments(app.id);
    if (missing.length) return jsonError(400, "APPROVAL_DOCUMENTS_MISSING", { missing });
  }

  try {
    const updated = await transitionApplication({
      applicationId: app.id,
      to: def.to,
      actorId: user.id,
      reason: body.data.reason,
    });
    if (body.data.action === "approve") {
      const assignment = await autoAssign(app.id, user.id).catch((err) => {
        console.error("[auto-assign]", app.id, err);
        return { assigned: false as const, reason: "NO_OFFICER" as const };
      });
      const current = assignment.assigned ? "ASSIGNED" : updated.status;
      return NextResponse.json({ data: { id: updated.id, status: current, assignment } });
    }
    return NextResponse.json({ data: { id: updated.id, status: updated.status } });
  } catch (e) {
    if (e instanceof WorkflowError) return jsonError(e.code === "CONCURRENT_UPDATE" ? 409 : 400, e.code);
    throw e;
  }
}
