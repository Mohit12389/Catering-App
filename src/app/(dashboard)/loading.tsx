export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title */}
      <div>
        <div className="h-8 bg-muted rounded w-56" />
        <div className="h-4 bg-muted rounded w-80 mt-2" />
      </div>

      {/* Two column grid skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="h-5 bg-muted rounded w-32" />
              <div className="h-8 bg-muted rounded w-16" />
            </div>
            <div className="h-3 bg-muted rounded w-full" />
            <div className="space-y-2">
              {[...Array(3)].map((_, j) => (
                <div key={j} className="h-10 bg-muted/60 rounded" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}