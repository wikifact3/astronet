'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MapPin,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { api, type CoverageResult } from '@/lib/api';
import { t, type Dict, type Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  dict: Dict;
}

export function CoverageLookup({ locale, dict }: Props) {
  const [provinces, setProvinces] = useState<string[]>([]);
  const [districts, setDistricts] = useState<string[]>([]);
  const [municipalities, setMunicipalities] = useState<string[]>([]);
  const [wards, setWards] = useState<string[]>([]);

  const [province, setProvince] = useState('');
  const [district, setDistrict] = useState('');
  const [municipality, setMunicipality] = useState('');
  const [ward, setWard] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoverageResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.coverage.provinces().then((r) => setProvinces(r.provinces)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!province) return setDistricts([]);
    api.coverage.districts(province).then((r) => setDistricts(r.districts)).catch(() => {});
    setDistrict('');
    setMunicipality('');
    setWard('');
    setResult(null);
  }, [province]);

  useEffect(() => {
    if (!province || !district) return setMunicipalities([]);
    api.coverage
      .municipalities(province, district)
      .then((r) => setMunicipalities(r.municipalities))
      .catch(() => {});
    setMunicipality('');
    setWard('');
    setResult(null);
  }, [province, district]);

  useEffect(() => {
    if (!province || !district || !municipality) return setWards([]);
    api.coverage
      .wards(province, district, municipality)
      .then((r) => setWards(r.wards))
      .catch(() => {});
    setWard('');
    setResult(null);
  }, [province, district, municipality]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!province || !district || !municipality || !ward) return;

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api.coverage.lookup({ province, district, municipality, ward });
      setResult(r);
    } catch (err) {
      setError(t(dict, 'common.error'));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setProvince('');
    setDistrict('');
    setMunicipality('');
    setWard('');
    setResult(null);
    setError(null);
  }

  const canSubmit = province && district && municipality && ward && !loading;

  return (
    <div className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <MapPin size={20} />
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-900">
              {t(dict, 'coverage.title')}
            </h2>
            <p className="text-xs text-gray-500">
              Select your location below
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Field label={t(dict, 'coverage.province')}>
            <select
              className="input"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              required
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t(dict, 'coverage.district')}>
            <select
              className="input"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={!province}
              required
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t(dict, 'coverage.municipality')}>
            <select
              className="input"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              disabled={!district}
              required
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t(dict, 'coverage.ward')}>
            <select
              className="input"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              disabled={!municipality}
              required
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {wards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-6 w-full py-3 text-base"
          disabled={!canSubmit}
        >
          {loading ? (
            <>
              <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              {t(dict, 'coverage.checking')}
            </>
          ) : (
            <>
              <Search size={16} className="mr-2" />
              {t(dict, 'coverage.check')}
            </>
          )}
        </button>
      </form>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <CoverageResultCard
          locale={locale}
          dict={dict}
          result={result}
          onReset={reset}
        />
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function CoverageResultCard({
  locale,
  dict,
  result,
  onReset,
}: {
  locale: Locale;
  dict: Dict;
  result: CoverageResult;
  onReset: () => void;
}) {
  const map = {
    available: {
      tone: 'border-green-200 bg-gradient-to-br from-green-50 to-white',
      badge: 'bg-green-600 text-white',
      iconColor: 'text-green-600',
      iconBg: 'bg-green-100',
      Icon: CheckCircle2,
      title: t(dict, 'coverage.available'),
      desc: t(dict, 'coverage.availableDesc'),
      cta: (
        <Link
          href={`/${locale}/connect?ward=${result.ward}`}
          className="btn btn-primary w-full py-3 sm:w-auto"
        >
          {t(dict, 'coverage.orderNow')}
          <ArrowRight size={16} className="ml-2" />
        </Link>
      ),
      secondary: (
        <Link
          href={`/${locale}/plans`}
          className="btn btn-outline w-full py-3 sm:w-auto"
        >
          {t(dict, 'hero.ctaSecondary')}
        </Link>
      ),
    },
    coming_soon: {
      tone: 'border-amber-200 bg-gradient-to-br from-amber-50 to-white',
      badge: 'bg-amber-500 text-white',
      iconColor: 'text-amber-600',
      iconBg: 'bg-amber-100',
      Icon: Clock,
      title: t(dict, 'coverage.comingSoon'),
      desc: `${t(dict, 'coverage.comingSoonDesc')}${result.estimatedQuarter ? ` — expected ${result.estimatedQuarter}.` : '.'}`,
      cta: (
        <Link
          href={`/${locale}/connect?notify=1&ward=${result.ward}`}
          className="btn btn-primary w-full py-3 sm:w-auto"
        >
          {t(dict, 'coverage.notifyMe')}
          <ArrowRight size={16} className="ml-2" />
        </Link>
      ),
      secondary: (
        <Link
          href={`/${locale}/plans`}
          className="btn btn-outline w-full py-3 sm:w-auto"
        >
          View plans
        </Link>
      ),
    },
    not_planned: {
      tone: 'border-gray-200 bg-gradient-to-br from-gray-50 to-white',
      badge: 'bg-gray-700 text-white',
      iconColor: 'text-gray-600',
      iconBg: 'bg-gray-100',
      Icon: XCircle,
      title: t(dict, 'coverage.notPlanned'),
      desc: t(dict, 'coverage.notPlannedDesc'),
      cta: (
        <Link
          href={`/${locale}/connect?notify=1&ward=${result.ward}`}
          className="btn btn-primary w-full py-3 sm:w-auto"
        >
          {t(dict, 'coverage.notifyMe')}
          <ArrowRight size={16} className="ml-2" />
        </Link>
      ),
      secondary: null,
    },
  } as const;

  const c = map[result.status];
  const Icon = c.Icon;

  return (
    <div className={`rounded-2xl border ${c.tone} p-6 shadow-sm sm:p-8`}>
      <div className="flex items-start gap-4">
        <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${c.iconBg}`}>
          <Icon size={24} className={c.iconColor} strokeWidth={2} />
        </span>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${c.badge}`}>{c.title}</span>
            <span className="text-xs text-gray-500">
              {result.province} · {result.district} · {result.municipality} · Ward{' '}
              {result.ward}
            </span>
          </div>

          <p className="mt-3 text-sm leading-relaxed text-gray-700">{c.desc}</p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {c.cta}
            {c.secondary}
            <button
              type="button"
              onClick={onReset}
              className="btn btn-outline w-full py-3 sm:w-auto"
            >
              <RotateCcw size={14} className="mr-1.5" />
              Check another ward
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
