'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/useAdminAuth';

export function AdminHeader() {
  const { staff, logout } = useAdminAuth();
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.replace('/admin/login');
  }

  return (
    <header className="border-b border-admin-800 bg-admin-900 text-admin-100">
      <div className="container-admin flex h-14 items-center justify-between">
        <Link href="/admin/kyc" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-600 text-xs font-bold text-white">
            PL
          </span>
          <span className="text-sm font-semibold tracking-wide">
            PowerLink Admin
          </span>
        </Link>

        {staff && (
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-xs font-medium">{staff.fullName}</div>
              <div className="text-[10px] uppercase tracking-wider text-admin-400">
                {staff.role}
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded border border-admin-700 px-2 py-1 text-xs text-admin-200 hover:bg-admin-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
