import type { CurrentSubscription } from '@/lib/api';
import { t, type Dict } from '@/lib/i18n';

export function GraceCard({
  dict,
  sub,
}: {
  dict: Dict;
  sub: CurrentSubscription;
}) {
  const { usedThisYear, maxPerYear, remaining } = sub.gracePeriod;

  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {t(dict, 'dashboard.graceSection')}
      </h2>

      <div className="mt-3 flex items-baseline gap-3">
        <span className="text-3xl font-bold text-gray-900">{remaining}</span>
        <span className="text-sm text-gray-500">
          {t(dict, 'dashboard.graceRemaining')}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: maxPerYear }).map((_, i) => (
          <span
            key={i}
            className={`h-2 flex-1 rounded-full ${
              i < usedThisYear ? 'bg-gray-300' : 'bg-brand-500'
            }`}
          />
        ))}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        {t(dict, 'dashboard.graceUsed')}: {usedThisYear} / {maxPerYear}
      </p>

      <p className="mt-3 text-xs text-gray-600">
        {t(dict, 'dashboard.graceExplanation')}
      </p>
    </div>
  );
}
