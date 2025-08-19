import { NextRequest } from 'next/server';
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import dayjs from 'dayjs';
import { parseCsv, DailyRowSchema, CampaignRowSchema } from '@/lib/csv';
import { aggregateMonthly, aggregateWeekly, aggregateCampaigns, formatPercent, formatYen } from '@/lib/aggregate';
import { buildMonthlyInsights, buildWeeklyInsights, buildCampaignInsights } from '@/lib/insights';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const month = String(form.get('month'));
  const daily = form.get('daily') as unknown as File;
  const campaign = form.get('campaign') as unknown as File;
  if (!month || !daily || !campaign) {
    return new Response('missing fields', { status: 400 });
  }

  // Parse CSVs
  const dailyRowsRaw = await parseCsv<Record<string, string | number>>(daily);
  const dailyRows = dailyRowsRaw.map((r) => DailyRowSchema.parse(r));
  const campRowsRaw = await parseCsv<Record<string, string | number>>(campaign);
  const campRows = campRowsRaw.map((r) => CampaignRowSchema.parse(r));

  // Aggregations
  const ym = dayjs(month).format('YYYY-MM');
  const curr = aggregateMonthly(dailyRows, ym);
  const prevYm = dayjs(month).subtract(1, 'month').format('YYYY-MM');
  const prev = aggregateMonthly(dailyRows, prevYm);
  const weekly = aggregateWeekly(dailyRows, ym);
  const camps = aggregateCampaigns(campRows);

  const monthlyInsights = buildMonthlyInsights(curr, prev);
  const weeklyInsights = buildWeeklyInsights(weekly);
  const campaignInsights = buildCampaignInsights(camps);

  // HTML for PDF (960x540 per page)
  const html = buildHtml({ ym, curr, prev, weekly, camps, monthlyInsights, weeklyInsights, campaignInsights });

  // Launch headless browser (Vercel/AWS Lambda では @sparticuz/chromium を使用)
  const isServerless = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;
  
  let executablePath;
  let args;
  
  if (isServerless) {
    executablePath = await chromium.executablePath();
    args = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process'
    ];
  } else {
    executablePath = process.env.CHROME_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    args = ['--no-sandbox'];
  }
  
  console.log('[pdf] isServerless', isServerless, 'executablePath', executablePath);
  
  const browser = await puppeteer.launch({
    args,
    defaultViewport: { width: 960, height: 540 },
    executablePath,
    headless: true,
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdf = await page.pdf({
    printBackground: true,
    width: '960px',
    height: '540px',
  });
  await browser.close();

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Indeed_Report_${ym}.pdf"`
    }
  });
}

function number(value: number): string { return value.toLocaleString('ja-JP'); }

