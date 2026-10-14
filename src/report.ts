import { NO_PLACE, placeNameOf } from './places';
import { ItemPhoto } from './types';

/**
 * Insurance-ready inventory report (v0.11).
 *
 * The scenario this exists for: after a fire, flood or break-in, an
 * insurer asks for proof — photos, what things are, where they were
 * kept, what they were worth. This builds a clean printable HTML
 * document from the library and hands it to the system print/share
 * pipeline as a PDF. Generation is lazy-required and guarded: builds
 * without the print module (Expo Go / web preview) report
 * 'unavailable' and the caller explains — never a crash.
 */

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function totalValue(items: ItemPhoto[]): number {
  return items.reduce((sum, i) => sum + (typeof i.valueGBP === 'number' ? i.valueGBP : 0), 0);
}

export function money(value: number): string {
  return `£${value.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function buildReportHtml(items: ItemPhoto[], generatedAt: Date = new Date()): string {
  const byPlace = new Map<string, ItemPhoto[]>();
  for (const item of items) {
    const place = placeNameOf(item);
    const list = byPlace.get(place) ?? [];
    list.push(item);
    byPlace.set(place, list);
  }
  const places = Array.from(byPlace.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const total = totalValue(items);
  const valued = items.filter((i) => typeof i.valueGBP === 'number').length;

  const sections = places
    .map(([place, list]) => {
      const rows = list
        .map((i) => {
          const facts: string[] = [];
          if (i.category) facts.push(esc(i.category));
          facts.push(
            `Stashed ${new Date(i.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`
          );
          if (i.expiresAt) facts.push(`Warranty/expiry ${esc(i.expiresAt)}`);
          if (i.lentTo) facts.push(`Currently with ${esc(i.lentTo)}`);
          if (i.markerNote) facts.push(`Marked: ${esc(i.markerNote)}`);
          return `<tr>
            <td class="photo"><img src="${esc(i.imageUri)}" alt=""/></td>
            <td><strong>${esc(i.title || 'Untitled item')}</strong><br/><span class="muted">${facts.join(' · ')}</span>${
              i.description ? `<br/>${esc(i.description)}` : ''
            }</td>
            <td class="value">${typeof i.valueGBP === 'number' ? money(i.valueGBP) : '—'}</td>
          </tr>`;
        })
        .join('\n');
      return `<h2>${esc(place === NO_PLACE ? 'No place noted' : place)}</h2>
      <table>${rows}</table>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><style>
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #1c1a17; margin: 32px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 24px 0 8px; color: #5b45f2; }
  .sub { color: #6f6a61; font-size: 12px; margin-bottom: 16px; }
  .summary { background: #f4f2ec; border-radius: 10px; padding: 12px 16px; font-size: 13px; }
  table { width: 100%; border-collapse: collapse; }
  td { border-bottom: 1px solid #e6e2d9; padding: 8px 6px; vertical-align: top; font-size: 12px; }
  td.photo { width: 84px; }
  td.photo img { width: 76px; height: 76px; object-fit: cover; border-radius: 8px; }
  td.value { width: 76px; text-align: right; font-weight: 600; }
  .muted { color: #6f6a61; }
  .foot { color: #6f6a61; font-size: 11px; margin-top: 28px; }
</style></head><body>
  <h1>FindIt — Home Inventory Report</h1>
  <div class="sub">Generated ${generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · For insurance and personal records</div>
  <div class="summary"><strong>${items.length} items</strong> across ${places.length} place${places.length === 1 ? '' : 's'} · Total recorded value <strong>${money(total)}</strong> (${valued} of ${items.length} items valued)</div>
  ${sections}
  <div class="foot">Produced by FindIt. Values are owner estimates recorded in the app. Photos are the app's stored copies.</div>
</body></html>`;
}

type PrintModule = {
  printToFileAsync: (o: { html: string }) => Promise<{ uri: string }>;
};
type SharingModule = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (uri: string, o?: object) => Promise<void>;
};

function loadPrint(): PrintModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-print') as { Print?: PrintModule } & PrintModule;
    return (mod.Print ?? mod) as PrintModule;
  } catch {
    return null;
  }
}

function loadSharing(): SharingModule | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-sharing') as SharingModule;
    return typeof mod.shareAsync === 'function' ? mod : null;
  } catch {
    return null;
  }
}

export type ReportOutcome = 'shared' | 'unavailable' | 'failed';

/** Build the PDF and open the share sheet. Never throws. */
export async function shareReportPdf(items: ItemPhoto[]): Promise<ReportOutcome> {
  const print = loadPrint();
  const sharing = loadSharing();
  if (!print || !sharing) return 'unavailable';
  try {
    if (!(await sharing.isAvailableAsync())) return 'unavailable';
    const { uri } = await print.printToFileAsync({ html: buildReportHtml(items) });
    await sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: 'FindIt inventory report' });
    return 'shared';
  } catch {
    return 'failed';
  }
}
