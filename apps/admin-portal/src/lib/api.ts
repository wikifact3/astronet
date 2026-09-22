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

export type AccountStatus =
  | 'lead'
  | 'kyc_pending'
  | 'kyc_rejected'
  | 'installation_scheduled'
  | 'active'
  | 'suspended'
  | 'churned';

export interface AccountSummary {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  accountType: string;
  status: AccountStatus;
  referralCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AccountDetail extends AccountSummary {
  installationAddress: object | null;
  billingAddress: object | null;
  gpsCoordinates: object | null;
  kycStatus: string;
  transitions: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    reason: string | null;
    actorId: string | null;
    actorType: string;
    createdAt: string;
  }>;
}

export type LeadStatus =
  | 'draft'
  | 'submitted'
  | 'needs_review'
  | 'contacted'
  | 'converted'
  | 'rejected'
  | 'expired';

export interface AdminLead {
  id: string;
  referenceId: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  province: string | null;
  district: string | null;
  municipality: string | null;
  ward: string | null;
  status: LeadStatus;
  submittedAt: string | null;
  accountId: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  promotedBy: string | null;
  promotedAt: string | null;
  internalNotes: string | null;
}

export type TicketStatus =
  | 'open'
  | 'assigned'
  | 'field_tech_dispatched'
  | 'pending_customer'
  | 'resolved'
  | 'reopened'
  | 'closed';

export type TicketCategory =
  | 'connectivity'
  | 'billing'
  | 'hardware'
  | 'installation'
  | 'general';

export interface AdminTicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: string;
  customerName: string;
  customerPhone: string;
  assignedToId: string | null;
  assignedToName: string | null;
  ward: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface AdminTicketDetail extends AdminTicketSummary {
  description: string;
  messages: Array<{
    id: string;
    authorType: 'customer' | 'staff' | 'system';
    authorName: string;
    message: string;
    isInternal: boolean;
    createdAt: string;
  }>;
}

export interface AssignableStaff {
  id: string;
  fullName: string;
  email: string;
  role: string;
}

export type InvoiceStatus =
  | 'draft'
  | 'issued'
  | 'paid'
  | 'overdue'
  | 'cancelled'
  | 'credit_note';

export interface AdminInvoiceRow {
  id: string;
  invoiceNumber: string;
  accountId: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  vatAmount: number;
  tscAmount: number;
  totalAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paidAt: string | null;
  isAdjustment: boolean;
  originalInvoiceId: string | null;
}

export interface ReconciliationSummary {
  period: { from: string | null; to: string | null };
  counts: {
    issued: number;
    paid: number;
    overdue: number;
    cancelled: number;
    creditNote: number;
  };
  amounts: {
    outstanding: number;
    collected: number;
    credits: number;
    overdue: number;
  };
}

export type AdjustmentKind = 'charge' | 'credit' | 'refund';

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
  adminBilling: {
    listInvoices: (params?: { status?: InvoiceStatus; search?: string; fromDate?: string; toDate?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.fromDate) qs.set('fromDate', params.fromDate);
      if (params?.toDate) qs.set('toDate', params.toDate);
      if (params?.limit) qs.set('limit', String(params.limit));
      const suffix = qs.toString() ? `?${qs}` : '';
      return request<{ invoices: AdminInvoiceRow[]; total: number; summary: ReconciliationSummary }>(
        `/admin/billing/invoices${suffix}`,
      );
    },
    adjust: (body: {
      accountId: string;
      kind: AdjustmentKind;
      amount: number;
      reason: string;
      originalInvoiceId?: string;
    }) =>
      request<{ invoiceId: string; invoiceNumber: string; kind: AdjustmentKind; amount: number; linkedTo: string | null }>(
        '/admin/billing/adjustments',
        { method: 'POST', body: JSON.stringify(body) },
      ),
  },
  adminTickets: {
    list: (params?: { status?: TicketStatus; category?: TicketCategory; assignedTo?: string; search?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.category) qs.set('category', params.category);
      if (params?.assignedTo) qs.set('assignedTo', params.assignedTo);
      if (params?.search) qs.set('search', params.search);
      if (params?.limit) qs.set('limit', String(params.limit));
      const suffix = qs.toString() ? `?${qs}` : '';
      return request<{ tickets: AdminTicketSummary[]; total: number }>(`/admin/tickets${suffix}`);
    },
    assignableStaff: () =>
      request<{ staff: AssignableStaff[] }>('/admin/tickets/assignable-staff'),
    get: (id: string) => request<AdminTicketDetail>(`/admin/tickets/${id}`),
    assign: (id: string, staffId: string, note?: string) =>
      request<AdminTicketDetail>(`/admin/tickets/${id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ staffId, note }),
      }),
    updateStatus: (id: string, status: TicketStatus, note?: string) =>
      request<AdminTicketDetail>(`/admin/tickets/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status, note }),
      }),
    reply: (id: string, message: string, isInternal = false) =>
      request<AdminTicketDetail>(`/admin/tickets/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ message, isInternal }),
      }),
  },
  adminLeads: {
    list: (params?: { status?: LeadStatus; search?: string; limit?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.limit) qs.set('limit', String(params.limit));
      const suffix = qs.toString() ? `?${qs}` : '';
      return request<{ leads: AdminLead[]; total: number }>(`/admin/leads${suffix}`);
    },
    get: (id: string) => request<AdminLead>(`/admin/leads/${id}`),
    verify: (id: string, notes?: string) =>
      request<AdminLead>(`/admin/leads/${id}/verify`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      }),
    promote: (id: string) =>
      request<{ lead: AdminLead; accountId: string; alreadyPromoted: boolean }>(
        `/admin/leads/${id}/promote`,
        { method: 'POST' },
      ),
    reject: (id: string, reason?: string) =>
      request<AdminLead>(`/admin/leads/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      }),
  },
  adminCrm: {
    list: (params?: { status?: AccountStatus; search?: string; limit?: number; page?: number }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      if (params?.search) qs.set('search', params.search);
      if (params?.limit) qs.set('limit', String(params.limit));
      if (params?.page) qs.set('page', String(params.page));
      const suffix = qs.toString() ? `?${qs}` : '';
      return request<{ accounts: AccountSummary[]; total: number }>(`/admin/accounts${suffix}`);
    },
    get: (id: string) => request<AccountDetail>(`/admin/accounts/${id}`),
    transition: (id: string, body: { toStatus: AccountStatus; reason?: string }) =>
      request<AccountDetail>(`/admin/accounts/${id}/transition`, {
        method: 'POST',
        body: JSON.stringify(body),
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
