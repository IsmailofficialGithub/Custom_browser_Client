'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { apiRequest } from '@/lib/api';
import {
  Users2,
  Plus,
  Trash2,
  Edit2,
  Eye,
  X,
  RefreshCw,
  Shield,
  Network,
  Users,
  Check
} from 'lucide-react';

interface TeamRecord {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  managers: Array<{ id: string; email: string; permissions: string[] }>;
  _count: {
    members: number;
    proxies: number;
  };
}

interface TeamDetail {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  managers: Array<{ id: string; email: string; permissions: string[]; createdAt: string }>;
  members: Array<{ id: string; email: string; createdAt: string; _count: { proxies: number } }>;
  proxies: Array<{ id: string; host: string; port: string; protocol: string; os: string; status: string }>;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Create Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createCode, setCreateCode] = useState('');

  // Edit Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editId, setEditId] = useState('');
  const [editName, setEditName] = useState('');
  const [editCode, setEditCode] = useState('');

  // Details Drawer / Modal
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [teamDetail, setTeamDetail] = useState<TeamDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [error, setError] = useState('');

  async function loadTeams() {
    setLoading(true);
    try {
      const res = await apiRequest('/api/admin/teams');
      if (res.success && Array.isArray(res.teams)) {
        setTeams(res.teams);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTeams();
  }, []);

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await apiRequest('/api/admin/teams', {
      method: 'POST',
      body: JSON.stringify({ name: createName, code: createCode })
    });

    if (res.success) {
      setShowCreateModal(false);
      setCreateName('');
      setCreateCode('');
      loadTeams();
    } else {
      setError(res.message || 'Failed to create team');
    }
  }

  function openEditModal(t: TeamRecord) {
    setError('');
    setEditId(t.id);
    setEditName(t.name);
    setEditCode(t.code);
    setShowEditModal(true);
  }

  async function handleUpdateTeam(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await apiRequest(`/api/admin/teams/${editId}`, {
      method: 'PUT',
      body: JSON.stringify({ name: editName, code: editCode })
    });

    if (res.success) {
      setShowEditModal(false);
      loadTeams();
    } else {
      setError(res.message || 'Failed to update team');
    }
  }

  async function openDetailModal(id: string) {
    setDetailLoading(true);
    setShowDetailModal(true);
    setTeamDetail(null);
    try {
      const res = await apiRequest(`/api/admin/teams/${id}`);
      if (res.success && res.team) {
        setTeamDetail(res.team);
      }
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleDeleteTeam(id: string, teamName: string) {
    if (!confirm(`Are you sure you want to delete team '${teamName}'?`)) return;
    const res = await apiRequest(`/api/admin/teams/${id}`, { method: 'DELETE' });
    if (res.success) loadTeams();
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#f1f5f9]">Team Management</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Partition operators and proxies into dedicated multi-tenant teams.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadTeams}
              className="p-2 rounded-lg border border-[#262c3b] bg-[#161922] hover:bg-[#1e222d] text-[#cbd5e1] text-xs transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setError(''); setShowCreateModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Create Team</span>
            </button>
          </div>
        </div>

        {/* Teams Table */}
        <div className="rounded-xl border border-[#262c3b] bg-[#161922] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#11131a] border-b border-[#262c3b] text-[#94a3b8] font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Team Name</th>
                <th className="py-3 px-4">Team Code (Login ID)</th>
                <th className="py-3 px-4">Assigned Managers</th>
                <th className="py-3 px-4">Members</th>
                <th className="py-3 px-4">Proxies</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262c3b]/50">
              {teams.map((t) => (
                <tr key={t.id} className="hover:bg-[#1e222d]/50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[#f1f5f9]">
                    <button
                      onClick={() => openDetailModal(t.id)}
                      className="hover:text-[#60a5fa] hover:underline flex items-center gap-1.5"
                    >
                      <span>{t.name}</span>
                    </button>
                  </td>
                  <td className="py-3.5 px-4 font-mono font-semibold text-[#60a5fa]">{t.code}</td>
                  <td className="py-3.5 px-4">
                    {t.managers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {t.managers.map((m) => (
                          <span
                            key={m.id}
                            className="px-2 py-0.5 rounded bg-[#10b981]/10 text-[#10b981] border border-[#10b981]/20 text-[10.5px]"
                          >
                            {m.email}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[#64748b] text-[11px]">No manager assigned</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 tabular-data text-[#cbd5e1]">{t._count.members} users</td>
                  <td className="py-3.5 px-4 tabular-data text-[#cbd5e1]">{t._count.proxies} proxies</td>
                  <td className="py-3.5 px-4 text-right space-x-1">
                    <button
                      onClick={() => openDetailModal(t.id)}
                      className="p-1.5 rounded hover:bg-[#2563eb]/15 text-[#64748b] hover:text-[#60a5fa] transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => openEditModal(t)}
                      className="p-1.5 rounded hover:bg-[#2563eb]/15 text-[#64748b] hover:text-[#60a5fa] transition-colors"
                      title="Edit Team"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteTeam(t.id, t.name)}
                      className="p-1.5 rounded hover:bg-[#f43f5e]/15 text-[#64748b] hover:text-[#f43f5e] transition-colors"
                      title="Delete Team"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {teams.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[#64748b]">
                    No teams found. Click "Create Team" to initialize one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Modal: Create Team */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Create New Team</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && <div className="p-2.5 rounded bg-[#f43f5e]/10 text-xs text-[#fca5a5]">{error}</div>}

              <form onSubmit={handleCreateTeam} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Team Display Name</label>
                  <input
                    type="text"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                    placeholder="e.g. Asia-Pacific Automation"
                  />
                </div>

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">
                    Team Code / Login ID (Unique slug lowercase)
                  </label>
                  <input
                    type="text"
                    value={createCode}
                    onChange={(e) => setCreateCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    required
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] font-mono focus:outline-none focus:border-[#2563eb]"
                    placeholder="e.g. apac-team"
                  />
                  <p className="text-[11px] text-[#64748b] mt-1">Managers will enter this Team Code on the login page.</p>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-3 py-2 rounded-lg border border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium"
                  >
                    Create Team
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Team */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Edit Team</h3>
                <button onClick={() => setShowEditModal(false)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && <div className="p-2.5 rounded bg-[#f43f5e]/10 text-xs text-[#fca5a5]">{error}</div>}

              <form onSubmit={handleUpdateTeam} className="space-y-3 text-xs">
                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Team Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                  />
                </div>

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Team Code / Login ID</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    required
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] font-mono focus:outline-none focus:border-[#2563eb]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="px-3 py-2 rounded-lg border border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Team Details */}
        {showDetailModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-2xl rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-5 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <div className="flex items-center gap-2">
                  <Users2 className="w-5 h-5 text-[#60a5fa]" />
                  <h3 className="text-base font-semibold text-[#f1f5f9]">
                    {teamDetail ? teamDetail.name : 'Loading team details...'}
                  </h3>
                  {teamDetail && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-[#2563eb]/15 text-[#60a5fa] border border-[#2563eb]/30">
                      {teamDetail.code}
                    </span>
                  )}
                </div>
                <button onClick={() => setShowDetailModal(false)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {detailLoading && (
                <div className="py-12 text-center text-xs text-[#94a3b8]">Loading team resources...</div>
              )}

              {teamDetail && (
                <div className="space-y-5 text-xs">
                  {/* Managers Section */}
                  <div>
                    <h4 className="font-semibold text-[#cbd5e1] mb-2 flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-[#10b981]" />
                      <span>Assigned Managers ({teamDetail.managers.length})</span>
                    </h4>
                    {teamDetail.managers.length > 0 ? (
                      <div className="rounded-lg border border-[#262c3b] bg-[#10121a] divide-y divide-[#262c3b]/50">
                        {teamDetail.managers.map((m) => (
                          <div key={m.id} className="p-3 flex items-center justify-between">
                            <div>
                              <div className="font-medium text-[#f1f5f9]">{m.email}</div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.permissions.map((p) => (
                                  <span key={p} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#161922] text-[#94a3b8] border border-[#262c3b]">
                                    {p}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <span className="text-[11px] text-[#64748b]">Manager</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-[#262c3b] bg-[#10121a] text-[#64748b]">
                        No managers assigned to this team yet.
                      </div>
                    )}
                  </div>

                  {/* Members Section */}
                  <div>
                    <h4 className="font-semibold text-[#cbd5e1] mb-2 flex items-center gap-1.5">
                      <Users className="w-4 h-4 text-[#60a5fa]" />
                      <span>Team Operator Members ({teamDetail.members.length})</span>
                    </h4>
                    {teamDetail.members.length > 0 ? (
                      <div className="rounded-lg border border-[#262c3b] bg-[#10121a] divide-y divide-[#262c3b]/50 max-h-48 overflow-y-auto">
                        {teamDetail.members.map((u) => (
                          <div key={u.id} className="p-3 flex items-center justify-between">
                            <span className="font-medium text-[#f1f5f9]">{u.email}</span>
                            <span className="tabular-data text-[#94a3b8]">{u._count.proxies} proxies</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-[#262c3b] bg-[#10121a] text-[#64748b]">
                        No operator members assigned to this team.
                      </div>
                    )}
                  </div>

                  {/* Proxies Section */}
                  <div>
                    <h4 className="font-semibold text-[#cbd5e1] mb-2 flex items-center gap-1.5">
                      <Network className="w-4 h-4 text-[#f59e0b]" />
                      <span>Assigned Proxies ({teamDetail.proxies.length})</span>
                    </h4>
                    {teamDetail.proxies.length > 0 ? (
                      <div className="rounded-lg border border-[#262c3b] bg-[#10121a] divide-y divide-[#262c3b]/50 max-h-48 overflow-y-auto">
                        {teamDetail.proxies.map((p) => (
                          <div key={p.id} className="p-2.5 px-3 flex items-center justify-between font-mono text-[11px]">
                            <span className="text-[#f1f5f9]">{p.host}:{p.port}</span>
                            <div className="flex items-center gap-2">
                              <span className="uppercase text-[10px] text-[#60a5fa]">{p.protocol}</span>
                              <span className="capitalize text-[10px] text-[#cbd5e1]">{p.os}</span>
                              <span className="px-1.5 py-0.2 rounded text-[10px] bg-[#10b981]/15 text-[#10b981]">{p.status}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border border-[#262c3b] bg-[#10121a] text-[#64748b]">
                        No proxies assigned to this team.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
