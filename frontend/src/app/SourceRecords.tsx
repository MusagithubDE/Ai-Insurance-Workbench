'use client';

import { useState } from 'react';

type DemoCase = {
  data_mode: string;
  claim: Record<string, string>;
  policy: Record<string, string>;
  incident_report: Record<string, string>;
};

export default function SourceRecords() {
  const [records, setRecords] = useState<DemoCase | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadRecords() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/demo/case',
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        }
      );

      if (!response.ok) {
        throw new Error(`Could not load records: HTTP ${response.status}`);
      }

      const data: DemoCase = await response.json();
      setRecords(data);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : 'Could not load records.'
      );
    } finally {
      setLoading(false);
    }
  }

  const sections = records
    ? [
        { title: 'Claim record', fields: records.claim },
        { title: 'Policy record', fields: records.policy },
        { title: 'Incident report', fields: records.incident_report },
      ]
    : [];

  return (
    <section
      style={{
        margin: '24px 0',
        padding: 24,
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
      }}
    >
      <h2>Source records</h2>

      <p style={{ margin: '12px 0', lineHeight: 1.6 }}>
        Inspect the synthetic records used for the date comparisons
        and AI draft.
      </p>

      <button
        onClick={loadRecords}
        disabled={loading}
        style={{
          padding: '10px 16px',
          border: '1px solid #94a3b8',
          borderRadius: 8,
          background: '#ffffff',
          color: '#0f172a',
          cursor: loading ? 'wait' : 'pointer',
        }}
      >
        {loading
          ? 'Loading records...'
          : records
            ? 'Refresh source records'
            : 'View source records'}
      </button>

      <p role="status" style={{ marginTop: 12, color: '#b91c1c' }}>
        {error}
      </p>

      {records && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(min(100%, 250px), 1fr))',
            gap: 16,
            marginTop: 20,
          }}
        >
          {sections.map(({ title, fields }) => (
            <article
              key={title}
              style={{
                padding: 20,
                background: '#f8fafc',
                borderRadius: 8,
                border: '1px solid #e2e8f0',
              }}
            >
              <h3 style={{ marginBottom: 16 }}>{title}</h3>

              <dl>
                {Object.entries(fields).map(([key, value]) => (
                  <div key={key} style={{ marginBottom: 12 }}>
                    <dt
                      style={{
                        color: '#475569',
                        fontSize: 13,
                        textTransform: 'capitalize',
                      }}
                    >
                      {key.replaceAll('_', ' ')}
                    </dt>
                    <dd
                      style={{
                        margin: '4px 0 0',
                        lineHeight: 1.5,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}