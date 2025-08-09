import { CampaignSummary, MonthlySummary, WeeklyRow, divideSafe } from './aggregate';

export function buildMonthlyInsights(curr: MonthlySummary, prev?: MonthlySummary): string[] {
  if (!prev) return [];
  const diff = (a?: number, b?: number) => (a !== undefined && b !== undefined ? ((a - b) / b) : undefined);
  const impressionsMoM = diff(curr.impressions, prev.impressions);
  const ctrMoM = diff(curr.ctr, prev.ctr);
  const cpaMoM = diff(curr.cpa, prev.cpa);
  const appliesMoM = diff(curr.applies, prev.applies);
  const items: string[] = [];
  if (impressionsMoM !== undefined && ctrMoM !== undefined) {
    if (impressionsMoM < 0 && ctrMoM > 0) {
      items.push('表示は減少したが効率は改善：質の高い露出に成功');
    }
  }
  if (appliesMoM !== undefined && cpaMoM !== undefined) {
    if (cpaMoM < 0) items.push('応募単価が低下しコスト効率が改善');
    if (appliesMoM > 0) items.push('応募数が増加し獲得ボリュームを拡大');
  }
  return [...new Set(items)];
}

export function buildWeeklyInsights(weekly: WeeklyRow[]): string[] {
  if (weekly.length === 0) return [];
  const first = weekly[0];
  const last = weekly[weekly.length - 1];
  const cpaChange = divideSafe(last.cpa - first.cpa, first.cpa);
  const items: string[] = [];
  if (cpaChange !== undefined && cpaChange < 0) {
    items.push(`応募単価は ${first.cpa.toFixed(0)}円 → ${last.cpa.toFixed(0)}円に改善`);
  }
  return items;
}

export function buildCampaignInsights(camps: CampaignSummary[]): string[] {
  if (camps.length === 0) return [];
  const sortedByCpa = camps.filter((c) => c.cpa !== undefined && c.applies > 0).sort((a, b) => (a.cpa! - b.cpa!));
  const best = sortedByCpa[0];
  const worst = camps.filter((c) => (c.applies ?? 0) === 0);
  const items: string[] = [];
  if (best) items.push(`${best.name} は低CPAで効率良好`);
  if (worst.length > 0) items.push(`応募ゼロのキャンペーンが ${worst.length} 件あり、見直しが必要`);
  return items;
}

