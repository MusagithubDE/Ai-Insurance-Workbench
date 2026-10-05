'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';

type Records = {
  data_mode: string;
  claim: Record<string, string>;
  policy: Record<string, string>;
  incident_report: Record<string, string>;
};
type Analysis = {
  analysis_id: string;
  created_at: string;
  model: string;
  records: Records;
  ai_draft: string;
  verified_checks: {
    cover_start_date: string;
    policy_source: string;
    dates_conflict: boolean;
    comparisons: { source_id: string; incident_date: string; relation_to_cover_start: string }[];
  };
};
type ReviewSummary = { id: string; analysis_id: string; reviewer: string; saved_at: string };
type Review = ReviewSummary & { reviewed_note: string; analysis: Analysis };
const API = 'http://127.0.0.1:8000';
const card: CSSProperties = { background: 'white', border: '1px solid #cbd5e1', borderRadius: 12, padding: 24, marginTop: 20 };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: 20 };
const field: CSSProperties = { display: 'block', width: '100%', boxSizing: 'border-box', margin: '8px 0 18px', padding: 12, border: '1px solid #94a3b8', borderRadius: 8, background: 'white', color: '#0f172a', font: 'inherit' };
const button: CSSProperties = { padding: '11px 16px', border: '1px solid #94a3b8', borderRadius: 8, background: 'white', color: '#0f172a', cursor: 'pointer' };
const textStyle: CSSProperties = { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.7 };

async function request<T>(path: string, body?: unknown, post = false): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method: post ? 'POST' : 'GET',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store', signal: AbortSignal.timeout(path === '/demo/analyse' || path === '/ai/test' ? 200000 : 15000),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Request failed (HTTP ${response.status}). Check the required fields.`);
  return data;
}
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Request failed.';

function Evidence({ records }: { records: Records }) {
  return <div style={grid}>{[
    ['Claim record', records.claim], ['Policy record', records.policy], ['Incident report', records.incident_report],
  ].map(([title, values]) => <article key={String(title)} style={card}>
    <h3>{String(title)}</h3>
    <dl>{Object.entries(values).map(([key, value]) => <div key={key} style={{ marginTop: 12 }}>
      <dt style={{ color: '#475569', textTransform: 'capitalize' }}>{key.replaceAll('_', ' ')}</dt>
      <dd style={{ margin: '4px 0', overflowWrap: 'anywhere' }}>{value}</dd>
    </div>)}</dl>
  </article>)}</div>;
}

function AnalysisView({ analysis }: { analysis: Analysis }) {
  return <>
    <Evidence records={analysis.records} />
    <div style={grid}>
      <section style={card}>
        <h2>Calculated date checks</h2>
        <p>Python compares recorded dates; it does not establish the actual incident date.</p>
        <p>Cover start: <strong>{analysis.verified_checks.cover_start_date}</strong> [{analysis.verified_checks.policy_source}]</p>
        {analysis.verified_checks.comparisons.map(item => <p key={item.source_id}>
          <strong>{item.source_id}</strong>: {item.incident_date} — <strong>{item.relation_to_cover_start.toUpperCase()}</strong> cover start.
        </p>)}
        <p style={{ color: '#9a3412' }}>{analysis.verified_checks.dates_conflict ? 'The incident records contain conflicting dates.' : 'The incident dates match.'}</p>
        <p><strong>Coverage: undetermined. No claim decision made.</strong></p>
      </section>
      <section style={card}>
        <h2>Original AI draft</h2>
        <p style={{ color: '#92400e' }}>Requires human review. Check each statement against the evidence.</p>
        <div style={textStyle}>{analysis.ai_draft}</div>
        <p style={{ color: '#475569', fontSize: 13 }}>Model: {analysis.model}</p>
      </section>
    </div>
  </>;
}

