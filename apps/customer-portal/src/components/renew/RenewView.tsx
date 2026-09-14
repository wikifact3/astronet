'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, formatNPR, type CurrentSubscription } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  dict: Dict;
}

export function RenewView({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [sub, setSub] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side guard
  useEffect(() => {
    if (ready && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [ready, user, locale, router]);

  // Fetch current subscription (which has plan + price)
  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const s = await api.subscriptions.current();
        if (cancelled) return;
        setSub(s);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
        setError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, dict]);

  if (!ready || !user) {
    return (
      <div className="container-page py-16 text-center text-sm text-gray-500">
        {t(dict, 'common.loading')}
      </div>
    );
  }

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/${locale}/dashboard`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'renew.backButton')}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          {t(dict, 'renew.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t(dict, 'renew.subtitle')}</p>

        {loading && (
          <div className="card mt-8 p-6 text-sm text-gray-500">
            {t(dict, 'common.loading')}
          </div>
        )}

        {error && (
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {sub && (
          <>
            <div className="card mt-8 p-6">
              <dl className="divide-y divide-gray-100">
                <Row
                  label={t(dict, 'renew.planLabel')}
                  value={`${sub.plan.name} — ${sub.plan.speedMbps} Mbps`}
                />
                <Row
                  label={t(dict, 'dashboard.validityEnd')}
                  value={sub.validityEnd}
                />
                <Row
                  label={t(dict, 'renew.periodLabel')}
                  value={`1 month (${sub.plan.speedMbps} Mbps)`}
                />
                <Row
                  label={t(dict, 'plans.basePrice')}
                  value={formatNPR(sub.plan.basePrice)}
                />
                <Row
                  label="VAT (13%)"
                  value={formatNPR(sub.plan.vatAmount)}
                />
                <Row
                  label="TSC (1%)"
                  value={formatNPR(sub.plan.tscAmount)}
                />
                <Row
                  label={t(dict, 'renew.amountLabel')}
                  value={formatNPR(sub.plan.totalPrice)}
                  emphasis
                />
              </dl>
            </div>

            <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900">
                {t(dict, 'renew.comingSoon')}
              </p>
              <p className="mt-2 text-xs text-amber-800">
                {t(dict, 'renew.invoiceNote')}
              </p>
            </div>

            <button
              type="button"
              className="btn btn-primary mt-6 w-full"
              disabled
              title="Payment integration coming soon"
            >
              {t(dict, 'renew.payButton')}
            </button>

            {sub.daysRemaining > 0 && (
              <p className="mt-4 text-center text-xs text-gray-500">
                {t(dict, 'renew.daysRemainingNote', { days: sub.daysRemaining })}
              </p>
            )}
          </>
        )}
      </div>
    </section>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <dt className={emphasis ? 'font-medium text-gray-900' : 'text-gray-600'}>
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? 'text-lg font-semibold text-gray-900'
            : 'font-medium text-gray-900'
        }
      >
        {value}
      </dd>
    </div>
  );
}
