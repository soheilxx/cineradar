import { guides } from './guides';
import { specialists } from './specialists';
export const comparisons = [...guides, ...specialists];
export function getComparison(id: string) {
  return comparisons.find((c) => c.id === id);
}
