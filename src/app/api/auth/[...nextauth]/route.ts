import NextAuth from "next-auth";
import GoogleProvider from "next-auth/providers/google";

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
  ],
  session: {
    strategy: "jwt", // Use JWT for stateless sessions
    maxAge: 30 * 24 * 60 * 60, // 30 days
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
      }
      if (user) {
        token.email = user.email;
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
