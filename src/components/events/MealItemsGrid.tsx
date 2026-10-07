"use client"

// CHANGED: new component — one meal's menu items on the event history page, in the
// SAME 4-column, top-to-bottom layout as the printed menu, so the order you see is the
// order that prints. With `arranging` on, items can be dragged to a new place.
//
// Each meal gets its own grid (its own drag area), so an item can only move inside
// its own meal — never into another meal. The server checks this too (item-order route).

import { useEffect, useState } from "react"
import { ChefHat, GripVertical, Save, X } from "lucide-react"
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent
} from "@dnd-kit/core"
import {
  SortableContext, arrayMove, rectSortingStrategy,
  sortableKeyboardCoordinates, useSortable
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui"

interface GridItem {
  id: string  // EventItem id
  name: string
}

interface MealItemsGridProps {
  items: GridItem[]
  iconClassName?: string
  arranging: boolean
  saving?: boolean
  /** Called with this meal's EventItem ids in the new order. */
  onSave: (orderedIds: string[]) => void
  onCancel: () => void
}

// Column-first fill, exactly like the print grid: rows = ceil(n / 4)
function gridStyle(count: number): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gridAutoFlow: "column",
    gridTemplateRows: `repeat(${Math.max(1, Math.ceil(count / 4))}, auto)`,
    gap: "0.5rem"
  }
}

function SortableCard({ item, iconClassName, arranging }: { item: GridItem; iconClassName?: string; arranging: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, disabled: !arranging })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 10 : undefined,
        // stop the page scrolling under your finger while dragging on a phone
        touchAction: arranging ? "none" : undefined
      }}
      className={
        "flex items-center gap-1.5 p-2 bg-muted/30 rounded-lg border text-sm min-w-0 " +
        (arranging ? "cursor-grab active:cursor-grabbing border-dashed border-primary/50 bg-background select-none " : "") +
        (isDragging ? "shadow-lg opacity-90" : "")
      }
      {...(arranging ? attributes : {})}
      {...(arranging ? listeners : {})}
    >
      {arranging
        ? <GripVertical className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        : <ChefHat className={`w-3.5 h-3.5 shrink-0 ${iconClassName || ""}`} />}
      {/* names wrap instead of being cut off */}
      <span className="font-medium break-words min-w-0">{item.name}</span>
    </div>
  )
}

export function MealItemsGrid({ items, iconClassName, arranging, saving, onSave, onCancel }: MealItemsGridProps) {
  // Local working copy while arranging; reset to the saved order whenever it changes
  // or arranging is turned off (Cancel).
  const [order, setOrder] = useState<GridItem[]>(items)
  useEffect(() => { setOrder(items) }, [items, arranging])

  const sensors = useSensors(
    // small movement threshold so a plain click doesn't start a drag
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    // short press on touch screens, so a swipe still scrolls the page
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    setOrder(prev => {
      const from = prev.findIndex(i => i.id === active.id)
      const to = prev.findIndex(i => i.id === over.id)
      return arrayMove(prev, from, to)
    })
  }

  const shown = arranging ? order : items
  const changed = order.some((it, i) => it.id !== items[i]?.id)

  return (
    <div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={shown.map(i => i.id)} strategy={rectSortingStrategy}>
          <div style={gridStyle(shown.length)}>
            {shown.map(item => (
              <SortableCard key={item.id} item={item} iconClassName={iconClassName} arranging={arranging} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {arranging && (
        <div className="flex items-center justify-end gap-2 mt-2">
          <span className="text-xs text-muted-foreground mr-auto">
            Drag items to change their order / आइटम खींचकर क्रम बदलें
          </span>
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            <X className="w-3.5 h-3.5 mr-1" />Cancel
          </Button>
          <Button size="sm" onClick={() => onSave(order.map(i => i.id))} disabled={saving || !changed}>
            <Save className="w-3.5 h-3.5 mr-1" />{saving ? "Saving..." : "Save / सेव करें"}
          </Button>
        </div>
      )}
    </div>
  )
}
