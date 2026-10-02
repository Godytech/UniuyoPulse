export function escapeCsvCell(value: string | number | boolean): string {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function buildCsv(headers: string[], rows: Array<Array<string | number | boolean>>): string {
  const csvRows = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
  return `\uFEFF${csvRows.join('\n')}\n`;
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Downloads the data and a separate checksum. The checksum is intentionally
 * calculated from the exact downloaded bytes so recipients can detect edits.
 */
export async function downloadTamperEvidentCsv(
  csv: string,
  filename: string,
  metadata: Record<string, string>
): Promise<void> {
  const hash = await sha256(csv);
  const baseFilename = filename.replace(/\.csv$/i, '');
  const metadataLines = Object.entries(metadata).map(([key, value]) => `${key}: ${value}`);
  const checksum = [
    'Uniuyo Pulse export integrity manifest',
    ...metadataLines,
    `SHA-256: ${hash}`,
    `File: ${filename}`,
    'Verify by calculating SHA-256 for the downloaded CSV and comparing it with this value.'
  ].join('\n');

  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), filename);
  downloadBlob(new Blob([checksum], { type: 'text/plain;charset=utf-8;' }), `${baseFilename}.sha256.txt`);
}
