'use client';

import React, { useEffect, useState } from 'react';
import DashboardShell from '@/components/DashboardShell';
import { apiRequest } from '@/lib/api';
import { UserPlus, Trash2, Edit2, X, RefreshCw, Key, ShieldCheck, Check } from 'lucide-react';

interface EvomiConfigRecord {
  enabled: boolean;
  apiKey: string;
  country: string;
  protocol: string;
  osDistribution: {
    windows: number;
    mac: number;
    ios: number;
    android: number;
  };
  batchSize: number;
}

interface UserRecord {
  id: string;
  email: string;
  role: 'admin' | 'manager' | 'user';
  permissions: string[];
  managedTeam?: { id: string; name: string; code: string };
  memberTeam?: { id: string; name: string; code: string };
  createdAt: string;
  proxyCount: number;
  adsPowerUrl: string;
  evomiConfig?: EvomiConfigRecord | null;
}

interface TeamOption {
  id: string;
  name: string;
  code: string;
}

const AVAILABLE_PERMISSIONS = [
  { id: 'user.create', label: 'Create Operators' },
  { id: 'user.read', label: 'View Operators' },
  { id: 'user.edit', label: 'Edit / Reset Password' },
  { id: 'user.delete', label: 'Delete Operators' },
  { id: 'proxy.create', label: 'Batch Import Proxies' },
  { id: 'proxy.read', label: 'View Proxies' },
  { id: 'proxy.edit', label: 'Recycle / Update Proxies' },
  { id: 'proxy.delete', label: 'Delete Proxies' },
  { id: 'config.read', label: 'View AdsPower Configs' },
  { id: 'config.edit', label: 'Edit AdsPower Configs' }
];

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState('admin');

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'manager'>('user');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'user.create',
    'user.read',
    'proxy.create',
    'proxy.read',
    'proxy.edit'
  ]);

  // Edit Permissions Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState<UserRecord | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editTeamId, setEditTeamId] = useState<string>('');
  const [editRole, setEditRole] = useState<'user' | 'manager'>('manager');
  const [editPassword, setEditPassword] = useState('');

  // Evomi Configuration State
  const [evomiEnabled, setEvomiEnabled] = useState(false);
  const [evomiApiKey, setEvomiApiKey] = useState('');
  const [evomiCountry, setEvomiCountry] = useState('all');
  const [evomiProtocol, setEvomiProtocol] = useState('http');
  const [evomiWindows, setEvomiWindows] = useState(50);
  const [evomiMac, setEvomiMac] = useState(30);
  const [evomiIos, setEvomiIos] = useState(20);
  const [evomiAndroid, setEvomiAndroid] = useState(0);
  const [evomiBatchSize, setEvomiBatchSize] = useState(10);

  const [error, setError] = useState('');

  async function loadData() {
    setLoading(true);
    try {
      const [uRes, tRes] = await Promise.all([
        apiRequest('/api/admin/users'),
        apiRequest('/api/admin/teams')
      ]);

      if (uRes.success && Array.isArray(uRes.users)) setUsers(uRes.users);
      if (tRes.success && Array.isArray(tRes.teams)) {
        setTeams(tRes.teams);
        if (tRes.teams.length > 0 && !selectedTeamId) setSelectedTeamId(tRes.teams[0].id);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem('hostrif_admin_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setCurrentUserRole(parsed.role || 'admin');
      }
    } catch (_) {}
    loadData();
  }, []);

  function toggleCreatePermission(permId: string) {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  }

  function toggleEditPermission(permId: string) {
    setEditPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  }

  function openEditModal(u: UserRecord) {
    setError('');
    setEditUser(u);
    setEditRole(u.role === 'admin' ? 'user' : u.role);
    setEditPermissions(u.permissions || []);
    setEditTeamId(u.role === 'manager' ? (u.managedTeam?.id || '') : (u.memberTeam?.id || ''));
    setEditPassword('');

    // Populate Evomi config
    if (u.evomiConfig) {
      setEvomiEnabled(Boolean(u.evomiConfig.enabled));
      setEvomiApiKey(u.evomiConfig.apiKey || '');
      setEvomiCountry(u.evomiConfig.country || 'all');
      setEvomiProtocol(u.evomiConfig.protocol || 'http');
      const dist = u.evomiConfig.osDistribution || { windows: 50, mac: 30, ios: 20, android: 0 };
      setEvomiWindows(dist.windows ?? 50);
      setEvomiMac(dist.mac ?? 30);
      setEvomiIos(dist.ios ?? 20);
      setEvomiAndroid(dist.android ?? 0);
      setEvomiBatchSize(u.evomiConfig.batchSize || 10);
    } else {
      setEvomiEnabled(false);
      setEvomiApiKey('');
      setEvomiCountry('all');
      setEvomiProtocol('http');
      setEvomiWindows(50);
      setEvomiMac(30);
      setEvomiIos(20);
      setEvomiAndroid(0);
      setEvomiBatchSize(10);
    }

    setShowEditModal(true);
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const payload: {
      email: string;
      password: string;
      role: string;
      memberTeamId?: string;
      managedTeamId?: string;
      permissions?: string[];
    } = {
      email: newEmail,
      password: newPassword,
      role: newRole
    };

    if (newRole === 'user' && selectedTeamId) {
      payload.memberTeamId = selectedTeamId;
    } else if (newRole === 'manager') {
      payload.managedTeamId = selectedTeamId;
      payload.permissions = selectedPermissions;
    }

    const res = await apiRequest('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    if (res.success) {
      setShowCreateModal(false);
      setNewEmail('');
      setNewPassword('');
      loadData();
    } else {
      setError(res.message || 'Failed to create account');
    }
  }

  async function handleUpdateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setError('');

    const payload: {
      role?: string;
      password?: string;
      permissions?: string[];
      managedTeamId?: string | null;
      memberTeamId?: string | null;
    } = {
      role: editRole,
      permissions: editRole === 'manager' ? editPermissions : [],
      managedTeamId: editRole === 'manager' ? editTeamId || null : null,
      memberTeamId: editRole === 'user' ? editTeamId || null : null
    };

    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    const res = await apiRequest(`/api/admin/users/${editUser.id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    if (!res.success) {
      setError(res.message || 'Failed to update account permissions');
      return;
    }

    // Save Evomi configuration
    const evomiRes = await apiRequest(`/api/admin/users/${editUser.id}/evomi`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled: evomiEnabled,
        apiKey: evomiApiKey,
        country: evomiCountry,
        protocol: evomiProtocol,
        osDistribution: {
          windows: Number(evomiWindows) || 0,
          mac: Number(evomiMac) || 0,
          ios: Number(evomiIos) || 0,
          android: Number(evomiAndroid) || 0
        },
        batchSize: Number(evomiBatchSize) || 10
      })
    });

    if (evomiRes.success) {
      setShowEditModal(false);
      loadData();
    } else {
      setError(evomiRes.message || 'Failed to update Evomi settings');
    }
  }

  async function handleDeleteUser(id: string, email: string) {
    if (!confirm(`Are you sure you want to delete ${email}?`)) return;
    const res = await apiRequest(`/api/admin/users/${id}`, { method: 'DELETE' });
    if (res.success) loadData();
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold tracking-tight text-[#f1f5f9]">Account & Operator Directory</h2>
            <p className="text-xs text-[#94a3b8] mt-0.5">Manage Superadmins, Team Managers with granular permissions, and Operators.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={loadData}
              className="p-2 rounded-lg border border-[#262c3b] bg-[#161922] hover:bg-[#1e222d] text-[#cbd5e1] text-xs transition-colors"
              title="Refresh"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => { setError(''); setShowCreateModal(true); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#2563eb] hover:bg-[#1d4ed8] text-white text-xs font-medium transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>Create Account</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="rounded-xl border border-[#262c3b] bg-[#161922] overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#11131a] border-b border-[#262c3b] text-[#94a3b8] font-medium uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Account Email</th>
                <th className="py-3 px-4">System Role</th>
                <th className="py-3 px-4">Team Association</th>
                <th className="py-3 px-4">Permissions / Proxies</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#262c3b]/50">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-[#1e222d]/50 transition-colors">
                  <td className="py-3.5 px-4 font-medium text-[#f1f5f9]">{u.email}</td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                        u.role === 'admin'
                          ? 'bg-[#8b5cf6]/10 text-[#a78bfa] border-[#8b5cf6]/25'
                          : u.role === 'manager'
                          ? 'bg-[#2563eb]/10 text-[#60a5fa] border-[#2563eb]/25'
                          : 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/25'
                      }`}
                    >
                      {u.role.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-[#cbd5e1]">
                    {u.role === 'manager' && u.managedTeam ? (
                      <span className="text-[#60a5fa] font-medium">Manages: {u.managedTeam.name}</span>
                    ) : u.memberTeam ? (
                      <span>{u.memberTeam.name}</span>
                    ) : (
                      <span className="text-[#64748b]">Global / None</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4">
                    {u.role === 'manager' ? (
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {u.permissions.map((p) => (
                          <span key={p} className="px-1.5 py-0.2 rounded bg-[#10121a] text-[#94a3b8] border border-[#262c3b] text-[10px]">
                            {p}
                          </span>
                        ))}
                      </div>
                    ) : u.role === 'user' ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[#94a3b8] tabular-data">{u.proxyCount} assigned proxies</span>
                        {u.evomiConfig?.enabled && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] bg-[#2563eb]/15 text-[#60a5fa] border border-[#2563eb]/30 font-medium">
                            Evomi ({u.evomiConfig.country.toUpperCase()})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[#a78bfa] font-semibold text-[11px]">Unrestricted (Superadmin)</span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-right space-x-1">
                    {currentUserRole === 'admin' && (
                      <button
                        onClick={() => openEditModal(u)}
                        className="p-1.5 rounded hover:bg-[#2563eb]/15 text-[#64748b] hover:text-[#60a5fa] transition-colors"
                        title="Edit Permissions & Role"
                      >
                        <Edit2 className="w-3.5 h-3.5 inline" />
                      </button>
                    )}
                    {u.role !== 'admin' && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.email)}
                        className="p-1.5 rounded hover:bg-[#f43f5e]/15 text-[#64748b] hover:text-[#f43f5e] transition-colors"
                        title="Delete User"
                      >
                        <Trash2 className="w-3.5 h-3.5 inline" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Modal: Edit Permissions / Account */}
        {showEditModal && editUser && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-[#f1f5f9]">Edit Permissions & Roles</h3>
                  <p className="text-xs text-[#94a3b8] mt-0.5">{editUser.email}</p>
                </div>
                <button onClick={() => setShowEditModal(false)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && <div className="p-2.5 rounded bg-[#f43f5e]/10 text-xs text-[#fca5a5]">{error}</div>}

              <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
                {currentUserRole === 'admin' && (
                  <div>
                    <label className="block text-[#cbd5e1] font-medium mb-1">Account Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setEditRole('user')}
                        className={`py-2 rounded-lg border text-xs font-semibold ${
                          editRole === 'user'
                            ? 'bg-[#2563eb]/15 border-[#2563eb] text-[#f1f5f9]'
                            : 'border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]'
                        }`}
                      >
                        Operator (User)
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditRole('manager')}
                        className={`py-2 rounded-lg border text-xs font-semibold ${
                          editRole === 'manager'
                            ? 'bg-[#2563eb]/15 border-[#2563eb] text-[#f1f5f9]'
                            : 'border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]'
                        }`}
                      >
                        Team Manager
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">
                    {editRole === 'manager' ? 'Assigned Managed Team' : 'Team Member Assignment'}
                  </label>
                  <select
                    value={editTeamId}
                    onChange={(e) => setEditTeamId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                  >
                    <option value="">None / Standalone</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} (Code: {t.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Reset Password (leave empty to keep current)</label>
                  <input
                    type="text"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] font-mono focus:outline-none focus:border-[#2563eb]"
                    placeholder="New password..."
                  />
                </div>

                {editRole === 'manager' && (
                  <div className="space-y-2 border-t border-[#262c3b] pt-3">
                    <div className="flex items-center justify-between">
                      <label className="block text-[#cbd5e1] font-semibold">
                        Manager Permissions ({editPermissions.length} active)
                      </label>
                      <div className="space-x-2 text-[11px]">
                        <button
                          type="button"
                          onClick={() => setEditPermissions(AVAILABLE_PERMISSIONS.map((p) => p.id))}
                          className="text-[#60a5fa] hover:underline"
                        >
                          Select All
                        </button>
                        <span className="text-[#64748b]">•</span>
                        <button
                          type="button"
                          onClick={() => setEditPermissions([])}
                          className="text-[#f43f5e] hover:underline"
                        >
                          Deselect All
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => {
                        const checked = editPermissions.includes(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer select-none transition-colors ${
                              checked
                                ? 'bg-[#2563eb]/10 border-[#2563eb]/40 text-[#f1f5f9]'
                                : 'border-[#262c3b] text-[#64748b] hover:bg-[#1e222d]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleEditPermission(perm.id)}
                              className="accent-[#2563eb]"
                            />
                            <div>
                              <span className="block text-xs font-mono font-medium">{perm.id}</span>
                              <span className="block text-[10px] text-[#64748b]">{perm.label}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Evomi API Key & Automated Proxy Generator */}
                <div className="space-y-3 border-t border-[#262c3b] pt-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-xs font-semibold text-[#f1f5f9]">Evomi Proxy Generator</span>
                      <span className="block text-[11px] text-[#94a3b8]">Auto-generate 10 fresh residential proxies on Backend</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={evomiEnabled}
                        onChange={(e) => setEvomiEnabled(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-[#262c3b] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#2563eb]"></div>
                    </label>
                  </div>

                  {evomiEnabled && (
                    <div className="space-y-3 rounded-lg border border-[#262c3b] bg-[#11131a] p-3">
                      <div>
                        <label className="block text-[#cbd5e1] font-medium mb-1">Evomi API Key</label>
                        <input
                          type="text"
                          value={evomiApiKey}
                          onChange={(e) => setEvomiApiKey(e.target.value)}
                          placeholder="e.g. your-evomi-api-key"
                          required={evomiEnabled}
                          className="w-full px-3 py-2 bg-[#161922] border border-[#262c3b] rounded-lg text-xs text-[#f1f5f9] font-mono focus:outline-none focus:border-[#2563eb]"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[#cbd5e1] font-medium mb-1">Country</label>
                          <select
                            value={evomiCountry}
                            onChange={(e) => setEvomiCountry(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[#161922] border border-[#262c3b] rounded-lg text-xs text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                          >
                            <option value="all">All / Global</option>
                            <option value="us">United States (US)</option>
                            <option value="gb">United Kingdom (GB)</option>
                            <option value="ca">Canada (CA)</option>
                            <option value="de">Germany (DE)</option>
                            <option value="fr">France (FR)</option>
                            <option value="pk">Pakistan (PK)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[#cbd5e1] font-medium mb-1">Protocol</label>
                          <select
                            value={evomiProtocol}
                            onChange={(e) => setEvomiProtocol(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-[#161922] border border-[#262c3b] rounded-lg text-xs text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                          >
                            <option value="http">HTTP (Port 1000)</option>
                            <option value="socks5">SOCKS5 (Port 1001)</option>
                          </select>
                        </div>
                      </div>

                      {/* OS Distribution % */}
                      <div>
                        <div className="flex items-center justify-between mb-1.5">
                          <label className="block text-[#cbd5e1] font-semibold text-[11px]">
                            Target OS Distribution (%)
                          </label>
                          <span
                            className={`text-[10.5px] font-mono font-medium ${
                              evomiWindows + evomiMac + evomiIos + evomiAndroid === 100
                                ? 'text-[#10b981]'
                                : 'text-[#f59e0b]'
                            }`}
                          >
                            Total: {evomiWindows + evomiMac + evomiIos + evomiAndroid}%
                          </span>
                        </div>
                        <div className="grid grid-cols-4 gap-2">
                          <div>
                            <span className="block text-[10px] text-[#94a3b8] mb-0.5">Windows</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={evomiWindows}
                              onChange={(e) => setEvomiWindows(Number(e.target.value))}
                              className="w-full px-2 py-1 bg-[#161922] border border-[#262c3b] rounded text-xs text-[#f1f5f9] text-center"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#94a3b8] mb-0.5">macOS</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={evomiMac}
                              onChange={(e) => setEvomiMac(Number(e.target.value))}
                              className="w-full px-2 py-1 bg-[#161922] border border-[#262c3b] rounded text-xs text-[#f1f5f9] text-center"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#94a3b8] mb-0.5">iOS</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={evomiIos}
                              onChange={(e) => setEvomiIos(Number(e.target.value))}
                              className="w-full px-2 py-1 bg-[#161922] border border-[#262c3b] rounded text-xs text-[#f1f5f9] text-center"
                            />
                          </div>
                          <div>
                            <span className="block text-[10px] text-[#94a3b8] mb-0.5">Android</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={evomiAndroid}
                              onChange={(e) => setEvomiAndroid(Number(e.target.value))}
                              className="w-full px-2 py-1 bg-[#161922] border border-[#262c3b] rounded text-xs text-[#f1f5f9] text-center"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#262c3b]">
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

        {/* Modal: Create Account */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-[#262c3b] bg-[#161922] p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between border-b border-[#262c3b] pb-3">
                <h3 className="text-sm font-semibold text-[#f1f5f9]">Create New Account</h3>
                <button onClick={() => setShowCreateModal(false)} className="text-[#64748b] hover:text-[#f1f5f9]">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {error && <div className="p-2.5 rounded bg-[#f43f5e]/10 text-xs text-[#fca5a5]">{error}</div>}

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                {currentUserRole === 'admin' && (
                  <div>
                    <label className="block text-[#cbd5e1] font-medium mb-1">Account Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setNewRole('user')}
                        className={`py-2 rounded-lg border text-xs font-semibold ${
                          newRole === 'user'
                            ? 'bg-[#2563eb]/15 border-[#2563eb] text-[#f1f5f9]'
                            : 'border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]'
                        }`}
                      >
                        Operator (User)
                      </button>
                      <button
                        type="button"
                        onClick={() => setNewRole('manager')}
                        className={`py-2 rounded-lg border text-xs font-semibold ${
                          newRole === 'manager'
                            ? 'bg-[#2563eb]/15 border-[#2563eb] text-[#f1f5f9]'
                            : 'border-[#262c3b] text-[#94a3b8] hover:bg-[#1e222d]'
                        }`}
                      >
                        Team Manager
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                    placeholder="account@hostrif.com"
                  />
                </div>

                <div>
                  <label className="block text-[#cbd5e1] font-medium mb-1">Password</label>
                  <input
                    type="text"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] font-mono focus:outline-none focus:border-[#2563eb]"
                    placeholder="Password123!"
                  />
                </div>

                {teams.length > 0 && (
                  <div>
                    <label className="block text-[#cbd5e1] font-medium mb-1">
                      {newRole === 'manager' ? 'Assign Managed Team' : 'Assign to Team (Optional)'}
                    </label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full px-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] focus:outline-none focus:border-[#2563eb]"
                    >
                      <option value="">None / Standalone</option>
                      {teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name} (Code: {t.code})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newRole === 'manager' && (
                  <div className="space-y-2 border-t border-[#262c3b] pt-3">
                    <label className="block text-[#cbd5e1] font-semibold">
                      Manager CRUD Permissions (Select Allowed Actions)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      {AVAILABLE_PERMISSIONS.map((perm) => {
                        const checked = selectedPermissions.includes(perm.id);
                        return (
                          <label
                            key={perm.id}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer select-none transition-colors ${
                              checked
                                ? 'bg-[#2563eb]/10 border-[#2563eb]/40 text-[#f1f5f9]'
                                : 'border-[#262c3b] text-[#64748b] hover:bg-[#1e222d]'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleCreatePermission(perm.id)}
                              className="accent-[#2563eb]"
                            />
                            <div>
                              <span className="block text-xs font-mono font-medium">{perm.id}</span>
                              <span className="block text-[10px] text-[#64748b]">{perm.label}</span>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2 border-t border-[#262c3b]">
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
                    Create Account
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
