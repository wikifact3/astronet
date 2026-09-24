'use client';

import { useState } from 'react';
import {
  api, ApiError,
  type AdminInvoiceRow,
  type AdjustmentKind,
} from '@/lib/api';
import { useToast } from '@/components/toast/ToastProvider';

interface Props {
  invoice: AdminInvoiceRow;
  kind: AdjustmentKind;
  onClose: () => void;
  onSubmitted: () => void;
}

export function AdjustmentModal({ invoice, kind, onClose, onSubmitted }: Props) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const parsed = parseFloat(amount);
  const canSubmit =
    reason.trim().length >= 10 &&
    !Number.isNaN(parsed) &&
    parsed > 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.adminBilling.adjust({
        accountId: invoice.accountId,
        kind,
        amount: parsed,
        reason: reason.trim(),
        originalInvoiceId: kind === 'refund' ? invoice.id : undefined,
      });
      toast.success(
        kind === 'charge'
          ? 'Charge added'
          : kind === 'credit'
            ? 'Credit issued'
            : 'Refund issued',
        `${res.invoiceNumber} · Rs. ${parsed.toLocaleString('en-NP')}`,
      );
      onSubmitted();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to submit';
      setError(msg);
      toast.error('Adjustment failed', msg);
      setBusy(false);
    }
  }

  const title = {
    charge: 'Add charge',
    credit: 'Issue credit',
    refund: 'Issue refund',
  }[kind];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-lg bg-white shadow-lg"
      >
        <div className="border-b border-admin-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-admin-900">{title}</h2>
          <p className="mt-1 text-xs text-admin-500">
            For invoice <span className="font-mono">{invoice.invoiceNumber}</span> ·{' '}
            {invoice.customerName}
          </p>
        </div>

        <div className="px-5 py-4">
          <label className="block">
            <span className="label text-xs">Amount (NPR)</span>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input mt-1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              autoFocus
            />
          </label>

          <label className="mt-4 block">
            <span className="label text-xs">Reason (required)</span>
            <textarea
              className="input mt-1"
              rows={3}
              maxLength={500}
              minLength={10}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="This will appear in the audit log and on the new invoice."
            />
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
            className={`btn text-xs ${kind === 'charge' ? 'btn-primary' : 'btn-danger'}`}
            disabled={busy || !canSubmit}
          >
            {busy ? 'Submitting…' : title}
          </button>
        </div>
      </form>
    </div>
  );
}
