'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api, ApiError,
  type AccountDetail,
  type AccountStatus,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/components/toast/ToastProvider';

const ALLOWED_TRANSITIONS: Record<AccountStatus, AccountStatus[]> = {
  lead: ['kyc_pending', 'churned'],
  kyc_pending: ['kyc_rejected', 'installation_scheduled', 'churned'],
  kyc_rejected: ['kyc_pending', 'churned'],
  installation_scheduled: ['active', 'kyc_pending', 'churned'],
  active: ['suspended', 'churned'],
  suspended: ['active', 'churned'],
  churned: [],
};

const ALL_STATUSES: AccountStatus[] = [
  'lead',
  'kyc_pending',
  'kyc_rejected',
  'installation_scheduled',
  'active',
  'suspended',
  'churned',
];

export function AccountDetailView({ accountId }: { accountId: string }) {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();
  const toast = useToast();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toStatus, setToStatus] = useState<AccountStatus | ''>('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const a = await api.adminCrm.get(accountId);
      setAccount(a);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load';
      setError(msg);
    }
  }, [accountId]);

  useEffect(() => {
    if (ready && !staff) router.replace(`/admin/login?next=/admin/accounts/${accountId}`);
  }, [ready, staff, router, accountId]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  useEffect(() => {
    if (!account) return;
    const allowed = ALLOWED_TRANSITIONS[account.status];
    setToStatus(allowed[0] ?? '');
  }, [account]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!account || !toStatus) return;
    setSubmitting(true);
    setError(null);
    try {
      const previousStatus = account.status;
      const updated = await api.adminCrm.transition(accountId, {
        toStatus,
        reason: reason.trim() || undefined,
      });
      setAccount(updated);
      setReason('');
      toast.success(
        'Status updated',
        `${previousStatus.replace(/_/g, ' ')} → ${toStatus.replace(/_/g, ' ')}`,
      );
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to transition';
      setError(msg);
      toast.error('Transition failed', msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !staff) return null;

  return (
    <div className="container-admin py-8">
      <Link href="/admin/accounts" className="text-sm text-admin-500 hover:text-admin-700">
        ← Back to CRM
      </Link>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {account === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {account !== null && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-admin-900">
                {account.customerName}
              </h1>
              <span className={`badge ${statusClass(account.status)}`}>
                {account.status.replace(/_/g, ' ')}
              </span>
            </div>
            <p className="mt-1 text-sm text-admin-600">
              {account.customerPhone}
              {account.customerEmail && <> · {account.customerEmail}</>}
            </p>

            <div className="card mt-6 p-5">
              <h2 className="text-sm font-semibold text-admin-900">Account</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <Row label="Account ID" value={account.id} />
                <Row label="Type" value={account.accountType} />
                <Row label="KYC status" value={account.kycStatus} />
                <Row label="Referral" value={account.referralCode ?? '—'} />
                <Row
                  label="Created"
                  value={account.createdAt.slice(0, 16).replace('T', ' ')}
                />
              </dl>
            </div>

            <div className="card mt-4 p-5">
              <h2 className="text-sm font-semibold text-admin-900">History</h2>
              {account.transitions.length === 0 ? (
                <p className="mt-3 text-xs text-admin-500">
                  No status changes recorded yet.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {account.transitions.map((t) => (
                    <li key={t.id} className="border-l-2 border-admin-200 pl-3">
                      <p className="text-xs">
                        <span className="text-admin-500">
                          {t.fromStatus ?? '∅'} →
                        </span>{' '}
                        <span className="font-medium text-admin-900">
                          {t.toStatus}
                        </span>
                      </p>
                      {t.reason && (
                        <p className="mt-0.5 text-xs text-admin-600">
                          {t.reason}
                        </p>
                      )}
                      <p className="mt-0.5 text-[10px] text-admin-400">
                        {t.createdAt.slice(0, 16).replace('T', ' ')} · {t.actorType}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <form onSubmit={onSubmit} className="card p-5">
              <h2 className="text-sm font-semibold text-admin-900">Change status</h2>

              {ALLOWED_TRANSITIONS[account.status].length === 0 ? (
                <p className="mt-3 text-xs text-admin-500">
                  This account is <strong>{account.status}</strong>. No further
                  transitions are allowed.
                </p>
              ) : (
                <>
                  <label className="mt-4 block">
                    <span className="label text-xs">Transition to</span>
                    <select
                      className="input mt-1"
                      value={toStatus}
                      onChange={(e) => setToStatus(e.target.value as AccountStatus)}
                    >
                      {ALLOWED_TRANSITIONS[account.status].map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-4 block">
                    <span className="label text-xs">Reason (optional)</span>
                    <textarea
                      className="input mt-1"
                      rows={3}
                      maxLength={500}
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      placeholder="Why is this changing? Shown in the audit history."
                    />
                  </label>

                  <button
                    type="submit"
                    className="btn btn-primary mt-5 w-full"
                    disabled={submitting || !toStatus}
                  >
                    {submitting ? 'Updating…' : 'Apply transition'}
                  </button>
                </>
              )}
            </form>

            <div className="mt-4 text-xs text-admin-500">
              <p className="font-medium text-admin-700">Allowed next states:</p>
              <ul className="mt-1 space-y-0.5">
                {ALL_STATUSES.map((s) => {
                  const allowed = ALLOWED_TRANSITIONS[account.status] ?? [];
                  if (!allowed.includes(s)) return null;
                  return (
                    <li key={s} className="font-mono">
                      · {s}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-admin-500">{label}</dt>
      <dd className="break-all text-right font-medium text-admin-900">{value}</dd>
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
