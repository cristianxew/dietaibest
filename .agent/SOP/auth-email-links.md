# SOP: Auth email links (magic link + password reset)

**Applies to:** every Supabase Auth flow that sends the user an email and
redirects them back into the app.
**Last Updated:** 2026-08-01

---

## The rule that broke production once

**Every page reachable from an email link MUST live under `src/app/[locale]/`.**

`src/middleware.ts` runs the next-intl middleware with
`localePrefix: "as-needed"`. A request to an unprefixed path is *rewritten* to
`/{defaultLocale}{path}` before Next.js resolves the route:

```
GET /auth/callback  →  x-middleware-rewrite: /en/auth/callback
```

The magic-link callback used to live at `src/app/auth/callback/page.tsx`, i.e.
outside `[locale]`. Nothing resolves `/en/auth/callback`, so every magic link in
every email opened a **404**. The page file existed, the route did not.

Verify any new auth page with a raw request — a 404 here is invisible in code
review:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/auth/callback
```

Current layout:

| Route                    | File                                                          |
| ------------------------ | ------------------------------------------------------------- |
| `/auth/callback`         | `src/app/[locale]/(public-pages)/auth/callback/page.tsx`       |
| `/auth/reset-password`   | `src/app/[locale]/(public-pages)/auth/reset-password/page.tsx` |
| `/auth/error`            | `src/app/[locale]/(public-pages)/auth/error/page.tsx`          |
| `/forgot-password`       | `src/app/[locale]/(public-pages)/forgot-password/page.tsx`     |

Each one is also listed in `PUBLIC_ROUTES` in `src/middleware.ts`; without that
entry the `authorized` callback sends an unauthenticated visitor to `/sign-in`
— which is exactly the person who cannot sign in.

---

## Building redirect URLs

Never hand-concatenate the redirect URL. Use `src/lib/auth-links.ts`:

```ts
import { AUTH_CALLBACK_PATH, buildAuthRedirectUrl } from "@/lib/auth-links";

await supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: buildAuthRedirectUrl({
      origin: window.location.origin,
      locale,                        // useLocale() from next-intl
      path: AUTH_CALLBACK_PATH,
      params: { redirect: callbackUrl },
    }),
  },
});
```

It applies the locale prefix the same way the middleware does (`""` for `en`,
`/es` and `/pl` otherwise), so a Polish user comes back to the Polish page.

---

## Reading what Supabase sends back

The Supabase client uses the default `flowType: "implicit"`. Tokens **and
errors** come back in the URL *fragment*, which never reaches the server:

```
/auth/callback#error=access_denied&error_code=otp_expired&error_description=...
/auth/callback#access_token=...&refresh_token=...&type=magiclink
```

Consequences:

1. `useSearchParams()` alone sees none of it. Use
   `readAuthCallbackParams(window.location.search, window.location.hash)`.
2. `supabase.auth.getSession()` called once on mount **races** the client's
   `detectSessionInUrl` parse and frequently returns `null` for a valid link.
   Use `waitForSupabaseSession()` from `src/lib/supabase-auth-session.ts`,
   which resolves on the existing session, the `SIGNED_IN` /
   `PASSWORD_RECOVERY` event, or a 10s timeout.

---

## Session model

Supabase Auth verifies the email link; **NextAuth is the app's session of
record** (middleware and server routes read its JWT). So every flow ends the
same way: take the Supabase access token and mint a NextAuth session.

```ts
await signIn("credentials", {
  email: session.user.email,
  supabaseToken: session.access_token,
  redirect: false,
});
```

The password-reset page does this after `updateUser({ password })`, so the user
lands signed in rather than being bounced back to the sign-in form.

---

## Supabase dashboard configuration (per environment)

Authentication → URL Configuration:

| Setting           | Value                                                                     |
| ----------------- | ------------------------------------------------------------------------- |
| **Site URL**      | `https://dietaimanager.com` (exact, with https, no trailing slash)         |
| **Redirect URLs** | `https://dietaimanager.com/**` — one wildcard covers every locale prefix   |
|                   | `http://localhost:3000/**` for local development                          |

Without a matching entry Supabase **silently falls back to the Site URL** — the
link "works" but drops the user on the landing page instead of the callback,
and no error is reported anywhere.

Email templates (Authentication → Email Templates) need no change: the default
`{{ .ConfirmationURL }}` in *Magic Link* and *Reset Password* routes through
Supabase's `/auth/v1/verify` endpoint and then to the `redirectTo` we supplied.

---

## Manual smoke test after deploying an auth change

1. `/sign-in` → **Magic Link** tab → send to a real inbox → open the link →
   expect the dashboard, not a 404 and not the landing page.
2. Open the *same* link a second time → expect the "Link expired" card with a
   working "Request new magic link" button.
3. `/sign-in` → **Forgot your password?** → send → open the link → set a new
   password → expect to land on `/dashboard` already signed in.
4. Sign out, sign in with the new password.
5. Repeat step 1 from `/es/sign-in` and confirm the link returns to
   `/es/auth/callback`.