function buildHtml(params: any): string {
  const { ym, curr, prev, weekly, camps, monthlyInsights, weeklyInsights, campaignInsights } = params;
  const ymLabel = dayjs(ym + '-01').format('YYYY年M月');
  const kpiCards = `
    <div class="kpis">
      <div class="kpi"><div class="label">総表示回数</div><div class="value">${number(curr.impressions)}</div></div>
      <div class="kpi"><div class="label">総応募数</div><div class="value">${number(curr.applies)}</div></div>
      <div class="kpi"><div class="label">平均応募単価</div><div class="value">${formatYen(curr.cpa)}</div></div>
    </div>`;

  const monthlyTable = `
    <table class="table">
      <thead><tr><th>期間</th><th>表示回数</th><th>クリック率</th><th>応募率</th><th>応募数</th><th>費用</th><th>CPA</th></tr></thead>
      <tbody>
        <tr><td>${dayjs(prev.month + '-01').format('M月')}</td><td>${number(prev.impressions)}</td><td>${formatPercent(prev.ctr)}</td><td>–</td><td>${number(prev.applies)}</td><td>${number(prev.cost)}</td><td>${formatYen(prev.cpa)}</td></tr>
        <tr><td>${dayjs(curr.month + '-01').format('M月')}</td><td>${number(curr.impressions)}</td><td>${formatPercent(curr.ctr)}</td><td>–</td><td>${number(curr.applies)}</td><td>${number(curr.cost)}</td><td>${formatYen(curr.cpa)}</td></tr>
      </tbody>
    </table>`;

  const weeklyRows = weekly.map((w: any) => `<tr><td>${w.label}</td><td>${number(w.impressions)}</td><td>${number(w.clicks)}</td><td>${number(w.applies)}</td><td>${number(w.cost)}</td><td>${formatYen(w.cpc)}</td><td>${formatYen(w.cpa)}</td></tr>`).join('');
  const weeklyTable = `
    <table class="table">
      <thead><tr><th>週</th><th>表示回数</th><th>クリック数</th><th>応募数</th><th>費用</th><th>CPC</th><th>CPA</th></tr></thead>
      <tbody>${weeklyRows}</tbody>
    </table>`;

  const campRows = camps.map((c: any) => `<tr><td>${escapeHtml(c.name)}</td><td>${c.jobs ?? '-'}</td><td>${number(c.impressions)}</td><td>${c.ctr ? (c.ctr * 100).toFixed(2) + '%' : '–'}</td><td>${number(c.clicks)}</td><td>${c.asr ? (c.asr * 100).toFixed(2) + '%' : '–'}</td><td>${number(c.applies)}</td><td>${c.ar ? (c.ar * 100).toFixed(2) + '%' : '–'}</td><td>${number(c.cost)}</td><td>${c.cpa ? formatYen(c.cpa) : '–'}</td></tr>`).join('');
  const campTable = `
    <table class="table">
      <thead><tr><th>キャンペーン</th><th>求人数</th><th>表示</th><th>CTR</th><th>クリック</th><th>ASR</th><th>応募</th><th>AR</th><th>費用</th><th>CPA</th></tr></thead>
      <tbody>${campRows}</tbody>
    </table>`;

  const page = (title: string, body: string) => `
    <section class="page">
      <header>${title}</header>
      <div class="content">${body}</div>
      <footer>株式会社メディアハウスホールディングス HR Tech SBU</footer>
    </section>`;

  const style = `
    <style>
      @page { size: 960px 540px; margin: 0; }
      body { margin: 0; font-family: 'Noto Sans JP', sans-serif; }
      .page { width: 960px; height: 540px; padding: 36px 44px; box-sizing: border-box; display: flex; flex-direction: column; justify-content: space-between; }
      header { font-weight: 700; font-size: 28px; color: #0B6DFF; }
      footer { color: #667085; font-size: 12px; }
      .content { flex: 1; margin-top: 16px; display: grid; gap: 16px; }
      .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .kpi { background: #F2F7FF; border: 1px solid #D6E4FF; border-radius: 12px; padding: 16px; }
      .kpi .label { color: #667085; font-weight: 500; }
      .kpi .value { font-weight: 700; font-size: 28px; }
      .table { width: 100%; border-collapse: collapse; }
      .table th, .table td { border-bottom: 1px solid #EAECF0; padding: 8px 10px; text-align: left; font-size: 14px; }
      ul { margin: 0; padding-left: 18px; }
    </style>`;

  const monthlyList = monthlyInsights.map((t: string) => `<li>${escapeHtml(t)}</li>`).join('');
  const weeklyList = weeklyInsights.map((t: string) => `<li>${escapeHtml(t)}</li>`).join('');
  const campaignList = campaignInsights.map((t: string) => `<li>${escapeHtml(t)}</li>`).join('');

  const html = `
  <html><head>
    <meta charset="utf-8" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;700&display=swap" rel="stylesheet" />
    ${style}
  </head><body>
    ${page(`${ymLabel} Indeed PLUS パフォーマンスレビュー`, '')}
    ${page('アジェンダ', `<ul>
      <li>月次データ概要と前月比較</li>
      <li>週別データ推移と分析</li>
      <li>キャンペーン別効果状況</li>
      <li>課題点と改善余地の考察</li>
      <li>改善施策提案</li>
      <li>予算シミュレーション</li>
    </ul>`) }
    ${page('月次データ概要', `${kpiCards}${monthlyTable}<ul>${monthlyList}</ul>`) }
    ${page('週別データ推移と分析', `${weeklyTable}<ul>${weeklyList}</ul>`) }
    ${page('キャンペーン別効果状況', `${campTable}<ul>${campaignList}</ul>`) }
    ${page('課題点と改善余地', `<ul>
      <li>効率格差の是正とゼロ応募の是正</li>
      <li>応募フローの最適化（完了率の改善）</li>
      <li>予算配分の再調整（高効率への集中）</li>
    </ul>`) }
    ${page('改善施策提案', `<ul>
      <li>成功パターンの横展開（求人内容・画像・訴求）</li>
      <li>応募フロー短縮とモバイル最適化</li>
      <li>ブランド/キャンペーン単位の予算最適化</li>
    </ul>`) }
    ${page('予算シミュレーション', `<p>現状・増額プランの比較（係数設定は後日テンプレ化）</p>`) }
    ${page('まとめと次のステップ', `<ul>
      <li>重点施策の合意</li>
      <li>週次での効果測定とPDCA</li>
      <li>来月の目標KPIの再確認</li>
    </ul>`) }
    ${page('お問い合わせ', `<p>HR Tech SBU / 株式会社メディアハウスホールディングス</p>`) }
  </body></html>`;
  return html;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c] as string));
}

