import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'

export default function HomePage() {
  return (
    <main className="h-full bg-[#0a0a0a] text-white flex flex-col relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <img src="/golden-pegasus-mark.svg" alt="" loading="lazy" fetchPriority="low" className="w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] object-contain opacity-[0.04]" />
      </div>
      <nav className="relative shrink-0 border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-md z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <BrandLogo href="/" size="md" subtitle="IT Consulting & Services LLC" />
          <div className="flex items-center gap-2">
            <Link href="/admin-login" className="text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg transition-all duration-200">
              Admin Login
            </Link>
            <Link href="/login" className="text-xs bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-lg transition-all duration-200">
              Employee Login
            </Link>
          </div>
        </div>
      </nav>
      <div className="relative flex-1 flex flex-col items-center justify-center gap-8 px-6 z-10">
        <div className="flex flex-col items-center gap-4 scale-150 sm:scale-[2] md:scale-[2.5] lg:scale-[3] origin-center">
          <BrandLogo variant="lockup" size="lg" subtitle="IT Consulting & Services LLC" />
        </div>
      </div>
    </main>
  )
}
