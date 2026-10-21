export interface AssessmentItem {
  label: string;
  amountCents: number;
  evidence: string;
  // true = quote found verbatim in the report; false = NOT found (flagged);
  // null = could not be checked.
  evidenceVerified: boolean | null;
}

export interface Assessment {
  summary: string;
  confidence: number;
  items: AssessmentItem[];
  totalCents: number;
  promptVersion: string;
  aiMode: "live" | "fixture";
}

export interface PendingCapture {
  captureId: string;
  amountCents: number;
  status: "PENDING";
  statusDetails: { reason?: string } | null;
  requestedAt: string;
}

export interface Resolution {
  action: "capture" | "release" | "cancel";
  amountCents: number;
  captureId?: string;
  status?: string;
  finalCapture?: boolean;
  // Authorization status reported by PayPal after the capture — the source
  // of truth for what happened to the remainder, never inferred locally.
  authorizationStatus?: string | null;
  decidedAt: string;
}

export interface Rental {
  id: string;
  itemName: string;
  ownerName: string;
  renterName: string;
  checkoutCondition: string;
  depositCents: number;
  currency: string;
  state:
    | "awaiting_approval"
    | "hold_active"
    | "review_pending"
    | "under_review"
    | "resolved_captured"
    | "resolved_released"
    | "cancelled"
    | "attention";
  paypal: {
    mode: "sandbox" | "simulated";
    orderId: string | null;
    approveLink: string | null;
    authorizationId: string | null;
    captureId: string | null;
    expiresAt: string | null;
  };
  report: { text: string; submittedAt: string; submittedBy?: string } | null;
  assessment: Assessment | null;
  assessmentError: string | null;
  pendingCapture: PendingCapture | null;
  resolution: Resolution | null;
  createdAt: string;
  updatedAt: string;
}

export interface RentalKeys {
  ownerKey: string;
  renterKey: string;
}

export interface RentalEvent {
  id: string;
  rentalId: string;
  at: string;
  type: string;
  detail: Record<string, unknown>;
}

export interface AppConfig {
  currency: string;
  modes: { paypal: "sandbox" | "simulated"; ai: "live" | "fixture" };
  paypalClientId: string | null;
  maxReportChars: number;
  canResetDemo: boolean;
}

export type Role = "owner" | "renter" | null;
