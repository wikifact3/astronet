import Link from 'next/link';
import { Check } from 'lucide-react';
import { formatNPR, type PlanPublic } from '@/lib/api';
import type { Dict, Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  dict: Dict;
  plan: PlanPublic;
  featured?: boolean;
}

export function PlanCard({ locale, dict, plan, featured }: Props) {
  return (
    <div
      className={`relative flex h-full flex-col rounded-2xl border bg-white p-6 transition-all hover:-translate-y-0.5 hover:shadow-lg ${
        featured
          ? 'border-brand-500 shadow-md shadow-brand-100 ring-1 ring-brand-500'
          : 'border-gray-200'
      }`}
    >
      {featured && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-white">
          Most popular
        </span>
      )}

      <h3 className="text-base font-semibold text-gray-900">{plan.name}</h3>

      <div className="mt-4 flex items-baseline gap-1">
        <span className="text-4xl font-bold tracking-tight text-gray-900">
          {plan.speedMbps}
        </span>
        <span className="text-sm font-medium text-gray-500">Mbps</span>
      </div>

      <div className="mt-4 border-t border-gray-100 pt-4">
        <p className="text-xs uppercase tracking-wide text-gray-500">
          {dict.plans.total}
        </p>
        <p className="mt-1 text-2xl font-semibold text-gray-900">
          {formatNPR(plan.totalPrice)}
          <span className="text-sm font-normal text-gray-500">
            {dict.plans.perMonth}
          </span>
        </p>
        <dl className="mt-3 space-y-1 text-xs text-gray-500">
          <div className="flex justify-between">
            <dt>{dict.plans.basePrice}</dt>
            <dd>{formatNPR(plan.basePrice)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{dict.plans.vat}</dt>
            <dd>{formatNPR(plan.vatAmount)}</dd>
          </div>
          <div className="flex justify-between">
            <dt>{dict.plans.tsc}</dt>
            <dd>{formatNPR(plan.tscAmount)}</dd>
          </div>
        </dl>
      </div>

      <ul className="mt-5 space-y-2 text-sm text-gray-700">
        <Feature text={`${plan.speedMbps} Mbps symmetric`} />
        <Feature
          text={
            plan.fupThresholdGb
              ? `${plan.fupThresholdGb} GB fair usage allowance`
              : 'Unlimited usage'
          }
        />
        <Feature text="Free standard installation" />
        <Feature text="24×7 local support" />
      </ul>

      <div className="mt-6 flex-1" />

      <Link
        href={`/${locale}/connect?plan=${plan.id}`}
        className={`btn w-full ${
          featured ? 'btn-primary' : 'btn-outline'
        }`}
      >
        {dict.plans.orderNow}
      </Link>
    </div>
  );
}

function Feature({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <Check size={16} className="mt-0.5 shrink-0 text-brand-600" strokeWidth={2.5} />
      <span>{text}</span>
    </li>
  );
}
