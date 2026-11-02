/**
 * The allowed values for a brand profile's industry.
 *
 * Industry is a constrained choice, not free text, so it cannot be confused
 * with — or used interchangeably with — the business name. Business name is the
 * account's verified identity (set at signup, approved by an admin, quoted in
 * audit logs); industry is cosmetic brand data that only steers the AI prompt.
 * Keeping this list as the single source of truth stops BrandSurvey and
 * Settings from drifting apart.
 */
export const INDUSTRY_OPTIONS = [
  'Food & Beverage',
  'Fashion & Apparel',
  'Beauty & Wellness',
  'Hardware & Home',
  'Services',
  'Retail & E-commerce',
  'Health & Fitness',
  'Education & Training',
  'Other',
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];

/**
 * "Other" with the owner's own niche is stored in the same industry field as "Other: <niche>".
 * The niche belongs to that profile only; it never joins INDUSTRY_OPTIONS.
 */
export const OTHER_PREFIX = 'Other: ';
export const NICHE_MAX = 60;

/** Splits a stored industry into the dropdown choice and the typed niche (for "Other"). */
export const splitIndustry = (value: string): { choice: string; niche: string } =>
  value.startsWith(OTHER_PREFIX) ? { choice: 'Other', niche: value.slice(OTHER_PREFIX.length) } : { choice: value, niche: '' };

/** The stored value for a choice and niche ("Other" + niche → "Other: niche"). */
export const joinIndustry = (choice: string, niche: string): string => {
  // Kept as typed while editing (so spaces between words survive); trimmed for the AI and display.
  const n = niche.replace(/^\s+/, '').slice(0, NICHE_MAX);
  return choice === 'Other' && n.trim() ? `${OTHER_PREFIX}${n}` : choice;
};

/** What the AI and staff read: the niche itself for "Other: niche". */
export const industryLabel = (value: string): string => splitIndustry(value).niche.trim() || value;

/** True when a stored value predates the dropdown (free text from an older profile). */
export const isLegacyIndustry = (value: string): boolean =>
  value.trim().length > 0 && !value.startsWith(OTHER_PREFIX) && !INDUSTRY_OPTIONS.includes(value as IndustryOption);
