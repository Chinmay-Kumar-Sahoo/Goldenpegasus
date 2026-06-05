export default function Loading() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <div className="shrink-0 mb-4">
        <div className="skeleton h-7 w-48 mb-2" />
        <div className="skeleton h-4 w-64 mb-6" />
      </div>
      <div className="flex-1 bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="p-4 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
