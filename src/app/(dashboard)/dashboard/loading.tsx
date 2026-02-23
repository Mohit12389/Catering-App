export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title skeleton */}
      <div>
        <div className="h-8 bg-muted rounded w-48" />
        <div className="h-4 bg-muted rounded w-72 mt-2" />
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-2">
            <div className="h-4 bg-muted rounded w-20" />
            <div className="h-7 bg-muted rounded w-28" />
          </div>
        ))}
      </div>

      {/* Content area skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-72 bg-muted rounded-lg border" />
        <div className="h-72 bg-muted rounded-lg border" />
      </div>
    </div>
  )
}