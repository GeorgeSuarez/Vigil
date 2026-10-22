/**
 * `<vigil-stat>` — a labelled value for dense status rows: "Zoom 4".
 *
 * Authored as a custom element rather than a React component on purpose: the
 * boundary is the whole point. The shadow root owns layout, weight and tone; the
 * light DOM owns the text, so it stays in document order for screen readers, for
 * `getByText` in tests, and for anything that indexes the page.
 *
 * Consumers get exactly two hooks and nothing else: the exported `part`s
 * (`label`, `value`) for styling and the `--vigil-stat-*` custom properties for
 * spacing and colour. No selector inside the shadow root is public.
 *
 *   <vigil-stat tone="danger" emphasis>
 *     <span slot="label">Exposure</span>
 *     <span slot="value">12,400</span>
 *   </vigil-stat>
 *
 * The `label` attribute is shorthand for the common case; a slotted label wins
 * when both are present:
 *
 *   <vigil-stat label="Zoom">4</vigil-stat>
 */

/** Colour family for the value. Each maps to a token the host page can set. */
export type StatTone = 'neutral' | 'accent' | 'success' | 'danger'

export const VIGIL_STAT_TAG = 'vigil-stat'

const TONES: readonly StatTone[] = ['neutral', 'accent', 'success', 'danger']

function isTone(value: string | null): value is StatTone {
  return value !== null && (TONES as readonly string[]).includes(value)
}

/** Parsed once; every instance clones it. */
const template = document.createElement('template')
template.innerHTML = `
  <style>
    :host {
      display: inline-flex;
      align-items: baseline;
      gap: var(--vigil-stat-gap, 0.35em);
      /* An atom: a crowded row must never squeeze the value into a stub. */
      flex: none;
      /* Colour is inherited so the element drops into any surface — the muted
         status bar, a popup, a light panel — without knowing the palette. */
      color: inherit;
    }

    :host([hidden]) {
      display: none;
    }

    .label {
      color: var(--vigil-stat-label-color, inherit);
    }

    .value {
      color: var(--vigil-stat-value-color, inherit);
      font-variant-numeric: tabular-nums;
      font-weight: var(--vigil-stat-value-weight, 400);
    }

    :host([emphasis]) .value {
      font-weight: var(--vigil-stat-value-weight, 600);
    }

    :host([tone='accent']) {
      --vigil-stat-value-color: var(--accent, oklch(75.4% 0.139 232.7));
    }

    :host([tone='success']) {
      --vigil-stat-value-color: var(--status-success, oklch(78% 0.15 150));
    }

    :host([tone='danger']) {
      --vigil-stat-value-color: var(--status-danger, oklch(70% 0.19 25));
    }

    /* Nothing slotted: collapse the label box instead of floating a stray gap. */
    :host([label-less]) .label {
      display: none;
    }
  </style>
  <span class="label" part="label"><slot name="label"></slot></span>
  <span class="value" part="value"><slot name="value"></slot></span>
`

export class VigilStatElement extends HTMLElement {
  /** Only `label` needs reacting to: `tone` and `emphasis` are pure CSS hooks. */
  static readonly observedAttributes = ['label']

  readonly #labelSlot: HTMLSlotElement

  constructor() {
    super()
    const root = this.attachShadow({ mode: 'open' })
    root.append(template.content.cloneNode(true))

    const labelSlot = root.querySelector<HTMLSlotElement>('slot[name="label"]')
    if (!labelSlot) throw new Error('<vigil-stat> template has no label slot')
    this.#labelSlot = labelSlot
  }

  connectedCallback(): void {
    this.#syncLabelFallback()
    this.#syncLabelPresence()
    this.#labelSlot.addEventListener('slotchange', this.#onSlotChange)
  }

  disconnectedCallback(): void {
    this.#labelSlot.removeEventListener('slotchange', this.#onSlotChange)
  }

  attributeChangedCallback(name: string): void {
    if (name === 'label') {
      this.#syncLabelFallback()
      this.#syncLabelPresence()
    }
  }

  /** Shorthand label; empty string removes the attribute. */
  get label(): string {
    return this.getAttribute('label') ?? ''
  }

  set label(value: string) {
    if (value) this.setAttribute('label', value)
    else this.removeAttribute('label')
  }

  /** Unknown values fall back to `neutral` rather than leaking a bad token. */
  get tone(): StatTone {
    const value = this.getAttribute('tone')
    return isTone(value) ? value : 'neutral'
  }

  set tone(value: StatTone) {
    this.setAttribute('tone', isTone(value) ? value : 'neutral')
  }

  get emphasis(): boolean {
    return this.hasAttribute('emphasis')
  }

  set emphasis(value: boolean) {
    this.toggleAttribute('emphasis', value)
  }

  /** Bound once so add/removeEventListener see the same reference. */
  readonly #onSlotChange = (): void => {
    this.#syncLabelPresence()
  }

  /** Fallback content for the label slot: the `label` attribute, if any. */
  #syncLabelFallback(): void {
    const fallback = this.label
    // Text only — assigned nodes are light DOM and must stay untouched.
    if (this.#labelSlot.textContent !== fallback) this.#labelSlot.textContent = fallback
  }

  /** Track whether a label exists at all, so the gap can collapse. */
  #syncLabelPresence(): void {
    const slotted = this.#labelSlot.assignedNodes({ flatten: false }).length > 0
    this.toggleAttribute('label-less', !slotted && this.label === '')
  }
}

// Guarded so HMR and repeated imports cannot throw NotSupportedError.
if (!customElements.get(VIGIL_STAT_TAG)) {
  customElements.define(VIGIL_STAT_TAG, VigilStatElement)
}

declare global {
  interface HTMLElementTagNameMap {
    'vigil-stat': VigilStatElement
  }
}
