import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';
import { api } from '@/lib/api';
import { ConnectionWizard } from '@/components/wizard/ConnectionWizard';

export default async function ConnectPage({
  params,
}: {
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  const { plans } = await api.plans.list();

  return (
    <section className="container-page py-12">
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<div className="card p-6 text-sm text-gray-500">Loading…</div>}>
          <ConnectionWizard locale={locale} dict={dict} plans={plans} />
        </Suspense>
      </div>
    </section>
  );
}
