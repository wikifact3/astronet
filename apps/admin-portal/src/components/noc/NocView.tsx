'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api, ApiError,
  type BroadcastCategory,
  type TechnicianLoad,
  type WardGroup,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export function NocView() {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();

  const [groups, setGroups] = useState<WardGroup[] | null>(null);
  const [technicians, setTechnicians] = useState<TechnicianLoad[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setGroups(null);
    setTechnicians(null);
    try {
      const [w, t] = await Promise.all([
        api.adminNoc.wardView(),
        api.adminNoc.technicians(),
      ]);
      setGroups(w.groups);
      setTechnicians(t.technicians);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }, []);

  useEffect(() => {
    if (ready && !staff) router.replace('/admin/login?next=/admin/noc');
  }, [ready, staff, router]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  if (!ready || !staff) return null;

  return (
    <div className="container-admin py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-admin-900">NOC dispatch</h1>
          <p className="mt-1 text-sm text-admin-600">
            Open tickets grouped by Ward. Broadcast SMS to a Ward or the whole network.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="btn btn-outline text-xs">
            Refresh
          </button>
          <button
            onClick={() => setBroadcastOpen(true)}
            className="btn btn-primary text-xs"
          >
            Send broadcast
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {broadcastOpen && (
        <BroadcastPanel
          wards={groups?.map((g) => g.ward).filter((w) => w !== '(unassigned)') ?? []}
          onClose={() => setBroadcastOpen(false)}
          onSent={load}
        />
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-admin-500">
            Tickets by Ward
          </h2>

          {groups === null && !error && (
            <div className="mt-4 text-sm text-admin-500">Loading…</div>
          )}

          {groups !== null && groups.length === 0 && (
            <div className="card mt-4 p-8 text-center text-sm text-admin-500">
              No open tickets. Nice work.
            </div>
          )}

          {groups !== null && groups.length > 0 && (
            <div className="mt-4 space-y-4">
              {groups.map((g) => (
                <div key={g.ward} className="card overflow-hidden">
                  <div className="flex items-center justify-between border-b border-admin-200 bg-admin-50 px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-admin-900">
                        Ward {g.ward}
                      </span>
                      <span className="badge bg-admin-200 text-admin-700">
                        {g.openCount} open
                      </span>
                      {g.urgentCount > 0 && (
                        <span className="badge bg-red-100 text-red-800">
                          {g.urgentCount} urgent
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setBroadcastOpen(true)}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Broadcast →
                    </button>
                  </div>

                  <table className="w-full">
                    <tbody className="divide-y divide-admin-100">
                      {g.tickets.map((t) => (
                        <tr key={t.id} className="hover:bg-admin-50">
                          <td className="td font-mono text-xs text-admin-600 w-32">
                            {t.ticketNumber}
                          </td>
                          <td className="td">
                            <Link
                              href={`/admin/tickets/${t.id}`}
                              className="text-sm font-medium text-admin-900 hover:text-brand-700"
                            >
                              {t.subject}
                            </Link>
                            <div className="text-xs text-admin-500">
                              {t.customerName} · {t.category}
                            </div>
                          </td>
                          <td className="td text-xs text-admin-500 w-24 text-right">
                            {t.ageHours}h
                          </td>
                          <td className="td text-xs w-32">
                            {t.assignedToName ? (
                              <span className="text-admin-700">{t.assignedToName}</span>
                            ) : (
                              <span className="text-admin-400">unassigned</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-admin-500">
            Technician load
          </h2>

          {technicians === null && !error && (
            <div className="mt-4 text-sm text-admin-500">Loading…</div>
          )}

          {technicians !== null && technicians.length === 0 && (
            <div className="card mt-4 p-6 text-center text-sm text-admin-500">
              No dispatchers or technicians registered.
            </div>
          )}

          {technicians !== null && technicians.length > 0 && (
            <div className="card mt-4 divide-y divide-admin-100">
              {technicians.map((t) => (
                <div key={t.id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-admin-900">
                      {t.fullName}
                    </span>
                    <span className="text-xs text-admin-500">{t.role}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-admin-500">
                    <span>{t.openTickets} open</span>
                    <span>{t.assignedToday} today</span>
                  </div>
                  {t.wardAccess && t.wardAccess.length > 0 && (
                    <p className="mt-1 text-[10px] text-admin-400">
                      Wards: {t.wardAccess.join(', ')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BroadcastPanel({
  wards,
  onClose,
  onSent,
}: {
  wards: string[];
  onClose: () => void;
  onSent: () => void;
}) {
  const [selectedWards, setSelectedWards] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<BroadcastCategory>('maintenance');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ recipients: number } | null>(null);

  function toggleWard(w: string) {
    setSelectedWards((prev) =>
      prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w],
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (message.trim().length < 5) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminNoc.broadcast({
        wards: selectedWards.length ? selectedWards : undefined,
        message: message.trim(),
        category,
      });
      setResult({ recipients: res.recipients });
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send');
    } finally {
      setBusy(false);
    }
  }

  const allNetworks = selectedWards.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20">
      <form
        onSubmit={submit}
        className="w-full max-w-lg rounded-lg bg-white shadow-lg"
      >
        <div className="border-b border-admin-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-admin-900">Broadcast SMS</h2>
          <p className="mt-1 text-xs text-admin-500">
            {allNetworks
              ? 'No wards selected — sending to all active customers.'
              : `${selectedWards.length} ward(s) selected.`}
          </p>
        </div>

        {result ? (
          <div className="px-5 py-6 text-center">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-100 text-green-700 text-lg">
              ✓
            </div>
            <p className="mt-3 text-sm font-medium text-admin-900">
              Sent to {result.recipients} recipient
              {result.recipients === 1 ? '' : 's'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-primary mt-4"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="px-5 py-4">
              {wards.length > 0 && (
                <div>
                  <span className="label text-xs">
                    Wards (leave empty for all active customers)
                  </span>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {wards.map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => toggleWard(w)}
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition ${
                          selectedWards.includes(w)
                            ? 'bg-admin-900 text-white'
                            : 'bg-admin-100 text-admin-700 hover:bg-admin-200'
                        }`}
                      >
                        Ward {w}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <label className="mt-4 block">
                <span className="label text-xs">Category</span>
                <select
                  className="input mt-1"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as BroadcastCategory)
                  }
                >
                  <option value="maintenance">Maintenance</option>
                  <option value="outage">Outage</option>
                  <option value="promotion">Promotion</option>
                  <option value="general">General</option>
                </select>
              </label>

              <label className="mt-4 block">
                <span className="label text-xs">Message</span>
                <textarea
                  className="input mt-1"
                  rows={3}
                  minLength={5}
                  maxLength={400}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Keep it short. Max 400 characters."
                />
                <span className="mt-1 block text-right text-[11px] text-admin-400">
                  {message.length}/400
                </span>
              </label>

              {error && (
                <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {error}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-admin-200 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-outline text-xs"
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary text-xs"
                disabled={busy || message.trim().length < 5}
              >
                {busy ? 'Sending…' : 'Send broadcast'}
              </button>
            </div>
          </>
        )}
      </form>
    </div>
  );
}
