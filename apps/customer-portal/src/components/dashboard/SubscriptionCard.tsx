import { formatNPR, type CurrentSubscription } from '@/lib/api';
import { t, type Dict } from '@/lib/i18n';

export function SubscriptionCard({
  dict,
  sub,
}: {
  dict: Dict;
  sub: CurrentSubscription;
}) {
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

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            {t(dict, 'dashboard.planSection')}
          </h2>
          <p className="mt-2 text-2xl font-bold text-gray-900">{sub.plan.name}</p>
          <p className="mt-1 text-sm text-gray-600">
            {sub.plan.speedMbps} Mbps
          </p>
        </div>
        <span
          className={`badge ${
            sub.status === 'active'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-700'
          }`}
        >
          {t(dict, `status.${sub.status}`)}
        </span>
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
          <span className="font-medium text-gray-900">
            {sub.validityEnd}
          </span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className={`h-full rounded-full ${
              expired ? 'bg-red-500' : 'bg-brand-600'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-2 flex justify-between text-xs text-gray-500">
          <span>{t(dict, 'dashboard.validityStart')}: {sub.validityStart}</span>
          <span>{t(dict, 'dashboard.validityEnd')}: {sub.validityEnd}</span>
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
    </div>
  );
}
