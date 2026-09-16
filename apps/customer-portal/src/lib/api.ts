/**
 * API client for the customer portal.
 */

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

/**
 * Single-flight refresh: if multiple callers hit refresh() concurrently,
 * they all await the same in-flight request. Without this, React strict-mode
 * double-mounts and navigation-induced remounts trip the backend's reuse
 * detector.
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

function getBaseUrl(): string {
  const isServer = typeof window === 'undefined';
  if (isServer) {
    const internal = process.env.API_INTERNAL_URL;
    if (!internal) throw new Error('API_INTERNAL_URL is not set for server-side fetches.');
    return internal.endsWith('/v1') ? internal : `${internal.replace(/\/$/, '')}/v1`;
  }
  return process.env.NEXT_PUBLIC_API_URL || '/api';
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

/**
 * Single-flight wrapper around POST /auth/refresh.
 * Concurrent callers share the same in-flight promise.
 */
async function refreshAccessToken(): Promise<{ accessToken: string }> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = request<{ accessToken: string }>('/auth/refresh', {
    method: 'POST',
    skipAuth: true,
  }).finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

// ---------- Types ----------

export interface AuthUser {
  id: string;
  phone: string;
  fullName: string;
  preferredLanguage: string;
}

export interface VerifyOtpResponse {
  accessToken: string;
  user: AuthUser;
  isNewUser: boolean;
}

export interface OtpSentResponse {
  status: 'sent';
  expiresIn: number;
}

export interface OtpNotRegisteredResponse {
  status: 'not_registered';
  message: string;
  applyUrl: string;
  phone: string;
}

export type OtpRequestResponse = OtpSentResponse | OtpNotRegisteredResponse;

export interface MeResponse {
  id: string;
  phone: string;
  email: string | null;
  fullName: string;
  preferredLanguage: string;
  kycStatus: string;
  accounts: Array<{
    id: string;
    accountType: string;
    status: string;
    referralCode: string | null;
    parentAccountId: string | null;
  }>;
}

export interface CurrentSubscription {
  id: string;
  accountId: string;
  status: string;
  validityStart: string;
  validityEnd: string;
  daysRemaining: number;
  fupTier: string;
  fupExplanation: string;
  autoRenew: boolean;
  gracePeriod: {
    usedThisYear: number;
    maxPerYear: number;
    remaining: number;
  };
  plan: {
    id: string;
    name: string;
    speedMbps: number;
    basePrice: number;
    vatAmount: number;
    tscAmount: number;
    totalPrice: number;
    fupThresholdGb: number | null;
  };
}

export interface InvoiceResponse {
  id: string;
  invoiceNumber: string;
  amount: number;
  vatAmount: number;
  tscAmount: number;
  totalAmount: number;
  status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled' | 'credit_note';
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  planName: string;
}

export interface InitiatePaymentResponse {
  paymentId: string;
  redirectUrl: string;
  expiresAt: string;
}

export interface PaymentStatusResponse {
  paymentId: string;
  status:
    | 'initiated'
    | 'pending_confirmation'
    | 'confirmed'
    | 'declined'
    | 'timeout'
    | 'refunded'
    | 'failed';
  providerTxnId: string | null;
  confirmedAt: string | null;
  invoiceStatus: InvoiceResponse['status'];
  bandwidthStatus: 'pending' | 'active' | 'failed';
}

// ---------- Endpoints ----------

export type TicketCategory =
  | 'connectivity'
  | 'billing'
  | 'hardware'
  | 'installation'
  | 'general';

export type TicketStatus =
  | 'open'
  | 'assigned'
  | 'field_tech_dispatched'
  | 'pending_customer'
  | 'resolved'
  | 'reopened'
  | 'closed';

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: string;
  subject: string;
  createdAt: string;
  resolvedAt: string | null;
  reopenDeadline: string | null;
  reopenedCount: number;
  messageCount: number;
}

export interface TicketDetail extends TicketSummary {
  description: string;
  messages: Array<{
    id: string;
    authorType: 'customer' | 'staff' | 'system';
    authorName: string;
    message: string;
    createdAt: string;
  }>;
}

export const api = {
  auth: {
    requestOtp: (phone: string) =>
      request<OtpRequestResponse>('/auth/otp/request', {
        method: 'POST',
        body: JSON.stringify({ phone }),
        skipAuth: true,
      }),
    verifyOtp: (phone: string, otp: string) =>
      request<VerifyOtpResponse>('/auth/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ phone, otp }),
        skipAuth: true,
      }),
    refresh: refreshAccessToken,
    logout: () =>
      request<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
        skipAuth: true,
      }),
  },
  me: {
    get: () => request<MeResponse>('/me'),
  },
  subscriptions: {
    current: () => request<CurrentSubscription>('/subscriptions/current'),
  },
  invoices: {
    list: () => request<{ invoices: InvoiceResponse[] }>('/invoices'),
    get: (id: string) => request<InvoiceResponse>(`/invoices/${id}`),
    generateCurrent: () =>
      request<InvoiceResponse>('/invoices/generate-current', {
        method: 'POST',
      }),
    pdfUrl: (id: string) => `${getBaseUrl()}/invoices/${id}/pdf`,
  },
  payments: {
    initiate: (provider: 'esewa' | 'khalti', invoiceId: string) => {
      const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
      const idem = `initiate-${invoiceId}-${provider}-${bucket}`;
      return request<InitiatePaymentResponse>(`/payments/${provider}/initiate`, {
        method: 'POST',
        body: JSON.stringify({ invoiceId }),
        headers: { 'Idempotency-Key': idem },
      });
    },
    status: (paymentId: string) =>
      request<PaymentStatusResponse>(`/payments/${paymentId}/status`),
  },
  tickets: {
    list: (params?: { status?: TicketStatus; category?: TicketCategory; limit?: number; page?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.category) qs.set('category', params.category);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.page) qs.set('page', String(params.page));
      const suffix = qs.toString() ? `?${qs}` : '';
      return request<{ tickets: TicketSummary[]; total: number }>(`/tickets${suffix}`);
    },
    create: (body: { category: TicketCategory; subject: string; description: string }) =>
      request<TicketDetail>('/tickets', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    get: (id: string) => request<TicketDetail>(`/tickets/${id}`),
    addMessage: (id: string, message: string) =>
      request<TicketDetail>(`/tickets/${id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ message }),
      }),
    reopen: (id: string) =>
      request<TicketDetail>(`/tickets/${id}/reopen`, { method: 'POST' }),
  },
};


export function formatNPR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-NP', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
