import { formatNPR, type CurrentSubscription } from '@/lib/api';
import { t, type Dict } from '@/lib/i18n';

export function PlanSummary({
  dict,
  sub,
}: {
  dict: Dict;
  sub: CurrentSubscription;
}) {
  return (
    <div className="card p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
        {t(dict, 'dashboard.speed')}
      </h2>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {sub.plan.speedMbps}
        <span className="ml-1 text-base font-normal text-gray-500">Mbps</span>
      </p>

      <dl className="mt-4 space-y-1.5 text-xs text-gray-600">
        <div className="flex justify-between">
          <dt>{t(dict, 'plans.basePrice') || 'Base'}</dt>
          <dd>{formatNPR(sub.plan.basePrice)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>VAT (13%)</dt>
          <dd>{formatNPR(sub.plan.vatAmount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>TSC (1%)</dt>
          <dd>{formatNPR(sub.plan.tscAmount)}</dd>
        </div>
      </dl>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-500">{t(dict, 'dashboard.monthlyTotal')}</p>
        <p className="text-xl font-semibold text-gray-900">
          {formatNPR(sub.plan.totalPrice)}
        </p>
      </div>
    </div>
  );
}
