import { NextRequest } from "next/server";

import prisma from "@/lib/prisma";
import { deletePath } from "@/lib/storage/chat-recipe-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// DIE-41 — Cron endpoint for chat-recipe-media bucket retention. Called daily
// by .github/workflows/cron-cleanup-chat-media.yml.
//
// Auth: shared-secret bearer header (CRON_SECRET env). The endpoint is in
// PUBLIC_API_ROUTES so it bypasses NextAuth — we authenticate via the secret
// instead because GitHub Actions doesn't carry a session cookie.
//
// Retention policy (decision #115):
//   success → 7 days post-processedAt
//   failure → 30 days post-createdAt (kept longer for debugging)
//   pending → 7 days post-createdAt (orphans, e.g. upload never sent)
//
// The blob is hard-deleted from Supabase Storage; the DB row stays for audit
// with `deletedAt` set so a re-run skips it. Failures during blob delete
// (e.g. blob already gone from manual cleanup) still mark deletedAt so the
// cron doesn't haunt the same row forever.

const SUCCESS_RETENTION_DAYS = 7;
const FAILURE_RETENTION_DAYS = 30;
const PENDING_ORPHAN_DAYS = 7;

interface CleanupReport {
  scanned: number;
  deleted: number;
  errors: Array<{ id: string; mediaPath: string; error: string }>;
}

function jsonError(status: number, code: string, message: string) {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return jsonError(
      500,
      "missing-secret",
      "CRON_SECRET is not configured on the server"
    );
  }

  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  if (auth !== expected) {
    return jsonError(401, "unauthorized", "Invalid cron secret");
  }

  // Find every event whose blob is overdue for deletion. Three independent
  // conditions OR'd together because Prisma can't express the union cleanly.
  const overdue = await prisma.multimodalImportEvent.findMany({
    where: {
      deletedAt: null,
      OR: [
        {
          outcome: "success",
          processedAt: { lt: daysAgo(SUCCESS_RETENTION_DAYS) },
        },
        {
          outcome: "failure",
          createdAt: { lt: daysAgo(FAILURE_RETENTION_DAYS) },
        },
        {
          outcome: "pending",
          createdAt: { lt: daysAgo(PENDING_ORPHAN_DAYS) },
        },
      ],
    },
    select: { id: true, mediaPath: true },
    take: 500, // cap per run; cron is daily so 500/day = plenty
  });

  const report: CleanupReport = {
    scanned: overdue.length,
    deleted: 0,
    errors: [],
  };

  for (const row of overdue) {
    try {
      await deletePath(row.mediaPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      report.errors.push({ id: row.id, mediaPath: row.mediaPath, error: message });
      // Continue to mark deletedAt below — see header comment for rationale.
    }
    await prisma.multimodalImportEvent.update({
      where: { id: row.id },
      data: { deletedAt: new Date() },
    });
    report.deleted += 1;
  }

  console.info(
    `[cron:cleanup-chat-media] scanned=${report.scanned} deleted=${report.deleted} errors=${report.errors.length}`
  );

  return new Response(JSON.stringify(report), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Allow GET for manual testing from a shell (curl with the bearer secret).
// Body shape is identical to POST.
export async function GET(req: NextRequest) {
  return POST(req);
}
