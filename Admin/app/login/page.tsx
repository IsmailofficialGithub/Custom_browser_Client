'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, ArrowRight, Lock, Mail, Users2 } from 'lucide-react';
import { apiRequest } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'admin' | 'manager'>('admin');
  const [email, setEmail] = useState('demo@hostrif.com');
  const [password, setPassword] = useState('Demo123!');
  const [teamCode, setTeamCode] = useState('alpha');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function switchMode(newMode: 'admin' | 'manager') {
    setMode(newMode);
    setError('');
    if (newMode === 'admin') {
      setEmail('demo@hostrif.com');
      setPassword('Demo123!');
    } else {
      setEmail('manager@alpha.com');
      setPassword('Manager123!');
      setTeamCode('alpha');
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload: { email: string; password: string; teamCode?: string } = { email, password };
      if (mode === 'manager') {
        payload.teamCode = teamCode.trim();
      }

      const res = await apiRequest('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (res.success && res.token) {
        localStorage.setItem('hostrif_admin_token', res.token);
        localStorage.setItem('hostrif_admin_user', JSON.stringify(res.user));
        router.push('/');
      } else {
        setError(res.message || 'Invalid authentication credentials.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(`Server unreachable: ${msg}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-xl border border-[#262c3b] bg-[#161922] p-8 shadow-2xl">
        {/* Brand */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-10 h-10 rounded-lg bg-[#2563eb]/15 border border-[#2563eb]/30 flex items-center justify-center text-[#60a5fa] mb-3">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-semibold text-[#f1f5f9]">HOSTRIF Portal</h2>
          <p className="text-xs text-[#94a3b8] mt-1">Select your access role to continue.</p>
        </div>

        {/* Role Toggle Selector */}
        <div className="grid grid-cols-2 p-1 rounded-lg bg-[#10121a] border border-[#262c3b] mb-5">
          <button
            type="button"
            onClick={() => switchMode('admin')}
            className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'admin'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-[#f1f5f9]'
            }`}
          >
            Superadmin
          </button>
          <button
            type="button"
            onClick={() => switchMode('manager')}
            className={`py-1.5 rounded-md text-xs font-semibold transition-all ${
              mode === 'manager'
                ? 'bg-[#2563eb] text-white shadow-sm'
                : 'text-[#94a3b8] hover:text-[#f1f5f9]'
            }`}
          >
            Team Manager
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#f43f5e]/10 border border-[#f43f5e]/20 text-xs text-[#fca5a5]">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          {mode === 'manager' && (
            <div>
              <label className="block text-xs font-medium text-[#cbd5e1] mb-1.5">Team Code / ID</label>
              <div className="relative flex items-center">
                <Users2 className="absolute left-3 w-4 h-4 text-[#64748b] pointer-events-none" />
                <input
                  type="text"
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] placeholder-[#475569] font-mono focus:outline-none focus:border-[#2563eb] transition-colors"
                  placeholder="e.g. alpha"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#cbd5e1] mb-1.5">Email Address</label>
            <div className="relative flex items-center">
              <Mail className="absolute left-3 w-4 h-4 text-[#64748b] pointer-events-none" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#2563eb] transition-colors"
                placeholder={mode === 'admin' ? 'admin@hostrif.com' : 'manager@team.com'}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#cbd5e1] mb-1.5">Password</label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3 w-4 h-4 text-[#64748b] pointer-events-none" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 bg-[#10121a] border border-[#262c3b] rounded-lg text-sm text-[#f1f5f9] placeholder-[#475569] focus:outline-none focus:border-[#2563eb] transition-colors"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium bg-[#2563eb] hover:bg-[#1d4ed8] text-white transition-colors disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : `Sign In as ${mode === 'admin' ? 'Admin' : 'Manager'}`}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
