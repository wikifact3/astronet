'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError, type CurrentSubscription } from '@/lib/api';
import { t, type Dict } from '@/lib/i18n';

interface Props {
  dict: Dict;
  sub: CurrentSubscription;
  onRefresh: () => void;
}

export function GraceCard({ dict, sub, onRefresh }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { usedThisYear, maxPerYear, remaining } = sub.gracePeriod;
  const canUse = remaining > 0;

  async function useGrace() {
    setBusy(true);
    setError(null);
    try {
      await api.subscriptions.useGrace(sub.id);
      onRefresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to apply');
    } finally {
      setBusy(false);
    }
  }

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

      {error && (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      {canUse && (
        <button
          type="button"
          onClick={useGrace}
          disabled={busy}
          className="btn btn-outline mt-4 w-full text-xs"
        >
          {busy
            ? t(dict, 'dashboard.graceApplying')
            : t(dict, 'dashboard.graceUseButton')}
        </button>
      )}
    </div>
  );
}
