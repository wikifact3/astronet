'use client';

import Link from 'next/link';
import { formatNPR, type CurrentSubscription } from '@/lib/api';
import { t, type Dict, type Locale } from '@/lib/i18n';

interface Props {
  dict: Dict;
  locale: Locale;
  sub: CurrentSubscription;
}

export function SubscriptionCard({ dict, locale, sub }: Props) {
  const totalDays = Math.max(
    1,
    Math.round(
      (new Date(sub.validityEnd).getTime() - new Date(sub.validityStart).getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );
  const elapsed = Math.max(0, totalDays - sub.daysRemaining);
  const pct = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));
  const expired = sub.daysRemaining <= 0;

  // Urgency-driven CTA: normal, low (<5 days), expired
  const urgency: 'normal' | 'low' | 'expired' =
    expired ? 'expired' : sub.daysRemaining <= 5 ? 'low' : 'normal';

  const ctaLabel =
    urgency === 'expired'
      ? t(dict, 'dashboard.renewCtaExpired')
      : urgency === 'low'
        ? t(dict, 'dashboard.renewCtaExpiring', { days: sub.daysRemaining })
        : t(dict, 'dashboard.renewCta');

  const ctaClass =
    urgency === 'expired'
      ? 'btn bg-red-600 text-white hover:bg-red-700'
      : urgency === 'low'
        ? 'btn bg-amber-500 text-white hover:bg-amber-600'
        : 'btn btn-primary';

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t(dict, 'dashboard.planSection')}
          </h2>
          <p className="mt-2 text-2xl font-bold text-gray-900">{sub.plan.name}</p>
          <p className="mt-1 text-sm text-gray-600">{sub.plan.speedMbps} Mbps</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span
            className={`badge ${
              sub.status === 'active'
                ? 'bg-green-100 text-green-800'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {t(dict, `status.${sub.status}`)}
          </span>
          <span
            className={`badge ${
              sub.autoRenew
                ? 'bg-blue-50 text-blue-700'
                : 'bg-gray-50 text-gray-600'
            }`}
          >
            {sub.autoRenew
              ? t(dict, 'dashboard.autoRenewOn')
              : t(dict, 'dashboard.autoRenewOff')}
          </span>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            {expired
              ? t(dict, 'dashboard.expired')
              : sub.daysRemaining === 1
                ? t(dict, 'dashboard.daysRemainingOne')
                : t(dict, 'dashboard.daysRemaining', { days: sub.daysRemaining })}
          </span>
          <span className="font-medium text-gray-900">{sub.validityEnd}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${
              expired
                ? 'bg-red-500'
                : urgency === 'low'
                  ? 'bg-amber-500'
                  : 'bg-brand-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>
            {t(dict, 'dashboard.validityStart')}: {sub.validityStart}
          </span>
          <span>
            {t(dict, 'dashboard.validityEnd')}: {sub.validityEnd}
          </span>
        </div>
      </div>

      <div className="mt-6 border-t border-gray-100 pt-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          {t(dict, 'dashboard.fupSection')}
        </p>
        <div className="mt-2 flex items-baseline justify-between">
          <span className="text-lg font-semibold text-gray-900">
            {t(dict, `fupTier.${sub.fupTier}`)}
          </span>
          {sub.plan.fupThresholdGb !== null && (
            <span className="text-xs text-gray-500">
              {t(dict, 'dashboard.fupThreshold')}: {sub.plan.fupThresholdGb} GB
            </span>
          )}
        </div>
        <p className="mt-2 text-sm text-gray-600">{sub.fupExplanation}</p>
      </div>

      {/* Renewal CTA */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500">
              {t(dict, 'dashboard.renewSubtitle')}
            </p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatNPR(sub.plan.totalPrice)}
              <span className="text-sm font-normal text-gray-500">
                {t(dict, 'plans.perMonth')}
              </span>
            </p>
          </div>
          <Link href={`/${locale}/renew`} className={ctaClass}>
            {ctaLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
