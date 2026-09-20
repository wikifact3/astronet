import { TicketDetailView } from '@/components/tickets/TicketDetailView';

export default function TicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <TicketDetailView ticketId={params.id} />;
}
