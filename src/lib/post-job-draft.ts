const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getPostJobDraftId(value: unknown): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const id = "id" in value ? value.id : null;
  return typeof id === "string" && UUID_PATTERN.test(id) ? id : null;
}

export function ensurePostJobDraftId<T extends object>(
  draft: T,
  createId: () => string = () => crypto.randomUUID(),
): T & { id: string } {
  if (getPostJobDraftId(draft)) {
    return draft as T & { id: string };
  }

  return { ...draft, id: createId() };
}
