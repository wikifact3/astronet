import { AccountDetailView } from '@/components/crm/AccountDetailView';

export default function AccountDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <AccountDetailView accountId={params.id} />;
}
