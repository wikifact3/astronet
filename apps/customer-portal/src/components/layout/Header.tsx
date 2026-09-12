'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

export function Header({ locale, dict }: { locale: Locale; dict: Dict }) {
  const { user, logout } = useAuth();
  const router = useRouter();

  async function handleSignOut() {
    await logout();
    router.push(`/${locale}/login`);
  }

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="container-page flex h-16 items-center justify-between">
        <Link href={`/${locale}`} className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-brand-600 text-sm font-bold text-white">
            PL
          </span>
          <span className="text-lg font-semibold text-gray-900">
            {t(dict, 'nav.brand')}
          </span>
        </Link>

        {user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-gray-600 sm:inline">
              {user.fullName || user.phone}
            </span>
            <button
              type="button"
              onClick={handleSignOut}
              className="btn btn-outline text-xs"
            >
              {t(dict, 'nav.signOut')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
