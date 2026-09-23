import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, MapPin } from 'lucide-react';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict, t } from '@/lib/i18n';
import { api } from '@/lib/api';
import { HeroIllustration } from '@/components/home/HeroIllustration';
import { TrustStrip } from '@/components/home/TrustStrip';
import { Features } from '@/components/home/Features';
import { Testimonials } from '@/components/home/Testimonials';
import { FinalCta } from '@/components/home/FinalCta';
import { PlanCard } from '@/components/plans/PlanCard';
import { SectionHeading } from '@/components/shared/SectionHeading';
import { FadeIn } from '@/components/shared/FadeIn';

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
      {/* ---- HERO ---- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/60 via-white to-white">
        {/* soft background accents */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-brand-100/50 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-40 -left-40 h-[32rem] w-[32rem] rounded-full bg-brand-100/40 blur-3xl"
        />

        <div className="container-page relative grid gap-12 py-16 sm:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-medium text-brand-700 shadow-sm">
              <span className="grid h-1.5 w-1.5 place-items-center rounded-full bg-green-500" />
              99.9% uptime, backed by SLA
            </div>

            <h1 className="mt-6 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl">
              {t(dict, 'hero.title')}
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
              {t(dict, 'hero.subtitle')}
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={`/${locale}/coverage`}
                className="btn btn-primary px-6 py-3 text-base"
              >
                <MapPin size={18} className="mr-2" />
                {t(dict, 'hero.ctaPrimary')}
              </Link>
              <Link
                href={`/${locale}/plans`}
                className="btn btn-outline px-6 py-3 text-base"
              >
                {t(dict, 'hero.ctaSecondary')}
                <ArrowRight size={18} className="ml-2" />
              </Link>
            </div>

            <p className="mt-6 text-xs text-gray-500">
              No hidden fees · VAT & TSC shown separately · 48-hour standard install
            </p>
          </div>

          <div className="relative flex justify-center lg:justify-end">
            <HeroIllustration />
          </div>
        </div>
      </section>

      <TrustStrip />

      {/* ---- PLANS ---- */}
      <section className="container-page py-20">
        <SectionHeading
          eyebrow="Plans"
          title={t(dict, 'plans.title')}
          subtitle={t(dict, 'plans.subtitle')}
        />

        {plans.length === 0 ? (
          <p className="mt-12 text-center text-gray-500">{t(dict, 'common.error')}</p>
        ) : (
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {plans.slice(0, 4).map((plan, i) => (
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

        <div className="mt-12 text-center">
          <Link
            href={`/${locale}/plans`}
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Compare all plans
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <Features />

      {/* ---- COVERAGE PROMO ---- */}
      <section className="border-y border-gray-100 bg-gray-50/60">
        <div className="container-page grid gap-10 py-20 lg:grid-cols-2 lg:items-center">
          <FadeIn>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">
                Coverage
              </p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                Check if we serve your ward
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-gray-600">
                Enter your address to see if PowerLink is available today, coming
                soon, or on our expansion roadmap. We add new wards every quarter.
              </p>
              <Link
                href={`/${locale}/coverage`}
                className="btn btn-primary mt-6"
              >
                <MapPin size={16} className="mr-2" />
                Check coverage
              </Link>
            </div>
          </FadeIn>

          <FadeIn delay={120}>
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">
                  Kathmandu · Ward 7
                </p>
                <span className="badge bg-green-100 text-green-800">
                  Available
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <CoverageRow ward="Ward 1" status="available" />
                <CoverageRow ward="Ward 2" status="available" />
                <CoverageRow ward="Ward 7" status="available" />
                <CoverageRow ward="Ward 12" status="coming" />
                <CoverageRow ward="Ward 16" status="available" />
              </div>
              <p className="mt-4 text-xs text-gray-500">
                Live data from our field team. Updated weekly.
              </p>
            </div>
          </FadeIn>
        </div>
      </section>

      <Testimonials />

      <FinalCta locale={locale} />
    </>
  );
}

function CoverageRow({
  ward,
  status,
}: {
  ward: string;
  status: 'available' | 'coming';
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 text-sm">
      <span className="text-gray-700">{ward}</span>
      {status === 'available' ? (
        <span className="badge bg-green-100 text-green-800">Available</span>
      ) : (
        <span className="badge bg-amber-100 text-amber-800">Coming soon</span>
      )}
    </div>
  );
}