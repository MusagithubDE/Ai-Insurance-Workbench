'use client';

import { useState } from 'react';

type Props = {
  aiDraft: string;
};

export default function ReviewPanel({ aiDraft }: Props) {
  const [reviewer, setReviewer] = useState('');
  const [editedDraft, setEditedDraft] = useState(aiDraft);
  const [checked, setChecked] = useState(false);
  const [message, setMessage] = useState('');

  const canDownload =
    reviewer.trim().length > 0 &&
    editedDraft.trim().length > 0 &&
    checked;

  function downloadNote() {
    if (!canDownload) return;

    const note = [
      'AI INSURANCE WORKBENCH — SYNTHETIC DEMONSTRATION',
      '',
      `Reviewer: ${reviewer.trim()}`,
      `Exported at: ${new Date().toISOString()}`,
      'Sources: ACC-2048, POL-1007, REP-014',
      'Coverage: undetermined',
      'Claim decision: not made',
      '',
      'REVIEWER CONFIRMATION',
      'The reviewer confirmed checking the draft against the displayed records.',
      'This is a self-declared review, not an independently verified approval.',
      '',
      'ORIGINAL AI DRAFT',
      aiDraft,
      '',
      'REVIEWED NOTE',
      editedDraft.trim(),
    ].join('\n');

    const blob = new Blob([note], {
      type: 'text/plain;charset=utf-8',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'ACC-2048-review-note.txt';
    document.body.appendChild(link);
    link.click();
    link.remove();

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage('Download requested. Check your browser downloads.');
  }

  return (
    <section
      style={{
        marginTop: 24,
        padding: 24,
        background: '#ffffff',
        border: '1px solid #cbd5e1',
        borderRadius: 12,
      }}
    >
      <h2>Human review</h2>

      <p style={{ margin: '12px 0 20px', lineHeight: 1.6 }}>
        Check the AI draft against the source records and calculated
        dates. Correct its wording before exporting your review note.
      </p>

      <label htmlFor="reviewer">Reviewer name</label>
      <input
        id="reviewer"
        value={reviewer}
        onChange={(event) => {
          setReviewer(event.target.value);
          setChecked(false);
          setMessage('');
        }}
        placeholder="For example, Musa"
        style={{
          display: 'block',
          width: '100%',
          padding: 12,
          margin: '8px 0 20px',
          border: '1px solid #94a3b8',
          borderRadius: 8,
          background: '#ffffff',
          color: '#0f172a',
        }}
      />

      <label htmlFor="reviewed-note">Editable review note</label>
      <textarea
        id="reviewed-note"
        value={editedDraft}
        onChange={(event) => {
          setEditedDraft(event.target.value);
          setChecked(false);
          setMessage('');
        }}
        rows={10}
        style={{
          display: 'block',
          width: '100%',
          padding: 12,
          margin: '8px 0 20px',
          border: '1px solid #94a3b8',
          borderRadius: 8,
          background: '#ffffff',
          color: '#0f172a',
          font: 'inherit',
          lineHeight: 1.6,
          resize: 'vertical',
        }}
      />

      <label
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 10,
          lineHeight: 1.6,
        }}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => {
            setChecked(event.target.checked);
            setMessage('');
          }}
          style={{ marginTop: 5 }}
        />
        I checked this note against the displayed records. The actual
        incident date and coverage still require verification.
      </label>

      <button
        disabled={!canDownload}
        onClick={downloadNote}
        style={{
          marginTop: 20,
          padding: '12px 18px',
          border: 'none',
          borderRadius: 8,
          background: canDownload ? '#1d4ed8' : '#cbd5e1',
          color: canDownload ? '#ffffff' : '#475569',
          cursor: canDownload ? 'pointer' : 'not-allowed',
        }}
      >
        Download review note
      </button>

      <p role="status" style={{ marginTop: 12 }}>
        {message}
      </p>

      <p style={{ marginTop: 12, color: '#475569', fontSize: 14 }}>
        Edits remain in this page until downloaded. Refreshing the page
        or starting another analysis clears them.
      </p>
    </section>
  );
}