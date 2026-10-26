'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { apiRequest } from '@/lib/api';
import { Plus, Trash2, CheckCircle, RefreshCw, X, FileUp } from 'lucide-react';

interface ProxyRecord {
  id: string;
  userId: string;
  host: string;
  port: string;
  user: string;
  pass: string;
  protocol: string;
  os: string;
  status: string;
  userRef?: { email: string };
}

interface UserOption {
  id: string;
  email: string;
}

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBatchModal, setShowBatchModal] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch Import Form State
  const [rawText, setRawText] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedOs, setSelectedOs] = useState('windows');
  const [importStatus, setImportStatus] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [pxRes, uRes] = await Promise.all([
        apiRequest('/api/admin/proxies'),
        apiRequest('/api/admin/users')
      ]);

      if (pxRes.success && Array.isArray(pxRes.proxies)) {
        setProxies(pxRes.proxies);
        setSelectedIds(new Set());
      }
      if (uRes.success && Array.isArray(uRes.users)) {
        setUsers(uRes.users);
        if (uRes.users.length > 0 && !selectedUser) setSelectedUser(uRes.users[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (proxies.length > 0 && selectedIds.size === proxies.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(proxies.map((p) => p.id)));
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected proxies?`)) return;
    const res = await apiRequest('/api/admin/proxies', {
      method: 'DELETE',
      body: JSON.stringify({ proxyIds: Array.from(selectedIds) })
    });
    if (res.success) {
      setSelectedIds(new Set());
      loadData();
    } else {
      alert(res.message || 'Failed to delete selected proxies.');
    }
  }

  function parseBatchProxies(text: string, os: string) {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    const result = [];

    for (const line of lines) {
      let protocol = 'socks5';
      let cleanLine = line;

      if (line.includes('://')) {
        const parts = line.split('://');
        protocol = parts[0].toLowerCase();
        cleanLine = parts[1];
      }

      const segments = cleanLine.split(':');
      if (segments.length >= 2) {
        result.push({
          host: segments[0],
          port: segments[1],
          user: segments[2] || '',
          pass: segments[3] || '',
          protocol: protocol.includes('http') ? 'http' : 'socks5',
          os,
          status: 'fresh'
        });
      }
    }
    return result;
  }

  async function handleBatchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) {
      alert('Please select an operator to assign these proxies to.');
      return;
    }

    const parsed = parseBatchProxies(rawText, selectedOs);
    if (parsed.length === 0) {
      alert('Could not parse any valid proxies from input.');
      return;
    }

    setImportStatus(`Importing ${parsed.length} proxies...`);
    const res = await apiRequest('/api/admin/proxies/batch', {
      method: 'POST',
      body: JSON.stringify({ userId: selectedUser, proxies: parsed })
    });

    if (res.success) {
      setShowBatchModal(false);
      setRawText('');
      setImportStatus('');
      loadData();
    } else {
      setImportStatus(`Error: ${res.message}`);
    }
  }

  async function handleStatusChange(proxyId: string, newStatus: string) {
    const res = await apiRequest('/api/admin/proxies/bulk-status', {
      method: 'PUT',
      body: JSON.stringify({ proxyIds: [proxyId], status: newStatus })
    });
    if (res.success) loadData();
  }

  async function handleDeleteProxy(proxyId: string) {
    if (!confirm('Delete this proxy?')) return;
    const res = await apiRequest('/api/admin/proxies', {
      method: 'DELETE',
      body: JSON.stringify({ proxyIds: [proxyId] })
    });
    if (res.success) loadData();
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#f1f5f9]">Proxy Inventory</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Manage operator assignments, protocol routing, and lifecycle states.</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#f43f5e]/15 hover:bg-[#f43f5e]/25 text-[#f43f5e] border border-[#f43f5e]/30 text-xs font-medium transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Selected ({selectedIds.size})</span>
              </button>
            )}
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-[#262c3b] bg-[#161922] hover:bg-[#1e222d] text-[#cbd5e1] text-xs"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setShowBatchModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium"
            >
              <FileUp className="w-4 h-4" />
              <span>Batch Import Proxies</span>
            </button>
          </div>
        </div>

        {/* Proxies Table */}
        <div className="rounded-xl border border-[#262c3b] bg-[#161922] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#11131a] border-b border-[#262c3b] text-[#94a3b8] font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4 w-10">
                  <input
                    type="checkbox"
                    checked={proxies.length > 0 && selectedIds.size === proxies.length}
                    onChange={toggleSelectAll}
                    className="rounded border-[#262c3b] bg-[#10121a] text-[#2563eb] cursor-pointer"
                  />
                </th>
                <th className="py-3 px-4">Endpoint</th>
                <th className="py-3 px-4">Protocol</th>
                <th className="py-3 px-4">Target OS</th>
                <th className="py-3 px-4">Assigned Operator</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262c3b]/50">
              {proxies.map((p) => (
                <tr
                  key={p.id}
                  className={`hover:bg-[#1e222d]/50 transition-colors ${
                    selectedIds.has(p.id) ? 'bg-[#2563eb]/5' : ''
                  }`}
                >
                  <td className="py-3 px-4 w-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p.id)}
                      onChange={() => toggleSelect(p.id)}
                      className="rounded border-[#262c3b] bg-[#10121a] text-[#2563eb] cursor-pointer"
                    />
                  </td>
                  <td className="py-3 px-4 font-mono text-[#f1f5f9]">
                    {p.host}:{p.port}
                    {p.user && <span className="ml-1 text-[11px] text-[#64748b]">({p.user})</span>}
                  </td>
                  <td className="py-3 px-4 uppercase font-semibold text-[11px] text-[#60a5fa]">{p.protocol}</td>
                  <td className="py-3 px-4 capitalize text-[#cbd5e1]">{p.os}</td>
                  <td className="py-3 px-4 text-[#94a3b8] font-medium">{p.userRef?.email || 'Unassigned'}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                        p.status === 'fresh'
                          ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/25'
                          : p.status === 'used'
                          ? 'bg-[#f59e0b]/10 text-[#f59e0b] border-[#f59e0b]/25'
                          : 'bg-[#f43f5e]/10 text-[#f43f5e] border-[#f43f5e]/25'
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right space-x-1">
                    {p.status !== 'fresh' && (
                      <button
                        onClick={() => handleStatusChange(p.id, 'fresh')}
                        className="px-2 py-1 rounded bg-[#10b981]/15 text-[#10b981] hover:bg-[#10b981]/25 text-[11px]"
                        title="Mark Fresh"
                      >
                        Recycle
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteProxy(p.id)}
                      className="p-1 rounded hover:bg-[#f43f5e]/15 text-[#64748b] hover:text-[#f43f5e]"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5 inline" />
                    </button>
                  </td>
                </tr>
              ))}
              {proxies.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#64748b]">
                    No proxies in database. Click "Batch Import Proxies" to paste proxies.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Batch Import */}
        {showBatchModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Batch Import Proxies</h3>
                <button onClick={() => setShowBatchModal(false)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {importStatus && <div className="p-2.5 rounded bg-[#2563eb]/10 text-xs text-[#93c5fd]">{importStatus}</div>}

              <form onSubmit={handleBatchSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Assign To Operator</label>
                  <select
                    value={selectedUser}
                    onChange={(e) => setSelectedUser(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.email}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Target Operating System</label>
                  <select
                    value={selectedOs}
                    onChange={(e) => setSelectedOs(e.target.value)}
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="windows">Windows</option>
                    <option value="mac">macOS</option>
                    <option value="android">Android</option>
                    <option value="ios">iOS</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">
                    Raw Proxy List (One per line: host:port:user:pass or protocol://host:port)
                  </label>
                  <textarea
                    rows={6}
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    required
                    placeholder="192.168.1.1:8080:user:pass&#10;socks5://proxy.example.com:1080"
                    className="w-full p-3 bg-[#10121a] border border-[#262c3b] rounded-lg text-xs font-mono text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBatchModal(false)}
                    className="px-3 py-2 rounded-lg border border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium"
                  >
                    Import & Assign
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
