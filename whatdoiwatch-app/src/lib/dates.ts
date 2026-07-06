// Port of watch/utils.py's get_date_range, fixed to compute decade/century
// boundaries dynamically from the current date instead of hardcoded years.

import type { Era } from "@/lib/media";

export interface DateRange {
  gte: string;
  lte: string;
}

function iso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function lastDayOfMonth(year: number, month: number): number {
  // month is 1-indexed; day 0 of next month = last day of this month.
  return new Date(year, month, 0).getDate();
}

export function getDateRange(era: Era, now: Date = new Date()): DateRange {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const todayIso = iso(year, month, day);

  switch (era) {
    case "this_month": {
      const start = iso(year, month, 1);
      const end = iso(year, month, lastDayOfMonth(year, month));
      return { gte: start, lte: end };
    }
    case "this_year": {
      return { gte: iso(year, 1, 1), lte: iso(year, 12, 31) };
    }
    case "this_decade": {
      const decadeStart = Math.floor(year / 10) * 10;
      return { gte: iso(decadeStart, 1, 1), lte: todayIso };
    }
    case "last_decade": {
      const decadeStart = Math.floor(year / 10) * 10;
      const prevDecadeStart = decadeStart - 10;
      return {
        gte: iso(prevDecadeStart, 1, 1),
        lte: iso(decadeStart - 1, 12, 31),
      };
    }
    case "this_century": {
      const centuryStart = Math.floor(year / 100) * 100;
      return { gte: iso(centuryStart, 1, 1), lte: todayIso };
    }
    case "old": {
      // 1980 - 1999, kept as a fixed historical bucket (matches legacy intent:
      // "old" means the 20 years before the current century).
      const centuryStart = Math.floor(year / 100) * 100;
      return { gte: iso(centuryStart - 20, 1, 1), lte: iso(centuryStart - 1, 12, 31) };
    }
    case "ancient": {
      // Everything before the "old" bucket.
      const centuryStart = Math.floor(year / 100) * 100;
      return { gte: iso(1, 1, 1), lte: iso(centuryStart - 21, 12, 31) };
    }
    case "":
    default: {
      return { gte: iso(1, 1, 1), lte: todayIso };
    }
  }
}
