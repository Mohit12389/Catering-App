"use client"

import { useState, useRef, useEffect } from "react"
import { Download, Printer, FileText, FileSpreadsheet, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui"

// =============================================
// DOWNLOAD DROPDOWN MENU
// =============================================
// Consolidates all export options into one dropdown button.
// Pass an array of options; each has a label, icon, and onClick.

interface DownloadOption {
  label: string
  icon: "print" | "word" | "excel"
  onClick: () => void
}

export function DownloadDropdown({ options }: { options: DownloadOption[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [])

  const iconFor = (type: string) => {
    if (type === "print") return <Printer className="w-4 h-4" />
    if (type === "word") return <FileText className="w-4 h-4 text-blue-600" />
    if (type === "excel") return <FileSpreadsheet className="w-4 h-4 text-green-600" />
    return <Download className="w-4 h-4" />
  }

  return (
    <div className="relative" ref={ref}>
      <Button variant="outline" onClick={() => setOpen(!open)}>
        <Download className="w-4 h-4 mr-2" />
        Download
        <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${open ? "rotate-180" : ""}`} />
      </Button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-900 border rounded-lg shadow-lg z-50 py-1 animate-in fade-in slide-in-from-top-2">
          {options.map((opt, idx) => (
            <button
              key={idx}
              onClick={() => { opt.onClick(); setOpen(false) }}
              className="w-full px-4 py-2.5 text-left text-sm hover:bg-muted/50 flex items-center gap-3 transition-colors"
            >
              {iconFor(opt.icon)}
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}