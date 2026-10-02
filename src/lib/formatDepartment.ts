export function formatDepartment(department?: string): string {
  const value = department?.trim();
  if (!value) return 'Department not specified';
  if (/^department\s+of\b/i.test(value)) return value;
  return `Department of ${value}`;
}
