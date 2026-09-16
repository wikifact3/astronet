'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, formatNPR, getAccessToken, type InvoiceResponse } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  dict: Dict;
}

export function InvoicesView({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const [invoices, setInvoices] = useState<InvoiceResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, locale, router]);

  useEffect(() => {
    if (!ready || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.invoices.list();
        if (!cancelled) setInvoices(res.invoices);
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
          setError(msg);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, user, dict]);

  async function downloadInvoice(inv: InvoiceResponse) {
    setDownloading(inv.id);
    setError(null);
    try {
      // Auth header is required — a plain <a href> would be 401 because
      // navigations do not carry the Authorization header.
      const token = getAccessToken();
      const res = await fetch(api.invoices.pdfUrl(inv.id), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      if (!res.ok) {
        throw new Error(`Download failed (${res.status})`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke after a tick so the browser has time to start the download
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : t(dict, 'common.error'));
    } finally {
      setDownloading(null);
    }
  }

  if (!ready || !user) return null;

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/${locale}/dashboard`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'invoices.back')}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          {t(dict, 'invoices.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t(dict, 'invoices.subtitle')}</p>

        {error && (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {invoices === null && !error && (
          <div className="mt-8 text-sm text-gray-500">{t(dict, 'common.loading')}</div>
        )}

        {invoices !== null && invoices.length === 0 && (
          <div className="card mt-8 p-8 text-center text-sm text-gray-500">
            {t(dict, 'invoices.empty')}
          </div>
        )}

        {invoices !== null && invoices.length > 0 && (
          <div className="card mt-8 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">{t(dict, 'invoices.columnNumber')}</th>
                  <th className="px-4 py-3">{t(dict, 'invoices.columnIssued')}</th>
                  <th className="px-4 py-3">{t(dict, 'invoices.columnDue')}</th>
                  <th className="px-4 py-3 text-right">{t(dict, 'invoices.columnAmount')}</th>
                  <th className="px-4 py-3">{t(dict, 'invoices.columnStatus')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {invoices.map((inv) => (
                  <tr key={inv.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {inv.issuedAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{inv.dueDate}</td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatNPR(inv.totalAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`badge ${
                          inv.status === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : inv.status === 'issued'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {t(dict, `status.${inv.status}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => downloadInvoice(inv)}
                        disabled={downloading === inv.id}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700 disabled:opacity-50"
                      >
                        {downloading === inv.id
                          ? '…'
                          : t(dict, 'invoices.downloadPdf')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
