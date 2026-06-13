// Public-facing author name. Raw emails must never reach other users'
// clients — map every public surface through this helper server-side.
export function getAuthorName(user: {
  displayName?: string | null;
  email: string;
}): string {
  return user.displayName?.trim() || user.email.split("@")[0];
}
