'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  api, ApiError,
  type AdminInvoiceRow,
  type AdjustmentKind,
  type InvoiceStatus,
  type ReconciliationSummary,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { AdjustmentModal } from './AdjustmentModal';

const FILTERS: { key: InvoiceStatus | 'all'; label: string }[] = [
  { key: 'issued', label: 'Issued' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'paid', label: 'Paid' },
  { key: 'credit_note', label: 'Credit notes' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'all', label: 'All' },
];

export function BillingView() {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();

  const [filter, setFilter] = useState<InvoiceStatus | 'all'>('issued');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<AdminInvoiceRow[] | null>(null);
  const [summary, setSummary] = useState<ReconciliationSummary | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [adjustFor, setAdjustFor] = useState<AdminInvoiceRow | null>(null);
  const [adjustKind, setAdjustKind] = useState<AdjustmentKind>('charge');

  const load = useCallback(async () => {
    setError(null);
    setRows(null);
    try {
      const res = await api.adminBilling.listInvoices({
        status: filter === 'all' ? undefined : filter,
        search: search.trim() || undefined,
        limit: 100,
      });
      setRows(res.invoices);
      setTotal(res.total);
      setSummary(res.summary);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load');
    }
  }, [filter, search]);

  useEffect(() => {
    if (ready && !staff) router.replace('/admin/login?next=/admin/billing');
  }, [ready, staff, router]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  function openAdjust(invoice: AdminInvoiceRow, kind: AdjustmentKind) {
    setAdjustFor(invoice);
    setAdjustKind(kind);
  }

  function closeAdjust() {
    setAdjustFor(null);
  }

  async function onAdjustSubmitted() {
    closeAdjust();
    await load();
  }

  if (!ready || !staff) return null;

  const canAdjust = staff.role === 'BILLING_ADMIN' || staff.role === 'SUPER_ADMIN';

  return (
    <div className="container-admin py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-admin-900">Billing</h1>
          <p className="mt-1 text-sm text-admin-600">
            Reconciliation, manual adjustments, and refunds.
          </p>
        </div>
        <button onClick={() => void load()} className="btn btn-outline text-xs">
          Refresh
        </button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            label="Outstanding"
            value={formatNPR(summary.amounts.outstanding)}
            sub={`${summary.counts.issued} invoice${summary.counts.issued === 1 ? '' : 's'}`}
          />
          <SummaryCard
            label="Collected"
            value={formatNPR(summary.amounts.collected)}
            sub={`${summary.counts.paid} paid`}
          />
          <SummaryCard
            label="Overdue"
            value={formatNPR(summary.amounts.overdue)}
            sub={`${summary.counts.overdue} overdue`}
            tone="danger"
          />
          <SummaryCard
            label="Credits issued"
            value={formatNPR(summary.amounts.credits)}
            sub={`${summary.counts.creditNote} credit note${summary.counts.creditNote === 1 ? '' : 's'}`}
            tone="muted"
          />
        </div>
      )}

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
          placeholder="Search by invoice number, customer name, or phone…"
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

      {rows === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {rows !== null && rows.length === 0 && (
        <div className="card mt-8 p-8 text-center text-sm text-admin-500">
          No invoices in this view.
        </div>
      )}

      {rows !== null && rows.length > 0 && (
        <>
          <p className="mt-4 text-xs text-admin-500">
            {rows.length} of {total} shown
          </p>
          <div className="card mt-2 overflow-hidden">
            <table className="w-full">
              <thead className="border-b border-admin-200 bg-admin-50">
                <tr>
                  <th className="th">Invoice</th>
                  <th className="th">Customer</th>
                  <th className="th">Issued</th>
                  <th className="th">Due</th>
                  <th className="th text-right">Total</th>
                  <th className="th">Status</th>
                  <th className="th" />
                </tr>
              </thead>
              <tbody className="divide-y divide-admin-100">
                {rows.map((inv) => (
                  <tr key={inv.id} className="hover:bg-admin-50">
                    <td className="td font-mono text-xs text-admin-600">
                      {inv.invoiceNumber}
                      {inv.isAdjustment && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                          ADJ
                        </span>
                      )}
                    </td>
                    <td className="td text-admin-900">
                      {inv.customerName}
                      {inv.customerPhone && (
                        <div className="text-xs text-admin-400">{inv.customerPhone}</div>
                      )}
                    </td>
                    <td className="td text-admin-600">
                      {inv.issuedAt.slice(0, 10)}
                    </td>
                    <td className="td text-admin-600">{inv.dueDate}</td>
                    <td className="td text-right font-medium text-admin-900">
                      {formatNPR(inv.totalAmount)}
                    </td>
                    <td className="td">
                      <span className={`badge ${statusClass(inv.status)}`}>
                        {inv.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="td text-right">
                      {canAdjust && (
                        <div className="flex justify-end gap-2">
                          {inv.status === 'issued' && (
                            <>
                              <button
                                className="text-xs font-medium text-brand-600 hover:text-brand-700"
                                onClick={() => openAdjust(inv, 'charge')}
                              >
                                Charge
                              </button>
                              <button
                                className="text-xs font-medium text-amber-700 hover:text-amber-800"
                                onClick={() => openAdjust(inv, 'credit')}
                              >
                                Credit
                              </button>
                            </>
                          )}
                          {inv.status === 'paid' && (
                            <button
                              className="text-xs font-medium text-red-600 hover:text-red-700"
                              onClick={() => openAdjust(inv, 'refund')}
                            >
                              Refund
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {adjustFor && (
        <AdjustmentModal
          invoice={adjustFor}
          kind={adjustKind}
          onClose={closeAdjust}
          onSubmitted={onAdjustSubmitted}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  sub,
  tone = 'default',
}: {
  label: string;
  value: string;
  sub: string;
  tone?: 'default' | 'danger' | 'muted';
}) {
  const toneClass =
    tone === 'danger'
      ? 'text-red-700'
      : tone === 'muted'
        ? 'text-admin-600'
        : 'text-admin-900';
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-admin-500">{label}</p>
      <p className={`mt-2 text-xl font-semibold ${toneClass}`}>{value}</p>
      <p className="mt-1 text-xs text-admin-500">{sub}</p>
    </div>
  );
}

function statusClass(status: InvoiceStatus): string {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-800';
    case 'issued':
      return 'bg-amber-100 text-amber-800';
    case 'overdue':
      return 'bg-red-100 text-red-800';
    case 'credit_note':
      return 'bg-blue-100 text-blue-800';
    case 'cancelled':
      return 'bg-admin-200 text-admin-700';
    default:
      return 'bg-admin-100 text-admin-700';
  }
}

function formatNPR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-NP', { maximumFractionDigits: 2 })}`;
}
