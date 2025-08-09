import Papa, { ParseError } from 'papaparse';
import { z } from 'zod';

export const DailyRowSchema = z.object({
  '期間：日単位': z.string(),
  '表示回数': z.coerce.number(),
  'クリック率（CTR）': z.coerce.number().optional(),
  'クリック数': z.coerce.number(),
  '応募開始率 (ASR)': z.coerce.number().optional(),
  '応募開始数': z.coerce.number().optional(),
  '応募完了率': z.coerce.number().optional(),
  '応募数': z.coerce.number(),
  '応募率 (AR)': z.coerce.number().optional(),
  '費用': z.coerce.number(),
  'クリック単価（CPC）': z.coerce.number().optional(),
  '応募開始単価（CPAS）': z.coerce.number().optional(),
  '応募単価（CPA）': z.coerce.number().optional(),
});
export type DailyRow = z.infer<typeof DailyRowSchema>;

export const CampaignRowSchema = z.object({
  'キャンペーン': z.string(),
  '表示回数': z.coerce.number(),
  'クリック率（CTR）': z.coerce.number().optional(),
  'クリック数': z.coerce.number(),
  '応募開始率 (ASR)': z.coerce.number().optional(),
  '応募開始数': z.coerce.number().optional(),
  '応募完了率': z.coerce.number().optional(),
  '応募数': z.coerce.number(),
  '応募率 (AR)': z.coerce.number().optional(),
  '費用': z.coerce.number(),
  'クリック単価（CPC）': z.coerce.number().optional(),
  '応募開始単価（CPAS）': z.coerce.number().optional(),
  '応募単価（CPA）': z.coerce.number().optional(),
  'Job Count': z.coerce.number().optional(),
  '求人あたりの平均クリック数': z.coerce.number().optional(),
  '求人あたりの平均応募開始数': z.coerce.number().optional(),
  '求人あたりの平均応募数': z.coerce.number().optional(),
  '求人あたりの平均費用': z.coerce.number().optional(),
});
export type CampaignRow = z.infer<typeof CampaignRowSchema>;

export async function parseCsv<T>(file: File): Promise<T[]> {
  const text = await file.text();
  return new Promise((resolve, reject) => {
    Papa.parse<T>(text, {
      header: true,
      skipEmptyLines: true,
      transform: (value) => value.trim(),
      complete: (results) => {
        resolve(results.data as T[]);
      },
      error: (err: any) => reject(err as Error),
    });
  });
}

