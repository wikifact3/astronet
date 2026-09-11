'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { t, type Dict } from '@/lib/i18n';
import type { WizardState } from '../ConnectionWizard';

interface Props {
  dict: Dict;
  state: WizardState;
  setState: React.Dispatch<React.SetStateAction<WizardState>>;
  onNext: () => void;
}

export function Step1Address({ dict, state, setState, onNext }: Props) {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [wards, setWards] = useState<string[]>([]);
  const [gpsBusy, setGpsBusy] = useState(false);

  useEffect(() => {
    api.coverage.provinces().then((r) => setProvinces(r.provinces)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!state.province) return;
    api.coverage.districts(state.province).then((r) => setDistricts(r.districts)).catch(() => {});
  }, [state.province]);

  useEffect(() => {
    if (!state.province || !state.district) return;
    api.coverage
      .municipalities(state.province, state.district)
      .then((r) => setMunicipalities(r.municipalities))
      .catch(() => {});
  }, [state.province, state.district]);

  useEffect(() => {
    if (!state.province || !state.district || !state.municipality) return;
    api.coverage
      .wards(state.province, state.district, state.municipality)
      .then((r) => setWards(r.wards))
      .catch(() => {});
  }, [state.province, state.district, state.municipality]);

  function useGps() {
    if (!navigator.geolocation) return;
    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      () => setGpsBusy(false),
      () => setGpsBusy(false),
      { timeout: 5000 },
    );
  }

  const canProceed =
    !!state.province && !!state.district && !!state.municipality && !!state.ward;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t(dict, 'coverage.province')}>
          <select
            className="input"
            value={state.province}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                province: e.target.value,
                district: '',
                municipality: '',
                ward: '',
              }))
            }
          >
            <option value="">{t(dict, 'coverage.select')}</option>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>

        <Field label={t(dict, 'coverage.district')}>
          <select
            className="input"
            value={state.district}
            disabled={!state.province}
            onChange={(e) =>
              setState((s) => ({ ...s, district: e.target.value, municipality: '', ward: '' }))
            }
          >
            <option value="">{t(dict, 'coverage.select')}</option>
            {districts.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Field>

        <Field label={t(dict, 'coverage.municipality')}>
          <select
            className="input"
            value={state.municipality}
            disabled={!state.district}
            onChange={(e) =>
              setState((s) => ({ ...s, municipality: e.target.value, ward: '' }))
            }
          >
            <option value="">{t(dict, 'coverage.select')}</option>
            {municipalities.map((m) => (
              <option key={m}>{m}</option>
            ))}
          </select>
        </Field>

        <Field label={t(dict, 'coverage.ward')}>
          <select
            className="input"
            value={state.ward}
            disabled={!state.municipality}
            onChange={(e) => setState((s) => ({ ...s, ward: e.target.value }))}
          >
            <option value="">{t(dict, 'coverage.select')}</option>
            {wards.map((w) => (
              <option key={w}>{w}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t(dict, 'wizard.street')}>
        <input
          className="input"
          value={state.street}
          onChange={(e) => setState((s) => ({ ...s, street: e.target.value }))}
        />
      </Field>

      <button
        type="button"
        onClick={useGps}
        disabled={gpsBusy}
        className="btn btn-outline text-xs"
      >
        {t(dict, 'wizard.useGps')}
      </button>

      <div className="flex justify-end pt-2">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
