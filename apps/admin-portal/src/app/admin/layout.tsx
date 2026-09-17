import { AdminAuthProvider } from '@/hooks/useAdminAuth';
import { AdminShell } from '@/components/layout/AdminShell';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
