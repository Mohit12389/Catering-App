"use client"

import { useState, useMemo } from "react"
import { 
  LayoutList, 
  Calendar, 
  Users, 
  ChevronDown,
  ChevronRight,
  ChefHat,
  Package,
  Search
} from "lucide-react"
import { Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui"
import { Card, Loading, EmptyState, Badge } from "@/components/shared"
import { useSWRFetch } from "@/hooks/useSWRFetch"
import type { Event, ItemCategory } from "@/types"
import { formatDate, cn } from "@/lib/utils"

interface CategoryGroup {
  categoryId: string
  categoryName: string
  events: {
    event: Event
    items: string[]
  }[]
}

export default function CategoryMenuPage() {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [expandedCategories, setExpandedCategories] = useState<string[]>([])

  const { data: events = [], isLoading: loadingEvents } = useSWRFetch<Event[]>('/api/events?status=active')
  const { data: itemCategories = [], isLoading: loadingCategories } = useSWRFetch<ItemCategory[]>('/api/categories/items')

  // Group events by menu item category
  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups: Record<string, CategoryGroup> = {}

    events.forEach(event => {
      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase()
        if (!event.organizerName.toLowerCase().includes(searchLower) &&
            !event.eventId.toLowerCase().includes(searchLower) &&
            !event.location.toLowerCase().includes(searchLower)) {
          return
        }
      }

      // Group by each category the event's items belong to
      const eventItemsByCategory: Record<string, string[]> = {}

      event.eventItems?.forEach(ei => {
        const catId = ei.item?.category?.id || "uncategorized"
        const catName = ei.item?.category?.name || "Other"
        
        if (!eventItemsByCategory[catId]) {
          eventItemsByCategory[catId] = []
        }
        eventItemsByCategory[catId].push(ei.item?.name || "Unknown")

        if (!groups[catId]) {
          groups[catId] = {
            categoryId: catId,
            categoryName: catName,
            events: []
          }
        }
      })

      // Add event to each category it belongs to
      Object.entries(eventItemsByCategory).forEach(([catId, items]) => {
        if (groups[catId]) {
          // Check if event is already added
          const existing = groups[catId].events.find(e => e.event.id === event.id)
          if (!existing) {
            groups[catId].events.push({ event, items })
          }
        }
      })
    })

    // Filter by selected category
    let result = Object.values(groups)
    if (selectedCategory !== "all") {
      result = result.filter(g => g.categoryId === selectedCategory)
    }

    // Sort by category name and events by date
    result.sort((a, b) => a.categoryName.localeCompare(b.categoryName))
    result.forEach(group => {
      group.events.sort((a, b) => 
        new Date(a.event.functionDate).getTime() - new Date(b.event.functionDate).getTime()
      )
    })

    return result
  }, [events, search, selectedCategory])

  const toggleCategory = (catId: string) => {
    setExpandedCategories(prev => 
      prev.includes(catId) 
        ? prev.filter(id => id !== catId)
        : [...prev, catId]
    )
  }

  const totalEvents = categoryGroups.reduce((sum, g) => sum + g.events.length, 0)

  if (loadingEvents || loadingCategories) return <Loading text="Loading..." />

  return (
    <div className="space-y-6 animate-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2">
            <LayoutList className="w-8 h-8 text-primary" />
            Category Menu / श्रेणी मेन्यू
          </h1>
          <p className="text-muted-foreground mt-1">
            View events grouped by menu item categories
          </p>
        </div>
        
        <div className="flex gap-3">
          <div className="relative w-full sm:w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {itemCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total Categories</div>
          <div className="text-2xl font-bold text-primary">{categoryGroups.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Active Events</div>
          <div className="text-2xl font-bold text-secondary">{events.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Filtered Events</div>
          <div className="text-2xl font-bold">{totalEvents}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Menu Categories</div>
          <div className="text-2xl font-bold text-primary">{itemCategories.length}</div>
        </Card>
      </div>

      {/* Category Groups */}
      {categoryGroups.length === 0 ? (
        <EmptyState
          icon={LayoutList}
          title="No events found"
          description={search ? "Try a different search term" : "Create an event to see it here"}
        />
      ) : (
        <div className="space-y-4">
          {categoryGroups.map(group => (
            <Card key={group.categoryId} className="overflow-hidden">
              {/* Category Header */}
              <div 
                className="p-4 bg-muted/50 cursor-pointer flex items-center justify-between"
                onClick={() => toggleCategory(group.categoryId)}
              >
                <div className="flex items-center gap-3">
                  {expandedCategories.includes(group.categoryId) ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  <ChefHat className="w-5 h-5 text-primary" />
                  <h2 className="text-lg font-semibold">{group.categoryName}</h2>
                  <Badge variant="primary">{group.events.length} events</Badge>
                </div>
              </div>

              {/* Events List */}
              {expandedCategories.includes(group.categoryId) && (
                <div className="divide-y">
                  {group.events.map(({ event, items }) => (
                    <div key={event.id} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="font-mono text-xs">{event.eventId}</Badge>
                            <span className="font-semibold">{event.organizerName}</span>
                          </div>
                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {formatDate(event.functionDate)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-4 h-4" />
                              {event.guestCount} Guests
                            </span>
                          </div>
                        </div>
                        
                        {/* Items from this category */}
                        <div className="flex flex-wrap gap-1">
                          {items.map((itemName, idx) => (
                            <span 
                              key={idx}
                              className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full"
                            >
                              {itemName}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Legend */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Package className="w-4 h-4" />
          How to Use / उपयोग कैसे करें
        </h3>
        <ul className="text-sm text-muted-foreground space-y-1">
          <li>• Click on a category header to expand/collapse events</li>
          <li>• Use the dropdown to filter by specific category</li>
          <li>• Search by organizer name, event ID, or location</li>
          <li>• Events appear in multiple categories if they have items from different categories</li>
        </ul>
      </Card>
    </div>
  )
}
