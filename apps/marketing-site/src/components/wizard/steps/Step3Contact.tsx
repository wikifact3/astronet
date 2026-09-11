'use client';

import { t, type Dict } from '@/lib/i18n';
import type { WizardState } from '../ConnectionWizard';

interface Props {
  dict: Dict;
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onBack: () => void;
  onNext: () => void;
}

const PHONE_RE = /^(98|97|96)\d{8}$/;

export function Step3Contact({ dict, state, setState, onBack, onNext }: Props) {
  const phoneOk = PHONE_RE.test(state.phone);
  const canProceed = !!state.fullName.trim() && phoneOk;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="label">{t(dict, 'wizard.fullName')}</span>
        <input
          className="input mt-1"
          value={state.fullName}
          onChange={(e) => setState((s) => ({ ...s, fullName: e.target.value }))}
        />
      </label>

      <label className="block">
        <span className="label">{t(dict, 'wizard.phone')}</span>
        <input
          className="input mt-1"
          value={state.phone}
          inputMode="numeric"
          placeholder="98XXXXXXXX"
          onChange={(e) =>
            setState((s) => ({ ...s, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))
          }
        />
        {state.phone && !phoneOk && (
          <span className="mt-1 block text-xs text-red-600">
            {t(dict, 'wizard.required')}
          </span>
        )}
      </label>

      <label className="block">
        <span className="label">{t(dict, 'wizard.email')}</span>
        <input
          type="email"
          className="input mt-1"
          value={state.email}
          onChange={(e) => setState((s) => ({ ...s, email: e.target.value }))}
        />
      </label>

      <label className="block">
        <span className="label">{t(dict, 'wizard.notes')}</span>
        <textarea
          className="input mt-1"
          rows={3}
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
        />
      </label>

      <div className="flex justify-between pt-2">
        <button type="button" className="btn btn-outline" onClick={onBack}>
          {t(dict, 'wizard.back')}
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={!canProceed}
          onClick={onNext}
        >
          {t(dict, 'wizard.next')}
        </button>
      </div>
    </div>
  );
}
