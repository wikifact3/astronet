'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, type TicketDetail } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  dict: Dict;
  ticketId: string;
}

export function TicketDetailView({ locale, dict, ticketId }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [reopening, setReopening] = useState(false);

  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, locale, router]);

  async function load() {
    setError(null);
    try {
      const res = await api.tickets.get(ticketId);
      setTicket(res);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setError(msg);
    }
  }

  useEffect(() => {
    if (!ready || !user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, user, ticketId]);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !ticket) return;
    setSending(true);
    setError(null);
    try {
      const updated = await api.tickets.addMessage(ticketId, reply.trim());
      setTicket(updated);
      setReply('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  async function reopen() {
    if (!ticket) return;
    setReopening(true);
    setError(null);
    try {
      const updated = await api.tickets.reopen(ticketId);
      setTicket(updated);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setError(msg);
    } finally {
      setReopening(false);
    }
  }

  if (!ready || !user) return null;

  const canReply =
    ticket !== null &&
    ticket.status !== 'closed' &&
    !(ticket.status === 'resolved' && !ticket.reopenDeadline);

  const reopenAvailable =
    ticket !== null &&
    ticket.status === 'resolved' &&
    ticket.reopenDeadline !== null &&
    new Date(ticket.reopenDeadline) > new Date();

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/${locale}/tickets`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'tickets.backToTickets')}
        </Link>

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {ticket === null && !error && (
          <div className="mt-8 text-sm text-gray-500">{t(dict, 'common.loading')}</div>
        )}

        {ticket !== null && (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-gray-500">
                {ticket.ticketNumber}
              </span>
              <span className={`badge ${statusBadgeClass(ticket.status)}`}>
                {t(dict, `ticketStatus.${ticket.status}`)}
              </span>
              <span className="text-xs text-gray-500">
                {t(dict, `ticketCategory.${ticket.category}`)}
              </span>
            </div>

            <h1 className="mt-2 text-2xl font-bold text-gray-900">
              {ticket.subject}
            </h1>

            {ticket.reopenedCount > 0 && (
              <p className="mt-1 text-xs text-orange-600">
                {t(dict, 'tickets.reopenedCount', { count: ticket.reopenedCount })}
              </p>
            )}

            {reopenAvailable && ticket.reopenDeadline && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                <span>
                  {t(dict, 'tickets.reopenWindow', {
                    date: ticket.reopenDeadline.slice(0, 10),
                  })}
                </span>
                <button
                  type="button"
                  className="btn btn-primary text-xs"
                  disabled={reopening}
                  onClick={reopen}
                >
                  {t(dict, 'tickets.reopen')}
                </button>
              </div>
            )}

            <div className="mt-6 space-y-4">
              {ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg border p-4 text-sm ${
                    m.authorType === 'customer'
                      ? 'border-brand-100 bg-brand-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-medium text-gray-700">
                      {m.authorType === 'customer'
                        ? t(dict, 'tickets.you')
                        : m.authorName}
                    </span>
                    <span>{m.createdAt.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-gray-900">
                    {m.message}
                  </p>
                </div>
              ))}
            </div>

            {canReply ? (
              <form onSubmit={sendReply} className="mt-6">
                <label className="label">
                  {t(dict, 'tickets.replyLabel')}
                </label>
                <textarea
                  className="input mt-1"
                  rows={4}
                  maxLength={5000}
                  placeholder={t(dict, 'tickets.replyPlaceholder')}
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                />
                <div className="mt-3 flex justify-end">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={sending || reply.trim().length === 0}
                  >
                    {sending
                      ? t(dict, 'tickets.sending')
                      : t(dict, 'tickets.send')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6 rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
                {t(dict, 'tickets.closedNotice')}
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function statusBadgeClass(status: TicketDetail['status']): string {
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
