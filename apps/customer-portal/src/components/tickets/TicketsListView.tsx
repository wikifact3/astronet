'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, type TicketSummary, type TicketStatus } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

const FILTERS: { key: TicketStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'Open' },
  { key: 'assigned', label: 'Assigned' },
  { key: 'pending_customer', label: 'Waiting on you' },
  { key: 'resolved', label: 'Resolved' },
  { key: 'closed', label: 'Closed' },
];

export function TicketsListView({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [tickets, setTickets] = useState<TicketSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<TicketStatus | 'all'>('all');

  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, locale, router]);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    setTickets(null);
    setError(null);
    (async () => {
      try {
        const res = await api.tickets.list({
          status: filter === 'all' ? undefined : filter,
          limit: 50,
        });
        if (!cancelled) setTickets(res.tickets);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
          setError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, filter, dict]);

  if (!ready || !user) return null;

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/${locale}/dashboard`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'tickets.back')}
        </Link>

        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t(dict, 'tickets.title')}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {t(dict, 'tickets.subtitle')}
            </p>
          </div>
          <Link
            href={`/${locale}/tickets/new`}
            className="btn btn-primary text-xs whitespace-nowrap"
          >
            {t(dict, 'tickets.newTicket')}
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filter === f.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {tickets === null && !error && (
          <div className="mt-8 text-sm text-gray-500">{t(dict, 'common.loading')}</div>
        )}

        {tickets !== null && tickets.length === 0 && (
          <div className="card mt-8 p-8 text-center text-sm text-gray-500">
            {t(dict, 'tickets.empty')}
          </div>
        )}

        {tickets !== null && tickets.length > 0 && (
          <div className="card mt-8 divide-y divide-gray-100">
            {tickets.map((tk) => (
              <Link
                key={tk.id}
                href={`/${locale}/tickets/${tk.id}`}
                className="flex items-center justify-between gap-4 px-4 py-4 hover:bg-gray-50"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-500">
                      {tk.ticketNumber}
                    </span>
                    <span className={`badge ${statusBadgeClass(tk.status)}`}>
                      {t(dict, `ticketStatus.${tk.status}`)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium text-gray-900">
                    {tk.subject}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {t(dict, `ticketCategory.${tk.category}`)} ·{' '}
                    {tk.createdAt.slice(0, 10)}
                  </p>
                </div>
                <span className="text-xs text-brand-600">
                  {t(dict, 'tickets.view')} →
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

interface Props {
  locale: Locale;
  dict: Dict;
}

function statusBadgeClass(status: TicketStatus): string {
  switch (status) {
    case 'open':
    case 'assigned':
    case 'field_tech_dispatched':
      return 'bg-blue-100 text-blue-800';
    case 'pending_customer':
      return 'bg-amber-100 text-amber-800';
    case 'resolved':
    case 'closed':
      return 'bg-green-100 text-green-800';
    case 'reopened':
      return 'bg-orange-100 text-orange-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
