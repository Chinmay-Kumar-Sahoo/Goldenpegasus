export default function MarketingLoading() {
  return (
    <div>
      <div className="mb-8">
        <div className="skeleton h-7 w-48 mb-2" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="skeleton h-10 flex-1 min-w-[200px] rounded-xl" />
        <div className="skeleton h-10 w-32 rounded-xl" />
      </div>
      <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#2a2a2a]">
                {Array.from({ length: 14 }).map((_, i) => (
                  <th key={i} className="px-4 py-3"><div className="skeleton h-3 w-16" /></th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} className="border-b border-[#1a1a1a]">
                  {Array.from({ length: 14 }).map((_, j) => (
                    <td key={j} className="px-4 py-4"><div className="skeleton h-4 w-full" /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-[#2a2a2a]">
          <div className="skeleton h-3 w-40" />
        </div>
      </div>
    </div>
  )
}
