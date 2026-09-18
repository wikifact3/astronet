'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api,
  ApiError,
  getAccessToken,
  type KycDetail,
  type KycReviewAction,
  type KycReviewReasonCode,
} from '@/lib/api';
import { useAdminAuth } from '@/hooks/useAdminAuth';

const REASON_CODES: {
  value: KycReviewReasonCode;
  label: string;
  for: KycReviewAction;
}[] = [
  { value: 'document_clear', label: 'Document is clear and matches', for: 'approve' },
  { value: 'document_illegible', label: 'Document is illegible / low quality', for: 'reject' },
  { value: 'document_expired', label: 'Document has expired', for: 'reject' },
  { value: 'id_mismatch', label: 'ID details do not match application', for: 'reject' },
  { value: 'address_mismatch', label: 'Address does not match application', for: 'reject' },
  { value: 'incomplete_document', label: 'Document is incomplete', for: 'reject' },
  { value: 'other', label: 'Other (explain in notes)', for: 'reject' },
];

export function KycDetailView({ documentId }: { documentId: string }) {
  const router = useRouter();
  const { staff, ready } = useAdminAuth();

  const [doc, setDoc] = useState<KycDetail | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobError, setBlobError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [action, setAction] = useState<KycReviewAction>('approve');
  const [reasonCode, setReasonCode] = useState<KycReviewReasonCode>('document_clear');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const d = await api.adminKyc.get(documentId);
      setDoc(d);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to load';
      setError(msg);
    }
  }, [documentId]);

  useEffect(() => {
    if (ready && !staff) {
      router.replace(`/admin/login?next=/admin/kyc/${documentId}`);
    }
  }, [ready, staff, router, documentId]);

  useEffect(() => {
    if (!ready || !staff) return;
    void load();
  }, [ready, staff, load]);

  useEffect(() => {
    if (!doc) return;
    if (doc.pipelineStatus !== 'verified' && doc.pipelineStatus !== 'rejected') {
      return;
    }

    let cancelled = false;
    let revoke: string | null = null;

    (async () => {
      setBlobError(null);
      try {
        const token = getAccessToken();
        const res = await fetch(api.adminKyc.fileUrl(documentId), {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: 'include',
        });

        if (!res.ok) {
          if (!cancelled) setBlobError(`Could not load file (${res.status})`);
          return;
        }

        const blob = await res.blob();
        if (cancelled) return;

        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      } catch (err) {
        if (!cancelled) {
          setBlobError(err instanceof Error ? err.message : 'Could not load file');
        }
      }
    })();

    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
      setBlobUrl(null);
    };
  }, [doc, documentId]);

  useEffect(() => {
    const valid = REASON_CODES.filter((r) => r.for === action);
    if (!valid.some((r) => r.value === reasonCode)) {
      setReasonCode(valid[0].value);
    }
  }, [action, reasonCode]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!doc || doc.status !== 'pending') return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.adminKyc.review(documentId, {
        action,
        reasonCode,
        notes: notes.trim() || undefined,
      });
      setDoc(updated);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to submit review';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !staff) return null;

  const availableReasons = REASON_CODES.filter((r) => r.for === action);
  const isReviewed = doc !== null && doc.status !== 'pending';
  const canReview =
    doc !== null && doc.status === 'pending' && doc.pipelineStatus === 'verified';

  return (
    <div className="container-admin py-8">
      <Link href="/admin/kyc" className="text-sm text-admin-500 hover:text-admin-700">
        ← Back to queue
      </Link>

      {error && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {doc === null && !error && (
        <div className="mt-8 text-sm text-admin-500">Loading…</div>
      )}

      {doc !== null && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[2fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-admin-900">
                {doc.customerName}
              </h1>
              <span className={`badge ${statusBadgeClass(doc.status)}`}>
                {doc.status}
              </span>
              <span className={`badge ${pipelineBadgeClass(doc.pipelineStatus)}`}>
                {doc.pipelineStatus}
              </span>
            </div>
            <p className="mt-1 text-sm text-admin-600">
              {doc.customerPhone} · {doc.documentType}
            </p>

            <div className="card mt-6 overflow-hidden">
              <div className="border-b border-admin-200 bg-admin-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-admin-500">
                Document
              </div>
              <div className="flex min-h-[24rem] items-center justify-center bg-admin-100">
                <DocumentPreview doc={doc} blobUrl={blobUrl} blobError={blobError} />
              </div>
            </div>
          </div>

          <div>
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-admin-900">Submission</h2>
              <dl className="mt-3 space-y-2 text-xs">
                <Row label="Document ID" value={doc.id.slice(0, 8) + '…'} />
                <Row label="Account" value={doc.accountId.slice(0, 8) + '…'} />
                <Row
                  label="Submitted"
                  value={doc.createdAt.slice(0, 16).replace('T', ' ')}
                />
                {doc.mimeType && <Row label="Type" value={doc.mimeType} />}
                {doc.fileSizeBytes !== null && (
                  <Row label="Size" value={formatBytes(doc.fileSizeBytes)} />
                )}
                {doc.scanResult && <Row label="Scan" value={doc.scanResult} />}
                {doc.reviewedAt && (
                  <Row
                    label="Reviewed"
                    value={doc.reviewedAt.slice(0, 16).replace('T', ' ')}
                  />
                )}
              </dl>
            </div>

            {isReviewed ? (
              <div className="card mt-4 p-5">
                <h2 className="text-sm font-semibold text-admin-900">Review outcome</h2>
                <dl className="mt-3 space-y-2 text-xs">
                  <Row label="Decision" value={doc.status} />
                  <Row label="Reason" value={doc.reviewReasonCode ?? '—'} />
                  <Row label="Notes" value={doc.reviewNotes ?? '—'} />
                </dl>
              </div>
            ) : !canReview ? (
              <div className="card mt-4 p-5 text-xs text-admin-600">
                <h2 className="text-sm font-semibold text-admin-900">Not ready</h2>
                <p className="mt-2">
                  This document is still in the pipeline (
                  <code>{doc.pipelineStatus}</code>). Review becomes available once it
                  reaches <code>verified</code>.
                </p>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="card mt-4 p-5">
                <h2 className="text-sm font-semibold text-admin-900">Review</h2>

                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setAction('approve')}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
                      action === 'approve'
                        ? 'border-green-500 bg-green-50 text-green-800'
                        : 'border-admin-200 text-admin-700 hover:bg-admin-50'
                    }`}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setAction('reject')}
                    className={`flex-1 rounded-md border px-3 py-2 text-xs font-medium transition ${
                      action === 'reject'
                        ? 'border-red-500 bg-red-50 text-red-800'
                        : 'border-admin-200 text-admin-700 hover:bg-admin-50'
                    }`}
                  >
                    Reject
                  </button>
                </div>

                <label className="mt-4 block">
                  <span className="label text-xs">Reason</span>
                  <select
                    className="input mt-1"
                    value={reasonCode}
                    onChange={(e) => setReasonCode(e.target.value as KycReviewReasonCode)}
                  >
                    {availableReasons.map((r) => (
                      <option key={r.value} value={r.value}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-4 block">
                  <span className="label text-xs">Notes (optional)</span>
                  <textarea
                    className="input mt-1"
                    rows={3}
                    maxLength={500}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Shown to the customer when rejecting."
                  />
                </label>

                <button
                  type="submit"
                  className={`btn mt-5 w-full ${
                    action === 'approve' ? 'btn-primary' : 'btn-danger'
                  }`}
                  disabled={submitting}
                >
                  {submitting
                    ? 'Submitting…'
                    : action === 'approve'
                      ? 'Approve document'
                      : 'Reject document'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentPreview({
  doc,
  blobUrl,
  blobError,
}: {
  doc: KycDetail;
  blobUrl: string | null;
  blobError: string | null;
}) {
  if (blobError) {
    return (
      <div className="p-6 text-center text-sm text-admin-500">
        <p>{blobError}</p>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="p-6 text-center text-sm text-admin-500">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-admin-200 text-lg">
          🖼️
        </div>
        <p className="mt-3">
          {doc.pipelineStatus === 'verified' || doc.pipelineStatus === 'rejected'
            ? 'Loading document…'
            : `Pipeline status: ${doc.pipelineStatus}. Preview appears once the document is scanned.`}
        </p>
      </div>
    );
  }

  const isImage = doc.mimeType?.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';

  if (isImage) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={blobUrl}
        alt="KYC document"
        className="max-h-[40rem] w-full object-contain"
      />
    );
  }

  if (isPdf) {
    return (
      <iframe src={blobUrl} title="KYC document" className="h-[40rem] w-full" />
    );
  }

  return (
    <div className="p-6 text-center text-sm text-admin-500">
      Preview not supported for {doc.mimeType ?? 'this type'}.{' '}
      <a href={blobUrl} download className="text-brand-600 hover:underline">
        Download file
      </a>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-admin-500">{label}</dt>
      <dd className="break-all text-right font-medium text-admin-900">{value}</dd>
    </div>
  );
}

function statusBadgeClass(status: KycDetail['status']): string {
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

function pipelineBadgeClass(status: KycDetail['pipelineStatus']): string {
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
