'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, type TicketCategory } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

const CATEGORIES: TicketCategory[] = [
  'connectivity',
  'billing',
  'hardware',
  'installation',
  'general',
];

interface Props {
  locale: Locale;
  dict: Dict;
}

export function NewTicketView({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [category, setCategory] = useState<TicketCategory>('connectivity');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, locale, router]);

  const canSubmit =
    subject.trim().length >= 3 &&
    description.trim().length >= 10 &&
    !busy;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    try {
      const ticket = await api.tickets.create({
        category,
        subject: subject.trim(),
        description: description.trim(),
      });
      router.replace(`/${locale}/tickets/${ticket.id}`);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setError(msg);
      setBusy(false);
    }
  }

  if (!ready || !user) return null;

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href={`/${locale}/tickets`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'tickets.backToTickets')}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          {t(dict, 'tickets.newForm.title')}
        </h1>

        <form onSubmit={onSubmit} className="card mt-6 p-6">
          <label className="block">
            <span className="label">{t(dict, 'tickets.newForm.category')}</span>
            <select
              className="input mt-1"
              value={category}
              onChange={(e) => setCategory(e.target.value as TicketCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(dict, `ticketCategory.${c}`)}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-4 block">
            <span className="label">{t(dict, 'tickets.newForm.subject')}</span>
            <input
              className="input mt-1"
              maxLength={200}
              placeholder={t(dict, 'tickets.newForm.subjectPlaceholder')}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
            {subject && subject.trim().length < 3 && (
              <span className="mt-1 block text-xs text-red-600">
                {t(dict, 'tickets.newForm.subjectMin')}
              </span>
            )}
          </label>

          <label className="mt-4 block">
            <span className="label">{t(dict, 'tickets.newForm.description')}</span>
            <textarea
              className="input mt-1"
              rows={6}
              maxLength={5000}
              placeholder={t(dict, 'tickets.newForm.descriptionPlaceholder')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {description && description.trim().length < 10 && (
              <span className="mt-1 block text-xs text-red-600">
                {t(dict, 'tickets.newForm.descriptionMin')}
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
            disabled={!canSubmit}
          >
            {busy
              ? t(dict, 'tickets.newForm.submitting')
              : t(dict, 'tickets.newForm.submit')}
          </button>
        </form>
      </div>
    </section>
  );
}
