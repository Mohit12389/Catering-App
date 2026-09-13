// =============================================
// INGREDIENT UNITS
// =============================================
// CHANGED: moved out of customize-inventory/page.tsx so the extracted dialogs can
// share the one list. The Hindi labels are part of the product — the operator reads
// them, not the English — so they must stay exactly as written.

export const UNITS = [
  { value: "Kg", label: "Kg (किलोग्राम)" },
  { value: "g", label: "g (ग्राम)" },
  { value: "L", label: "L (लीटर)" },
  { value: "ml", label: "ml (मिलीलीटर)" },
  { value: "pcs", label: "pcs (पीस)" },
  { value: "Nos", label: "Nos (संख्या)" },
  { value: "dozen", label: "dozen (दर्जन)" },
  { value: "pkt", label: "pkt (पैकेट)" },
  { value: "Tin", label: "Tin (टिन)" },
  { value: "Can", label: "Can (कैन)" },
  { value: "Bottle", label: "Bottle (बोतल)" },
  { value: "Dibbi", label: "Dibbi (डिब्बी)" },
  { value: "Meter", label: "Meter (मीटर)" },
  { value: "Dibba", label: "Dibba (डिब्बा)" }
]
