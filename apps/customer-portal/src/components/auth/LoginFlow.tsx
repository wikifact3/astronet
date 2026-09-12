'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

const PHONE_RE = /^(98|97|96)\d{8}$/;
const RESEND_SECONDS = 60;

interface Props {
  locale: Locale;
  dict: Dict;
}

export function LoginFlow({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready, login } = useAuth();

  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);

  // If already authenticated, skip login
  useEffect(() => {
    if (ready && user) {
      router.replace(`/${locale}/dashboard`);
    }
  }, [ready, user, locale, router]);

  // Resend countdown
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn]);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    if (!PHONE_RE.test(phone)) return;
    setBusy(true);
    setError(null);
    try {
      await api.auth.requestOtp(phone);
      setStep('otp');
      setResendIn(RESEND_SECONDS);
      setOtp('');
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    if (otp.length !== 6) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.auth.verifyOtp(phone, otp);
      login(result);
      router.replace(`/${locale}/dashboard`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="card p-6 text-center text-sm text-gray-500">
        {t(dict, 'common.loading')}
      </div>
    );
  }

  if (step === 'phone') {
    return (
      <form onSubmit={sendCode} className="card p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-gray-900">{t(dict, 'login.title')}</h1>
        <p className="mt-2 text-sm text-gray-600">{t(dict, 'login.subtitle')}</p>

        <label className="mt-6 block">
          <span className="label">{t(dict, 'login.phoneLabel')}</span>
          <input
            className="input mt-1"
            inputMode="numeric"
            autoComplete="tel"
            placeholder={t(dict, 'login.phonePlaceholder')}
            value={phone}
            onChange={(e) =>
              setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))
            }
          />
          {phone && !PHONE_RE.test(phone) && (
            <span className="mt-1 block text-xs text-red-600">
              {t(dict, 'login.invalidPhone')}
            </span>
          )}
        </label>

        {error && (
          <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          type="submit"
          className="btn btn-primary mt-6 w-full"
          disabled={busy || !PHONE_RE.test(phone)}
        >
          {busy ? t(dict, 'login.sending') : t(dict, 'login.sendCode')}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={verifyCode} className="card p-6 sm:p-8">
      <h1 className="text-2xl font-bold text-gray-900">{t(dict, 'login.otpTitle')}</h1>
      <p className="mt-2 text-sm text-gray-600">
        {t(dict, 'login.otpSubtitle', { phone })}
      </p>

      <label className="mt-6 block">
        <span className="label">{t(dict, 'login.otpLabel')}</span>
        <input
          className="input mt-1 tracking-[0.5em] text-center text-lg"
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder={t(dict, 'login.otpPlaceholder')}
          maxLength={6}
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        />
        {otp && otp.length !== 6 && (
          <span className="mt-1 block text-xs text-red-600">
            {t(dict, 'login.invalidOtp')}
          </span>
        )}
      </label>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        className="btn btn-primary mt-6 w-full"
        disabled={busy || otp.length !== 6}
      >
        {busy ? t(dict, 'login.verifying') : t(dict, 'login.verify')}
      </button>

      <div className="mt-4 flex items-center justify-between text-xs">
        <button
          type="button"
          className="text-gray-500 hover:text-gray-700"
          onClick={() => {
            setStep('phone');
            setOtp('');
            setError(null);
          }}
        >
          {t(dict, 'login.changePhone')}
        </button>

        <button
          type="button"
          className="text-brand-600 hover:text-brand-700 disabled:text-gray-400"
          disabled={resendIn > 0 || busy}
          onClick={async () => {
            setError(null);
            try {
              await api.auth.requestOtp(phone);
              setResendIn(RESEND_SECONDS);
            } catch (err) {
              const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
              setError(msg);
            }
          }}
        >
          {resendIn > 0
            ? t(dict, 'login.resendIn', { seconds: resendIn })
            : t(dict, 'login.resend')}
        </button>
      </div>
    </form>
  );
}
