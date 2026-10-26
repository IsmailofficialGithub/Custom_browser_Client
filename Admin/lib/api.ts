const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:50052';

export async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('hostrif_admin_token') : null;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('hostrif_admin_token');
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
  }

  return res.json();
}