function downloadReview(review: Review) {
  const note = [
    'AI INSURANCE WORKBENCH — SYNTHETIC DEMONSTRATION', '',
    `Review ID: ${review.id}`, `Analysis ID: ${review.analysis_id}`,
    `Reviewer (self-declared): ${review.reviewer}`, `Saved at: ${review.saved_at}`,
    `Model: ${review.analysis.model}`, 'Coverage: undetermined', 'Claim decision: not made', '',
    'REVIEWER CONFIRMATION', 'The reviewer confirmed checking the note against the records. This is a self-declared review.', '',
    'ORIGINAL AI DRAFT', review.analysis.ai_draft, '', 'REVIEWED NOTE', review.reviewed_note, '',
    'SOURCE RECORDS', JSON.stringify(review.analysis.records, null, 2), '',
    'CALCULATED DATE CHECKS', JSON.stringify(review.analysis.verified_checks, null, 2),
  ].join('\n');
  const url = URL.createObjectURL(new Blob([note], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url; link.download = `ACC-2048-review-${review.id}.txt`;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Home() {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [records, setRecords] = useState<Records | null>(null);
  const [reviewer, setReviewer] = useState('');
  const [note, setNote] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('Ready');
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [opened, setOpened] = useState<Review | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); } catch (error) { setStatus(errorText(error)); }
    finally { setBusy(false); }
  }
  async function loadHistory() {
    const data = await request<{ reviews: ReviewSummary[] }>('/reviews');
    setReviews(data.reviews); setHistoryLoaded(true);
  }
  function edit() { setConfirmed(false); setDirty(true); }
  const canSave = Boolean(analysis && reviewer.trim() && note.trim() && confirmed && dirty && !busy);
  const disabledStyle = (disabled: boolean): CSSProperties => ({ ...button, opacity: disabled ? 0.5 : 1, cursor: disabled ? 'not-allowed' : 'pointer' });

  return <main style={{ minHeight: '100vh', background: '#f1f5f9', color: '#0f172a', padding: '40px 24px', fontFamily: 'Arial, sans-serif', lineHeight: 1.6 }}>
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <p>MUSA &amp; CEBO · SYNTHETIC DATA DEMONSTRATION</p>
      <h1>AI Insurance Workbench</h1>
      <p>Inspect evidence, check dates, review the AI draft, and save your note.</p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        <button style={button} disabled={busy} onClick={() => run(async () => {
          await request('/health'); setStatus('Backend connected.');
        })}>Check backend</button>
        <button style={button} disabled={busy} onClick={() => run(async () => {
          setStatus('Waiting for local AI…');
          const data = await request<{ answer: string }>('/ai/test', undefined, true); setStatus(data.answer);
        })}>Test local AI</button>
        <button style={button} disabled={busy} onClick={() => run(async () => {
          setRecords(await request<Records>('/demo/case')); setStatus('Source records loaded.');
        })}>View source records</button>
        <button style={disabledStyle(busy || dirty)} disabled={busy || dirty} onClick={() => run(async () => {
          setStatus('Analysing with local AI. This may take a few minutes…');
          const result = await request<Analysis>('/demo/analyse', undefined, true);
          setAnalysis(result); setNote(result.ai_draft); setConfirmed(false); setDirty(true);
          setRecords(null); setStatus('Analysis ready. Review and correct the draft, then save your note.');
        })}>Analyse demo case</button>
      </div>
      <p role="status">{status}</p>
      {dirty && <p style={{ color: '#92400e' }}>Your review has unsaved changes. Save it before refreshing or starting another analysis.</p>}
      {!analysis && records && <Evidence records={records} />}
      {analysis && <>
        <AnalysisView analysis={analysis} />
        <section style={card}>
          <h2>Human review</h2>
          <label htmlFor="reviewer">Reviewer name (self-declared)</label>
          <input id="reviewer" style={field} maxLength={100} disabled={busy} value={reviewer} onChange={event => { setReviewer(event.target.value); edit(); }} />
          <label htmlFor="note">Editable review note</label>
          <textarea id="note" style={field} rows={10} maxLength={20000} disabled={busy} value={note} onChange={event => { setNote(event.target.value); edit(); }} />
          <label><input type="checkbox" disabled={busy} checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I checked this note against the displayed records. The actual incident date and coverage still require verification.</label>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 16 }}>
            <button style={disabledStyle(!canSave)} disabled={!canSave} onClick={() => run(async () => {
              const saved = await request<Review>('/reviews', { analysis_id: analysis.analysis_id, reviewer, reviewed_note: note, confirmed }, true);
              setOpened(saved); setDirty(false); setStatus('Review saved to the backend. You can reopen it from history.');
              try { await loadHistory(); } catch { setStatus('Review saved. History could not refresh; click Load saved reviews to retry.'); }
            })}>Save review</button>
            <button style={button} disabled={busy || !dirty} onClick={() => {
              if (!window.confirm('Discard this unsaved review?')) return;
              setAnalysis(null); setNote(''); setConfirmed(false); setDirty(false); setStatus('Unsaved review discarded.');
            }}>Discard unsaved review</button>
          </div>
        </section>
      </>}
      <section style={card}>
        <h2>Saved review history</h2>
        <p>Saved reviews can be reopened after refreshing or restarting the backend. Unsaved edits are not recovered.</p>
        <button style={button} disabled={busy} onClick={() => run(async () => {
          await loadHistory(); setStatus('Saved review history loaded.');
        })}>{historyLoaded ? 'Refresh saved reviews' : 'Load saved reviews'}</button>
        {historyLoaded && reviews.length === 0 && <p>No reviews saved yet.</p>}
        {reviews.map(review => <div key={review.id} style={{ borderTop: '1px solid #e2e8f0', padding: '14px 0', marginTop: 12 }}>
          <strong>{review.reviewer}</strong> · {new Date(review.saved_at).toLocaleString()}{' '}
          <button style={button} disabled={busy} onClick={() => run(async () => {
            setOpened(await request<Review>(`/reviews/${review.id}`)); setStatus('Saved review opened below.');
          })}>Open review</button>
        </div>)}
      </section>
      {opened && <section style={card}>
        <h2>Saved review</h2>
        <p>Reviewer: {opened.reviewer} · Saved: {new Date(opened.saved_at).toLocaleString()}</p>
        <p style={{ fontSize: 13, overflowWrap: 'anywhere' }}>Review ID: {opened.id}</p>
        <h3>Reviewed note</h3><div style={textStyle}>{opened.reviewed_note}</div>
        <button style={{ ...button, marginTop: 16 }} onClick={() => downloadReview(opened)}>Download saved review</button>
        <details style={{ marginTop: 20 }}><summary>Show original AI draft and saved evidence</summary>
          <AnalysisView analysis={opened.analysis} />
        </details>
      </section>}
      <p style={{ marginTop: 24, color: '#475569' }}>Synthetic demonstration. Reviews record a self-declared check, not an authenticated approval. Coverage remains undetermined.</p>
    </div>
  </main>;
}
