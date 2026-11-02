/**
 * Philippine dates that matter for posting: national holidays, popular observances and paydays.
 *
 * Fixed-date holidays follow Republic Act 9492 and the yearly proclamations; movable ones are
 * computed (Holy Week from Easter, National Heroes Day = last Monday of August). Eid and Chinese
 * New Year move with lunar calendars and are announced each year, so they aren't listed here.
 * Paydays are the 15th and the last day of the month, as most Filipino employers pay.
 */

export type PhDateKind = 'holiday' | 'observance' | 'payday';

export interface PhDate {
  /** Day of the month, 1–31. */
  day: number;
  name: string;
  kind: PhDateKind;
}

const FIXED: { m: number; d: number; name: string; kind: PhDateKind }[] = [
  { m: 1, d: 1, name: 'New Year’s Day', kind: 'holiday' },
  { m: 2, d: 14, name: 'Valentine’s Day', kind: 'observance' },
  { m: 2, d: 25, name: 'EDSA Revolution', kind: 'holiday' },
  { m: 4, d: 9, name: 'Araw ng Kagitingan', kind: 'holiday' },
  { m: 5, d: 1, name: 'Labor Day', kind: 'holiday' },
  { m: 6, d: 12, name: 'Independence Day', kind: 'holiday' },
  { m: 8, d: 21, name: 'Ninoy Aquino Day', kind: 'holiday' },
  { m: 11, d: 1, name: 'All Saints’ Day (Undas)', kind: 'holiday' },
  { m: 11, d: 2, name: 'All Souls’ Day', kind: 'holiday' },
  { m: 11, d: 30, name: 'Bonifacio Day', kind: 'holiday' },
  { m: 12, d: 8, name: 'Immaculate Conception', kind: 'holiday' },
  { m: 12, d: 16, name: 'Simbang Gabi starts', kind: 'observance' },
  { m: 12, d: 24, name: 'Christmas Eve', kind: 'holiday' },
  { m: 12, d: 25, name: 'Christmas Day', kind: 'holiday' },
  { m: 12, d: 30, name: 'Rizal Day', kind: 'holiday' },
  { m: 12, d: 31, name: 'New Year’s Eve', kind: 'holiday' },
];

/** Easter Sunday (Anonymous Gregorian algorithm). */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const lastMondayOf = (year: number, month0: number) => {
  const d = new Date(year, month0 + 1, 0);
  while (d.getDay() !== 1) d.setDate(d.getDate() - 1);
  return d.getDate();
};

/** Holidays, observances and paydays in a month (month0 = 0–11), one entry per name, sorted by day. */
export function phDatesInMonth(year: number, month0: number): PhDate[] {
  const out: PhDate[] = FIXED.filter((h) => h.m - 1 === month0).map((h) => ({ day: h.d, name: h.name, kind: h.kind }));

  const e = easter(year);
  const holy = [
    { offset: -3, name: 'Maundy Thursday' },
    { offset: -2, name: 'Good Friday' },
    { offset: -1, name: 'Black Saturday' },
  ];
  holy.forEach(({ offset, name }) => {
    const d = new Date(e);
    d.setDate(d.getDate() + offset);
    if (d.getMonth() === month0) out.push({ day: d.getDate(), name, kind: 'holiday' });
  });
  if (e.getMonth() === month0) out.push({ day: e.getDate(), name: 'Easter Sunday', kind: 'observance' });
  if (month0 === 7) out.push({ day: lastMondayOf(year, 7), name: 'National Heroes Day', kind: 'holiday' });

  const last = new Date(year, month0 + 1, 0).getDate();
  out.push({ day: 15, name: 'Payday', kind: 'payday' }, { day: last, name: 'Payday', kind: 'payday' });

  return out.sort((a, b) => a.day - b.day || (a.kind === 'payday' ? 1 : -1));
}

/** Short tags per day for the month grid, e.g. 30 → "Payday · Bonifacio". */
export function dayTags(year: number, month0: number): Map<number, string> {
  const tags = new Map<number, string[]>();
  phDatesInMonth(year, month0).forEach((d) => {
    const short = d.kind === 'payday' ? 'Payday' : d.name.replace(/ Day$| Revolution$/, '').replace(/’s$/, '').replace(/ \(.*\)$/, '');
    tags.set(d.day, [...(tags.get(d.day) ?? []), short]);
  });
  return new Map([...tags].map(([day, list]) => [day, list.join(' · ')]));
}
