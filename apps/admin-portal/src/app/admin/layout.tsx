import { AdminAuthProvider } from '@/hooks/useAdminAuth';
import { AdminShell } from '@/components/layout/AdminShell';
import { ToastProvider } from '@/components/toast/ToastProvider';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminAuthProvider>
      <ToastProvider>
        <AdminShell>{children}</AdminShell>
      </ToastProvider>
    </AdminAuthProvider>
  );
}
