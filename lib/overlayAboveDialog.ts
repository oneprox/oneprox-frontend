/** z-index di atas Dialog shadcn (z-[70]) */
export const OVERLAY_ABOVE_DIALOG_Z = 10000

export function getDialogElements() {
  return {
    contents: Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="dialog-content"], [data-radix-dialog-content]'
      )
    ),
    overlays: Array.from(
      document.querySelectorAll<HTMLElement>(
        '[data-slot="dialog-overlay"], [data-radix-dialog-overlay]'
      )
    ),
  }
}

/** Nonaktifkan interaksi dialog di bawah overlay kamera/scan */
export function blockDialogsBelow(): () => void {
  const { contents, overlays } = getDialogElements()
  const preventClose = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
  }

  const elements = [...contents, ...overlays]
  for (const el of elements) {
    el.dataset.oriproPrevPointerEvents = el.style.pointerEvents
    el.style.pointerEvents = 'none'
    el.addEventListener('click', preventClose, true)
    el.addEventListener('mousedown', preventClose, true)
  }

  return () => {
    for (const el of elements) {
      el.style.pointerEvents = el.dataset.oriproPrevPointerEvents || ''
      delete el.dataset.oriproPrevPointerEvents
      el.removeEventListener('click', preventClose, true)
      el.removeEventListener('mousedown', preventClose, true)
    }
  }
}

export function createFullscreenOverlay(id?: string): HTMLDivElement {
  const el = document.createElement('div')
  if (id) el.id = id
  el.style.cssText = [
    'position: fixed',
    'inset: 0',
    'background-color: rgba(0, 0, 0, 0.9)',
    'display: flex',
    'align-items: center',
    'justify-content: center',
    `z-index: ${OVERLAY_ABOVE_DIALOG_Z}`,
    'pointer-events: auto',
  ].join('; ')
  return el
}

export function mountOverlayOnBody(overlay: HTMLElement): void {
  document.body.appendChild(overlay)
}

export function removeOverlayFromBody(overlay: HTMLElement): void {
  if (document.body.contains(overlay)) {
    document.body.removeChild(overlay)
  }
}
