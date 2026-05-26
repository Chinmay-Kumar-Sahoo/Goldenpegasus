import Link from 'next/link'
import BrandLogo from '@/components/BrandLogo'


export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-[#2a2a2a] bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <BrandLogo href="/" size="md" subtitle="IT Consulting & Services LLC" />
          <div className="hidden md:flex items-center gap-8">
            
            <a href="#features" className="text-sm text-[#a1a1aa] hover:text-[#22c55e] transition-colors">Features</a>
            <a href="#about" className="text-sm text-[#a1a1aa] hover:text-[#22c55e] transition-colors">About</a>
            <a href="#security" className="text-sm text-[#a1a1aa] hover:text-[#22c55e] transition-colors">Security</a>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/admin-login" className="hidden sm:block text-xs bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20">
              Admin Login
            </Link>
            <Link href="/login" className="text-xs bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20">
              Employee Login
            </Link>
            <Link href="/signup" className="text-xs border border-[#2a2a2a] hover:border-[#3a3a3a] text-white font-semibold px-4 py-2 rounded-lg transition-all duration-200 ml-1">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section
        className="pt-32 pb-20 px-6 text-center relative bg-cover bg-center"
        style={{ backgroundImage: "linear-gradient(180deg, rgba(10,10,10,.42), #0a0a0a 88%), url('/golden-pegasus-landing-bg.svg')" }}
      >
        <div className="max-w-5xl mx-auto relative">
          <div className="inline-flex items-center gap-2 bg-[#1a1a1a] border border-[#2a2a2a] rounded-full px-4 py-1.5 text-xs text-[#22c55e] font-medium mb-8">
            <span className="w-1.5 h-1.5 bg-[#22c55e] rounded-full animate-pulse" />
            Secure Role-Based Database Management
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            <span className="text-white">Manage Your Data</span>
            <br />
            <span className="text-[#22c55e]">Without Limits</span>
          </h1>

          <p className="text-lg text-[#a1a1aa] max-w-2xl mx-auto mb-10 leading-relaxed">
            GoldenPegasus IT Consulting & Services LLC provides a powerful, secure SaaS platform to centralize employee, marketing, and client data with real-time collaboration and fine-grained access control.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-8 py-4 rounded-xl text-base transition-all duration-200 hover:shadow-xl hover:shadow-green-500/25 hover:-translate-y-0.5">
              Start Free Trial →
            </Link>
            <Link href="#features" className="border border-[#2a2a2a] hover:border-[#3a3a3a] text-white font-semibold px-8 py-4 rounded-xl text-base transition-all duration-200 hover:bg-[#1a1a1a]">
              View Features
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 px-6 border-y border-[#2a2a2a]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: 'Role-Based', label: 'Access Control' },
            { value: 'Real-Time', label: 'Sync & Updates' },
            { value: 'Dynamic', label: 'Table Builder' },
            { value: 'Supabase', label: 'Powered Backend' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-2xl font-bold text-[#22c55e] mb-1">{stat.value}</div>
              <div className="text-sm text-[#71717a]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>



      {/* Features Section */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Everything your team needs</h2>
            <p className="text-[#a1a1aa] max-w-xl mx-auto">A complete data management ecosystem built for modern IT organizations.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature) => (
              <div
                key={feature.title}
                className="group bg-[#111111] border border-[#2a2a2a] rounded-2xl p-6 hover:border-[#22c55e]/30 hover:bg-[#1a1a1a] transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-[#22c55e]/10 rounded-xl flex items-center justify-center text-2xl mb-4 group-hover:bg-[#22c55e]/20 transition-colors">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-sm text-[#71717a] leading-relaxed">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 bg-[#111111] border-y border-[#2a2a2a]">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">Built for IT Consulting Teams</h2>
          <p className="text-[#a1a1aa] text-lg leading-relaxed mb-8">
            GoldenPegasus IT Consulting & Services LLC designed this platform for teams that need structure, security, and flexibility. With Admin and Employee roles, every team member sees exactly what they need — nothing more, nothing less.
          </p>
          <div className="grid sm:grid-cols-2 gap-6 text-left">
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <div className="text-[#22c55e] font-bold text-lg mb-2">🔑 Admin Role</div>
              <ul className="text-sm text-[#a1a1aa] space-y-2">
                <li>• Full system visibility and control</li>
                <li>• Create and manage dynamic tables</li>
                <li>• Assign permissions to employees</li>
                <li>• Audit log access</li>
              </ul>
            </div>
            <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-6">
              <div className="text-[#22c55e] font-bold text-lg mb-2">👤 Employee Role</div>
              <ul className="text-sm text-[#a1a1aa] space-y-2">
                <li>• View global marketing data (read-only)</li>
                <li>• Full CRUD on own records</li>
                <li>• Create private/custom tables</li>
                <li>• Share tables with teammates</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Security Section */}
      <section id="security" className="py-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Enterprise-Grade Security</h2>
          <p className="text-[#a1a1aa] mb-12">Your data is protected at every layer.</p>
          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {security.map((item) => (
              <div key={item.title} className="bg-[#111111] border border-[#2a2a2a] rounded-xl p-5 text-left">
                <div className="text-xl mb-3">{item.icon}</div>
                <div className="font-semibold text-white text-sm mb-1">{item.title}</div>
                <div className="text-xs text-[#71717a] leading-relaxed">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-6 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-[#22c55e]/5 to-transparent pointer-events-none" />
        <div className="max-w-3xl mx-auto relative">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to get started?</h2>
          <p className="text-[#a1a1aa] mb-10 text-lg">Join GoldenPegasus and take control of your organizational data today.</p>
          <Link href="/signup" className="inline-block bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-10 py-4 rounded-xl text-lg transition-all duration-200 hover:shadow-2xl hover:shadow-green-500/30 hover:-translate-y-1">
            Create Your Account
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#2a2a2a] py-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BrandLogo href="/" variant="mark" size="sm" />
            <span className="text-sm text-[#71717a]">© 2025 GoldenPegasus IT Consulting & Services LLC. All rights reserved.</span>
          </div>
          <div className="flex gap-6 text-sm text-[#71717a]">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </main>
  )
}

const features = [
  { icon: '🏗️', title: 'Dynamic Table Builder', description: 'Admins and employees can create custom tables with any schema — no developer required. Define fields, types, and labels on the fly.' },
  { icon: '🔐', title: 'Role-Based Access Control', description: 'Strict separation between Admin and Employee roles. Row-level security ensures users only access what they\'re authorized to see.' },
  { icon: '⚡', title: 'Real-Time Sync', description: 'Powered by Supabase Realtime. When admins grant access or data changes, dashboards update instantly without refresh.' },
  { icon: '📊', title: 'Global Marketing View', description: 'All employees can view consolidated marketing data across the organization in read-only mode for better coordination.' },
  { icon: '🤝', title: 'Collaborative Sharing', description: 'Share your custom tables with teammates or admins with fine-grained View or Edit permissions. Tables appear instantly on recipient dashboards.' },
  { icon: '📤', title: 'CSV & Excel Export', description: 'Export any dataset to CSV or Excel format. Paginated views and advanced filters keep large datasets manageable.' },
]

const security = [
  { icon: '🛡️', title: 'Row-Level Security', desc: 'Supabase RLS policies ensure strict data isolation at the database level.' },
  { icon: '🔑', title: 'JWT Authentication', desc: 'Secure session management with time-limited tokens and automatic refresh.' },
  { icon: '🔒', title: 'Encrypted Passwords', desc: 'All passwords are hashed and encrypted — never stored in plain text.' },
  { icon: '🚫', title: 'XSS & SQL Injection Protection', desc: 'All inputs are validated and sanitized before reaching the database.' },
  { icon: '📧', title: 'Secure Password Reset', desc: 'Time-limited email tokens for password recovery, auto-invalidated after use.' },
  { icon: '📋', title: 'Audit Logs', desc: 'Every admin action is logged with user, timestamp, and metadata for compliance.' },
]
