import dynamic from 'next/dynamic';
import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';

const RenewView = dynamic(
  () => import('@/components/renew/RenewView').then((m) => m.RenewView),
  {
    ssr: false,
    loading: () => (
      <div className="container-page py-16 text-center text-sm text-gray-500">
        Loading…
      </div>
    ),
  },
);

export default function RenewPage({
  params,
}: {
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  return <RenewView locale={locale} dict={dict} />;
}
