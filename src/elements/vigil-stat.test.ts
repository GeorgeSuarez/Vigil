import { describe, expect, it } from 'vitest'
import { VIGIL_STAT_TAG, VigilStatElement } from './vigil-stat'

function shadowOf(element: HTMLElement): ShadowRoot {
  const root = element.shadowRoot
  if (!root) throw new Error('expected an open shadow root')
  return root
}

/** Slotted child built on the DOM, so no HTML string is ever parsed. */
function slotted(slot: string, text: string): HTMLSpanElement {
  const node = document.createElement('span')
  node.slot = slot
  node.textContent = text
  return node
}

/** Builds a stat, connects it (so slot assignment resolves) and returns it. */
function connected(label: string | null, value = '4'): VigilStatElement {
  const host = document.createElement(VIGIL_STAT_TAG)
  if (label !== null) host.append(slotted('label', label))
  host.append(slotted('value', value))
  document.body.append(host)
  return host
}

describe('VigilStatElement', () => {
  it('is registered under its tag name', () => {
    expect(customElements.get(VIGIL_STAT_TAG)).toBe(VigilStatElement)
  })

  it('exposes its internals as parts and nothing else', () => {
    const host = connected('Zoom')
    const root = shadowOf(host)

    expect(root.querySelector('[part="label"]')).toBeInstanceOf(HTMLElement)
    expect(root.querySelector('[part="value"]')).toBeInstanceOf(HTMLElement)
    // Parts are the public styling surface; internal classes stay private.
    expect(root.querySelectorAll('[part]')).toHaveLength(2)
    host.remove()
  })

  it('assigns label and value to their slots, keeping the text in the light DOM', () => {
    const host = connected('Zoom')
    const root = shadowOf(host)

    const labelSlot = root.querySelector<HTMLSlotElement>('slot[name="label"]')
    const valueSlot = root.querySelector<HTMLSlotElement>('slot[name="value"]')

    expect(labelSlot?.assignedNodes().map((node) => node.textContent)).toEqual(['Zoom'])
    expect(valueSlot?.assignedNodes().map((node) => node.textContent)).toEqual(['4'])
    // The content stayed in the document, where RTL and screen readers find it.
    expect(host.querySelector('[slot="label"]')?.textContent).toBe('Zoom')
    host.remove()
  })

  it('uses the label attribute as shadow fallback content when nothing is slotted', () => {
    const host = document.createElement(VIGIL_STAT_TAG)
    host.setAttribute('label', 'Zoom')
    document.body.append(host)

    const fallback = shadowOf(host).querySelector('slot[name="label"]')
    expect(fallback?.textContent).toBe('Zoom')

    // Reacting to the attribute is why it is declared as observed.
    host.label = 'Scale'
    expect(fallback?.textContent).toBe('Scale')
    host.remove()
  })

  it('collapses the label box when there is no label at all', () => {
    const host = connected(null)
    expect(host.hasAttribute('label-less')).toBe(true)

    host.label = 'Zoom'
    expect(host.hasAttribute('label-less')).toBe(false)

    host.label = ''
    expect(host.hasAttribute('label-less')).toBe(true)
    host.remove()
  })

  it('reflects tone to an attribute and falls back on unknown values', () => {
    const host = document.createElement(VIGIL_STAT_TAG)

    expect(host.tone).toBe('neutral')
    host.tone = 'danger'
    expect(host.getAttribute('tone')).toBe('danger')

    host.setAttribute('tone', 'chartreuse')
    expect(host.tone).toBe('neutral')
  })

  it('toggles the emphasis attribute from its property', () => {
    const host = document.createElement(VIGIL_STAT_TAG)

    expect(host.emphasis).toBe(false)
    host.emphasis = true
    expect(host.hasAttribute('emphasis')).toBe(true)
    host.emphasis = false
    expect(host.hasAttribute('emphasis')).toBe(false)
  })

  it('survives a move in the DOM without attaching a second shadow root', () => {
    const host = connected('Zoom')
    const shadow = shadowOf(host)

    host.remove()
    document.body.append(host)

    expect(shadowOf(host)).toBe(shadow)
    expect(shadowOf(host).querySelectorAll('[part]')).toHaveLength(2)
    host.remove()
  })
})
