import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { getSupabase } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

// This is the Next.js route handler for next-auth. It configures authentication providers and session handling.
// Providers are configured using environment variables for security and flexibility.

// Helper functions to get env vars at runtime (not build time)
function getGoogleCredentials() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing required Google OAuth environment variables");
  }
  return { clientId, clientSecret };
}

function getNextAuthSecret() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error("Missing NEXTAUTH_SECRET environment variable");
  }
  return secret;
}

// Create NextAuth handler lazily to avoid build-time initialization
function createHandler() {
  const { clientId, clientSecret } = getGoogleCredentials();

  // Log critical config for debugging
  console.log("[NextAuth] Initializing with config:");
  console.log("[NextAuth] NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
  console.log("[NextAuth] NODE_ENV:", process.env.NODE_ENV);

  return NextAuth({
  providers: [
    GoogleProvider({
      clientId,
      clientSecret,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        supabaseToken: { label: "Supabase Token", type: "text" },
      },
      async authorize(credentials) {
        console.log("[NextAuth] Credentials authorize started");
        try {
          if (!credentials?.email || !credentials?.supabaseToken) {
            console.error("[NextAuth] Missing credentials - email:", !!credentials?.email, "token:", !!credentials?.supabaseToken);
            return null;
          }

          console.log("[NextAuth] Verifying Supabase token for:", credentials.email);

          // Verify the Supabase token and get user info
          const {
            data: { user },
            error,
          } = await getSupabase().auth.getUser(credentials.supabaseToken);

          if (error || !user) {
            console.error("[NextAuth] Supabase auth verification failed:", error?.message || "No user returned");
            return null;
          }

          console.log("[NextAuth] Supabase user verified:", user.email);

          // Ensure email matches
          if (user.email !== credentials.email) {
            console.error("[NextAuth] Email mismatch - expected:", credentials.email, "got:", user.email);
            return null;
          }

          // Create or find user in database
          try {
            console.log("[NextAuth] Upserting user in database...");
            await prisma.user.upsert({
              where: { email: user.email },
              update: {
                // Update any fields if needed
              },
              create: {
                email: user.email,
                password: "", // Empty password for OAuth users
              },
            });
            console.log("[NextAuth] User upserted successfully");
          } catch (dbError) {
            console.error("[NextAuth] Database user creation error:", dbError);
            // Don't return null here - user might already exist
          }

          console.log("[NextAuth] Returning user object");
          return {
            id: user.id,
            email: user.email,
            name:
              user.user_metadata?.full_name ||
              user.user_metadata?.name ||
              user.email,
            image: user.user_metadata?.avatar_url || null,
          };
        } catch (error) {
          console.error("[NextAuth] Credentials authorization error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt", // Use JWT for stateless sessions
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    // JWT tokens expire in 1 hour to enable proper refresh cycle
    maxAge: 60 * 60, // 1 hour
  },
  // Let NextAuth handle cookie configuration automatically based on NEXTAUTH_URL
  // This ensures proper cookie names (__Secure- prefix in production) and settings
  callbacks: {
    async signIn({ user }) {
      console.log("[NextAuth] signIn callback - user:", user.email);
      // Custom sign-in logic - sync user with database
      try {
        if (user.email) {
          // Create or find user in database
          await prisma.user.upsert({
            where: { email: user.email },
            update: {
              // Update any fields if needed
            },
            create: {
              email: user.email,
              password: "", // Empty password for OAuth users
            },
          });
        }
        console.log("[NextAuth] signIn callback returning true");
        return true;
      } catch (error) {
        console.error("[NextAuth] signIn callback error:", error);
        return false;
      }
    },
    async session({ session, token }) {
      console.log("[NextAuth] session callback - token.sub:", token.sub);
      // Attach user id and other claims to session
      if (session.user) {
        // Type assertion is used here because NextAuth's default type does not include 'id' on user
        (session.user as { id?: string; provider?: string }).id = token.sub;
        (session.user as { id?: string; provider?: string }).provider =
          token.provider as string;
      }
      return session;
    },
    async jwt({ token, account, user }) {
      console.log("[NextAuth] jwt callback - user:", user?.email, "account:", account?.provider);
      // Persist additional claims or provider info in the JWT
      if (account) {
        token.provider = account.provider;
        token.accessToken = account.access_token;
        // Set issued at time for refresh logic
        token.iat = Math.floor(Date.now() / 1000);
        token.exp = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour expiry
      }
      if (user) {
        token.email = user.email;
        token.name = user.name;
        token.picture = user.image;
        // Generate a unique session ID for this login session
        if (!token.sessionId) {
          token.sessionId = crypto.randomUUID();
        }
      }

      // Check if token needs refresh (within 5 minutes of expiry)
      const now = Math.floor(Date.now() / 1000);
      const tokenExp = token.exp as number;
      if (tokenExp && now > tokenExp - 300) {
        // Token is about to expire, trigger refresh
        token.shouldRefresh = true;
      }

      console.log("[NextAuth] jwt callback returning token with sessionId:", token.sessionId);
      return token;
    },
    async redirect({ url, baseUrl }) {
      console.log("[NextAuth] redirect callback - url:", url, "baseUrl:", baseUrl);
      // Ensure redirects stay within the app
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  pages: {
    signIn: "/sign-in",
    error: "/auth/error",
  },
  // Add more next-auth options as needed
  secret: getNextAuthSecret(),
});
}

// Lazy handler initialization - created on first request
let _handler: ReturnType<typeof NextAuth> | null = null;

function getHandler() {
  if (!_handler) {
    _handler = createHandler();
  }
  return _handler;
}

// Export wrapped handlers that defer initialization to runtime
// App Router requires both request and context with params
export async function GET(
  request: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  return getHandler()(request, context);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ nextauth: string[] }> }
) {
  return getHandler()(request, context);
}
