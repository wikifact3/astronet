'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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

  const canSubmit = province && district && municipality && ward && !loading;

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">{t(dict, 'coverage.province')}</label>
            <select
              className="input mt-1"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {provinces.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t(dict, 'coverage.district')}</label>
            <select
              className="input mt-1"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={!province}
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {districts.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t(dict, 'coverage.municipality')}</label>
            <select
              className="input mt-1"
              value={municipality}
              onChange={(e) => setMunicipality(e.target.value)}
              disabled={!district}
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {municipalities.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">{t(dict, 'coverage.ward')}</label>
            <select
              className="input mt-1"
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              disabled={!municipality}
            >
              <option value="">{t(dict, 'coverage.select')}</option>
              {wards.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>
        </div>

        <button
          type="submit"
          className="btn btn-primary mt-6 w-full sm:w-auto"
          disabled={!canSubmit}
        >
          {loading ? t(dict, 'coverage.checking') : t(dict, 'coverage.check')}
        </button>
      </form>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && <CoverageResultCard locale={locale} dict={dict} result={result} />}
    </div>
  );
}

function CoverageResultCard({
  locale,
  dict,
  result,
}: {
  locale: Locale;
  dict: Dict;
  result: CoverageResult;
}) {
  const map = {
    available: {
      tone: 'border-green-200 bg-green-50 text-green-800',
      badge: 'bg-green-600 text-white',
      title: t(dict, 'coverage.available'),
      desc: t(dict, 'coverage.availableDesc'),
      cta: (
        <Link href={`/${locale}/connect`} className="btn btn-primary">
          {t(dict, 'coverage.orderNow')}
        </Link>
      ),
    },
    coming_soon: {
      tone: 'border-amber-200 bg-amber-50 text-amber-900',
      badge: 'bg-amber-500 text-white',
      title: t(dict, 'coverage.comingSoon'),
      desc: `${t(dict, 'coverage.comingSoonDesc')}${result.estimatedQuarter ? ` (${result.estimatedQuarter})` : ''}.`,
      cta: (
        <Link href={`/${locale}/connect`} className="btn btn-outline">
          {t(dict, 'coverage.notifyMe')}
        </Link>
      ),
    },
    not_planned: {
      tone: 'border-gray-200 bg-gray-50 text-gray-800',
      badge: 'bg-gray-600 text-white',
      title: t(dict, 'coverage.notPlanned'),
      desc: t(dict, 'coverage.notPlannedDesc'),
      cta: (
        <Link href={`/${locale}/connect`} className="btn btn-outline">
          {t(dict, 'coverage.notifyMe')}
        </Link>
      ),
    },
  } as const;

  const c = map[result.status];

  return (
    <div className={`rounded-lg border p-6 ${c.tone}`}>
      <div className="flex items-center gap-3">
        <span className={`badge ${c.badge}`}>{c.title}</span>
        <span className="text-sm opacity-75">
          {result.province} / {result.district} / {result.municipality} / W{result.ward}
        </span>
      </div>
      <p className="mt-3 text-sm">{c.desc}</p>
      <div className="mt-5">{c.cta}</div>
    </div>
  );
}
