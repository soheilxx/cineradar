import type { Localized } from './copy';
import type { ComparisonId } from './routes';
import type { FeatureKey } from './features';
export type ClaimStatus =
  | 'belegt'
  | 'eingeschränkt'
  | 'unbekannt'
  | 'nicht_anwendbar';
export interface Claim {
  feature: FeatureKey;
  text: Localized;
  scope: Localized;
  status: ClaimStatus;
  source: string;
  checkedAt: string;
}
export interface Comparison {
  id: ComparisonId;
  brand: string;
  url: string;
  focus: Localized;
  intro: Localized;
  decision: Localized;
  question: Localized;
  answer: Localized;
  example: string;
  claims: Claim[];
  related: ComparisonId[];
  publishedAt: string;
  updatedAt: string;
}
export const reviewed = '2026-09-07';
