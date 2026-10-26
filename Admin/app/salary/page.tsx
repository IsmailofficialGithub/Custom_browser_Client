'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { apiRequest } from '@/lib/api';
import {
  CalendarDays,
  DollarSign,
  TrendingUp,
  Target,
  Edit2,
  RefreshCw,
  X,
  CheckCircle2,
  Clock
} from 'lucide-react';

interface UserOption {
  id: string;
  email: string;
}

interface CalendarDayData {
  day: number;
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  earnings: number;
  dayRate?: number;
}

interface SalaryMetrics {
  year: number;
  month: number;
  daysInMonth: number;
  monthlySalary: number;
  dailyLeadGoal: number;
  dailyAllocation: number;
  perLeadValue: number;
}

export default function SalaryPage() {
  const [users, setUsers] = useState<UserOption[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [metrics, setMetrics] = useState<SalaryMetrics | null>(null);
  const [summary, setSummary] = useState<{ totalSubmissions: number; approvedLeads: number; earnedTotal: number } | null>(null);
  const [calendarDays, setCalendarDays] = useState<CalendarDayData[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [inputSalary, setInputSalary] = useState('');
  const [inputGoal, setInputGoal] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    try {
      const res = await apiRequest('/api/admin/users');
      if (res.success && Array.isArray(res.users)) {
        setUsers(res.users);
        if (res.users.length > 0 && !selectedUserId) {
          setSelectedUserId(res.users[0].id);
        }
      }
    } catch (_) {}
  }

  async function loadUserMetrics(userId: string) {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await apiRequest(`/api/admin/salary/metrics/${userId}`);
      if (res.success) {
        setMetrics(res.metrics);
        setSummary(res.summary);
        setCalendarDays(res.calendarDays);
        setInputSalary(String(res.metrics.monthlySalary));
        setInputGoal(String(res.metrics.dailyLeadGoal));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadUserMetrics(selectedUserId);
    }
  }, [selectedUserId]);

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUserId) return;
    setSaving(true);
    try {
      const res = await apiRequest(`/api/admin/salary/config/${selectedUserId}`, {
        method: 'PUT',
        body: JSON.stringify({
          monthlySalary: parseFloat(inputSalary) || 0,
          dailyLeadGoal: parseInt(inputGoal, 10) || 50
        })
      });
      if (res.success) {
        setShowConfigModal(false);
        loadUserMetrics(selectedUserId);
      } else {
        alert(res.message || 'Failed to update salary config');
      }
    } finally {
      setSaving(false);
    }
  }

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#f1f5f9]">Salary & Calendar Ledger</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Live calendar calculations dividing monthly salary by calendar days and daily lead goals.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Operator Selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs text-[#94a3b8]">Operator:</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-[#262c3b] bg-[#161922] text-xs font-medium text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.email}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={() => loadUserMetrics(selectedUserId)}
              className="p-2 rounded-lg border border-[#262c3b] bg-[#161922] hover:bg-[#1e222d] text-[#cbd5e1] text-xs"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={() => setShowConfigModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Edit Salary & Goal</span>
            </button>
          </div>
        </div>

        {/* 4 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Monthly Base Salary</span>
              <DollarSign className="w-4 h-4 text-[#10b981]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#f1f5f9]">
              PKR {metrics ? metrics.monthlySalary.toLocaleString() : '0'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">
              {metrics ? `${metrics.daysInMonth} calendar days this month` : ''}
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Daily Lead Goal</span>
              <Target className="w-4 h-4 text-[#60a5fa]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#60a5fa]">
              {metrics ? metrics.dailyLeadGoal : '0'} leads/day
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">
              PKR {metrics ? metrics.dailyAllocation : '0'} daily salary pool
            </div>
          </div>

          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Calculated Lead Value</span>
              <TrendingUp className="w-4 h-4 text-[#a78bfa]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#a78bfa]">
              PKR {metrics ? metrics.perLeadValue.toFixed(4) : '0.0000'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">Credit added per approved lead</div>
          </div>

          <div className="p-5 rounded-xl border border-[#262c3b] bg-[#161922]">
            <div className="flex items-center justify-between text-[#94a3b8]">
              <span className="text-xs font-medium">Accrued Earned Credit</span>
              <CheckCircle2 className="w-4 h-4 text-[#10b981]" />
            </div>
            <div className="mt-3 text-2xl font-bold tabular-data text-[#10b981]">
              PKR {summary ? summary.earnedTotal.toFixed(2) : '0.00'}
            </div>
            <div className="mt-1 text-[11px] text-[#64748b]">
              {summary ? `${summary.approvedLeads} approved video proofs` : ''}
            </div>
          </div>
        </div>

        {/* Calendar Grid Header */}
        <div className="rounded-xl border border-[#262c3b] bg-[#161922] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
            <div className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-[#60a5fa]" />
              <h3 className="text-sm font-semibold text-[#f1f5f9]">
                {metrics ? `${monthNames[metrics.month - 1]} ${metrics.year}` : 'Live Calendar'}
              </h3>
            </div>
            <div className="flex items-center gap-4 text-xs text-[#94a3b8]">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#10b981]"></span>
                <span>Approved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#f59e0b]"></span>
                <span>Pending Review</span>
              </div>
            </div>
          </div>

          {/* Calendar Grid (Days 1 to Month End) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2.5">
            {calendarDays.map((d) => {
              const isToday = metrics && d.day === new Date().getDate() && metrics.month === new Date().getMonth() + 1;
              return (
                <div
                  key={d.day}
                  className={`p-3 rounded-lg border text-xs flex flex-col justify-between min-h-[92px] transition-all ${
                    isToday
                      ? 'border-[#2563eb] bg-[#2563eb]/10'
                      : d.approved > 0
                      ? 'border-[#10b981]/30 bg-[#10b981]/5'
                      : 'border-[#262c3b] bg-[#10121a]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-bold ${isToday ? 'text-[#60a5fa]' : 'text-[#cbd5e1]'}`}>
                      Day {d.day}
                    </span>
                    {isToday && (
                      <span className="text-[9px] font-bold uppercase px-1 py-0.2 rounded bg-[#2563eb] text-white">
                        Today
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 my-1">
                    <div className="text-[11px] tabular-data text-[#94a3b8] flex justify-between">
                      <span>Rate:</span>
                      <span className="text-[#a78bfa] font-mono">
                        PKR {d.dayRate && d.dayRate > 0 ? d.dayRate.toFixed(2) : (metrics?.perLeadValue || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="text-[11px] tabular-data text-[#94a3b8]">
                      Target: <span className="text-[#cbd5e1]">{metrics?.dailyLeadGoal}</span>
                    </div>
                    {d.approved > 0 && (
                      <div className="text-[11px] tabular-data text-[#10b981] font-semibold">
                        ✓ {d.approved} approved
                      </div>
                    )}
                    {d.pending > 0 && (
                      <div className="text-[11px] tabular-data text-[#f59e0b]">
                        ⏳ {d.pending} review
                      </div>
                    )}
                  </div>

                  <div className="pt-1 border-t border-[#262c3b]/50 text-[11px] font-mono font-semibold text-[#f1f5f9] flex justify-between">
                    <span className="text-[#64748b]">Earned:</span>
                    <span className={d.earnings > 0 ? 'text-[#10b981]' : 'text-[#64748b]'}>
                      PKR {d.earnings.toFixed(2)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal: Edit Salary & Daily Goal */}
        {showConfigModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Configure Operator Salary</h3>
                <button onClick={() => setShowConfigModal(false)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveConfig} className="space-y-4 text-xs">
                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Monthly Base Salary (PKR)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={inputSalary}
                    onChange={(e) => setInputSalary(e.target.value)}
                    required
                    placeholder="10000"
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] font-mono focus:outline-none focus:border-[#2563eb]"
                  />
                  <p className="text-[11px] text-[#64748b] mt-1">Total compensation allocated across the calendar days.</p>
                </div>

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Daily Lead Target</label>
                  <input
                    type="number"
                    value={inputGoal}
                    onChange={(e) => setInputGoal(e.target.value)}
                    required
                    placeholder="50"
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] font-mono focus:outline-none focus:border-[#2563eb]"
                  />
                  <p className="text-[11px] text-[#64748b] mt-1">Expected daily leads to calculate per-lead value.</p>
                </div>

                {inputSalary && inputGoal && (
                  <div className="p-3 rounded-lg bg-[#2563eb]/10 border border-[#2563eb]/20 text-[11px] space-y-1">
                    <div className="text-[#93c5fd] font-semibold">Live Calculation Preview:</div>
                    <div className="text-[#cbd5e1] font-mono">
                      Per Lead: PKR {metrics ? (parseFloat(inputSalary) / (metrics.daysInMonth * parseInt(inputGoal, 10))).toFixed(4) : '0.0000'}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-[#262c3b]">
                  <button
                    type="button"
                    onClick={() => setShowConfigModal(false)}
                    className="px-3 py-2 rounded-lg border border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium"
                  >
                    {saving ? 'Saving...' : 'Save Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
