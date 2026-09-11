/**
 * API base URL resolution.
 *
 * - Browser: uses NEXT_PUBLIC_API_URL (defaults to "/api"), which hits the
 *   Next.js rewrite proxy defined in next.config.js.
 * - Server (SSR / SSG / RSC): uses API_INTERNAL_URL directly, because Node's
 *   fetch cannot resolve relative URLs and there is no "current origin".
 */
function getBaseUrl(): string {
  const isServer = typeof window === 'undefined';

  if (isServer) {
    const internal = process.env.API_INTERNAL_URL;
    if (!internal) {
      throw new Error(
        'API_INTERNAL_URL is not set. Server-side fetches require an absolute URL.',
      );
    }
    // Ensure trailing /v1 is present
    return internal.endsWith('/v1') ? internal : `${internal.replace(/\/$/, '')}/v1`;
  }

  const publicUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
  return publicUrl;
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

async function request<T>(
  path: string,
  init?: RequestInit & { revalidate?: number },
): Promise<T> {
  const { revalidate, ...rest } = init ?? {};
  const base = getBaseUrl();
  const url = `${base}${path}`;

  const res = await fetch(url, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(rest.headers ?? {}),
    },
    ...(revalidate !== undefined
      ? { next: { revalidate } }
      : { cache: 'no-store' as RequestCache }),
  });

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
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message);
  }

  return (await res.json()) as T;
}

export interface PlanPublic {
  id: string;
  name: string;
  speedMbps: number;
  basePrice: number;
  vatRate: number;
  tscRate: number;
  vatAmount: number;
  tscAmount: number;
  totalPrice: number;
  fupThresholdGb: number | null;
  bundleAddons: Array<{ name?: string; price?: number }>;
  displayOrder: number;
}

export interface CoverageResult {
  status: 'available' | 'coming_soon' | 'not_planned';
  estimatedQuarter: string | null;
  province: string;
  district: string;
  municipality: string;
  ward: string;
}

export interface LeadDraft {
  id: string;
  draftToken: string;
  status: string;
  province: string | null;
  district: string | null;
  municipality: string | null;
  ward: string | null;
  fullName: string | null;
  phone: string | null;
  email: string | null;
  preferredPlanId: string | null;
  referenceId: string | null;
  submittedAt: string | null;
}

export const api = {
  plans: {
    list: () => request<{ plans: PlanPublic[] }>('/plans', { revalidate: 300 }),
    get: (id: string) => request<PlanPublic>(`/plans/${id}`, { revalidate: 300 }),
  },
  coverage: {
    lookup: (q: {
      province?: string;
      district?: string;
      municipality?: string;
      ward?: string;
    }) => {
      const params = new URLSearchParams();
      Object.entries(q).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      return request<CoverageResult>(`/coverage/lookup?${params.toString()}`, {
        revalidate: 60,
      });
    },
    provinces: () =>
      request<{ provinces: string[] }>('/coverage/provinces', { revalidate: 3600 }),
    districts: (province: string) =>
      request<{ districts: string[] }>(
        `/coverage/districts?province=${encodeURIComponent(province)}`,
        { revalidate: 3600 },
      ),
    municipalities: (province: string, district: string) =>
      request<{ municipalities: string[] }>(
        `/coverage/municipalities?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`,
        { revalidate: 3600 },
      ),
    wards: (province: string, district: string, municipality: string) =>
      request<{ wards: string[] }>(
        `/coverage/wards?province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}&municipality=${encodeURIComponent(municipality)}`,
        { revalidate: 3600 },
      ),
  },
  leads: {
    createDraft: (body: {
      province?: string;
      district?: string;
      municipality?: string;
      ward?: string;
    }) =>
      request<LeadDraft>('/leads/draft', {
        method: 'POST',
        body: JSON.stringify(body),
        cache: 'no-store',
      }),
    getDraft: (token: string) =>
      request<LeadDraft>(`/leads/draft/${token}`, { cache: 'no-store' }),
    updateDraft: (token: string, body: Record<string, unknown>) =>
      request<LeadDraft>(`/leads/draft/${token}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
        cache: 'no-store',
      }),
    submit: (token: string) =>
      request<LeadDraft>(`/leads/draft/${token}/submit`, {
        method: 'POST',
        cache: 'no-store',
      }),
  },
};

export function formatNPR(amount: number): string {
  return `Rs. ${amount.toLocaleString('en-NP', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
