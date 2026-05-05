'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface SearchResult {
  id: string
  type: 'marketing' | 'employee' | 'client' | 'admin'
  title: string
  subtitle: string
  meta: string
  status?: string | null
}

const TYPE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  marketing: { label: 'Marketing', icon: '📈', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
  employee:  { label: 'Employee',  icon: '👤', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  client:    { label: 'Client',    icon: '🤝', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  admin:     { label: 'Admin',     icon: '🔑', color: 'bg-red-500/10 text-red-400 border-red-500/20' },
}

const STATUS_COLORS: Record<string, string> = {
  active:    'bg-green-500/10 text-green-400 border-green-500/20',
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  completed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  closed:    'bg-red-500/10 text-red-400 border-red-500/20',
  inactive:  'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  prospect:  'bg-orange-500/10 text-orange-400 border-orange-500/20',
}

export default function PublicSearch() {
  const [query, setQuery] = useState('')
  const [type, setType] = useState('all')
  const [status, setStatus] = useState('all')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [total, setTotal] = useState(0)
  const [message, setMessage] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string, t: string, s: string) => {
    if (q.trim().length === 0) {
      setResults([])
      setTotal(0)
      setMessage('')
      setSearched(false)
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ q, type: t, status: s })
      const res = await fetch(`/api/search?${params}`)
      const json = await res.json()
      setResults(json.results || [])
      setTotal(json.count || 0)
      setMessage(json.message || '')
      setSearched(q.length > 0)
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // Removed 1 char restriction so any input triggers search
    
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      doSearch(query, type, status)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, type, status, doSearch])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceRef.current) clearTimeout(debounceRef.current)
    doSearch(query, type, status)
  }

  return (
    <section className="py-20 px-6 relative" id="search">
      <div className="absolute inset-0 bg-gradient-to-b from-[#0a0a0a] via-[#111111] to-[#0a0a0a] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-1.5 text-xs text-[#22c55e] font-medium mb-4">
            <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full" />
            Public Database Search
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">
            Search Our <span className="text-[#22c55e]">Database</span>
          </h2>
          <p className="text-[#71717a] text-base max-w-xl mx-auto">
            Search across marketing records, employees, and clients by name, email, company name, or project details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative group">
            <div className="absolute inset-0 bg-[#22c55e]/10 rounded-2xl blur-xl opacity-0 group-focus-within:opacity-100 transition-all duration-500 pointer-events-none" />
            <div className="relative flex items-center bg-[#111111] border border-[#2a2a2a] group-focus-within:border-[#22c55e]/50 rounded-2xl overflow-hidden transition-all duration-300 shadow-2xl">
              <div className="pl-5 pr-3 flex-shrink-0">
                {loading ? (
                  <div className="w-5 h-5 border-2 border-[#22c55e]/30 border-t-[#22c55e] rounded-full animate-spin" />
                ) : (
                  <svg className="w-5 h-5 text-[#71717a] group-focus-within:text-[#22c55e] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                )}
              </div>

              <input
                id="public-search-input"
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, email, company, project name..."
                autoComplete="off"
                suppressHydrationWarning={true}
                className="flex-1 bg-transparent py-5 pr-4 text-white placeholder-[#3a3a3a] focus:outline-none text-base"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => { setQuery(''); doSearch('', type, status) }}
                  className="px-4 text-[#71717a] hover:text-white transition-colors flex-shrink-0"
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}

              <button
                type="submit"
                className="m-2 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-6 py-3 rounded-xl text-sm transition-all duration-200 flex-shrink-0 hover:shadow-lg hover:shadow-green-500/20"
              >
                Search
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1 bg-[#111111] border border-[#2a2a2a] rounded-xl p-1">
              {[
                { value: 'all',               label: 'All',       icon: '🔍' },
                { value: 'marketing_records', label: 'Marketing', icon: '📈' },
                { value: 'employees',         label: 'Employees', icon: '👥' },
                { value: 'client_records',    label: 'Clients',   icon: '🤝' },
              ].map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                    type === opt.value
                      ? 'bg-[#22c55e] text-black'
                      : 'text-[#71717a] hover:text-white hover:bg-[#1a1a1a]'
                  }`}
                >
                  <span>{opt.icon}</span>
                  <span className="hidden sm:inline">{opt.label}</span>
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-sm text-[#71717a]">
              <span className="text-xs">Status:</span>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="bg-[#111111] border border-[#2a2a2a] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#22c55e]/50 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="pending">Pending</option>
                <option value="completed">Completed</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            {searched && (
              <div className="text-xs text-[#71717a] ml-auto">
                <span className="text-white font-medium">{total}</span> result{total !== 1 ? 's' : ''} for &quot;<span className="text-[#22c55e]">{query}</span>&quot;
              </div>
            )}
          </div>
        </form>

        <div className="mt-6 space-y-3 animate-fade-in-up">
          {results.length === 0 && searched ? (
            <div className="bg-[#111111] border border-[#2a2a2a] rounded-2xl p-10 text-center">
              <div className="text-4xl mb-3">🔎</div>
              <div className="text-white font-medium mb-1">No results found</div>
              <div className="text-sm text-[#71717a]">Try a different search term or adjust your filters.</div>
            </div>
          ) : (
            results.map((result) => {
              const typeInfo = TYPE_LABELS[result.type] || TYPE_LABELS.marketing
              return (
                <div
                  key={`${result.type}-${result.id}`}
                  className="group bg-[#111111] border border-[#2a2a2a] hover:border-[#22c55e]/30 rounded-2xl p-4 transition-all duration-200 hover:bg-[#1a1a1a] hover:-translate-y-0.5 flex items-center gap-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#1a1a1a] group-hover:bg-[#222222] flex items-center justify-center text-lg flex-shrink-0 transition-colors border border-[#2a2a2a]">
                    {typeInfo.icon}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <span className="font-semibold text-white text-sm">{result.title}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${typeInfo.color}`}>
                        {typeInfo.label}
                      </span>
                      {result.status && result.status !== 'active' && (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${STATUS_COLORS[result.status] || STATUS_COLORS.active}`}>
                          {result.status}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[#71717a] truncate">{result.subtitle}</div>
                  </div>

                  <div className="text-xs text-[#3a3a3a] group-hover:text-[#71717a] transition-colors flex-shrink-0 hidden sm:block">
                    {result.meta}
                  </div>

                  <div className="text-[#2a2a2a] group-hover:text-[#22c55e] transition-colors flex-shrink-0 text-sm">→</div>
                </div>
              )
            })
          )}

          {/* Results hint / Login CTA */}
          {(results.length > 0 || message) && (
            <div className="bg-gradient-to-r from-[#22c55e]/5 via-[#1a1a1a] to-[#22c55e]/5 border border-[#22c55e]/20 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm text-white font-medium">{message || "Want to see full details?"}</div>
                <div className="text-xs text-[#71717a]">Sign in to access complete records and manage your data.</div>
              </div>
              <a href="/login" className="flex-shrink-0 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-xs transition-all hover:shadow-lg hover:shadow-green-500/20">
                Sign In →
              </a>
            </div>
          )}
        </div>

        {/* Quick search tips */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { icon: '👥', text: 'Employees', value: 'employees' },
            { icon: '📈', text: 'Marketing', value: 'marketing_records' },
            { icon: '🤝', text: 'Clients', value: 'client_records' },
            { icon: '🔍', text: 'All Data', value: 'all' },
          ].map(tip => (
            <button
              key={tip.text}
              type="button"
              onClick={() => { setType(tip.value); setQuery(''); }}
              className={`bg-[#111111] border rounded-xl p-3 text-center transition-all duration-200 group cursor-pointer ${
                type === tip.value ? 'border-[#22c55e] bg-[#1a1a1a]' : 'border-[#2a2a2a] hover:border-[#22c55e]/30 hover:bg-[#1a1a1a]'
              }`}
            >
              <div className="text-2xl mb-1.5">{tip.icon}</div>
              <div className={`text-xs transition-colors ${type === tip.value ? 'text-[#22c55e]' : 'text-[#71717a] group-hover:text-[#a1a1aa]'}`}>{tip.text}</div>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
