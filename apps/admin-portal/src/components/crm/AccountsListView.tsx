'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api, ApiError,
  type AccountSummary,
  type AccountStatus,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const STATUSES: { key: AccountStatus | 'all'; label: string }[] = [
  { key: 'lead', label: 'Leads' },
  { key: 'kyc_pending', label: 'KYC pending' },
  { key: 'kyc_rejected', label: 'KYC rejected' },
  { key: 'installation_scheduled', label: 'Install scheduled' },
  { key: 'active', label: 'Active' },
  { key: 'suspended', label: 'Suspended' },
  { key: 'churned', label: 'Churned' },
  { key: 'all', label: 'All' },
];

export function AccountsListView() {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();

  const [filter, setFilter] = useState<AccountStatus | 'all'>('lead');
  const [search, setSearch] = useState('');
  const [accounts, setAccounts] = useState<AccountSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setAccounts(null);
    try {
      const res = await api.adminCrm.list({
        status: filter === 'all' ? undefined : filter,
        search: search.trim() || undefined,
        limit: 100,
      });
      setAccounts(res.accounts);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load';
      setError(msg);
    }
  }, [filter, search]);

  useEffect(() => {
    if (ready && !staff) router.replace('/admin/login?next=/admin/accounts');
  }, [ready, staff, router]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  if (!ready || !staff) return null;

  return (
    <div className="container-admin py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-admin-900">CRM</h1>
          <p className="mt-1 text-sm text-admin-600">
            Manage the account lifecycle from lead to active to churned.
          </p>
        </div>
        <button onClick={() => void load()} className="btn btn-outline text-xs">
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s.key}
            onClick={() => setFilter(s.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === s.key
                ? 'bg-admin-900 text-white'
                : 'bg-admin-100 text-admin-700 hover:bg-admin-200'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="input max-w-sm"
          placeholder="Search by name, phone, email, referral code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void load();
          }}
        />
        <button onClick={() => void load()} className="btn btn-secondary text-xs">
          Search
        </button>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {accounts === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {accounts !== null && accounts.length === 0 && (
        <div className="card mt-8 p-8 text-center text-sm text-admin-500">
          No accounts in this view.
        </div>
      )}

      {accounts !== null && accounts.length > 0 && (
        <>
          <p className="mt-4 text-xs text-admin-500">
            {accounts.length} of {total} shown
          </p>
          <div className="card mt-2 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-admin-200 bg-admin-50">
                <tr>
                  <th className="th">Customer</th>
                  <th className="th">Phone</th>
                  <th className="th">Type</th>
                  <th className="th">Status</th>
                  <th className="th">Referral</th>
                  <th className="th">Updated</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-100">
                {accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-admin-50">
                    <td className="td font-medium text-admin-900">{a.customerName}</td>
                    <td className="td text-admin-600">{a.customerPhone}</td>
                    <td className="td text-admin-600">{a.accountType}</td>
                    <td className="td">
                      <span className={`badge ${statusClass(a.status)}`}>
                        {a.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="td font-mono text-xs text-admin-600">
                      {a.referralCode ?? '—'}
                    </td>
                    <td className="td text-admin-600">
                      {a.updatedAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="td text-right">
                      <Link
                        href={`/admin/accounts/${a.id}`}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function statusClass(status: AccountStatus): string {
  switch (status) {
    case 'active':
      return 'bg-green-100 text-green-800';
    case 'suspended':
    case 'kyc_rejected':
      return 'bg-red-100 text-red-800';
    case 'churned':
      return 'bg-admin-200 text-admin-700';
    case 'lead':
      return 'bg-blue-100 text-blue-800';
    case 'kyc_pending':
    case 'installation_scheduled':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-admin-100 text-admin-700';
  }
}
