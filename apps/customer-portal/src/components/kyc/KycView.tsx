'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api,
  ApiError,
  type KycDocument,
  type KycDocumentType,
} from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { t, type Dict, type Locale } from '@/lib/i18n';

interface Props {
  locale: Locale;
  dict: Dict;
}

const DOC_TYPES: KycDocumentType[] = [
  'citizenship_front',
  'citizenship_back',
  'passport',
  'utility_bill',
  'other',
];

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 30; // 60 seconds

export function KycView({ locale, dict }: Props) {
  const router = useRouter();
  const { user, ready } = useAuth();

  const [documents, setDocuments] = useState<KycDocument[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<KycDocumentType>('citizenship_front');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await api.kyc.listDocuments();
      setDocuments(res.documents);
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t(dict, 'common.error');
      setError(msg);
    }
  }, [dict]);

  useEffect(() => {
    if (ready && !user) router.replace(`/${locale}/login`);
  }, [ready, user, locale, router]);

  useEffect(() => {
    if (!ready || !user) return;
    void load();
  }, [ready, user, load]);

  // Poll while any document is still being processed
  useEffect(() => {
    if (!documents) return;
    const active = documents.some(
      (d) =>
        d.pipelineStatus === 'uploaded' ||
        d.pipelineStatus === 'scanning' ||
        d.pipelineStatus === 'processing' ||
        d.pipelineStatus === 'upload_pending',
    );
    if (!active) return;

    let attempt = 0;
    const interval = setInterval(async () => {
      attempt += 1;
      if (attempt > MAX_POLL_ATTEMPTS) {
        clearInterval(interval);
        return;
      }
      try {
        const res = await api.kyc.listDocuments();
        setDocuments(res.documents);
      } catch {
        /* ignore transient errors during poll */
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [documents]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setClientError(null);
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setSelectedFile(null);
      return;
    }
    if (file.size > MAX_BYTES) {
      setClientError(
        t(dict, 'kyc.errors.tooLarge', { mb: Math.round(MAX_BYTES / 1024 / 1024) }),
      );
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      setClientError(t(dict, 'kyc.errors.badType'));
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  }

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) return;
    setBusy(true);
    setClientError(null);
    setError(null);
    try {
      const session = await api.kyc.createSession(selectedType);
      await api.kyc.upload(session.id, selectedFile);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await load();
    } catch (err) {
      const msg =
        err instanceof ApiError ? err.message : t(dict, 'kyc.errors.uploadFailed');
      setError(msg);
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !user) return null;

  const hasActive = documents?.some(
    (d) =>
      d.pipelineStatus === 'uploaded' ||
      d.pipelineStatus === 'scanning' ||
      d.pipelineStatus === 'processing',
  );

  return (
    <section className="container-page py-10">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/${locale}/dashboard`}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          ← {t(dict, 'kyc.back')}
        </Link>

        <h1 className="mt-4 text-2xl font-bold text-gray-900">
          {t(dict, 'kyc.title')}
        </h1>
        <p className="mt-1 text-sm text-gray-600">{t(dict, 'kyc.subtitle')}</p>

        {/* Upload form */}
        <form onSubmit={upload} className="card mt-6 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="label">{t(dict, 'kyc.pickDocumentType')}</span>
              <select
                className="input mt-1"
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value as KycDocumentType)}
                disabled={busy}
              >
                {DOC_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {t(dict, `kyc.docType.${dt}`)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="label">{t(dict, 'kyc.selectFile')}</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,application/pdf"
                className="input mt-1 py-1.5 file:mr-3 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs"
                onChange={onFileChange}
                disabled={busy}
              />
              <span className="mt-1 block text-xs text-gray-500">
                {t(dict, 'kyc.allowedFormats')} ·{' '}
                {t(dict, 'kyc.maxSize', { mb: Math.round(MAX_BYTES / 1024 / 1024) })}
              </span>
            </label>
          </div>

          {selectedFile && (
            <p className="mt-3 text-xs text-gray-600">
              {t(dict, 'kyc.uploadedFile', {
                name: selectedFile.name,
                size: formatBytes(selectedFile.size),
              })}
            </p>
          )}

          {clientError && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {clientError}
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={busy || !selectedFile}
            >
              {busy ? t(dict, 'kyc.submitting') : t(dict, 'kyc.submit')}
            </button>
          </div>
        </form>

        {hasActive && (
          <p className="mt-4 text-xs text-gray-500">
            {t(dict, 'kyc.stillScanning')}
          </p>
        )}

        {/* Document list */}
        {documents === null && !error && (
          <div className="mt-8 text-sm text-gray-500">{t(dict, 'common.loading')}</div>
        )}

        {documents !== null && documents.length === 0 && (
          <div className="card mt-8 p-8 text-center text-sm text-gray-500">
            {t(dict, 'kyc.empty')}
          </div>
        )}

        {documents !== null && documents.length > 0 && (
          <div className="card mt-8 divide-y divide-gray-100">
            {documents.map((doc) => (
              <DocumentRow key={doc.id} dict={dict} doc={doc} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function DocumentRow({ dict, doc }: { dict: Dict; doc: KycDocument }) {
  return (
    <div className="px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              {t(dict, `kyc.docType.${doc.documentType}`)}
            </span>
            <span className={`badge ${pipelineBadgeClass(doc.pipelineStatus)}`}>
              {t(dict, `kyc.pipeline.${doc.pipelineStatus}`)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {t(dict, 'kyc.submitted')}: {doc.createdAt.slice(0, 16).replace('T', ' ')}
            {doc.mimeType && (
              <>
                {' · '}
                {doc.mimeType}
                {doc.fileSizeBytes !== null && ` · ${formatBytes(doc.fileSizeBytes)}`}
              </>
            )}
          </p>
          {doc.reviewedAt && (
            <p className="mt-1 text-xs text-gray-500">
              {t(dict, 'kyc.reviewed')}: {doc.reviewedAt.slice(0, 16).replace('T', ' ')}
            </p>
          )}
          {doc.reviewReasonCode && (
            <p className="mt-1 text-xs text-gray-600">
              {t(dict, 'kyc.reason')}: {doc.reviewReasonCode}
            </p>
          )}
          {doc.reviewNotes && (
            <p className="mt-1 text-xs text-gray-600">
              {t(dict, 'kyc.notes')}: {doc.reviewNotes}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function pipelineBadgeClass(status: KycDocument['pipelineStatus']): string {
  switch (status) {
    case 'verified':
      return 'bg-green-100 text-green-800';
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
      return 'bg-gray-100 text-gray-700';
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
