'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/Sidebar';
import { apiRequest } from '@/lib/api';

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [adminEmail, setAdminEmail] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('hostrif_admin_token');
    if (!token) {
      router.push('/login');
      return;
    }

    apiRequest('/api/admin/me')
      .then((res) => {
        if (res.success && res.user) {
          setAdminEmail(res.user.email);
          setLoading(false);
        } else {
          router.push('/login');
        }
      })
      .catch(() => router.push('/login'));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center text-sm text-[#94a3b8]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#2563eb] animate-ping"></span>
          <span>Verifying administrator session...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0f1117]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 px-8 border-b border-[#262c3b] bg-[#161922] flex items-center justify-between">
          <h1 className="text-sm font-semibold text-[#f1f5f9] tracking-tight">Admin Console</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#94a3b8] font-mono">{adminEmail}</span>
            <div className="w-7 h-7 rounded-full bg-[#2563eb]/20 border border-[#2563eb]/40 text-[#60a5fa] flex items-center justify-center text-xs font-bold uppercase">
              {adminEmail ? adminEmail[0] : 'A'}
            </div>
          </div>
        </header>
        <main className="flex-1 p-8 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
