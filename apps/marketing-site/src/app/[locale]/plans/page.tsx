import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict, t } from '@/lib/i18n';
import { api, formatNPR } from '@/lib/api';

export const revalidate = 300;

export default async function PlansPage({
  params,
}: {
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  const { plans } = await api.plans.list();

  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h1 className="text-3xl font-bold text-gray-900">{t(dict, 'plans.title')}</h1>
        <p className="mt-3 text-gray-600">{t(dict, 'plans.subtitle')}</p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {plans.map((plan) => (
          <div key={plan.id} className="card flex flex-col p-6">
            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>

            <p className="mt-3 text-3xl font-bold text-brand-700">
              {plan.speedMbps}
              <span className="ml-1 text-base font-normal text-gray-500">Mbps</span>
            </p>

            <dl className="mt-5 space-y-1.5 text-xs text-gray-600">
              <div className="flex justify-between">
                <dt>{t(dict, 'plans.basePrice')}</dt>
                <dd>{formatNPR(plan.basePrice)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t(dict, 'plans.vat')}</dt>
                <dd>{formatNPR(plan.vatAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>{t(dict, 'plans.tsc')}</dt>
                <dd>{formatNPR(plan.tscAmount)}</dd>
              </div>
            </dl>

            <div className="mt-5 border-t border-gray-100 pt-5">
              <p className="text-sm text-gray-500">{t(dict, 'plans.total')}</p>
              <p className="text-2xl font-semibold text-gray-900">
                {formatNPR(plan.totalPrice)}
                <span className="text-sm font-normal text-gray-500">
                  {t(dict, 'plans.perMonth')}
                </span>
              </p>
            </div>

            <div className="mt-6 flex-1" />

            <Link
              href={`/${locale}/connect?plan=${plan.id}`}
              className="btn btn-primary w-full"
            >
              {t(dict, 'plans.orderNow')}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
