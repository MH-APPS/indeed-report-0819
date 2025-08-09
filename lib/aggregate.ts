import dayjs from 'dayjs';
import { DailyRow, CampaignRow } from './csv';

export type MonthlySummary = {
  month: string; // YYYY-MM
  impressions: number;
  clicks: number;
  applies: number;
  cost: number;
  ctr: number; // clicks / impressions
  cpc: number; // cost / clicks
  cpa: number; // cost / applies
  asr?: number; // optional if available
  ar?: number; // optional if available
};

export type WeeklyRow = {
  label: string; // e.g., 3/1–3/7
  impressions: number;
  clicks: number;
  asr?: number;
  completionRate?: number;
  applies: number;
  ar?: number;
  cost: number;
  cpc: number;
  cpa: number;
};

export type CampaignSummary = {
  name: string;
  jobs?: number;
  impressions: number;
  ctr?: number;
  clicks: number;
  asr?: number;
  applies: number;
  ar?: number;
  cost: number;
  cpc?: number;
  cpa?: number;
};

export function sumSafe(values: Array<number | undefined>): number {
  return values.reduce((acc: number, v: number | undefined) => acc + (typeof v === 'number' ? v : 0), 0);
}

export function divideSafe(numerator: number, denominator: number): number | undefined {
  if (!denominator || denominator === 0) return undefined;
  return numerator / denominator;
}

export function formatPercent(value?: number, fractionDigits = 1): string {
  if (value === undefined) return '–';
  return `${(value * 100).toFixed(fractionDigits)}%`;
}

export function formatYen(value?: number): string {
  if (value === undefined) return '–';
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

export function aggregateMonthly(daily: DailyRow[], ym: string): MonthlySummary {
  const rows = daily.filter((r) => dayjs(r['期間：日単位']).format('YYYY-MM') === ym);
  const impressions = sumSafe(rows.map((r) => r['表示回数']));
  const clicks = sumSafe(rows.map((r) => r['クリック数']));
  const applies = sumSafe(rows.map((r) => r['応募数']));
  const cost = sumSafe(rows.map((r) => r['費用']));
  const ctr = divideSafe(clicks, impressions) ?? 0;
  const cpc = divideSafe(cost, clicks) ?? 0;
  const cpa = divideSafe(cost, applies) ?? 0;
  return { month: ym, impressions, clicks, applies, cost, ctr, cpc, cpa };
}

export function aggregateWeekly(daily: DailyRow[], ym: string): WeeklyRow[] {
  const within = daily.filter((r) => dayjs(r['期間：日単位']).format('YYYY-MM') === ym);
  if (within.length === 0) return [];
  const start = dayjs(within[0]['期間：日単位']).startOf('month');
  const weeks: [dayjs.Dayjs, dayjs.Dayjs][] = [
    [start.date(1), start.date(Math.min(7, start.daysInMonth()))],
    [start.date(8), start.date(Math.min(14, start.daysInMonth()))],
    [start.date(15), start.date(Math.min(21, start.daysInMonth()))],
    [start.date(22), start.endOf('month')],
  ];
  return weeks.map(([s, e]) => {
    const rows = within.filter((r) => {
      const d = dayjs(r['期間：日単位']);
      return (d.isSame(s, 'day') || d.isAfter(s, 'day')) && (d.isSame(e, 'day') || d.isBefore(e, 'day'));
    });
    const impressions = sumSafe(rows.map((r) => r['表示回数']));
    const clicks = sumSafe(rows.map((r) => r['クリック数']));
    const applies = sumSafe(rows.map((r) => r['応募数']));
    const cost = sumSafe(rows.map((r) => r['費用']));
    const cpc = divideSafe(cost, clicks) ?? 0;
    const cpa = divideSafe(cost, applies) ?? 0;
    const label = `${s.format('M/D')}–${e.format('M/D')}`;
    return { label, impressions, clicks, applies, cost, cpc, cpa };
  });
}

export function aggregateCampaigns(camps: CampaignRow[]): CampaignSummary[] {
  return camps.map((c) => ({
    name: c['キャンペーン'],
    jobs: c['Job Count'],
    impressions: c['表示回数'],
    ctr: c['クリック率（CTR）'],
    clicks: c['クリック数'],
    asr: c['応募開始率 (ASR)'],
    applies: c['応募数'],
    ar: c['応募率 (AR)'],
    cost: c['費用'],
    cpc: c['クリック単価（CPC）'],
    cpa: c['応募単価（CPA）'],
  }));
}

