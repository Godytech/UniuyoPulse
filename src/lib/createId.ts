let fallbackId = 0;

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  fallbackId += 1;
  return `row-${Date.now().toString(36)}-${fallbackId.toString(36)}-${Math.random().toString(36).slice(2)}`;
}
