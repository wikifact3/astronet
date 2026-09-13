/**
 * API client for the customer portal.
 */

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

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
    if (!internal) {
      throw new Error('API_INTERNAL_URL is not set for server-side fetches.');
    }
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

// ---------- Endpoints ----------

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
    refresh: () =>
      request<{ accessToken: string }>('/auth/refresh', {
        method: 'POST',
        skipAuth: true,
      }),
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
};

export function formatNPR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-NP', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
