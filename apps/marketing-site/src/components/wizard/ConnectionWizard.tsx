'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, type LeadDraft, type PlanPublic } from '@/lib/api';
import { t, type Dict, type Locale } from '@/lib/i18n';
import { Step1Address } from './steps/Step1Address';
import { Step2Plan } from './steps/Step2Plan';
import { Step3Contact } from './steps/Step3Contact';
import { Step4Review } from './steps/Step4Review';

const STORAGE_KEY = 'pl.leadDraftToken';

interface Props {
  locale: Locale;
  dict: Dict;
  plans: PlanPublic[];
}

export interface WizardState {
  draft: LeadDraft | null;
  province: string;
  district: string;
  municipality: string;
  ward: string;
  street: string;
  planId: string;
  fullName: string;
  phone: string;
  email: string;
  notes: string;
}

const emptyState: WizardState = {
  draft: null,
  province: '',
  district: '',
  municipality: '',
  ward: '',
  street: '',
  planId: '',
  fullName: '',
  phone: '',
  email: '',
  notes: '',
};

export function ConnectionWizard({ locale, dict, plans }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const [step, setStep] = useState(1);
  const [state, setState] = useState<WizardState>(emptyState);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const planFromQuery = params.get('plan');
    if (planFromQuery) setState((s) => ({ ...s, planId: planFromQuery }));

    const token = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (!token) return;

    api.leads
      .getDraft(token)
      .then((draft) => {
        if (draft.status !== 'draft') {
          localStorage.removeItem(STORAGE_KEY);
          return;
        }
        setState((s) => ({
          ...s,
          draft,
          province: draft.province ?? s.province,
          district: draft.district ?? s.district,
          municipality: draft.municipality ?? s.municipality,
          ward: draft.ward ?? s.ward,
          fullName: draft.fullName ?? s.fullName,
          phone: draft.phone ?? s.phone,
          email: draft.email ?? s.email,
          planId: draft.preferredPlanId ?? s.planId,
        }));
      })
      .catch(() => {
        localStorage.removeItem(STORAGE_KEY);
      });
  }, [params]);

  async function ensureDraft(): Promise<LeadDraft> {
    if (state.draft) return state.draft;
    const draft = await api.leads.createDraft({
      province: state.province || undefined,
      district: state.district || undefined,
      municipality: state.municipality || undefined,
      ward: state.ward || undefined,
    });
    localStorage.setItem(STORAGE_KEY, draft.draftToken);
    setState((s) => ({ ...s, draft }));
    return draft;
  }

  async function persist(partial: Record<string, unknown>) {
    const draft = await ensureDraft();
    const updated = await api.leads.updateDraft(draft.draftToken, partial);
    setState((s) => ({ ...s, draft: updated }));
    return updated;
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const draft = await ensureDraft();
      const submitted = await api.leads.submit(draft.draftToken);
      localStorage.removeItem(STORAGE_KEY);
      router.push(`/${locale}/connect/success?ref=${submitted.referenceId ?? ''}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : t(dict, 'common.error');
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  const steps = [
    t(dict, 'wizard.stepAddress'),
    t(dict, 'wizard.stepPlan'),
    t(dict, 'wizard.stepContact'),
    t(dict, 'wizard.stepReview'),
  ];

  return (
    <div className="card p-6 sm:p-8">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
        {steps.map((label, i) => {
          const n = i + 1;
          const active = step === n;
          const done = step > n;
          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold ${
                  done
                    ? 'bg-brand-600 text-white'
                    : active
                      ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-500'
                      : 'bg-gray-100 text-gray-500'
                }`}
              >
                {n}
              </span>
              <span className={active ? 'font-medium text-gray-900' : ''}>{label}</span>
              {i < steps.length - 1 && <span className="text-gray-300">/</span>}
            </li>
          );
        })}
      </ol>

      <h1 className="mt-6 text-2xl font-bold text-gray-900">{t(dict, 'wizard.title')}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {t(dict, 'wizard.step', { current: step, total: steps.length })}
      </p>

      <div className="mt-8">
        {step === 1 && (
          <Step1Address
            dict={dict}
            state={state}
            setState={setState}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Step2Plan
            dict={dict}
            plans={plans}
            state={state}
            setState={setState}
            onBack={() => setStep(1)}
            onNext={async () => {
              await persist({ preferredPlanId: state.planId || undefined });
              setStep(3);
            }}
          />
        )}
        {step === 3 && (
          <Step3Contact
            dict={dict}
            state={state}
            setState={setState}
            onBack={() => setStep(2)}
            onNext={async () => {
              await persist({
                fullName: state.fullName,
                phone: state.phone,
                email: state.email || undefined,
                street: state.street || undefined,
                notes: state.notes || undefined,
              });
              setStep(4);
            }}
          />
        )}
        {step === 4 && (
          <Step4Review
            dict={dict}
            plans={plans}
            state={state}
            busy={busy}
            error={error}
            onBack={() => setStep(3)}
            onSubmit={submit}
          />
        )}
      </div>
    </div>
  );
}
