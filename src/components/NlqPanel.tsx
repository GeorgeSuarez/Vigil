import { useRef, useState } from 'react'
import type { SyntheticEvent } from 'react'

export interface NlqPanelProps {
  /** Runs a command and resolves with the assistant's reply. */
  onRun: (text: string) => Promise<string>
  /** Whether the optional LLM path is configured (vs the keyless parser). */
  llmActive: boolean
}

interface Entry {
  q: string
  a: string
}

/** Floating "Ask the map" panel: natural-language commands drive the map. */
export function NlqPanel({ onRun, llmActive }: NlqPanelProps) {
  const [open, setOpen] = useState(false)
  const [entries, setEntries] = useState<readonly Entry[]>([])
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  if (!open) {
    return (
      <button
        type="button"
        className="nlq-pill"
        onClick={() => setOpen(true)}
        aria-expanded="false"
        aria-label="Open the ask-the-map panel"
      >
        ✨ Ask the map
      </button>
    )
  }

  const submit = async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    const q = draft.trim()
    if (!q || busy) return
    setEntries((prev) => [...prev, { q, a: '…' }])
    setDraft('')
    setBusy(true)
    try {
      const a = await onRun(q)
      setEntries((prev) => {
        // Replace the busy placeholder (the last entry) with the real answer.
        return [...prev.slice(0, -1), { q, a }]
      })
    } finally {
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  return (
    <section className="nlq-dock" aria-label="Ask the map">
      <div className="nlq-head">
        <span className="nlq-title">✨ Ask the map</span>
        <calcite-chip scale="s" kind={llmActive ? 'brand' : 'neutral'} label="NLQ mode">
          {llmActive ? 'LLM' : 'offline rules'}
        </calcite-chip>
        <button
          type="button"
          className="nlq-close"
          onClick={() => setOpen(false)}
          aria-label="Close the ask-the-map panel"
        >
          ✕
        </button>
      </div>

      <div className="nlq-entries" role="log" aria-live="polite">
        {entries.length === 0 && (
          <p className="nlq-hint">Try a command, e.g. “show M6+ earthquakes”.</p>
        )}
        {entries.map((entry, index) => (
          <div key={`${entry.q}-${index}`} className="nlq-entry">
            <p className="nlq-q">{entry.q}</p>
            <p className="nlq-a" aria-busy={entry.a === '…'}>
              {entry.a}
            </p>
          </div>
        ))}
      </div>

      <form className="nlq-form" onSubmit={(e) => void submit(e)}>
        <input
          ref={inputRef}
          className="nlq-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="show M6+ earthquakes in Alaska…"
          aria-label="Ask the map a question"
          disabled={busy}
        />
        <calcite-button type="submit" scale="s" disabled={busy} aria-label="Send command">
          Ask
        </calcite-button>
      </form>
    </section>
  )
}
