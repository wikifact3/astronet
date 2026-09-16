import { notFound } from 'next/navigation';
import { isLocale, type Locale } from '@/lib/i18n/config';
import { getDict } from '@/lib/i18n';
import { TicketDetailView } from '@/components/tickets/TicketDetailView';

export default function TicketDetailPage({
  params,
}: {
  params: { locale: string; id: string };
}) {
  if (!isLocale(params.locale)) notFound();
  const locale = params.locale as Locale;
  const dict = getDict(locale);

  return <TicketDetailView locale={locale} dict={dict} ticketId={params.id} />;
}
