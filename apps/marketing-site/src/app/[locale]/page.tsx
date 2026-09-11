import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict, t } from '@/lib/i18n';
import { api, formatNPR } from '@/lib/api';

export const revalidate = 300;

export default async function HomePage({
  params,
}: {
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  const { plans } = await api.plans.list();

  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 to-white">
        <div className="container-page py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              {t(dict, 'hero.title')}
            </h1>
            <p className="mt-6 text-lg text-gray-600">{t(dict, 'hero.subtitle')}</p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href={`/${locale}/coverage`}
                className="btn btn-primary px-6 py-3 text-base"
              >
                {t(dict, 'hero.ctaPrimary')}
              </Link>
              <Link
                href={`/${locale}/plans`}
                className="btn btn-outline px-6 py-3 text-base"
              >
                {t(dict, 'hero.ctaSecondary')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-16">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold text-gray-900">{t(dict, 'plans.title')}</h2>
          <p className="mt-3 text-gray-600">{t(dict, 'plans.subtitle')}</p>
        </div>

        {plans.length === 0 ? (
          <p className="text-center text-gray-500">{t(dict, 'common.error')}</p>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.slice(0, 4).map((plan) => (
              <div key={plan.id} className="card p-6">
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-2 text-3xl font-bold text-brand-700">
                  {plan.speedMbps}
                  <span className="ml-1 text-base font-normal text-gray-500">Mbps</span>
                </p>

                <dl className="mt-4 space-y-1 text-xs text-gray-600">
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

                <div className="mt-4 border-t border-gray-100 pt-4">
                  <p className="text-sm text-gray-500">{t(dict, 'plans.total')}</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {formatNPR(plan.totalPrice)}
                    <span className="text-sm font-normal text-gray-500">
                      {t(dict, 'plans.perMonth')}
                    </span>
                  </p>
                </div>

                <Link
                  href={`/${locale}/connect?plan=${plan.id}`}
                  className="btn btn-primary mt-6 w-full"
                >
                  {t(dict, 'plans.orderNow')}
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}