import Link from 'next/link'

export default function Footer() {
  return (
    <footer className="bg-[#111111] border-t border-[#333333] py-6">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-[#a1a1aa] text-xs">
            © {new Date().getFullYear()} GoldenPegasus IT Consulting & Services LLC. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <Link 
              href="/privacy-policy" 
              className="text-[#d4d4d8] hover:text-[#22c55e] text-xs font-medium transition-colors"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
