import { KycDetailView } from '@/components/kyc/KycDetailView';

export default function KycDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return <KycDetailView documentId={params.id} />;
}
