'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, type CancellationRequest } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';
import { useToast } from '@/components/toast/ToastProvider';

interface Props {
  locale: Locale;
  dict: Dict;
}

export function CancelView({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const toast = useToast();

  const [requests, setRequests] = useState<CancellationRequest[] | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.cancellations.list();
      setRequests(res.requests);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t(dict, 'common.error'));
    }
  }, [dict]);

  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, locale, router]);

  useEffect(() => {
    if (!ready || !user) return;
    void load();
  }, [ready, user, load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 10) return;
    setBusy(true);
    setError(null);
    try {
      await api.cancellations.create(reason.trim());
      setReason('');
      toast.success(
        'Cancellation requested',
        'Our team will contact you within 2 business days.',
      );
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t(dict, 'common.error'));
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(id: string) {
    setBusy(true);
    setError(null);
    try {
      await api.cancellations.withdraw(id);
      toast.info('Request withdrawn');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t(dict, 'common.error'));
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !user) return null;

  const hasPending = requests?.some((r) => r.status === 'pending') ?? false;

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/${locale}/dashboard`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'cancel.back')}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          {t(dict, 'cancel.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t(dict, 'cancel.subtitle')}</p>

        <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          {t(dict, 'cancel.notice')}
        </div>

        {!hasPending && (
          <form onSubmit={submit} className="card mt-6 p-6">
            <label className="block">
              <span className="label">{t(dict, 'cancel.reasonLabel')}</span>
              <textarea
                className="input mt-1"
                rows={4}
                minLength={10}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t(dict, 'cancel.reasonPlaceholder')}
              />
            </label>
            <button
              type="submit"
              className="btn btn-danger mt-4 w-full"
              disabled={busy || reason.trim().length < 10}
            >
              {busy ? t(dict, 'cancel.submitting') : t(dict, 'cancel.submit')}
            </button>
          </form>
        )}

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {requests !== null && requests.length > 0 && (
          <div className="card mt-6 divide-y divide-gray-100">
            {requests.map((r) => (
              <div key={r.id} className="px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <span className={`badge ${statusClass(r.status)}`}>
                    {r.status}
                  </span>
                  <span className="text-xs text-gray-500">
                    {r.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-700">{r.reason}</p>
                {r.reviewNotes && (
                  <p className="mt-1 text-xs text-gray-500">
                    {t(dict, 'cancel.reviewNotes')}: {r.reviewNotes}
                  </p>
                )}
                {r.status === 'pending' && (
                  <button
                    className="mt-3 text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                    onClick={() => withdraw(r.id)}
                    disabled={busy}
                  >
                    {t(dict, 'cancel.withdraw')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function statusClass(status: CancellationRequest['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'approved':
      return 'bg-red-100 text-red-800';
    case 'rejected':
      return 'bg-green-100 text-green-800';
    case 'withdrawn':
      return 'bg-gray-100 text-gray-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}
