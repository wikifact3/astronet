import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';
import { NewTicketView } from '@/components/tickets/NewTicketView';

export default function NewTicketPage({
  params,
}: {
  params: { locale: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  return <NewTicketView locale={locale} dict={dict} />;
}
