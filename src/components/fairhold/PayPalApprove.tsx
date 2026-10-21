import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { Rental } from "@/types/fairhold";

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => { render: (el: HTMLElement) => void; close?: () => void };
    };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(clientId: string, currency: string): Promise<void> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&intent=authorize&currency=${currency}`;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load the PayPal JS SDK"));
    document.body.appendChild(script);
  });
  return sdkPromise;
}

export function PayPalApprove({
  rental,
  clientId,
  onApproved,
  onError,
}: {
  rental: Rental;
  clientId: string;
  onApproved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cancelled, setCancelled] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    let disposed = false;
    loadSdk(clientId, rental.currency)
      .then(() => {
        if (disposed || !containerRef.current || !window.paypal) return;
        containerRef.current.innerHTML = "";
        window.paypal
          .Buttons({
            // The order was created server-side with intent=AUTHORIZE; the
            // button only collects the payer's approval.
            createOrder: () => rental.paypal.orderId,
            onApprove: async () => {
              try {
                await onApproved();
              } catch (err) {
                onError(err instanceof Error ? err.message : "Authorization failed");
              }
            },
            onCancel: () => setCancelled(true),
            onError: (err: unknown) => onError(`PayPal button error: ${String(err)}`),
          })
          .render(containerRef.current);
      })
      .catch((err) => onError(err instanceof Error ? err.message : "SDK load failed"));
    return () => {
      disposed = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rental.id]);

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">
        The renter approves the hold in the PayPal sandbox sheet. Approving places a hold only — no money moves until
        the owner captures after the item comes back.
      </p>
      <div ref={containerRef} aria-label="PayPal approval buttons" />
      {rental.paypal.approveLink && (
        <div className="grid gap-2 rounded-md border p-3">
          <p className="text-sm text-muted-foreground">
            If the popup does not open, approve in a new tab. After PayPal returns you to FairHold, check the approval here.
          </p>
          <Button asChild variant="outline">
            <a href={rental.paypal.approveLink} target="_blank" rel="noopener noreferrer">Open PayPal in a new tab</a>
          </Button>
          <Button disabled={checking} onClick={async () => {
            setChecking(true);
            try { await onApproved(); }
            catch (err) { onError(err instanceof Error ? err.message : "Authorization failed"); }
            finally { setChecking(false); }
          }}>
            {checking ? "Checking PayPal…" : "Check PayPal approval"}
          </Button>
          <p className="text-xs text-muted-foreground">The server verifies approval with PayPal before activating the hold.</p>
        </div>
      )}
      {cancelled && (
        <Alert>
          <AlertTitle>Approval cancelled</AlertTitle>
          <AlertDescription>The renter closed the PayPal sheet without approving. No hold was placed.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export function SimulatedApprove({ onApproved, busy }: { onApproved: () => Promise<void>; busy: boolean }) {
  return (
    <div className="grid gap-3">
      <Alert variant="destructive">
        <AlertTitle>Simulated payer approval</AlertTitle>
        <AlertDescription>
          No PayPal credentials are configured, so this approval is simulated and clearly labeled. Add
          PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET to <code>.env</code> to use the real sandbox flow with the PayPal
          button.
        </AlertDescription>
      </Alert>
      <Button onClick={onApproved} disabled={busy} variant="outline" className="border-amber-500">
        {busy ? "Authorizing…" : "Simulate renter approval (fixture)"}
      </Button>
    </div>
  );
}
