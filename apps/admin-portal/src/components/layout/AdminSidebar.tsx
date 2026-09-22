'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  disabled?: boolean;
}

const ITEMS: NavItem[] = [
  { href: '/admin/leads', label: 'Leads' },
  { href: '/admin/accounts', label: 'CRM' },
  { href: '/admin/kyc', label: 'KYC review' },
  { href: '/admin/tickets', label: 'Tickets' },
  { href: '/admin/billing', label: 'Billing' },
  { href: '/admin/noc', label: 'NOC dispatch' },
];

export function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-56 shrink-0 border-r border-admin-200 bg-white md:block">
      <nav className="flex flex-col py-4">
        {ITEMS.map((item) => {
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className="cursor-not-allowed px-4 py-2 text-sm text-admin-300"
                title="Coming soon"
              >
                {item.label}
              </span>
            );
          }

          const active = pathname?.startsWith(item.href) && item.href !== '#';

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`border-l-2 px-4 py-2 text-sm ${
                active
                  ? 'border-brand-600 bg-admin-50 font-medium text-brand-700'
                  : 'border-transparent text-admin-700 hover:bg-admin-50'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
