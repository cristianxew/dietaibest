/**
 * Pure builder for the `@google/genai` Vertex AI client options.
 *
 * Kept in its own module that does NOT import `@google/genai`, so it stays
 * dependency-free and unit-testable (the SDK is a heavy native-ish dep that
 * isn't always installed in the test environment).
 */

/**
 * Subset of `@google/genai`'s `GoogleGenAIOptions` we construct for Vertex AI.
 * Declared structurally so this module needs no SDK import; the shape is
 * assignable to `GoogleGenAIOptions` at the call site.
 */
export interface GenAIVertexOptions {
  vertexai: true;
  project: string;
  location: string;
  /** Maps to google-auth-library `GoogleAuthOptions.keyFilename`. */
  googleAuthOptions?: { keyFilename: string };
}

/**
 * An environment-variable bag, e.g. `process.env`. Typed as an index signature
 * (not an interface of optional keys) so `process.env` is assignable without
 * tripping TypeScript's weak-type detection. Reads: GOOGLE_CLOUD_PROJECT_ID,
 * GOOGLE_VERTEX_LOCATION, GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH.
 */
export type GenAIEnv = Record<string, string | undefined>;

const DEFAULT_LOCATION = "us-central1";

/**
 * Builds the Vertex AI options for `new GoogleGenAI(...)` from environment.
 *
 * Returns `null` when `GOOGLE_CLOUD_PROJECT_ID` is missing so the caller can
 * surface a configuration error.
 *
 * When `GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH` is set, its value is passed as
 * `googleAuthOptions.keyFilename` so Vertex AI authenticates with the SAME
 * service-account key file already configured for Document AI — instead of
 * relying on Application Default Credentials, which fall back to the GCP
 * metadata server (unavailable off-GCP, e.g. our self-hosted VPS) and fail
 * with "All promises were rejected". When unset, the SDK keeps its default ADC
 * behaviour (honouring `GOOGLE_APPLICATION_CREDENTIALS` if present).
 */
export function buildGenAIVertexOptions(
  env: GenAIEnv
): GenAIVertexOptions | null {
  const project = env.GOOGLE_CLOUD_PROJECT_ID;
  if (!project) return null;

  const location = env.GOOGLE_VERTEX_LOCATION ?? DEFAULT_LOCATION;
  const keyFilename = env.GOOGLE_CLOUD_SERVICE_ACCOUNT_PATH;

  return {
    vertexai: true,
    project,
    location,
    ...(keyFilename ? { googleAuthOptions: { keyFilename } } : {}),
  };
}
