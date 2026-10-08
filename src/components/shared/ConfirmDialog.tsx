"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { AlertTriangle, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui"
// CHANGED: built on Radix Dialog so it stacks correctly ON TOP of another Radix dialog.
// The old hand-made overlay got its clicks blocked by the open dialog underneath, so
// "Delete" fell through to whatever was behind it (e.g. the Record Payment dialog).
import * as DialogPrimitive from "@radix-ui/react-dialog"

// =============================================
// REUSABLE CONFIRM DIALOG
// =============================================
// Usage:
//   const confirm = useConfirm()
//   const ok = await confirm({ title: "Delete item?", description: "This cannot be undone." })
//   if (!ok) return
//
// Wrap the app (or dashboard layout) once with <ConfirmProvider>.

interface ConfirmOptions {
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "default"
}

interface ConfirmContextValue {
  confirm: (options?: ConfirmOptions) => Promise<boolean>
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [options, setOptions] = useState<ConfirmOptions>({})
  // Holds the resolve function of the current confirm() promise
  const [resolver, setResolver] = useState<{ resolve: (v: boolean) => void } | null>(null)

  const confirm = useCallback((opts: ConfirmOptions = {}) => {
    setOptions(opts)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      setResolver({ resolve })
    })
  }, [])

  const handleClose = (result: boolean) => {
    setOpen(false)
    resolver?.resolve(result)
    setResolver(null)
  }

  const isDanger = options.variant !== "default" // default to danger styling for deletes

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {/* CHANGED: Radix Root/Portal/Overlay/Content replace the plain divs. Clicking the
          backdrop or pressing Esc cancels (onOpenChange). The inside is unchanged. */}
      <DialogPrimitive.Root open={open} onOpenChange={o => { if (!o) handleClose(false) }}>
        <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
          {/* Dialog */}
          <DialogPrimitive.Content
            className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95"
            // No description → tell Radix explicitly, or it logs a console warning.
            {...(options.description ? {} : { "aria-describedby": undefined })}
          >
            {/* Close X */}
            <button
              onClick={() => handleClose(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Icon + Title */}
            <div className="flex items-start gap-4">
              <div
                className={
                  isDanger
                    ? "w-12 h-12 rounded-full bg-red-100 flex items-center justify-center shrink-0"
                    : "w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0"
                }
              >
                {isDanger ? (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-primary" />
                )}
              </div>
              <div className="flex-1 pt-1">
                {/* CHANGED: Radix Title/Description (same tags and styles) for screen readers */}
                <DialogPrimitive.Title className="text-lg font-semibold">
                  {options.title || "Are you sure?"}
                </DialogPrimitive.Title>
                {options.description && (
                  <DialogPrimitive.Description className="text-sm text-muted-foreground mt-1">
                    {options.description}
                  </DialogPrimitive.Description>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => handleClose(false)}>
                {options.cancelText || "Cancel"}
              </Button>
              <Button
                variant={isDanger ? "destructive" : "primary"} // CHANGED: - needless `as any`
                onClick={() => handleClose(true)}
              >
                {isDanger && <Trash2 className="w-4 h-4 mr-2" />}
                {options.confirmText || "Delete"}
              </Button>
            </div>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </ConfirmContext.Provider>
  )
}

// Hook to trigger a confirmation from anywhere
export function useConfirm() {
  const ctx = useContext(ConfirmContext)
  if (!ctx) {
    throw new Error("useConfirm must be used within a ConfirmProvider")
  }
  return ctx.confirm
}