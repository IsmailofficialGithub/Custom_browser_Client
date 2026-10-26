'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { apiRequest } from '@/lib/api';
import {
  Video,
  CheckCircle,
  XCircle,
  Play,
  RefreshCw,
  Clock,
  User,
  X
} from 'lucide-react';

interface LeadItem {
  id: string;
  userId: string;
  videoUrl: string;
  fileSizeBytes: number;
  videoDuration: number;
  calculatedPay: number;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  user?: { email: string };
  team?: { name: string; code: string };
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('pending');
  const [activeVideoUrl, setActiveVideoUrl] = useState<string | null>(null);
  const [activeLead, setActiveLead] = useState<LeadItem | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);

  async function loadLeads() {
    setLoading(true);
    try {
      const q = filterStatus ? `?status=${filterStatus}` : '';
      const res = await apiRequest(`/api/admin/leads${q}`);
      if (res.success && Array.isArray(res.leads)) {
        setLeads(res.leads);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, [filterStatus]);

  async function handleApprove(id: string) {
    setProcessingId(id);
    try {
      const res = await apiRequest(`/api/admin/leads/${id}/approve`, { method: 'POST' });
      if (res.success) {
        if (activeLead?.id === id) setActiveLead(null);
        loadLeads();
      } else {
        alert(res.message || 'Approval failed');
      }
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(id: string) {
    const reason = prompt('Optional rejection reason:') || '';
    setProcessingId(id);
    try {
      const res = await apiRequest(`/api/admin/leads/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reviewNotes: reason })
      });
      if (res.success) {
        if (activeLead?.id === id) setActiveLead(null);
        loadLeads();
      } else {
        alert(res.message || 'Rejection failed');
      }
    } finally {
      setProcessingId(null);
    }
  }

  const backendHost = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:50052';

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#f1f5f9]">Lead Video Proof & Audits</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">
              Review ultra-compressed 5 FPS desktop recordings submitted by operators and approve salary credits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Status Filter */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#161922] border border-[#262c3b]">
              {['all', 'pending', 'approved', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilterStatus(st === 'all' ? '' : st)}
                  className={`px-3 py-1 rounded text-xs capitalize font-medium transition-colors ${
                    (filterStatus === st || (st === 'all' && !filterStatus))
                      ? 'bg-[#2563eb] text-white'
                      : 'text-[#94a3b8] hover:text-[#f1f5f9]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            <button
              onClick={loadLeads}
              className="p-2 rounded-lg border border-[#262c3b] bg-[#161922] hover:bg-[#1e222d] text-[#cbd5e1] text-xs"
              title="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Leads Table */}
        <div className="rounded-xl border border-[#262c3b] bg-[#161922] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#11131a] border-b border-[#262c3b] text-[#94a3b8] font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Operator</th>
                <th className="py-3 px-4">Duration & Size</th>
                <th className="py-3 px-4">Calculated Lead Value</th>
                <th className="py-3 px-4">Submitted At</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262c3b]/50">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-[#1e222d]/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-medium text-[#f1f5f9]">{l.user?.email || l.userId}</div>
                    {l.team && <div className="text-[11px] text-[#60a5fa]">{l.team.name}</div>}
                  </td>
                  <td className="py-3 px-4 font-mono text-[#cbd5e1]">
                    {l.videoDuration}s • {(l.fileSizeBytes / 1024).toFixed(0)} KB (5fps)
                  </td>
                  <td className="py-3 px-4 font-mono text-[#a78bfa] font-semibold">
                    PKR {l.calculatedPay.toFixed(4)}
                  </td>
                  <td className="py-3 px-4 text-[#64748b]">
                    {new Date(l.submittedAt).toLocaleString()}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border capitalize ${
                        l.status === 'approved'
                          ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/25'
                          : l.status === 'pending'
                          ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/25'
                          : 'bg-[#f43f5e]/10 text-[#f43f5e] border-[#f43f5e]/25'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    <button
                      onClick={() => setActiveLead(l)}
                      className="px-2.5 py-1.5 rounded bg-[#2563eb]/15 text-[#60a5fa] hover:bg-[#2563eb]/25 font-medium inline-flex items-center gap-1"
                    >
                      <Play className="w-3 h-3" />
                      <span>Review Video</span>
                    </button>
                    {l.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(l.id)}
                          disabled={processingId === l.id}
                          className="px-2.5 py-1.5 rounded bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 font-medium inline-flex items-center gap-1"
                        >
                          <CheckCircle className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReject(l.id)}
                          disabled={processingId === l.id}
                          className="px-2.5 py-1.5 rounded bg-[#f43f5e]/15 text-[#f43f5e] hover:bg-[#f43f5e]/25 font-medium inline-flex items-center gap-1"
                        >
                          <XCircle className="w-3 h-3" />
                          <span>Reject</span>
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748b]">
                    No {filterStatus} video recordings found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Video Review Player */}
        {activeLead && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#60a5fa]" />
                  <h3 className="text-sm font-semibold text-[#f1f5f9]">
                    Lead Proof Review: {activeLead.user?.email}
                  </h3>
                </div>
                <button onClick={() => setActiveLead(null)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Video Player */}
              <div className="rounded-lg overflow-hidden border border-[#262c3b] bg-black aspect-video flex items-center justify-center">
                <video
                  src={`${backendHost}${activeLead.videoUrl}`}
                  controls
                  autoPlay
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Metadata & Actions */}
              <div className="flex items-center justify-between pt-2">
                <div className="text-xs space-y-1">
                  <div className="text-[#94a3b8]">
                    Calculated Lead Value:{' '}
                    <span className="font-mono font-bold text-[#a78bfa]">
                      PKR {activeLead.calculatedPay.toFixed(4)}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#64748b]">
                    Duration: {activeLead.videoDuration}s • Size: {(activeLead.fileSizeBytes / 1024).toFixed(1)} KB (5fps)
                  </div>
                </div>

                {activeLead.status === 'pending' ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleReject(activeLead.id)}
                      className="px-4 py-2 rounded-lg bg-[#f43f5e]/15 text-[#f43f5e] hover:bg-[#f43f5e]/25 font-semibold text-xs flex items-center gap-1.5"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject Lead</span>
                    </button>
                    <button
                      onClick={() => handleApprove(activeLead.id)}
                      className="px-4 py-2 rounded-lg bg-[#10b981] hover:bg-[#059669] text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-[#10b981]/20"
                    >
                      <CheckCircle className="w-4 h-4" />
                      <span>Approve & Credit PKR {activeLead.calculatedPay.toFixed(2)}</span>
                    </button>
                  </div>
                ) : (
                  <span className="text-xs font-semibold capitalize text-[#cbd5e1]">
                    Status: {activeLead.status}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
