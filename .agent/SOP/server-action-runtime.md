# Server Action Runtime — How to Write a Gated Action

**Last Updated:** 2026-05-02

The `serverAction` runtime in `src/lib/server-action.ts` is the deep module that wraps every gated server action. Use it whenever you write a new action that needs auth, entitlement gating, Zod validation, error mapping, or cache revalidation.

This SOP shows how to use it. For the architectural rationale (why it exists, what it absorbs), see `System/project_architecture.md` § Key Design Patterns → Server Action Runtime.

---

## The shape

```typescript
"use server";

import { serverAction } from "@/lib/server-action";
import prisma from "@/lib/prisma";
import { mySchema } from "@/types/...";
import { assertCanX } from "@/lib/entitlements";

export async function myAction(input: MyInput) {
  return serverAction(
    {
      input: mySchema,
      requires: (input, ctx) => assertCanX(ctx.user),
      revalidates: ["/somewhere"],
    },
    async (ctx, validated) => {
      // Pure body — auth + validation + entitlement already done.
      // ctx.user is the resolved Prisma User.
      // validated is the Zod-parsed input.
      return prisma.something.create({ data: { ..., userId: ctx.user.id } });
    }
  )(input);
}
```

The outer function (`myAction`) keeps the public signature your callers expect. Internally it builds a `serverAction(...)` and immediately invokes it with `(input)`. Multi-arg signatures (e.g. `createRecipe(data, source, options)`) work the same way: closure-capture the extra args inside the body.

---

## What the runtime owns

In order:

1. **Auth** — calls `getServerSession()` + `prisma.user.findUnique({ where: { email } })`. Throws `"Unauthorized"` or `"User not found"` if missing. Both come back as plain string errors in the result tuple.
2. **Validation** — if `config.input` is provided, the runtime calls `schema.parse(rawInput)`. `ZodError` is caught and mapped to `{ data: null, error: "Invalid input: <first issue>" }`.
3. **Entitlement assertion** — calls `await config.requires?.(input, ctx)`. The body of `requires` typically calls one or more `assertCan*` functions from `src/lib/entitlements.ts`. Throws are caught and mapped via `toEntitlementError` to the structured `EntitlementErrorPayload`.
4. **Body execution** — calls your `body(ctx, input)`.
5. **Revalidation** — on success, resolves `config.revalidates` (static array or function of result) and calls `revalidatePath` for each.
6. **Result wrapping** — returns `{ data: result, error: null }` on success. On any uncaught throw, returns `{ data: null, error: <mapped string or payload> }` and logs via `console.error("[serverAction]", error)`.

---

## What the runtime does NOT own

These stay in the body — by design:

- **Resource ownership checks.** If your action takes a resource ID and needs to verify the user owns it, do it in the body:

  ```typescript
  async (ctx, { recipeId }) => {
    const recipe = await prisma.recipe.findUnique({ where: { id: recipeId } });
    if (!recipe || recipe.userId !== ctx.user.id) {
      throw new Error("Recipe not found");
    }
    // ... continue
  }
  ```

  The runtime gates ENTITLEMENT (can this user, by plan/quota, do this kind of thing?). Ownership is a different concept (does this specific resource belong to this user?). They have different failure modes and different paywall semantics.

- **Per-action user includes.** The runtime resolves a base `User`. If your body needs related data (e.g. `user.storeCredentials` joined), fetch it separately:

  ```typescript
  const credential = await prisma.storeCredential.findFirst({
    where: { userId: ctx.user.id, store },
  });
  ```

- **Domain decisions and side-effects** like nutrition analysis after recipe creation. These are body concerns — the runtime's job is the cross-cutting plumbing.

- **Custom invariant errors.** Throw `Error("Recipe not found")`, `Error("Template is private")`, etc. The runtime maps them to `{ data: null, error: "<message>" }`.

---

## Patterns

### Single static assertion

```typescript
requires: (_, ctx) => assertCanCreateRecipe(ctx.user),
```

Returns a Promise<void>. The `(_, ctx)` ignores input.

### Multi-step assertion (sequential, short-circuit)

```typescript
requires: async (_, ctx) => {
  await assertCanImportRecipe(ctx.user);  // gate 1
  await assertCanCreateRecipe(ctx.user);  // gate 2 — only runs if gate 1 passed
},
```

