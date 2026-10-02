export function formatFaculty(faculty?: string): string {
  const value = faculty?.trim();
  if (!value) return 'Faculty not specified';
  if (/^faculty\s+of\b/i.test(value)) return value;
  return `Faculty of ${value}`;
}
