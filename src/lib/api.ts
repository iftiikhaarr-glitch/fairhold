import type { AppConfig, Rental, RentalEvent, RentalKeys, Role } from "@/types/fairhold";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request<T>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = (data as { error?: { message?: string; code?: string } }).error;
    throw new ApiError(err?.message || `Request failed (${res.status})`, err?.code || "UNKNOWN", res.status);
  }
  return data as T;
}

export function money(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
}

// ---- role key storage (per browser, per rental) ----------------------------

const KEY_PREFIX = "fairhold:keys:";

export function storeKeys(rentalId: string, keys: RentalKeys): void {
  localStorage.setItem(KEY_PREFIX + rentalId, JSON.stringify(keys));
}

export function loadKeys(rentalId: string): Partial<RentalKeys> {
  try {
    return JSON.parse(localStorage.getItem(KEY_PREFIX + rentalId) || "{}");
  } catch {
    return {};
  }
}

export function clearKeys(rentalId: string): void {
  localStorage.removeItem(KEY_PREFIX + rentalId);
}

/** The strongest key available for this rental (owner outranks renter). */
export function keyHeaders(rentalId: string): Record<string, string> {
  const keys = loadKeys(rentalId);
  const key = keys.ownerKey || keys.renterKey;
  return key ? { "X-Rental-Key": key } : {};
}

export function localRole(rentalId: string): Role {
  const keys = loadKeys(rentalId);
  if (keys.ownerKey) return "owner";
  if (keys.renterKey) return "renter";
  return null;
}

export const api = {
  config: () => request<AppConfig>("GET", "/api/config"),
  listRentals: () => request<{ rentals: Rental[] }>("GET", "/api/rentals"),
  getRental: (id: string) =>
    request<{ rental: Rental; events: RentalEvent[]; role: Role }>("GET", `/api/rentals/${id}`, undefined, keyHeaders(id)),
  createRental: (input: {
    itemName: string;
    ownerName: string;
    renterName: string;
    checkoutCondition: string;
    deposit: number;
  }) => request<{ rental: Rental; keys: RentalKeys }>("POST", "/api/rentals", input),
  authorize: (id: string, renterKey: string) =>
    request<{ rental: Rental }>("POST", `/api/rentals/${id}/authorize`, undefined, { "X-Rental-Key": renterKey }),
  submitReport: (id: string, report: string) =>
    request<{ rental: Rental }>("POST", `/api/rentals/${id}/report`, { report }, keyHeaders(id)),
  resolve: (id: string, action: "capture" | "release", amount: number | undefined, idempotencyKey: string) =>
    request<{ rental: Rental; replayed?: boolean; pending?: boolean; message?: string }>(
      "POST",
      `/api/rentals/${id}/resolve`,
      { action, amount },
      { "Idempotency-Key": idempotencyKey, ...keyHeaders(id) }
    ),
  reconcile: (id: string) =>
    request<{ rental: Rental; stillPending?: boolean; captureFailed?: boolean; message?: string }>(
      "POST",
      `/api/rentals/${id}/reconcile`,
      undefined,
      keyHeaders(id)
    ),
  cancel: (id: string) => request<{ rental: Rental }>("POST", `/api/rentals/${id}/cancel`, undefined, keyHeaders(id)),
  resetDemo: () => request<{ ok: boolean }>("POST", "/api/demo/reset"),
};

export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}
