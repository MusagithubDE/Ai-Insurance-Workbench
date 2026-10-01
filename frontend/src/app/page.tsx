'use client';

import { useState } from 'react';

type Analysis = {
  status: string;
  model: string;
  verified_checks: {
    method: string;
    policy_source: string;
    cover_start_date: string;
    dates_conflict: boolean;
    comparisons: {
      source_id: string;
      incident_date: string;
      relation_to_cover_start: 'before' | 'on' | 'after';
    }[];
  };
  ai_draft: string;
  ai_draft_status: string;
  coverage_status: string;
  data_mode: string;
  human_review_required: boolean;
};

export default function Home() {
  const [status, setStatus] = useState('Ready');
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);

  async function runRequest(
    path: '/health' | '/ai/test' | '/demo/analyse'
  ) {
    setBusy(true);
    setGreeting('');
    setAnalysis(null);
    setStatus(
      path === '/health'
        ? 'Checking backend...'
        : 'Waiting for the local AI. This may take a few minutes...'
    );

    try {
      const response = await fetch(
        `http://127.0.0.1:8000${path}`,
        {
          method: path === '/health' ? 'GET' : 'POST',
          signal: AbortSignal.timeout(200000),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          typeof data.detail === 'string'
            ? data.detail
            : `Request failed: HTTP ${response.status}`
        );
      }

      if (data.status !== 'ok') {
        throw new Error('Unexpected backend response.');
      }

      if (path === '/demo/analyse') {
        setAnalysis(data);
        setStatus('Date checks complete. AI draft ready for review.');
      } else if (path === '/ai/test') {
        setGreeting(data.answer);
        setStatus('Local AI connected.');
      } else {
        setStatus(`Backend connected — ${data.data_mode} data.`);
      }
    } catch (error) {
      setStatus(
        error instanceof Error ? error.message : 'Request failed.'
      );
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = {
    padding: '12px 18px',
    borderRadius: 8,
    border: '1px solid #94a3b8',
    background: '#ffffff',
    color: '#0f172a',
    cursor: busy ? 'wait' : 'pointer',
    opacity: busy ? 0.6 : 1,
  };

  const cardStyle = {
    padding: 24,
    border: '1px solid #cbd5e1',
    borderRadius: 12,
    background: '#ffffff',
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '40px 24px',
        background: '#f1f5f9',
        color: '#0f172a',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ color: '#475569', marginBottom: 12 }}>
          MUSA &amp; CEBO · SYNTHETIC DATA DEMONSTRATION
        </p>

        <h1 style={{ fontSize: 36, marginBottom: 12 }}>
          AI Insurance Workbench
        </h1>

        <p style={{ marginBottom: 24, lineHeight: 1.6 }}>
          Compare incident records and prepare an AI draft for human
          review.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          <button
            disabled={busy}
            onClick={() => runRequest('/health')}
            style={buttonStyle}
          >
            Check backend
          </button>

          <button
            disabled={busy}
            onClick={() => runRequest('/ai/test')}
            style={buttonStyle}
          >
            Test local AI
          </button>

          <button
            disabled={busy}
            onClick={() => runRequest('/demo/analyse')}
            style={{
              ...buttonStyle,
              background: '#1d4ed8',
              color: '#ffffff',
              borderColor: '#1d4ed8',
            }}
          >
            Analyse demo case
          </button>
        </div>

        <p role="status" style={{ margin: '24px 0', lineHeight: 1.6 }}>
          {status}
        </p>

        {greeting && (
          <section style={cardStyle}>
            <h2>AI greeting</h2>
            <p style={{ marginTop: 12 }}>{greeting}</p>
          </section>
        )}

        {analysis && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns:
                  'repeat(auto-fit, minmax(min(100%, 340px), 1fr))',
                gap: 20,
              }}
            >
              <section style={cardStyle}>
                <h2>Calculated date checks</h2>

                <p style={{ margin: '12px 0', lineHeight: 1.6 }}>
                  Python compares dates from the supplied records.
                  These checks do not establish the actual incident date.
                </p>

                <p style={{ marginBottom: 20 }}>
                  <strong>Cover start:</strong>{' '}
                  {analysis.verified_checks.cover_start_date}
                  <br />
                  <strong>Source:</strong>{' '}
                  {analysis.verified_checks.policy_source}
                </p>

                {analysis.verified_checks.comparisons.map((item) => (
                  <div
                    key={item.source_id}
                    style={{
                      padding: '14px 0',
                      borderTop: '1px solid #e2e8f0',
                      lineHeight: 1.7,
                    }}
                  >
                    <strong>{item.source_id}</strong>
                    <p>Recorded incident: {item.incident_date}</p>
                    <p>
                      <strong>
                        {item.relation_to_cover_start.toUpperCase()}
                      </strong>{' '}
                      the cover start date
                    </p>
                  </div>
                ))}

                <p
                  style={{
                    padding: 14,
                    marginTop: 16,
                    background: '#fff7ed',
                    borderRadius: 8,
                    color: '#9a3412',
                  }}
                >
                  {analysis.verified_checks.dates_conflict
                    ? 'The incident records contain conflicting dates.'
                    : 'The incident dates match.'}
                </p>

                <p style={{ marginTop: 16 }}>
                  <strong>Coverage:</strong>{' '}
                  {analysis.coverage_status}
                </p>
              </section>

              <section style={cardStyle}>
                <h2>AI-written draft</h2>

                <p
                  style={{
                    margin: '12px 0 20px',
                    color: '#92400e',
                    lineHeight: 1.6,
                  }}
                >
                  Requires human review. Check every statement against
                  the records and calculated dates.
                </p>

                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.8,
                  }}
                >
                  {analysis.ai_draft}
                </div>
              </section>
            </div>

            <p style={{ marginTop: 20, color: '#475569' }}>
              {analysis.human_review_required
                ? 'Human review required. '
                : ''}
              This demonstration does not approve or reject claims.
            </p>
          </>
        )}
      </div>
    </main>
  );
}