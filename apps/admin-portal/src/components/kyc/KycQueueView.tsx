'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError, type KycQueueItem } from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

type Filter = 'all' | 'pending' | 'approved' | 'rejected';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Pending' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

export function KycQueueView() {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();

  const [filter, setFilter] = useState<Filter>('pending');
  const [documents, setDocuments] = useState<KycQueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setDocuments(null);
    try {
      const res = await api.adminKyc.list(filter === 'all' ? undefined : filter);
      setDocuments(res.documents);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load';
      setError(msg);
    }
  }, [filter]);

  useEffect(() => {
    if (ready && !staff) {
      router.replace('/admin/login?next=/admin/kyc');
    }
  }, [ready, staff, router]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  if (!ready || !staff) return null;

  return (
    <div className="container-admin py-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-admin-900">KYC review</h1>
          <p className="mt-1 text-sm text-admin-600">
            Approve or reject customer identity documents.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="btn btn-outline text-xs"
        >
          Refresh
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === f.key
                ? 'bg-admin-900 text-white'
                : 'bg-admin-100 text-admin-700 hover:bg-admin-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {documents === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {documents !== null && documents.length === 0 && (
        <div className="card mt-8 p-8 text-center text-sm text-admin-500">
          No documents in this view.
        </div>
      )}

      {documents !== null && documents.length > 0 && (
        <div className="card mt-8 overflow-hidden">
          <table className="w-full">
            <thead className="border-b border-admin-200 bg-admin-50">
              <tr>
                <th className="th">Customer</th>
                <th className="th">Phone</th>
                <th className="th">Document</th>
                <th className="th">Review</th>
                <th className="th">Pipeline</th>
                <th className="th">Submitted</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-100">
              {documents.map((doc) => (
                <tr key={doc.id} className="hover:bg-admin-50">
                  <td className="td font-medium text-admin-900">
                    {doc.customerName}
                  </td>
                  <td className="td text-admin-600">{doc.customerPhone}</td>
                  <td className="td text-admin-600">{doc.documentType}</td>
                  <td className="td">
                    <span className={`badge ${statusBadgeClass(doc.status)}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td className="td">
                    <span className={`badge ${pipelineBadgeClass(doc.pipelineStatus)}`}>
                      {doc.pipelineStatus}
                    </span>
                  </td>
                  <td className="td text-admin-600">
                    {doc.createdAt.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className="td text-right">
                    <Link
                      href={`/admin/kyc/${doc.id}`}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function statusBadgeClass(status: KycQueueItem['status']): string {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800';
    case 'approved':
      return 'bg-green-100 text-green-800';
    case 'rejected':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-admin-100 text-admin-700';
  }
}

function pipelineBadgeClass(status: KycQueueItem['pipelineStatus']): string {
  switch (status) {
    case 'verified':
      return 'bg-emerald-100 text-emerald-800';
    case 'rejected':
    case 'failed':
    case 'expired':
      return 'bg-red-100 text-red-800';
    case 'scanning':
    case 'processing':
    case 'uploaded':
    case 'upload_pending':
      return 'bg-amber-100 text-amber-800';
    default:
      return 'bg-admin-100 text-admin-700';
  }
}
