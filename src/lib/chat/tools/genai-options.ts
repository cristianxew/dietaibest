/**
 * Pure builder for the `@google/genai` Vertex AI client options.
 *
 * Kept in its own module that does NOT import `@google/genai`, so it stays
 * dependency-free and unit-testable (the SDK is a heavy native-ish dep that
 * isn't always installed in the test environment).
 */

/**
 * Service-account auth resolved from the environment. Maps to the
 * `google-auth-library` `GoogleAuthOptions` fields the `@google/genai`
 * client accepts:
 *  - `credentials`: an inline service-account object (parsed from a JSON env var)
 *  - `keyFilename`: a path to the service-account JSON file on disk
 */
export type GoogleServiceAccountAuth =
  | { credentials: Record<string, unknown> }
  | { keyFilename: string };

/**
 * Subset of `@google/genai`'s `GoogleGenAIOptions` we construct for Vertex AI.
 * Declared structurally so this module needs no SDK import; the shape is
 * assignable to `GoogleGenAIOptions` at the call site.
 */
export interface GenAIVertexOptions {
  vertexai: true;
  project: string;
  location: string;
  /** Maps to google-auth-library `GoogleAuthOptions` (credentials | keyFilename). */
  googleAuthOptions?: GoogleServiceAccountAuth;
}

/**
 * An environment-variable bag, e.g. `process.env`. Typed as an index signature
 * (not an interface of optional keys) so `process.env` is assignable without
 * tripping TypeScript's weak-type detection. Reads: GOOGLE_CLOUD_PROJECT_ID,
 * GOOGLE_VERTEX_LOCATION, GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON,
 * GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH.
 */
export type GenAIEnv = Record<string, string | undefined>;

const DEFAULT_LOCATION = "us-central1";

/**
 * Resolves Google service-account auth from the environment, preferring inline
 * JSON (`GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON`) over a key-file path
 * (`GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH`). Returns `null` so the caller falls
 * back to Application Default Credentials.
 *
 * Inline JSON is the reliable channel on the self-hosted VPS: it rides the
 * docker-compose `environment:` block like every other secret, instead of
 * depending on a Dokploy File Mount actually landing a file inside the
 * container — which it does not for a Compose-type deployment (the running
 * process gets ENOENT on the configured path). Both Google clients accept the
 * parsed object via `googleAuthOptions.credentials`.
 *
 * Malformed JSON is logged loudly and ignored (we fall through to the path /
 * ADC) so a paste typo never silently switches auth modes without a trace.
 */
export function resolveGoogleServiceAccountAuth(
  env: GenAIEnv
): GoogleServiceAccountAuth | null {
  const json = env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON;
  if (json && json.trim().length > 0) {
    try {
      return { credentials: JSON.parse(json) as Record<string, unknown> };
    } catch (err) {
      console.error(
        "[genai-options] GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON is set but is not valid JSON — ignoring it and falling back to the key file / ADC:",
        err instanceof Error ? err.message : String(err)
      );
    }
  }

  const keyFilename = env.GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH;
  if (keyFilename && keyFilename.trim().length > 0) {
    return { keyFilename };
  }

  return null;
}

/**
 * Builds the Vertex AI options for `new GoogleGenAI(...)` from environment.
 *
 * Returns `null` when `GOOGLE_CLOUD_PROJECT_ID` is missing so the caller can
 * surface a configuration error.
 *
 * Authentication is resolved by `resolveGoogleServiceAccountAuth` (inline JSON
 * preferred, then key-file path). Without either, the SDK falls back to
 * Application Default Credentials, which hit the GCP metadata server —
 * unavailable off-GCP (e.g. our self-hosted VPS) and failing with "All
 * promises were rejected".
 */
export function buildGenAIVertexOptions(
  env: GenAIEnv
): GenAIVertexOptions | null {
  const project = env.GOOGLE_CLOUD_PROJECT_ID;
  if (!project) return null;

  const location = env.GOOGLE_VERTEX_LOCATION ?? DEFAULT_LOCATION;
  const auth = resolveGoogleServiceAccountAuth(env);

  return {
    vertexai: true,
    project,
    location,
    ...(auth ? { googleAuthOptions: auth } : {}),
  };
}
