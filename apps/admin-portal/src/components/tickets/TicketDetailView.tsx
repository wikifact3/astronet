'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api, ApiError,
  type AdminTicketDetail,
  type AssignableStaff,
  type TicketStatus,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/components/toast/ToastProvider';

const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'field_tech_dispatched', label: 'Technician dispatched' },
  { value: 'pending_customer', label: 'Waiting on customer' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

export function TicketDetailView({ ticketId }: { ticketId: string }) {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();
  const toast = useToast();

  const [ticket, setTicket] = useState<AdminTicketDetail | null>(null);
  const [assignable, setAssignable] = useState<AssignableStaff[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [assignTo, setAssignTo] = useState('');
  const [newStatus, setNewStatus] = useState<TicketStatus>('assigned');

  const load = useCallback(async () => {
    setError(null);
    try {
      const [t, s] = await Promise.all([
        api.adminTickets.get(ticketId),
        api.adminTickets.assignableStaff(),
      ]);
      setTicket(t);
      setAssignable(s.staff);
      setNewStatus(t.status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }, [ticketId]);

  useEffect(() => {
    if (ready && !staff) router.replace(`/admin/login?next=/admin/tickets/${ticketId}`);
  }, [ready, staff, router, ticketId]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  async function submitReply(e: React.FormEvent) {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const t = await api.adminTickets.reply(ticketId, replyText.trim(), isInternal);
      setTicket(t);
      setReplyText('');
      setIsInternal(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send');
    } finally {
      setSubmitting(false);
    }
  }

  async function doAssign() {
    if (!assignTo) return;
    setSubmitting(true);
    setError(null);
    try {
      const t = await api.adminTickets.assign(ticketId, assignTo);
      setTicket(t);
      setAssignTo('');
      toast.success('Ticket assigned', `Assigned to ${t.assignedToName ?? 'staff'}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  }

  async function doUpdateStatus() {
    setSubmitting(true);
    setError(null);
    try {
      const t = await api.adminTickets.updateStatus(ticketId, newStatus);
      setTicket(t);
      toast.success(
        'Status updated',
        `Now ${newStatus.replace(/_/g, ' ')}`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update');
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !staff) return null;

  return (
    <div className="container-admin py-8">
      <Link href="/admin/tickets" className="text-sm text-admin-500 hover:text-admin-700">
        ← Back to tickets
      </Link>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {ticket === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {ticket !== null && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-xs text-admin-500">
                {ticket.ticketNumber}
              </span>
              <span className={`badge ${statusClass(ticket.status)}`}>
                {ticket.status.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-admin-500">
                {ticket.category}
              </span>
            </div>
            <h1 className="mt-2 text-xl font-semibold text-admin-900">
              {ticket.subject}
            </h1>
            <p className="mt-1 text-sm text-admin-600">
              {ticket.customerName}
              {ticket.customerPhone && <> · {ticket.customerPhone}</>}
            </p>

            <div className="mt-6 space-y-4">
              {ticket.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg border p-4 text-sm ${
                    m.isInternal
                      ? 'border-amber-200 bg-amber-50'
                      : m.authorType === 'customer'
                        ? 'border-brand-100 bg-brand-50'
                        : 'border-admin-200 bg-white'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-admin-500">
                    <span className="font-medium text-admin-700">
                      {m.authorName}
                      {m.isInternal && ' (internal note)'}
                    </span>
                    <span>{m.createdAt.slice(0, 16).replace('T', ' ')}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-admin-900">{m.message}</p>
                </div>
              ))}
            </div>

            <form onSubmit={submitReply} className="mt-6">
              <textarea
                className="input"
                rows={3}
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Type a reply…"
              />
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center gap-2 text-xs text-admin-600">
                  <input
                    type="checkbox"
                    checked={isInternal}
                    onChange={(e) => setIsInternal(e.target.checked)}
                  />
                  Internal note (not shown to customer)
                </label>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !replyText.trim()}
                >
                  {submitting ? 'Sending…' : 'Send'}
                </button>
              </div>
            </form>
          </div>

          <div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-admin-900">Assignment</h2>
              <p className="mt-2 text-xs text-admin-500">
                Current:{' '}
                {ticket.assignedToName ?? (
                  <span className="text-admin-400">Unassigned</span>
                )}
              </p>

              <label className="mt-4 block">
                <span className="label text-xs">Assign to</span>
                <select
                  className="input mt-1"
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                >
                  <option value="">Select…</option>
                  {assignable.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.role})
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-secondary mt-3 w-full text-xs"
                onClick={doAssign}
                disabled={!assignTo || submitting}
              >
                Assign
              </button>
            </div>

            <div className="card mt-4 p-5">
              <h2 className="text-sm font-semibold text-admin-900">Status</h2>
              <label className="mt-3 block">
                <select
                  className="input"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn btn-primary mt-3 w-full text-xs"
                onClick={doUpdateStatus}
                disabled={submitting || newStatus === ticket.status}
              >
                Update status
              </button>
              <p className="mt-2 text-xs text-admin-500">
                Customer is notified by SMS on <strong>resolved</strong>,{' '}
                <strong>dispatched</strong>, and <strong>waiting on customer</strong>.
              </p>
            </div>

            <div className="card mt-4 p-5 text-xs text-admin-600">
              <h2 className="text-sm font-semibold text-admin-900">Meta</h2>
              <dl className="mt-3 space-y-1.5">
                <div className="flex justify-between">
                  <dt>Created</dt>
                  <dd>{ticket.createdAt.slice(0, 16).replace('T', ' ')}</dd>
                </div>
                {ticket.resolvedAt && (
                  <div className="flex justify-between">
                    <dt>Resolved</dt>
                    <dd>{ticket.resolvedAt.slice(0, 16).replace('T', ' ')}</dd>
                  </div>
                )}
                <div className="flex justify-between">
                  <dt>Ward</dt>
                  <dd>{ticket.ward ?? '—'}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
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
