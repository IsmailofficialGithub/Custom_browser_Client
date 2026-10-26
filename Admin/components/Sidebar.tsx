'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Network,
  Sliders,
  LogOut,
  ShieldCheck,
  Server,
  Users2,
  CalendarDays,
  Video
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // Load current user role
  const [userRole, setUserRole] = React.useState<string>('admin');
  const [teamName, setTeamName] = React.useState<string>('');

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('hostrif_admin_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUserRole(parsed.role || 'admin');
        setTeamName(parsed.teamName || '');
      }
    } catch (_) {}
  }, []);

  function handleLogout() {
    localStorage.removeItem('hostrif_admin_token');
    localStorage.removeItem('hostrif_admin_user');
    router.push('/login');
  }

  const navItems = [
    { label: 'Overview', href: '/', icon: LayoutDashboard },
    ...(userRole === 'admin' ? [{ label: 'Teams', href: '/teams', icon: Users2 }] : []),
    { label: userRole === 'manager' ? 'Team Operators' : 'Operators', href: '/users', icon: Users },
    { label: 'Proxies', href: '/proxies', icon: Network },
    { label: 'Salary & Calendar', href: '/salary', icon: CalendarDays },
    { label: 'Lead Video Audits', href: '/leads', icon: Video },
    { label: 'AdsPower Config', href: '/configs', icon: Sliders }
  ];

  return (
    <aside className="w-64 flex flex-col border-r border-[#262c3b] bg-[#161922] min-h-screen">
      {/* Brand */}
      <div className="h-16 px-6 flex items-center gap-3 border-b border-[#262c3b]">
        <div className="w-8 h-8 rounded-lg bg-[#2563eb]/15 border border-[#2563eb]/30 flex items-center justify-center text-[#60a5fa]">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div>
          <span className="font-semibold text-sm tracking-tight text-[#f1f5f9]">HOSTRIF</span>
          <span className="ml-2 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-[#262c3b] text-[#94a3b8]">
            {userRole}
          </span>
        </div>
      </div>

      {teamName && (
        <div className="px-6 py-2 border-b border-[#262c3b]/50 bg-[#11131a]/60">
          <div className="text-[11px] text-[#64748b] uppercase font-semibold">Active Team</div>
          <div className="text-xs font-medium text-[#60a5fa] truncate">{teamName}</div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-[#2563eb]/15 text-[#f1f5f9] border border-[#2563eb]/30'
                  : 'text-[#94a3b8] hover:text-[#f1f5f9] hover:bg-[#1e222d]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#60a5fa]' : 'text-[#64748b]'}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* System Health Footer */}
      <div className="p-4 border-t border-[#262c3b] space-y-3">
        <div className="p-3 rounded-lg bg-[#11131a] border border-[#262c3b] space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#94a3b8]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse"></span>
              <span>PostgreSQL</span>
            </div>
            <span className="text-[11px] text-[#64748b] font-mono">:5432</span>
          </div>
          <div className="flex items-center justify-between text-xs text-[#94a3b8]">
            <div className="flex items-center gap-1.5">
              <Server className="w-3 h-3 text-[#60a5fa]" />
              <span>REST API</span>
            </div>
            <span className="text-[11px] text-[#64748b] font-mono">:50052</span>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-[#94a3b8] hover:text-[#f43f5e] hover:bg-[#f43f5e]/10 border border-transparent hover:border-[#f43f5e]/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
