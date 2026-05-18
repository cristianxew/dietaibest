import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// DIE-41 — Supabase Storage helper for the chat agent's image uploads.
//
// Bucket scheme:
//   bucket:        chat-recipe-media (private — service-role-only access)
//   object path:   {userId}/{eventId}.{ext}
//
// We always upload with a normalized extension (HEIC is converted to JPEG
// upstream by the /api/chat/upload route via sharp). This keeps the path
// predictable and lets the FE preview-render the same bytes the server saw.
//
// All operations use the service role key — never the anon key — because:
//   - the bucket is private (no public RLS read path)
//   - the API route already authenticates the user and gates write to their
//     own {userId}/ prefix; service-role bypasses RLS but our route enforces
//     ownership before calling these helpers.

export const CHAT_RECIPE_MEDIA_BUCKET = "chat-recipe-media";

let _client: SupabaseClient | null = null;

function getServiceClient(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase service-role credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export function buildStoragePath(args: {
  userId: string;
  eventId: string;
  extension: string;
}): string {
  const ext = args.extension.replace(/^\.+/, "").toLowerCase();
  return `${args.userId}/${args.eventId}.${ext}`;
}

export async function uploadImage(args: {
  path: string;
  body: Buffer | Uint8Array;
  contentType: string;
}): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.storage
    .from(CHAT_RECIPE_MEDIA_BUCKET)
    .upload(args.path, args.body, {
      contentType: args.contentType,
      upsert: false,
    });
  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }
}

export async function getSignedUrl(
  path: string,
  expiresInSec = 3600
): Promise<string> {
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(CHAT_RECIPE_MEDIA_BUCKET)
    .createSignedUrl(path, expiresInSec);
  if (error || !data?.signedUrl) {
    throw new Error(
      `Supabase Storage signed URL failed: ${error?.message ?? "no url returned"}`
    );
  }
  return data.signedUrl;
}

export async function downloadBytes(path: string): Promise<Uint8Array> {
  const client = getServiceClient();
  const { data, error } = await client.storage
    .from(CHAT_RECIPE_MEDIA_BUCKET)
    .download(path);
  if (error || !data) {
    throw new Error(
      `Supabase Storage download failed: ${error?.message ?? "no data"}`
    );
  }
  return new Uint8Array(await data.arrayBuffer());
}

export async function deletePath(path: string): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.storage
    .from(CHAT_RECIPE_MEDIA_BUCKET)
    .remove([path]);
  if (error) {
    throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }
}
