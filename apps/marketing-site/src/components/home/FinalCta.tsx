import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { FadeIn } from '@/components/shared/FadeIn';
import type { Locale } from '@/lib/i18n/config';

interface Props {
  locale: Locale;
}

export function FinalCta({ locale }: Props) {
  return (
    <section className="container-page py-20">
      <FadeIn>
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 px-8 py-16 text-center sm:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-16 -left-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
          />

          <h2 className="relative text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Get connected in minutes
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-base text-brand-50">
            Check coverage at your ward, submit a connection request, and our team
            takes it from there.
          </p>

          <div className="relative mt-10 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/${locale}/coverage`}
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition hover:bg-brand-50"
            >
              Check coverage
              <ArrowRight size={16} />
            </Link>
            <Link
              href={`/${locale}/plans`}
              className="inline-flex items-center rounded-lg border border-white/30 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/10"
            >
              View plans
            </Link>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}
