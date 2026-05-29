export default function DashboardLoading() {
  return (
    <div>
      <div className="mb-8">
        <div className="skeleton h-7 w-48 mb-2" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-5">
            <div className="skeleton h-8 w-8 mb-3" />
            <div className="skeleton h-8 w-16 mb-1" />
            <div className="skeleton h-4 w-32" />
          </div>
        ))}
      </div>
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6">
        <div className="skeleton h-5 w-24 mb-4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full mb-2" />
        ))}
      </div>
    </div>
  )
}
