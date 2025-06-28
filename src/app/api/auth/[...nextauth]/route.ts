import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";

// This is the Next.js route handler for next-auth. It configures authentication providers and session handling.
// Providers are configured using environment variables for security and flexibility.

// Validate required environment variables
if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
  throw new Error("Missing required Google OAuth environment variables");
}

if (!process.env.NEXTAUTH_SECRET) {
  throw new Error("Missing NEXTAUTH_SECRET environment variable");
}

const handler = NextAuth({
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      id: "credentials",
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        supabaseToken: { label: "Supabase Token", type: "text" },
      },
      async authorize(credentials) {
        try {
          if (!credentials?.email || !credentials?.supabaseToken) {
            return null;
          }

          // Verify the Supabase token and get user info
          const {
            data: { user },
            error,
          } = await supabase.auth.getUser(credentials.supabaseToken);

          if (error || !user) {
            console.error("Supabase auth verification failed:", error);
            return null;
          }

          // Ensure email matches
          if (user.email !== credentials.email) {
            console.error("Email mismatch in credentials");
            return null;
          }

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
          console.error("Credentials authorization error:", error);
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
  cookies: {
    sessionToken: {
      name: "next-auth.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    async signIn({ user, account }) {
      // Custom sign-in logic - sync user with Supabase if needed
      try {
        if (account?.provider === "google" && user.email) {
          // Here you can create/update user in Supabase
          // For now, we'll just allow the sign-in
          return true;
        }
        return true;
      } catch (error) {
        console.error("Sign-in error:", error);
        return false;
      }
    },
    async session({ session, token }) {
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

      return token;
    },
    async redirect({ url, baseUrl }) {
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
  secret: process.env.NEXTAUTH_SECRET,
});

export { handler as GET, handler as POST };
