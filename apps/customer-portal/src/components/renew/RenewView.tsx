'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  api,
  ApiError,
  formatNPR,
  type CurrentSubscription,
  type InvoiceResponse,
  type PaymentStatusResponse,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  dict: Dict;
}

type Phase =
  | { name: 'loading' }
  | { name: 'ready'; invoice: InvoiceResponse; sub: CurrentSubscription }
  | { name: 'processing'; paymentId: string; poll: number }
  | { name: 'success'; payment: PaymentStatusResponse; invoice: InvoiceResponse | null }
  | { name: 'failed'; payment: PaymentStatusResponse | null; reason?: string }
  | { name: 'error'; message: string };

const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 15; // 30 seconds

export function RenewView({ locale, dict }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, ready } = useAuth();

  const [phase, setPhase] = useState<Phase>({ name: 'loading' });
  const [payingProvider, setPayingProvider] = useState<'esewa' | 'khalti' | null>(null);
  const pollRef = useRef<number | null>(null);

  // Client-side guard
  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, locale, router]);

  // ---- Load invoice + subscription ----
  const loadReady = useCallback(async () => {
    try {
      const [sub, invoice] = await Promise.all([
        api.subscriptions.current(),
        api.invoices.generateCurrent(),
      ]);
      setPhase({ name: 'ready', invoice, sub });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setPhase({ name: 'error', message: msg });
    }
  }, [dict]);

  useEffect(() => {
    if (!ready || !user) return;
    const paymentId = searchParams.get('paymentId');
    if (paymentId) {
      setPhase({ name: 'processing', paymentId, poll: 0 });
      return;
    }
    void loadReady();
  }, [ready, user, searchParams, loadReady]);

  // ---- Poll payment status while in processing ----
  useEffect(() => {
    if (phase.name !== 'processing') return;

    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      try {
        const status = await api.payments.status(phase.paymentId);

        if (status.status === 'confirmed') {
          let invoice: InvoiceResponse | null = null;
          try {
            // Fetch a fresh copy of the invoice for the confirmation screen
            const invs = await api.invoices.list();
            invoice = invs.invoices.find((i) => i.id === status.paymentId) ?? null;
          } catch {
            /* best-effort */
          }
          setPhase({ name: 'success', payment: status, invoice });
          return;
        }

        if (
          status.status === 'declined' ||
          status.status === 'failed' ||
          status.status === 'timeout'
        ) {
          setPhase({ name: 'failed', payment: status, reason: status.status });
          return;
        }

        // Still initiated / pending_confirmation
        if (phase.poll >= MAX_POLL_ATTEMPTS) {
          setPhase({ name: 'failed', payment: status, reason: 'timeout_poll' });
          return;
        }
        setPhase({ name: 'processing', paymentId: phase.paymentId, poll: phase.poll + 1 });
      } catch (err) {
        if (cancelled) return;
        // Network blips shouldn't immediately fail — retry within budget
        if (phase.poll >= MAX_POLL_ATTEMPTS) {
          const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
          setPhase({ name: 'error', message: msg });
          return;
        }
        setPhase({ name: 'processing', paymentId: phase.paymentId, poll: phase.poll + 1 });
      }
    };

    pollRef.current = window.setTimeout(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current !== null) {
        window.clearTimeout(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [phase, dict]);

  // ---- Pay ----
  async function startPayment(provider: 'esewa' | 'khalti') {
    if (phase.name !== 'ready') return;
    setPayingProvider(provider);
    try {
      const result = await api.payments.initiate(provider, phase.invoice.id);
      // Full-page redirect to the provider (or stub checkout)
      window.location.href = result.redirectUrl;
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setPhase({ name: 'error', message: msg });
      setPayingProvider(null);
    }
  }

  function resetToReady() {
    setPhase({ name: 'loading' });
    void loadReady();
  }

  if (!ready || !user) {
    return (
      <div className="container-page py-16 text-center text-sm text-gray-500">
        {t(dict, 'common.loading')}
      </div>
    );
  }

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/${locale}/dashboard`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'renew.backButton')}
        </Link>

        {phase.name === 'loading' && (
          <div className="card mt-8 p-6 text-sm text-gray-500">
            {t(dict, 'common.loading')}
          </div>
        )}

        {phase.name === 'error' && (
          <div className="mt-8 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {phase.message}
            <div className="mt-3">
              <button onClick={resetToReady} className="btn btn-outline text-xs">
                {t(dict, 'common.retry')}
              </button>
            </div>
          </div>
        )}

        {phase.name === 'ready' && (
          <ReadyView
            dict={dict}
            invoice={phase.invoice}
            sub={phase.sub}
            payingProvider={payingProvider}
            onPay={startPayment}
          />
        )}

        {phase.name === 'processing' && (
          <ProcessingView dict={dict} attempt={phase.poll} max={MAX_POLL_ATTEMPTS} />
        )}

        {phase.name === 'success' && (
          <ResultView
            tone="success"
            title={t(dict, 'renew.successTitle')}
            body={t(dict, 'renew.successBody', {
              end: phase.invoice?.periodEnd ?? '',
            })}
            dict={dict}
            locale={locale}
          />
        )}

        {phase.name === 'failed' && (
          <FailedView
            dict={dict}
            onRetry={resetToReady}
            reason={phase.reason}
          />
        )}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------
// Sub-views
// ---------------------------------------------------------------

function ReadyView({
  dict,
  invoice,
  sub,
  payingProvider,
  onPay,
}: {
  dict: Dict;
  invoice: InvoiceResponse;
  sub: CurrentSubscription;
  payingProvider: 'esewa' | 'khalti' | null;
  onPay: (p: 'esewa' | 'khalti') => void;
}) {
  const isPaid = invoice.status === 'paid';

  return (
    <>
      <h1 className="mt-4 text-2xl font-bold text-gray-900">
        {t(dict, 'renew.title')}
      </h1>
      <p className="mt-1 text-sm text-gray-600">{t(dict, 'renew.subtitle')}</p>

      <div className="card mt-8 p-6">
        <dl className="divide-y divide-gray-100">
          <Row label={t(dict, 'renew.invoiceNumber')} value={invoice.invoiceNumber} />
          <Row
            label={t(dict, 'renew.planLabel')}
            value={`${invoice.planName} — ${sub.plan.speedMbps} Mbps`}
          />
          <Row label={t(dict, 'renew.periodLabel')} value={`${invoice.periodStart ?? '—'} → ${invoice.periodEnd ?? '—'}`} />
          <Row label={t(dict, 'plans.basePrice')} value={formatNPR(invoice.amount)} />
          <Row label="VAT (13%)" value={formatNPR(invoice.vatAmount)} />
          <Row label="TSC (1%)" value={formatNPR(invoice.tscAmount)} />
          <Row
            label={t(dict, 'renew.amountLabel')}
            value={formatNPR(invoice.totalAmount)}
            emphasis
          />
        </dl>
      </div>

      {isPaid ? (
        <div className="mt-6 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {t(dict, 'renew.alreadyPaid')}
        </div>
      ) : (
        <>
          <p className="mt-6 text-sm font-medium text-gray-900">
            {t(dict, 'renew.chooseProvider')}
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ProviderButton
              label={t(dict, 'renew.providerEsewa')}
              busy={payingProvider === 'esewa'}
              disabled={payingProvider !== null}
              onClick={() => onPay('esewa')}
            />
            <ProviderButton
              label={t(dict, 'renew.providerKhalti')}
              busy={payingProvider === 'khalti'}
              disabled={payingProvider !== null}
              onClick={() => onPay('khalti')}
            />
          </div>
        </>
      )}

      {sub.daysRemaining > 0 && (
        <p className="mt-4 text-center text-xs text-gray-500">
          {t(dict, 'renew.daysRemainingNote', { days: sub.daysRemaining })}
        </p>
      )}
    </>
  );
}

function ProviderButton({
  label,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="btn btn-primary w-full py-3"
      disabled={disabled}
      onClick={onClick}
    >
      {busy ? '…' : label}
    </button>
  );
}

function ProcessingView({
  dict,
  attempt,
  max,
}: {
  dict: Dict;
  attempt: number;
  max: number;
}) {
  return (
    <div className="card mt-8 p-8 text-center">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      <h2 className="mt-6 text-lg font-semibold text-gray-900">
        {t(dict, 'renew.processingTitle')}
      </h2>
      <p className="mt-2 text-sm text-gray-600">{t(dict, 'renew.processingBody')}</p>
      <p className="mt-4 text-xs text-gray-400">
        {attempt} / {max}
      </p>
    </div>
  );
}

function ResultView({
  tone,
  title,
  body,
  dict,
  locale,
}: {
  tone: 'success';
  title: string;
  body: string;
  dict: Dict;
  locale: Locale;
}) {
  const toneClass =
    tone === 'success'
      ? 'border-green-200 bg-green-50 text-green-900'
      : 'border-gray-200 bg-gray-50 text-gray-800';

  return (
    <div className={`mt-8 rounded-lg border p-8 text-center ${toneClass}`}>
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-green-600 text-2xl text-white">
        ✓
      </div>
      <h2 className="mt-6 text-xl font-bold">{title}</h2>
      <p className="mt-2 text-sm">{body}</p>
      <Link
        href={`/${locale}/dashboard`}
        className="btn btn-primary mt-6 inline-flex"
      >
        {t(dict, 'renew.backToDashboard')}
      </Link>
    </div>
  );
}

function FailedView({
  dict,
  onRetry,
  reason,
}: {
  dict: Dict;
  onRetry: () => void;
  reason?: string;
}) {
  const isTimeoutPoll = reason === 'timeout_poll';
  return (
    <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-500 text-2xl text-white">
        !
      </div>
      <h2 className="mt-6 text-xl font-bold">
        {isTimeoutPoll
          ? t(dict, 'renew.pendingTitle')
          : t(dict, 'renew.failedTitle')}
      </h2>
      <p className="mt-2 text-sm">
        {isTimeoutPoll
          ? t(dict, 'renew.pendingBody')
          : t(dict, 'renew.failedBody')}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={onRetry} className="btn btn-primary">
          {isTimeoutPoll
            ? t(dict, 'renew.checkStatusAgain')
            : t(dict, 'renew.tryAgain')}
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-3 text-sm">
      <dt className={emphasis ? 'font-medium text-gray-900' : 'text-gray-600'}>
        {label}
      </dt>
      <dd
        className={
          emphasis
            ? 'text-lg font-semibold text-gray-900'
            : 'font-medium text-gray-900'
        }
      >
        {value}
      </dd>
    </div>
  );
}
