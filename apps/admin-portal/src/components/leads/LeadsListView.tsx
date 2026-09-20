'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api, ApiError,
  type AdminLead,
  type LeadStatus,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const FILTERS: { key: LeadStatus | 'all'; label: string }[] = [
  { key: 'submitted', label: 'Submitted' },
  { key: 'needs_review', label: 'Needs review' },
  { key: 'contacted', label: 'Verified' },
  { key: 'converted', label: 'Promoted' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export function LeadsListView() {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();
  const [filter, setFilter] = useState<LeadStatus | 'all'>('submitted');
  const [search, setSearch] = useState('');
  const [leads, setLeads] = useState<AdminLead[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setLeads(null);
    try {
      const res = await api.adminLeads.list({
        status: filter === 'all' ? undefined : filter,
        search: search.trim() || undefined,
        limit: 100,
      });
      setLeads(res.leads);
      setTotal(res.total);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load';
      setError(msg);
    }
  }, [filter, search]);

  useEffect(() => {
    if (ready && !staff) router.replace('/admin/login?next=/admin/leads');
  }, [ready, staff, router]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  async function action(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Action failed');
    } finally {
      setBusy(null);
    }
  }

  if (!ready || !staff) return null;

  return (
    <div className="container-admin py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-admin-900">Leads</h1>
          <p className="mt-1 text-sm text-admin-600">
            Connection requests from the public site.
            {staff.role !== 'SUPER_ADMIN' && (
              <span className="ml-1 text-admin-500">
                Only Super Admin can promote leads to accounts.
              </span>
            )}
          </p>
        </div>
        <button onClick={() => void load()} className="btn btn-outline text-xs">
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f.key
                ? 'bg-admin-900 text-white'
                : 'bg-admin-100 text-admin-700 hover:bg-admin-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <input
          className="input max-w-sm"
          placeholder="Search by name, phone, reference ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void load()}
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

      {leads === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {leads !== null && leads.length === 0 && (
        <div className="card mt-8 p-8 text-center text-sm text-admin-500">
          No leads in this view.
        </div>
      )}

      {leads !== null && leads.length > 0 && (
        <>
          <p className="mt-4 text-xs text-admin-500">
            {leads.length} of {total} shown
          </p>
          <div className="card mt-2 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-admin-200 bg-admin-50">
                <tr>
                  <th className="th">Reference</th>
                  <th className="th">Name</th>
                  <th className="th">Phone</th>
                  <th className="th">Ward</th>
                  <th className="th">Status</th>
                  <th className="th">Submitted</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-100">
                {leads.map((l) => (
                  <tr key={l.id} className="hover:bg-admin-50">
                    <td className="td font-mono text-xs text-admin-600">
                      {l.referenceId ?? '—'}
                    </td>
                    <td className="td font-medium text-admin-900">
                      {l.fullName ?? '(no name)'}
                    </td>
                    <td className="td text-admin-600">{l.phone ?? '—'}</td>
                    <td className="td text-admin-600">
                      {l.municipality} · W{l.ward}
                    </td>
                    <td className="td">
                      <span className={`badge ${statusClass(l.status)}`}>
                        {l.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="td text-admin-600">
                      {l.submittedAt
                        ? l.submittedAt.slice(0, 16).replace('T', ' ')
                        : '—'}
                    </td>
                    <td className="td text-right">
                      <div className="flex justify-end gap-2">
                        {!l.accountId && l.status !== 'rejected' && (
                          <>
                            <button
                              className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                              disabled={busy === l.id}
                              onClick={() => action(l.id, () => api.adminLeads.verify(l.id))}
                            >
                              Verify
                            </button>
                            {staff.role === 'SUPER_ADMIN' && (
                              <>
                                <button
                                  className="text-xs font-medium text-green-700 hover:text-green-800 disabled:opacity-50"
                                  disabled={busy === l.id}
                                  onClick={() =>
                                    action(l.id, () => api.adminLeads.promote(l.id))
                                  }
                                >
                                  Promote
                                </button>
                                <button
                                  className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                                  disabled={busy === l.id}
                                  onClick={() =>
                                    action(l.id, () => api.adminLeads.reject(l.id))
                                  }
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </>
                        )}
                        {l.accountId && (
                          <span className="text-xs text-admin-500">
                            Promoted
                          </span>
                        )}
                      </div>
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

function statusClass(status: LeadStatus): string {
  switch (status) {
    case 'submitted':
      return 'bg-blue-100 text-blue-800';
    case 'needs_review':
      return 'bg-amber-100 text-amber-800';
    case 'contacted':
      return 'bg-indigo-100 text-indigo-800';
    case 'converted':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-admin-100 text-admin-700';
  }
}
