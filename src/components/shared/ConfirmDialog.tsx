"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"
import { AlertTriangle, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui"

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

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 animate-in fade-in"
            onClick={() => handleClose(false)}
          />

          {/* Dialog */}
          <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md p-6 animate-in zoom-in-95">
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
                <h2 className="text-lg font-semibold">
                  {options.title || "Are you sure?"}
                </h2>
                {options.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {options.description}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 mt-6">
              <Button variant="outline" onClick={() => handleClose(false)}>
                {options.cancelText || "Cancel"}
              </Button>
              <Button
                variant={isDanger ? "destructive" : "primary" as any}
                onClick={() => handleClose(true)}
              >
                {isDanger && <Trash2 className="w-4 h-4 mr-2" />}
                {options.confirmText || "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
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