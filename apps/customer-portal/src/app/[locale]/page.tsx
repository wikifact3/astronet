'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function LocaleRoot({
  params,
}: {
  params: { locale: string };
}) {
  const { user, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    router.replace(`/${params.locale}/${user ? 'dashboard' : 'login'}`);
  }, [ready, user, params.locale, router]);

  return (
    <div className="container-page py-16 text-center text-sm text-gray-500">
      Loading…
    </div>
  );
}
