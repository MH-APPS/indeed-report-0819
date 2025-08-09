"use client";

import { useState } from "react";

export default function Page() {
  const [month, setMonth] = useState<string>("2025-03");
  const [daily, setDaily] = useState<File | null>(null);
  const [campaign, setCampaign] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPdfUrl(null);
    if (!daily || !campaign) {
      setError("CSV を 2 ファイルとも選択してください。");
      return;
    }
    setLoading(true);
    try {
      const form = new FormData();
      form.append("month", month);
      form.append("daily", daily);
      form.append("campaign", campaign);
      const res = await fetch("/api/generate-pdf", { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err: any) {
      setError(err.message || "PDF 生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container">
      <h1>Indeed レポート自動生成（PDF）</h1>
      <p>対象月と CSV（A: 日次/週次元データ、B: 当月のキャンペーン別）をアップロードしてください。</p>
      <form onSubmit={onSubmit} className="card grid">
        <div>
          <label>対象月</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div>
          <label>CSV A（日次・週次の元データ）</label>
          <input type="file" accept=".csv" onChange={(e) => setDaily(e.target.files?.[0] ?? null)} />
        </div>
        <div>
          <label>CSV B（当月のキャンペーン別集計）</label>
          <input type="file" accept=".csv" onChange={(e) => setCampaign(e.target.files?.[0] ?? null)} />
        </div>
        <div className="row">
          <button className="btn" disabled={loading}>
            {loading ? "生成中..." : "PDF を生成"}
          </button>
          {error && <span style={{ color: "#D92D20" }}>{error}</span>}
        </div>
        {pdfUrl && (
          <div className="row">
            <a className="btn" href={pdfUrl} download={`Indeed_Report_${month}.pdf`}>
              ダウンロード
            </a>
            <a className="btn" href={pdfUrl} target="_blank" rel="noreferrer">
              新規タブで表示
            </a>
          </div>
        )}
      </form>
    </div>
  );
}

