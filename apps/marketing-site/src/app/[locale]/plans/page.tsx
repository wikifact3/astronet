import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict, t } from '@/lib/i18n';
import { api } from '@/lib/api';
import { PlanCard } from '@/components/plans/PlanCard';
import { FadeIn } from '@/components/shared/FadeIn';
import { SectionHeading } from '@/components/shared/SectionHeading';

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
      <SectionHeading
        eyebrow="Plans"
        title={t(dict, 'plans.title')}
        subtitle={t(dict, 'plans.subtitle')}
      />

      {plans.length === 0 ? (
        <p className="mt-12 text-center text-gray-500">{t(dict, 'common.error')}</p>
      ) : (
        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, i) => (
            <FadeIn key={plan.id} delay={i * 60}>
              <PlanCard
                locale={locale}
                dict={dict}
                plan={plan}
                featured={plan.speedMbps === 100}
              />
            </FadeIn>
          ))}
        </div>
      )}

      <div className="mt-16 rounded-2xl border border-gray-200 bg-gray-50/60 p-8">
        <h3 className="text-lg font-semibold text-gray-900">
          What&apos;s included in every plan
        </h3>
        <div className="mt-6 grid gap-4 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-4">
          <IncludedItem label="Free standard installation" />
          <IncludedItem label="24×7 local support" />
          <IncludedItem label="Transparent VAT & TSC" />
          <IncludedItem label="Cancel anytime" />
        </div>
      </div>
    </section>
  );
}

function IncludedItem({ label }: { label: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-brand-600 text-[10px] text-white">
        ✓
      </span>
      <span>{label}</span>
    </div>
  );
}