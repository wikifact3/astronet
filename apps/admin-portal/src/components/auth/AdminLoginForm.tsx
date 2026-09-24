'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/components/toast/ToastProvider';

export function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { staff, ready, login } = useAdminAuth();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Redirect target: ?next=/admin/... or fallback
  const next = params.get('next') || '/admin/kyc';

  useEffect(() => {
    if (ready && staff) {
      router.replace(next);
    }
  }, [ready, staff, next, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.adminAuth.login(email, password);
      login(result);
      toast.success(
        `Welcome, ${result.staff.fullName.split(' ')[0]}`,
        `Signed in as ${result.staff.role}`,
      );
      router.replace(next);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Something went wrong';
      setError(msg);
      toast.error('Sign in failed', msg);
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center text-sm text-admin-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-admin-100 p-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-lg border border-admin-200 bg-white p-8 shadow-sm"
      >
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-admin-900 text-xs font-bold text-white">
            PL
          </span>
          <span className="text-base font-semibold text-admin-900">
            PowerLink Admin
          </span>
        </div>

        <h1 className="text-lg font-semibold text-admin-900">Sign in</h1>
        <p className="mt-1 text-xs text-admin-500">
          Staff access only. All activity is logged.
        </p>

        <label className="mt-6 block">
          <span className="label">Email</span>
          <input
            type="email"
            autoComplete="username"
            className="input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>

        <label className="mt-4 block">
          <span className="label">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </label>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary mt-6 w-full"
          disabled={busy || !email || password.length < 8}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
