'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api, ApiError,
  type AdminTicketSummary,
  type TicketStatus,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const FILTERS: { key: TicketStatus | 'all'; label: string }[] = [
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'field_tech_dispatched', label: 'Dispatched' },
  { key: 'pending_customer', label: 'Waiting on customer' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
];

export function TicketsListView() {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();
  const [filter, setFilter] = useState<TicketStatus | 'all'>('open');
  const [search, setSearch] = useState('');
  const [tickets, setTickets] = useState<AdminTicketSummary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setTickets(null);
    try {
      const res = await api.adminTickets.list({
        status: filter === 'all' ? undefined : filter,
        search: search.trim() || undefined,
        limit: 100,
      });
      setTickets(res.tickets);
      setTotal(res.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }, [filter, search]);

  useEffect(() => {
    if (ready && !staff) router.replace('/admin/login?next=/admin/tickets');
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
          <h1 className="text-xl font-semibold text-admin-900">Tickets</h1>
          <p className="mt-1 text-sm text-admin-600">
            Customer support queue. Assign to dispatchers and technicians.
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
          placeholder="Search subject or description…"
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

      {tickets === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {tickets !== null && tickets.length === 0 && (
        <div className="card mt-8 p-8 text-center text-sm text-admin-500">
          No tickets in this view.
        </div>
      )}

      {tickets !== null && tickets.length > 0 && (
        <>
          <p className="mt-4 text-xs text-admin-500">
            {tickets.length} of {total} shown
          </p>
          <div className="card mt-2 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-admin-200 bg-admin-50">
                <tr>
                  <th className="th">Ticket</th>
                  <th className="th">Subject</th>
                  <th className="th">Customer</th>
                  <th className="th">Status</th>
                  <th className="th">Assigned</th>
                  <th className="th">Created</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-100">
                {tickets.map((t) => (
                  <tr key={t.id} className="hover:bg-admin-50">
                    <td className="td font-mono text-xs text-admin-600">
                      {t.ticketNumber}
                    </td>
                    <td className="td font-medium text-admin-900">{t.subject}</td>
                    <td className="td text-admin-600">
                      {t.customerName}
                      {t.customerPhone && (
                        <div className="text-xs text-admin-400">{t.customerPhone}</div>
                      )}
                    </td>
                    <td className="td">
                      <span className={`badge ${statusClass(t.status)}`}>
                        {t.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="td text-admin-600">
                      {t.assignedToName ?? (
                        <span className="text-admin-400">Unassigned</span>
                      )}
                    </td>
                    <td className="td text-admin-600">
                      {t.createdAt.slice(0, 16).replace('T', ' ')}
                    </td>
                    <td className="td text-right">
                      <Link
                        href={`/admin/tickets/${t.id}`}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        Open →
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

function statusClass(status: TicketStatus): string {
  switch (status) {
    case 'open':
      return 'bg-blue-100 text-blue-800';
    case 'assigned':
      return 'bg-indigo-100 text-indigo-800';
    case 'field_tech_dispatched':
      return 'bg-purple-100 text-purple-800';
    case 'pending_customer':
      return 'bg-amber-100 text-amber-800';
    case 'resolved':
      return 'bg-green-100 text-green-800';
    case 'reopened':
      return 'bg-orange-100 text-orange-800';
    case 'closed':
      return 'bg-admin-200 text-admin-700';
    default:
      return 'bg-admin-100 text-admin-700';
  }
}
