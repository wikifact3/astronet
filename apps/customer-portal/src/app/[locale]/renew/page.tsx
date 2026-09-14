import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';
import { RenewView } from '@/components/renew/RenewView';

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
