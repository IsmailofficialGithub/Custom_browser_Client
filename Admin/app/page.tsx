'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { apiRequest } from '@/lib/api';
import { Users, Network, Sliders, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

interface StatsData {
  totalUsers: number;
  totalProxies: number;
  proxiesByStatus: { fresh: number; in_use: number; used: number; failed: number };
  proxiesByOs: { windows: number; mac: number; android: number; ios: number };
  proxiesByProtocol: { socks5: number; http: number };
  activeAdsPowerConfigs: number;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadStats() {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/stats');
      if (res.success && res.stats) {
        setStats(res.stats);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Title & Refresh */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#f1f5f9]">System Overview</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Real-time infrastructure health and proxy metrics.</p>
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#262c3b] bg-[#161922] hover:bg-[#1e222d] text-xs font-medium text-[#cbd5e1] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* 4 Primary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Total Operators</span>
              <Users className="w-4 h-4 text-[#60a5fa]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#f1f5f9]">
              {stats ? stats.totalUsers : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">Active user accounts</div>
          </div>

          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Fresh Proxies</span>
              <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#10b981]">
              {stats ? stats.proxiesByStatus.fresh : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">Ready for automation</div>
          </div>

          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Used / Recycled</span>
              <Network className="w-4 h-4 text-[#f59e0b]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#f59e0b]">
              {stats ? stats.proxiesByStatus.used : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">Executed sessions</div>
          </div>

          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Quarantined / Failed</span>
              <AlertCircle className="w-4 h-4 text-[#f43f5e]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#f43f5e]">
              {stats ? stats.proxiesByStatus.failed : '—'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">Offline or errored</div>
          </div>
        </div>

        {/* Breakdown Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* OS Distribution */}
          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <h3 className="text-sm font-semibold text-[#f1f5f9] mb-4">Target OS Distribution</h3>
            <div className="space-y-3">
              {[
                { label: 'Windows', count: stats?.proxiesByOs.windows || 0 },
                { label: 'macOS', count: stats?.proxiesByOs.mac || 0 },
                { label: 'Android', count: stats?.proxiesByOs.android || 0 },
                { label: 'iOS', count: stats?.proxiesByOs.ios || 0 }
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs py-1 border-b border-[#262c3b]/50">
                  <span className="text-[#94a3b8]">{row.label}</span>
                  <span className="font-semibold tabular-data text-[#f1f5f9]">{row.count} proxies</span>
                </div>
              ))}
            </div>
          </div>

          {/* Protocol & Engine */}
          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <h3 className="text-sm font-semibold text-[#f1f5f9] mb-4">Protocols & AdsPower Configs</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#262c3b]/50">
                <span className="text-[#94a3b8]">SOCKS5 Proxies</span>
                <span className="font-semibold tabular-data text-[#60a5fa]">{stats?.proxiesByProtocol.socks5 || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#262c3b]/50">
                <span className="text-[#94a3b8]">HTTP/HTTPS Proxies</span>
                <span className="font-semibold tabular-data text-[#f1f5f9]">{stats?.proxiesByProtocol.http || 0}</span>
              </div>
              <div className="flex items-center justify-between text-xs py-1 border-b border-[#262c3b]/50">
                <span className="text-[#94a3b8]">Configured AdsPower Endpoints</span>
                <span className="font-semibold tabular-data text-[#10b981]">{stats?.activeAdsPowerConfigs || 0}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}
