'use client';

import { formatNPR, type PlanPublic } from '@/lib/api';
import { t, type Dict } from '@/lib/i18n';
import type { WizardState } from '../ConnectionWizard';

interface Props {
  dict: Dict;
  plans: PlanPublic[];
  state: WizardState;
  busy: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: () => void;
}

export function Step4Review({
  dict,
  plans,
  state,
  busy,
  error,
  onBack,
  onSubmit,
}: Props) {
  const plan = plans.find((p) => p.id === state.planId) ?? null;

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">
        {t(dict, 'wizard.reviewTitle')}
      </h2>

      <dl className="divide-y divide-gray-100 rounded-lg border border-gray-200">
        <Row label={t(dict, 'coverage.province')} value={state.province} />
        <Row label={t(dict, 'coverage.district')} value={state.district} />
        <Row label={t(dict, 'coverage.municipality')} value={state.municipality} />
        <Row label={t(dict, 'coverage.ward')} value={state.ward} />
        {state.street && <Row label={t(dict, 'wizard.street')} value={state.street} />}
        <Row label={t(dict, 'wizard.fullName')} value={state.fullName} />
        <Row label={t(dict, 'wizard.phone')} value={state.phone} />
        {state.email && <Row label={t(dict, 'wizard.email')} value={state.email} />}
        <Row
          label={t(dict, 'wizard.selectPlan')}
          value={plan ? `${plan.name} — ${plan.speedMbps} Mbps — ${formatNPR(plan.totalPrice)}/mo` : t(dict, 'wizard.noPlan')}
        />
        {state.notes && <Row label={t(dict, 'wizard.notes')} value={state.notes} />}
      </dl>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between pt-2">
        <button type="button" className="btn btn-outline" onClick={onBack} disabled={busy}>
          {t(dict, 'wizard.back')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={busy}>
          {busy ? t(dict, 'wizard.submitting') : t(dict, 'wizard.submit')}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-3 text-sm">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-right font-medium text-gray-900">{value}</dd>
    </div>
  );
}
