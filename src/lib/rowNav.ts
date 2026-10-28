import type { MouseEvent } from "react"

// CHANGED: a table row can't be a real link, so the browser won't open it in a new
// tab by itself. This mimics link behaviour: Cmd/Ctrl+click or middle-click opens a
// new tab, a plain click navigates in the same tab.
export function isNewTabClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.button === 1
}

// CHANGED: the Next router (useRouter()), passed in by the page
type RowRouter = { push: (href: string) => void; prefetch: (href: string) => void }

// CHANGED: a plain click was `window.location.href = href` — a FULL page reload: the old
// page sat there frozen for seconds (no loading skeleton, all the app's code downloaded
// again, Clerk re-checked the login), so it looked like the click did nothing. It is now
// router.push, an in-app navigation: the (dashboard) loading skeleton shows at once.
export function navigateRow(e: MouseEvent, href: string, router: RowRouter) {
  // CHANGED: if the user just drag-selected text in the row (e.g. a phone number or
  // address to copy), the mouse-up counts as a row click — don't open the event then.
  if (window.getSelection()?.toString()) return
  if (isNewTabClick(e)) window.open(href, "_blank")
  else router.push(href)
}

// CHANGED: on mouse-over, fetch the event page's code + loading skeleton ahead of the
// click (Next's default "auto" prefetch). Deliberately NOT a full prefetch — that would
// run the event's DB queries for every row the mouse passes over.
export function prefetchRow(href: string, router: RowRouter) {
  router.prefetch(href)
}

// Put on a real link inside a clickable row so the click isn't handled twice
// (once by the link, once again by the row).
export const stopRowClick = {
  onClick: (e: MouseEvent) => e.stopPropagation(),
  onAuxClick: (e: MouseEvent) => e.stopPropagation(),
}
