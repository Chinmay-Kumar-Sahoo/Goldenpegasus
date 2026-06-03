import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

export default function HomePage() {
  return (
    <main className="h-screen bg-[#0a0a0a] text-white flex flex-col">
      <nav className="shrink-0 border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <BrandLogo href="/" size="md" subtitle="IT Consulting & Services LLC" />
          <div className="flex items-center gap-2">
            <Link href="/admin-login" className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg transition-all duration-200">
              Admin Login
            </Link>
            <Link href="/login" className="text-xs bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-lg transition-all duration-200">
              Employee Login
            </Link>
            <Link href="/signup" className="text-xs border border-[#2a2a2a] hover:border-[#3a3a3a] text-white font-semibold px-4 py-2 rounded-lg transition-all duration-200 ml-1">
              Get Started
            </Link>
          </div>
        </div>
      </nav>
      <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
        <BrandLogo variant="lockup" size="lg" subtitle="IT Consulting & Services LLC" />
      </div>
    </main>
  )
}
