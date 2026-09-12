'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type CurrentSubscription, type MeResponse } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';
import { SubscriptionCard } from './SubscriptionCard';
import { PlanSummary } from './PlanSummary';
import { GraceCard } from './GraceCard';

interface Props {
  locale: Locale;
  dict: Dict;
}

export function DashboardView({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [me, setMe] = useState<MeResponse | null>(null);
  const [sub, setSub] = useState<CurrentSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Client-side guard
  useEffect(() => {
    if (ready && !user) {
      router.replace(`/${locale}/login`);
    }
  }, [ready, user, locale, router]);

  // Fetch data when authenticated
  useEffect(() => {
    if (!ready || !user) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [meRes, subRes] = await Promise.all([
          api.me.get(),
          api.subscriptions.current(),
        ]);
        if (cancelled) return;
        setMe(meRes);
        setSub(subRes);
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

  if (!ready) {
    return (
      <div className="container-page py-16 text-center text-sm text-gray-500">
        {t(dict, 'common.loading')}
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const account = me?.accounts[0] ?? null;
  const greetingName = user.fullName || user.phone;

  return (
    <section className="container-page py-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {t(dict, 'dashboard.greeting', { name: greetingName })}
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          {t(dict, 'dashboard.subtitle')}
        </p>
      </div>

      {loading && (
        <div className="mt-8 text-sm text-gray-500">{t(dict, 'common.loading')}</div>
      )}

      {error && (
        <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {sub && (
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <SubscriptionCard dict={dict} sub={sub} />
          </div>
          <div className="space-y-6">
            <PlanSummary dict={dict} sub={sub} />
            <GraceCard dict={dict} sub={sub} />
          </div>
        </div>
      )}

      {me && account && (
        <div className="mt-6 card p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t(dict, 'dashboard.accountSection')}
          </h2>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3 text-sm">
            <div>
              <dt className="text-gray-500">{t(dict, 'dashboard.accountStatus')}</dt>
              <dd className="mt-1 font-medium text-gray-900">
                {t(dict, `status.${account.status}`)}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">KYC</dt>
              <dd className="mt-1 font-medium text-gray-900">
                {me.kycStatus}
              </dd>
            </div>
            <div>
              <dt className="text-gray-500">Phone</dt>
              <dd className="mt-1 font-medium text-gray-900">{me.phone}</dd>
            </div>
          </dl>
        </div>
      )}
    </section>
  );
}
