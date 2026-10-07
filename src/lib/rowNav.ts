import type { MouseEvent } from "react"

// CHANGED: a table row can't be a real link, so the browser won't open it in a new
// tab by itself. This mimics link behaviour: Cmd/Ctrl+click or middle-click opens a
// new tab, a plain click navigates in the same tab (a full page load, as before).
export function isNewTabClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.button === 1
}

export function navigateRow(e: MouseEvent, href: string) {
  // CHANGED: if the user just drag-selected text in the row (e.g. a phone number or
  // address to copy), the mouse-up counts as a row click — don't open the event then.
  if (window.getSelection()?.toString()) return
  if (isNewTabClick(e)) window.open(href, "_blank")
  else window.location.href = href
}

// Put on a real link inside a clickable row so the click isn't handled twice
// (once by the link, once again by the row).
export const stopRowClick = {
  onClick: (e: MouseEvent) => e.stopPropagation(),
  onAuxClick: (e: MouseEvent) => e.stopPropagation(),
}
