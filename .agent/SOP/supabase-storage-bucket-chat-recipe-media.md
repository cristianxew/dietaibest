# SOP — Create the `chat-recipe-media` Supabase Storage bucket (DIE-41)

Run this **once per environment** (local Supabase project, staging, prod). The bucket cannot be created from the app at runtime because `@supabase/supabase-js` requires service-role credentials for admin operations and we keep bucket lifecycle out of the request path.

## Purpose

Stores user-uploaded recipe images for the in-app chat agent's `importRecipeFromImage` tool. Path scheme `{userId}/{eventId}.{ext}`. Lifecycle managed by `MultimodalImportEvent` rows + the `/api/cron/cleanup-chat-media` cron (7d post-success / 30d post-failure deletes, or immediate via DELETE `/api/chat/attachment/{eventId}`).

## Steps

1. Open the Supabase dashboard for the target project → **Storage** → **New bucket**.
2. Fill:
   - **Name**: `chat-recipe-media`
   - **Public bucket**: **OFF** (private)
   - **File size limit**: `10 MB`
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/heic, image/heif`
3. Create.
4. **RLS policy** — the app uses the service-role key to read/write, so no RLS policies are strictly required for the app path. However, leave RLS **enabled** (Supabase default) to prevent any leakage if the anon key is ever misconfigured for storage access. With no policies + RLS enabled, only service-role bypasses RLS — which is exactly what we want.
5. Verify env vars in the target environment:
   - `NEXT_PUBLIC_SUPABASE_URL` — already set
   - `SUPABASE_SERVICE_ROLE_KEY` — **required** (was Optional pre-DIE-41; promote in `.env.production.example` and Dokploy env)

## Verification

```bash
# From the app environment shell (Dokploy "Open Shell" on the app service)
curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/chat-recipe-media/_smoke" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Content-Type: image/jpeg" \
  --data-binary @/some/local.jpg
# Expect 200 with { "Key": "chat-recipe-media/_smoke" }

curl -s -X DELETE "$NEXT_PUBLIC_SUPABASE_URL/storage/v1/object/chat-recipe-media/_smoke" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
# Expect 200
```

If both calls succeed, the app's `/api/chat/upload` and `/api/chat/attachment/{eventId}` routes will work end-to-end.

## Notes

- The cron job (`/api/cron/cleanup-chat-media`) is the only writer that issues bulk deletes; it uses the same service-role key.
- Manual cleanup (Supabase Studio "delete bucket contents") is fine for emergencies but does not update `MultimodalImportEvent.deletedAt`; if you do that, also `UPDATE "MultimodalImportEvent" SET "deletedAt" = NOW() WHERE "deletedAt" IS NULL;` so future cron runs don't re-attempt deletion.
- HEIC inputs are converted to JPEG by `/api/chat/upload` before they hit the bucket, so the bucket should never contain `image/heic` blobs in practice. The MIME allow-list keeps it permissive for safety against misconfigured client uploads going via the storage API directly.
