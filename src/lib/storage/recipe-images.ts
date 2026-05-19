import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Storage helper for the public `recipe-images` bucket.
// All operations use the service role key to bypass row level security (RLS)
// during server-side processing, while ownership gating is enforced by the caller.

export const RECIPE_IMAGES_BUCKET = "recipe-images";

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

/**
 * Uploads optimized image buffer to the public recipe-images bucket.
 */
export async function uploadRecipeImage(
  path: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  const client = getServiceClient();
  let { error } = await client.storage
    .from(RECIPE_IMAGES_BUCKET)
    .upload(path, body, {
      contentType,
      upsert: true, // We allow overwrite, though using unique UUID filenames is preferred
    });

  // If the bucket does not exist, attempt to create it and retry upload
  if (error && error.message === "Bucket not found") {
    const { error: createError } = await client.storage.createBucket(RECIPE_IMAGES_BUCKET, {
      public: true,
    });

    if (!createError) {
      const retry = await client.storage
        .from(RECIPE_IMAGES_BUCKET)
        .upload(path, body, {
          contentType,
          upsert: true,
        });
      error = retry.error;
    } else {
      throw new Error(`Supabase Storage upload failed because bucket did not exist and could not be created: ${createError.message}`);
    }
  }

  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }
}

/**
 * Deletes an image from the public recipe-images bucket.
 */
export async function deleteRecipeImage(path: string): Promise<void> {
  const client = getServiceClient();
  const { error } = await client.storage
    .from(RECIPE_IMAGES_BUCKET)
    .remove([path]);

  if (error) {
    // If the bucket doesn't exist, deletion is conceptually a success/no-op
    if (error.message === "Bucket not found") {
      return;
    }
    throw new Error(`Supabase Storage delete failed: ${error.message}`);
  }
}

/**
 * Sync synchronous helper to retrieve the public URL for a given storage path.
 */
export function getPublicUrl(path: string): string {
  const client = getServiceClient();
  const { data } = client.storage.from(RECIPE_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
