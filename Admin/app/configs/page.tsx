'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { apiRequest } from '@/lib/api';
import { Sliders, Save, CheckCircle2, RefreshCw } from 'lucide-react';

interface ConfigRecord {
  id: string;
  userId: string;
  adspowerUrl: string;
  adspowerApiKey: string;
  updatedAt: string;
  user?: { email: string };
}

export default function ConfigsPage() {
  const [configs, setConfigs] = useState<ConfigRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  async function loadConfigs() {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/configs');
      if (res.success && Array.isArray(res.configs)) {
        setConfigs(res.configs);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfigs();
  }, []);

  function handleFieldChange(id: string, field: 'adspowerUrl' | 'adspowerApiKey', value: string) {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, [field]: value } : c))
    );
  }

  async function handleSave(cfg: ConfigRecord) {
    setSavingId(cfg.id);
    setNotice('');
    const res = await apiRequest(`/api/admin/configs/${cfg.userId}`, {
      method: 'PUT',
      body: JSON.stringify({
        adspowerUrl: cfg.adspowerUrl,
        adspowerApiKey: cfg.adspowerApiKey
      })
    });

    setSavingId(null);
    if (res.success) {
      setNotice(`Saved configuration for ${cfg.user?.email || 'user'}`);
      setTimeout(() => setNotice(''), 3000);
    } else {
      alert(`Save failed: ${res.message}`);
    }
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#f1f5f9]">AdsPower Engine Configurations</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Control local agent API endpoints and API keys distributed to operators.</p>
          </div>
          <button
            onClick={loadConfigs}
            className="p-2 rounded-lg border border-[#262c3b] bg-[#161922] hover:bg-[#1e222d] text-[#cbd5e1] text-xs"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {notice && (
          <div className="p-3 rounded-lg bg-[#10b981]/10 border border-[#10b981]/20 text-xs text-[#6ee7b7] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{notice}</span>
          </div>
        )}

        {/* Configs Table */}
        <div className="rounded-xl border border-[#262c3b] bg-[#161922] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#11131a] border-b border-[#262c3b] text-[#94a3b8] font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Operator Email</th>
                <th className="py-3 px-4">AdsPower Local API URL</th>
                <th className="py-3 px-4">API Key (Optional)</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262c3b]/50">
              {configs.map((c) => (
                <tr key={c.id} className="hover:bg-[#1e222d]/50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[#f1f5f9]">
                    {c.user?.email || c.userId}
                  </td>
                  <td className="py-3.5 px-4">
                    <input
                      type="text"
                      value={c.adspowerUrl}
                      onChange={(e) => handleFieldChange(c.id, 'adspowerUrl', e.target.value)}
                      className="w-full max-w-xs px-2.5 py-1.5 bg-[#10121a] border border-[#262c3b] rounded text-xs font-mono text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                    />
                  </td>
                  <td className="py-3.5 px-4">
                    <input
                      type="password"
                      value={c.adspowerApiKey}
                      onChange={(e) => handleFieldChange(c.id, 'adspowerApiKey', e.target.value)}
                      placeholder="None"
                      className="w-full max-w-xs px-2.5 py-1.5 bg-[#10121a] border border-[#262c3b] rounded text-xs font-mono text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                    />
                  </td>
                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => handleSave(c)}
                      disabled={savingId === c.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium text-xs transition-colors disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingId === c.id ? 'Saving...' : 'Save'}</span>
                    </button>
                  </td>
                </tr>
              ))}
              {configs.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-[#64748b]">
                    No configuration entries found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardShell>
  );
}
