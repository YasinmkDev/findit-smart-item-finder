import QRCode from 'qrcode';
import { ItemPhoto } from './types';

/**
 * QR box labels (v0.11).
 *
 * A place/box gets a printable label whose QR code encodes a
 * `findit://place/<name>` link — any phone camera resolves it, and the
 * app (scheme "findit") can deep-link straight to that box's contents.
 * Rendering is dependency-light: the `qrcode` package produces the
 * module matrix and the app draws it with plain Views / HTML table
 * cells, so labels work in Expo Go and on web with no native module.
 */

const LABEL_PREFIX = 'findit://place/';

export function labelPayload(placeName: string): string {
  return LABEL_PREFIX + encodeURIComponent(placeName);
}

export function parseLabelPayload(text: string): string | null {
  if (!text.startsWith(LABEL_PREFIX)) return null;
  try {
    const name = decodeURIComponent(text.slice(LABEL_PREFIX.length));
    return name.trim() ? name : null;
  } catch {
    return null;
  }
}

/** QR module matrix (true = dark module), including no quiet zone. */
export function qrMatrix(text: string): boolean[][] {
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' });
  const size = qr.modules.size;
  const data = qr.modules.data;
  const rows: boolean[][] = [];
  for (let y = 0; y < size; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < size; x++) row.push(data[y * size + x] === 1);
    rows.push(row);
  }
  return rows;
}

function esc(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Printable label (for expo-print): QR table + place name + contents list. */
export function buildLabelHtml(placeName: string, items: ItemPhoto[]): string {
  const matrix = qrMatrix(labelPayload(placeName));
  const cell = 6;
  const table = matrix
    .map(
      (row) =>
        `<tr>${row.map((dark) => `<td style="background:${dark ? '#111' : '#fff'}"></td>`).join('')}</tr>`
    )
    .join('');
  const list = items
    .map((i) => `<li>${esc(i.sensitive ? 'Private item' : i.title || 'Untitled item')}</li>`)
    .join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; margin: 40px; }
    .label { border: 3px solid #111; border-radius: 16px; padding: 24px; width: ${matrix.length * cell + 48}px; }
    table { border-collapse: collapse; margin: 0 auto; }
    td { width: ${cell}px; height: ${cell}px; padding: 0; }
    h1 { font-size: 26px; text-align: center; margin: 16px 0 2px; }
    .count { text-align: center; color: #555; font-size: 13px; margin-bottom: 12px; }
    ul { font-size: 13px; margin: 8px 0 0; padding-left: 18px; }
    .scan { text-align: center; font-size: 12px; color: #555; margin-top: 12px; }
  </style></head><body>
    <div class="label">
      <table>${table}</table>
      <h1>${esc(placeName)}</h1>
      <div class="count">${items.length} item${items.length === 1 ? '' : 's'} inside</div>
      <ul>${list}</ul>
      <div class="scan">Scan to open this box in FindIt</div>
    </div>
  </body></html>`;
}

type PrintModule = { printToFileAsync: (o: { html: string }) => Promise<{ uri: string }> };
type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (uri: string, o?: object) => Promise<void>;
};

/** Build the label PDF and open the share/print sheet. Never throws. */
export async function shareLabelPdf(
  placeName: string,
  items: ItemPhoto[]
): Promise<'shared' | 'unavailable' | 'failed'> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const printMod = require('expo-print') as { Print?: PrintModule } & PrintModule;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharingMod = require('expo-sharing') as SharingModule;
    const print = printMod.Print ?? printMod;
    if (!print?.printToFileAsync || typeof sharingMod.shareAsync !== 'function') return 'unavailable';
    if (!(await sharingMod.isAvailableAsync())) return 'unavailable';
    const { uri } = await print.printToFileAsync({ html: buildLabelHtml(placeName, items) });
    await sharingMod.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `${placeName} — box label` });
    return 'shared';
  } catch {
    return 'failed';
  }
}
