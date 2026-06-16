'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useMemo, memo } from 'react'
import BrandLogo from '@/components/BrandLogo'

interface NavItem {
  label: string
  href: string
  icon: string
}

interface SidebarProps {
  role: 'admin' | 'employee'
  userName?: string
  userEmail?: string
}

const adminNav: NavItem[] = [
  { label: 'Overview', href: '/admin', icon: '📊' },
  { label: 'Admin', href: '/admin/admins', icon: '🔑' },
  { label: 'Employees', href: '/admin/employees', icon: '👥' },
  { label: 'All Marketing Records', href: '/admin/marketing', icon: '📈' },
  { label: 'All Marketing Profiles', href: '/admin/clients', icon: '🤝' },
  { label: 'Dynamic Tables', href: '/admin/tables', icon: '🏗️' },
  { label: 'Audit Log History', href: '/admin/audit', icon: '📋' },
  { label: 'Register Admin', href: '/admin/register', icon: '➕' },
  { label: 'Personal Details', href: '/admin/profile', icon: '👤' },
]

const employeeNav: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: '🏠' },
  { label: 'Personal Details', href: '/dashboard/profile', icon: '👤' },
  { label: 'All Marketing Records', href: '/dashboard/marketing', icon: '📊' },
  { label: 'My Marketing Records', href: '/dashboard/my-marketing', icon: '📈' },
  { label: 'All Marketing Profiles', href: '/dashboard/all-marketing-profiles', icon: '🤝' },
  { label: 'My Marketing Profile', href: '/dashboard/clients', icon: '👤' },
  { label: 'My Project Records', href: '/dashboard/projects', icon: '📋' },
  { label: 'Custom Tables', href: '/dashboard/tables', icon: '🏗️' },
]

const NavItemLink = memo(function NavItemLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
        active
          ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20'
          : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a1a]'
      }`}
    >
      <span className="text-base flex-shrink-0">{item.icon}</span>
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
})

export default function Sidebar({ role, userName, userEmail }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  const nav = role === 'admin' ? adminNav : employeeNav

  const activeMap = useMemo(() => {
    const map: Record<string, boolean> = {}
    for (const item of nav) {
      if (item.href === '/admin' || item.href === '/dashboard') {
        map[item.href] = pathname === item.href
      } else {
        map[item.href] = pathname.startsWith(item.href)
      }
    }
    return map
  }, [pathname, nav])

  return (
    <aside className={`${collapsed ? 'w-16' : 'w-64'} min-h-screen bg-[#111111] border-r border-[#2a2a2a] flex flex-col transition-all duration-300 flex-shrink-0`}>
      <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
        {!collapsed && (
          <Link href="/" className="flex items-center gap-3">
            <BrandLogo variant="mark" size="md" />
            <div className="space-y-1">
              <div className="font-bold text-white text-xs leading-tight">GoldenPegasus IT Consulting & Services</div>
              <div className="text-[11px] text-[#22c55e] leading-tight font-medium truncate max-w-[140px]">{userName || role}</div>
            </div>
          </Link>
        )}
        {collapsed && (
          <BrandLogo href="/" variant="mark" size="md" className="mx-auto" />
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="text-[#71717a] hover:text-white ml-auto transition-colors p-1">
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {nav.map((item) => (
          <NavItemLink key={item.href} item={item} active={activeMap[item.href]} collapsed={collapsed} />
        ))}
      </nav>

      <div className="p-3 border-t border-[#2a2a2a]">
        {collapsed ? (
          <div className="flex flex-col items-center mb-2 gap-2">
            <div 
              title={userName || (role === 'admin' ? 'Administrator' : 'Employee')}
              className="w-8 h-8 rounded-lg bg-[#1a1a1a] border border-[#2a2a2a] flex items-center justify-center text-[10px] font-bold text-[#22c55e]"
            >
              {(userName || (role === 'admin' ? 'A' : 'E')).charAt(0).toUpperCase()}
            </div>
          </div>
        ) : (
          <div className="px-3 py-2 mb-2">
            <div className="text-xs font-semibold text-white truncate mb-0.5">
              {userName || (role === 'admin' ? 'Administrator' : 'Employee')}
            </div>
            <div className="text-[10px] text-[#71717a] truncate font-medium">{userEmail}</div>
          </div>
        )}
      </div>
    </aside>
  )
}