If the first throws, the second never runs. Both throws are mapped to the structured payload (whichever was thrown — the runtime sees only the first).

### Parameterized assertion (input-aware)

```typescript
requires: (input, ctx) =>
  assertCanCreateMealPlanTemplate(ctx.user, input.duration),
```

`input` is the validated form (post-Zod parse). The runtime guarantees validation runs **before** `requires`, so you can trust types.

### Static revalidation

```typescript
revalidates: ["/recipes"],
```

Called once for each path on success. Skipped entirely if the body throws.

### Result-aware revalidation (dynamic paths)

```typescript
revalidates: (plan) => ["/meal-plans", `/meal-plans/${plan.id}`],
```

Receives the body's return value. Use this when paths depend on the resource's id or a derived field.

### No validation (rare, only for actions with no user input)

```typescript
return serverAction(
  {
    requires: (_, ctx) => assertCanX(ctx.user),
    revalidates: ["/foo"],
  },
  async (ctx) => {
    // No `input` arg — body just acts on ctx.user
    return prisma.something.findMany({ where: { userId: ctx.user.id } });
  }
)(undefined);
```

Skip the `input` field, pass `undefined` at the call site.

---

## Shadow-mode interaction

`enforce()` inside `assertCan*` consults `ENTITLEMENTS_ENFORCED`. When the flag is not exactly `"true"`, violations are **logged but not thrown** — `assertCan*` returns successfully and the body runs as if there were no quota.

The runtime is unaware of shadow mode. It just sees: `requires` either threw or didn't. Set `ENTITLEMENTS_ENFORCED=true` in production to enforce; leave unset (or `=false`) in staging to surface "would have blocked" log lines without breaking users.

---

## Result contract

```typescript
type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string | EntitlementErrorPayload };
```

- **Success** → `{ data: <body result>, error: null }`
- **Auth/validation/unknown error** → `{ data: null, error: "<string>" }`
- **Entitlement violation** → `{ data: null, error: { code: "PRO_ONLY"|"QUOTA_EXCEEDED", ... } }`

Callers should narrow on `result.error === null` for success. To handle entitlement specifically, check `typeof result.error === "object"` and switch on `result.error.code` — that's what `PaywallProvider` does.

---

## Don't bypass

A new server action that calls Prisma without going through `serverAction` is a regression. If you find yourself writing `getServerSession(); prisma.user.findUnique(...); try { ... }` boilerplate, stop and use the runtime.

The only reason NOT to use it is when the action genuinely doesn't need any of: auth, entitlement, validation, error mapping, or revalidation. In practice, that's almost never.

---

## Edge cases worth knowing

- **Schemas with `.default([])` or `.coerce`** — Zod's input type and parsed-output type diverge. The runtime's single-type-param `ActionConfig<TInput, TOutput>` can't capture both, so the body's `validated` input may show fields as optional even when the schema guarantees them. Workaround in the body destructure: `const { categoryIds = [], ...rest } = validated;` (no-op at runtime). The schema's default still applies.

- **Webhooks and unauthenticated routes** — these go in `src/app/api/`, not in `src/actions/`, and are NOT a fit for this runtime (no session). Use the existing pattern there.

- **Read actions (no Prisma writes)** — totally fine to use the runtime. `revalidates` becomes optional; everything else (auth, validation, entitlement) is still useful.

---

## Migration checklist (when touching an existing pre-runtime action)

1. Add `import { serverAction } from "@/lib/server-action";`
2. Wrap the body in `serverAction({...}, async (ctx, validated) => {...})(input)`.
3. Move auth from `await getAuthenticatedUser()` to `ctx.user`.
4. Move validation from `schema.parse(data)` to `input: schema` declaration.
5. Move `assertCan*` calls into `requires`.
6. Move `revalidatePath(...)` calls into `revalidates`.
7. Drop the surrounding `try/catch` + `toEntitlementError` mapping — the runtime handles them.
8. **Check the unused-imports**: `toEntitlementError` is usually no longer needed; `getServerSession` may no longer be needed (only if no other functions in the file use them).
9. Run `bun run typecheck` to confirm clean, then `bun run verify` before declaring done.
10. If the action is the LAST one in its file using `getAuthenticatedUser`, delete the file-local helper too.
