/**
 * Admin portal API client.
 *
 * Talks to the API directly (no Next proxy) so the httpOnly admin refresh
 * cookie is scoped to the API origin. Server-side fetches use
 * API_INTERNAL_URL for the same-origin loopback.
 */

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/**
 * Single-flight refresh — React Strict Mode double-mounts and route
 * transitions can otherwise fire two refresh requests that both rotate
 * and trip the backend's reuse detector.
 */
let refreshPromise: Promise<{ accessToken: string }> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setUnauthorizedHandler(fn: (() => void) | null): void {
  onUnauthorized = fn;
}

export function getBaseUrl(): string {
  const isServer = typeof window === 'undefined';
  if (isServer) {
    const internal = process.env.API_INTERNAL_URL;
    if (!internal) {
      throw new Error('API_INTERNAL_URL is not set for server-side fetches.');
    }
    return internal.endsWith('/v1') ? internal : `${internal.replace(/\/$/, '')}/v1`;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/v1';
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface RequestInitWithRevalidate extends RequestInit {
  revalidate?: number;
  skipAuth?: boolean;
}

async function request<T>(path: string, init?: RequestInitWithRevalidate): Promise<T> {
  const { revalidate, skipAuth, ...rest } = init ?? {};
  const base = getBaseUrl();
  const url = `${base}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((rest.headers as Record<string, string>) ?? {}),
  };

  if (!skipAuth && accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  const res = await fetch(url, {
    ...rest,
    headers,
    credentials: 'include',
    ...(revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: 'no-store' as RequestCache }),
  });

  if (res.status === 401 && !skipAuth) {
    onUnauthorized?.();
  }

  if (!res.ok) {
    let code = 'UNKNOWN';
    let message = res.statusText;
    try {
      const body = await res.json();
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      } else if (body?.message) {
        message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
      }
    } catch {
      /* non-JSON body */
    }
    throw new ApiError(res.status, code, message);
  }

  return (await res.json()) as T;
}

async function refreshAccessToken(): Promise<{ accessToken: string }> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = request<{ accessToken: string }>('/admin/auth/refresh', {
    method: 'POST',
    skipAuth: true,
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// ---------- Types ----------

export interface AdminStaff {
  id: string;
  email: string;
  fullName: string;
  role: string;
}

export interface AdminLoginResponse {
  accessToken: string;
  staff: AdminStaff;
}

export type KycPipelineStatus =
  | 'upload_pending'
  | 'uploaded'
  | 'scanning'
  | 'processing'
  | 'verified'
  | 'rejected'
  | 'failed'
  | 'expired';

export interface KycQueueItem {
  id: string;
  accountId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  documentType: string;
  status: 'pending' | 'approved' | 'rejected';
  pipelineStatus: KycPipelineStatus;
  mimeType: string | null;
  fileSizeBytes: number | null;
  createdAt: string;
  reviewedAt: string | null;
  scanResult: string | null;
}

export interface KycDetail extends KycQueueItem {
  storageKey: string | null;
  reviewReasonCode: string | null;
  reviewNotes: string | null;
  reviewedBy: string | null;
}

export interface KycSignedUrl {
  url: string;
  expiresAt: string;
  mimeType: string | null;
}

export type KycReviewAction = 'approve' | 'reject';

export type KycReviewReasonCode =
  | 'document_clear'
  | 'document_illegible'
  | 'document_expired'
  | 'id_mismatch'
  | 'address_mismatch'
  | 'incomplete_document'
  | 'other';

// ---------- Endpoints ----------

export const api = {
  adminAuth: {
    login: (email: string, password: string) =>
      request<AdminLoginResponse>('/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
        skipAuth: true,
      }),
    refresh: refreshAccessToken,
    logout: () =>
      request<{ ok: boolean }>('/admin/auth/logout', {
        method: 'POST',
        skipAuth: true,
      }),
  },
  adminKyc: {
    fileUrl: (id: string) => `${getBaseUrl()}/admin/kyc/${id}/file`,
    signedUrl: (id: string) =>
      request<KycSignedUrl>(`/admin/kyc/${id}/signed-url`, { method: 'POST' }),
    list: (status?: 'pending' | 'approved' | 'rejected') => {
      const suffix = status ? `?status=${status}` : '';
      return request<{ documents: KycQueueItem[] }>(`/admin/kyc${suffix}`);
    },
    get: (id: string) => request<KycDetail>(`/admin/kyc/${id}`),
    review: (
      id: string,
      body: { action: KycReviewAction; reasonCode: KycReviewReasonCode; notes?: string },
    ) =>
      request<KycDetail>(`/admin/kyc/${id}/review`, {
        method: 'POST',
        body: JSON.stringify(body),
      }),
  },
};
