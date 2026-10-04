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

/** True when a stored value predates the dropdown (free text from an older profile). */
export const isLegacyIndustry = (value: string): boolean =>
  value.trim().length > 0 && !INDUSTRY_OPTIONS.includes(value as IndustryOption);
