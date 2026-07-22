/** Shared party colour utility — used by overview, outreach, and planung pages. */

export const PARTEI_COLORS: Record<string, string> = {
  'AfD':     'bg-blue-50    text-blue-700    border-blue-200    dark:bg-blue-950/40   dark:text-blue-300   dark:border-blue-800',
  'CDU/CSU': 'bg-gray-100   text-gray-800    border-gray-300    dark:bg-gray-800/60   dark:text-gray-200   dark:border-gray-600',
  'CDU':     'bg-gray-100   text-gray-800    border-gray-300    dark:bg-gray-800/60   dark:text-gray-200   dark:border-gray-600',
  'CSU':     'bg-gray-100   text-gray-800    border-gray-300    dark:bg-gray-800/60   dark:text-gray-200   dark:border-gray-600',
  'SPD':     'bg-red-50     text-red-700     border-red-200     dark:bg-red-950/40    dark:text-red-300    dark:border-red-800',
  'FDP':     'bg-yellow-50  text-yellow-700  border-yellow-200  dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800',
  'Grün':    'bg-green-50   text-green-700   border-green-200   dark:bg-green-950/40  dark:text-green-300  dark:border-green-800',
  'Linke':   'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200 dark:bg-fuchsia-950/40 dark:text-fuchsia-300 dark:border-fuchsia-800',
  'BSW':     'bg-rose-50    text-rose-700    border-rose-200    dark:bg-rose-950/40   dark:text-rose-300   dark:border-rose-800',
};

const FALLBACK = 'bg-[color:var(--surface-muted)] text-[color:var(--foreground)] border-[color:var(--border)]';

/**
 * Returns Tailwind class string for a party badge.
 * Matching is case-insensitive substring search so "CDU/CSU",
 * "Bündnis 90/Die Grünen", "Die Linke" etc. all resolve correctly.
 */
export function parteiCls(partei: string | null | undefined): string {
  if (!partei) return FALLBACK;
  const p = partei.toLowerCase();
  const key = Object.keys(PARTEI_COLORS).find(k => p.includes(k.toLowerCase()));
  return key ? PARTEI_COLORS[key] : FALLBACK;
}
