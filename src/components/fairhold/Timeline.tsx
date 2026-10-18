import type { RentalEvent } from "@/types/fairhold";
import { money } from "@/lib/api";

const LABELS: Record<string, string> = {
  created: "Rental created",
  order_created: "PayPal order created (intent=AUTHORIZE)",
  authorized: "Deposit hold authorized by renter",
  authorization_voided: "Authorization voided",
  report_submitted: "Return condition report submitted",
  proposal_created: "AI proposal created (from the submitted report)",
  proposal_failed: "AI proposal unavailable — manual review",
  capture_pending: "Capture accepted by PayPal, awaiting completion",
  capture_not_completed: "Capture declined/failed at PayPal — no funds moved",
  capture_reconciled: "Capture outcome reconciled with PayPal",
  captured: "Deposit partially/fully captured (verified COMPLETED)",
  released: "Deposit released (hold voided)",
  cancelled: "Rental cancelled",
};

function detailLine(event: RentalEvent): string | null {
  const d = event.detail as Record<string, unknown>;
  switch (event.type) {
    case "captured":
      return `Captured ${money(Number(d.amountCents ?? 0))} · capture ${String(d.captureId ?? "")} · authorization ${String(d.authorizationStatus ?? "unknown")}`;
    case "proposal_created":
      return `Proposed deduction ${money(Number(d.totalCents ?? 0))} · ${String(d.aiMode)} AI · prompt ${String(d.promptVersion)} · evidence verbatim: ${String(d.evidenceAllVerified)}`;
    case "proposal_failed":
      return String(d.reason ?? "");
    case "capture_pending":
      return `Capture ${String(d.captureId ?? "")} · ${money(Number(d.amountCents ?? 0))}`;
    case "capture_not_completed":
      return `Status: ${String(d.status ?? "unknown")}`;
    case "capture_reconciled":
      return `Outcome: ${String(d.outcome ?? "")}`;
    case "authorized":
      return `Authorization ${String(d.authorizationId ?? "")}`;
    case "order_created":
      return `Order ${String(d.orderId ?? "")} · ${String(d.mode)} mode`;
    default:
      return null;
  }
}

export function Timeline({ events }: { events: RentalEvent[] }) {
  if (!events.length) return null;
  return (
    <ol className="relative border-l border-muted pl-4 grid gap-3">
      {events.map((e) => (
        <li key={e.id} className="grid gap-0.5">
          <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-primary" aria-hidden />
          <span className="text-sm font-medium">{LABELS[e.type] ?? e.type}</span>
          {detailLine(e) && <span className="text-xs text-muted-foreground break-all">{detailLine(e)}</span>}
          <time className="text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</time>
        </li>
      ))}
    </ol>
  );
}
