import { Package } from '../packages/packageTypes';
import { formatDate } from '../../lib/dateFormat';

export interface ActivePackageDateRange {
  earliestStart: string;
  latestEnd: string;
  formattedRange: string;
}

/**
 * Computes date range across all active (non-void, non-cancelled) packages.
 * Returns earliest start date to latest end date, or null if there are no active packages.
 */
export function computeActivePackageDateRange(packages: Package[]): ActivePackageDateRange | null {
  if (!packages || packages.length === 0) return null;

  const activePkgs = packages.filter((p) => {
    const st = String(p.status || (p as any).package_status || '').trim().toUpperCase();
    return st !== 'VOID' && st !== 'CANCELLED';
  });

  if (activePkgs.length === 0) return null;

  const startDates = activePkgs.map((p) => p.start_date).filter((d): d is string => Boolean(d && d.trim()));
  const endDates = activePkgs.map((p) => p.end_date).filter((d): d is string => Boolean(d && d.trim()));

  if (startDates.length === 0 && endDates.length === 0) return null;

  startDates.sort();
  endDates.sort();

  const earliestStart = startDates[0] || '';
  const latestEnd = endDates[endDates.length - 1] || '';

  const startFormatted = earliestStart ? formatDate(earliestStart) : '—';
  const endFormatted = latestEnd ? formatDate(latestEnd) : '—';

  return {
    earliestStart,
    latestEnd,
    formattedRange: `Dates: ${startFormatted} – ${endFormatted}`,
  };
}
