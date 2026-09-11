'use client';

import { formatNPR, type PlanPublic } from '@/lib/api';
import { t, type Dict } from '@/lib/i18n';
import type { WizardState } from '../ConnectionWizard';

interface Props {
  dict: Dict;
  plans: PlanPublic[];
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onBack: () => void;
  onNext: () => void;
}

export function Step2Plan({ dict, plans, state, setState, onBack, onNext }: Props) {
  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">{t(dict, 'wizard.selectPlan')}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          className={`rounded-lg border p-4 text-left transition ${
            state.planId === ''
              ? 'border-brand-500 ring-2 ring-brand-500'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => setState((s) => ({ ...s, planId: '' }))}
        >
          <p className="text-sm font-medium text-gray-900">{t(dict, 'wizard.noPlan')}</p>
          <p className="mt-1 text-xs text-gray-500">
            {t(dict, 'coverage.subtitle')}
          </p>
        </button>

        {plans.map((plan) => {
          const selected = state.planId === plan.id;
          return (
            <button
              key={plan.id}
              type="button"
              className={`rounded-lg border p-4 text-left transition ${
                selected
                  ? 'border-brand-500 ring-2 ring-brand-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setState((s) => ({ ...s, planId: plan.id }))}
            >
              <p className="text-sm font-semibold text-gray-900">{plan.name}</p>
              <p className="mt-1 text-2xl font-bold text-brand-700">
                {plan.speedMbps}
                <span className="ml-1 text-sm font-normal text-gray-500">Mbps</span>
              </p>
              <p className="mt-2 text-xs text-gray-500">
                {formatNPR(plan.totalPrice)}
                {t(dict, 'plans.perMonth')}
              </p>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button type="button" className="btn btn-outline" onClick={onBack}>
          {t(dict, 'wizard.back')}
        </button>
        <button type="button" className="btn btn-primary" onClick={onNext}>
          {t(dict, 'wizard.next')}
        </button>
      </div>
    </div>
  );
}
