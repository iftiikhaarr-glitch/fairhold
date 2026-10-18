import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { PayPalApprove, SimulatedApprove } from "./PayPalApprove";
import { Timeline } from "./Timeline";
import { api, loadKeys, money, newIdempotencyKey, storeKeys, localRole } from "@/lib/api";
import type { AppConfig, Rental, RentalEvent, Role } from "@/types/fairhold";

const STATE_LABEL: Record<string, string> = {
  awaiting_approval: "Awaiting renter approval",
  hold_active: "Deposit hold active",
  review_pending: "AI reviewing report…",
  under_review: "Awaiting owner decision",
  resolved_captured: "Resolved — deduction captured",
  resolved_released: "Resolved — fully released",
  cancelled: "Cancelled",
  attention: "Needs attention — capture pending",
};

function KeyEntry({ rentalId, onSaved }: { rentalId: string; onSaved: () => void }) {
  const [value, setValue] = useState("");
  const [asRole, setAsRole] = useState<"owner" | "renter">("owner");
  return (
    <div className="rounded-md border border-dashed p-3 grid gap-2">
      <p className="text-sm text-muted-foreground">
        This browser has no key for this rental. Paste a key to act:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          aria-label="Key role"
          value={asRole}
          onChange={(e) => setAsRole(e.target.value as "owner" | "renter")}
          className="h-9 rounded-md border bg-background px-2 text-sm"
        >
          <option value="owner">Owner key</option>
          <option value="renter">Renter key</option>
        </select>
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="paste key"
          className="font-mono text-xs w-72"
          aria-label="Paste role key"
        />
        <Button
          variant="outline"
          disabled={!value.trim()}
          onClick={() => {
            const existing = loadKeys(rentalId);
            storeKeys(rentalId, { ownerKey: existing.ownerKey || "", renterKey: existing.renterKey || "", [asRole + "Key"]: value.trim() } as never);
            onSaved();
          }}
        >
          Save key
        </Button>
      </div>
    </div>
  );
}

export function RentalDetail({
  rental,
  events,
  config,
  onChanged,
}: {
  rental: Rental;
  events: RentalEvent[];
  config: AppConfig;
  onChanged: (r: Rental) => void;
}) {
  const [report, setReport] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [role, setRole] = useState<Role>(() => localRole(rental.id));

  useEffect(() => {
    setReport("");
    setError(null);
    setNotice(null);
    setAmount(rental.assessment ? (rental.assessment.totalCents / 100).toFixed(2) : "");
    setRole(localRole(rental.id));
  }, [rental.id, rental.state, rental.assessment]);

  const run = async (label: string, fn: () => Promise<{ rental: Rental; pending?: boolean; message?: string }>) => {
    setBusy(label);
    setError(null);
    setNotice(null);
    try {
      const result = await fn();
      onChanged(result.rental);
      if (result.pending && result.message) setNotice(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(null);
    }
  };

  const renterKey = loadKeys(rental.id).renterKey || "";
  const proposedCents = rental.assessment?.totalCents ?? 0;
  const isOwner = role === "owner";

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="grid gap-4 content-start">
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{rental.itemName}</CardTitle>
                <CardDescription>
                  {rental.ownerName} → {rental.renterName} · hold {money(rental.depositCents, rental.currency)}
                </CardDescription>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant="outline">{STATE_LABEL[rental.state] ?? rental.state}</Badge>
                {role && <Badge variant="secondary">you hold the {role} key</Badge>}
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {error && (
              <Alert variant="destructive">
                <AlertTitle>Action failed</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {notice && (
              <Alert>
                <AlertTitle>Pending</AlertTitle>
                <AlertDescription>{notice}</AlertDescription>
              </Alert>
            )}
            {!role && ["awaiting_approval", "hold_active", "under_review", "attention"].includes(rental.state) && (
              <KeyEntry rentalId={rental.id} onSaved={() => setRole(localRole(rental.id))} />
            )}

            {rental.state === "awaiting_approval" && (
              <div className="grid gap-3">
                <h3 className="font-medium">Step 2 · Renter approves the hold</h3>
                {role !== "renter" && !renterKey ? (
                  <p className="text-sm text-muted-foreground">
                    Approving the hold requires the <strong>renter key</strong>
                    {isOwner ? " (you hold the owner key — open the renter key in another browser to play the renter, or paste it above)." : "."}
                  </p>
                ) : config.modes.paypal === "sandbox" && config.paypalClientId ? (
                  <PayPalApprove
                    rental={rental}
                    clientId={config.paypalClientId}
                    onApproved={async () => run("authorize", () => api.authorize(rental.id, renterKey))}
                    onError={setError}
                  />
                ) : (
                  <SimulatedApprove busy={busy === "authorize"} onApproved={() => run("authorize", () => api.authorize(rental.id, renterKey))} />
                )}
                {isOwner && (
                  <Button variant="ghost" className="justify-start text-muted-foreground" disabled={busy !== null} onClick={() => run("cancel", () => api.cancel(rental.id))}>
                    Cancel this rental (owner key)
                  </Button>
                )}
              </div>
            )}

            {rental.state === "hold_active" && (
              <div className="grid gap-3">
                <h3 className="font-medium">Step 3 · Item comes back — file the condition report</h3>
                <p className="text-sm text-muted-foreground">
                  Baseline at checkout: <em>{rental.checkoutCondition || "not recorded"}</em>
                </p>
                <Textarea
                  rows={4}
                  maxLength={config.maxReportChars}
                  value={report}
                  onChange={(e) => setReport(e.target.value)}
                  placeholder="e.g. Rainfly has a long scratch and one pole is dented. Stakes all returned."
                  aria-label="Return condition report"
                />
                <div className="flex flex-wrap gap-2">
                  <Button disabled={!report.trim() || busy !== null || !role} onClick={() => run("report", () => api.submitReport(rental.id, report))}>
                    {busy === "report" ? "AI reviewing…" : "Run AI condition review"}
                  </Button>
                  {isOwner && (
                    <Button variant="outline" disabled={busy !== null} onClick={() => run("release", () => api.resolve(rental.id, "release", undefined, newIdempotencyKey()))}>
                      {busy === "release" ? "Releasing…" : "No issues — release full deposit"}
                    </Button>
                  )}
                </div>
              </div>
            )}

            {rental.state === "review_pending" && <p className="text-sm text-muted-foreground">AI is reviewing the condition report…</p>}

            {rental.state === "under_review" && (
              <div className="grid gap-3">
                <h3 className="font-medium">Step 4 · AI proposal (based on the submitted report)</h3>
                {rental.report && (
                  <blockquote className="border-l-2 pl-3 text-sm text-muted-foreground">“{rental.report.text}”</blockquote>
                )}
                {rental.assessment ? (
                  <div className="rounded-md border p-3 grid gap-2">
                    {rental.assessment.aiMode === "fixture" && (
                      <Badge variant="secondary" className="w-fit border border-amber-500 text-amber-700">
                        FIXTURE AI output — keyword demo, not a real model
                      </Badge>
                    )}
                    <p className="text-sm">{rental.assessment.summary}</p>
                    {rental.assessment.items.length > 0 ? (
                      <ul className="text-sm grid gap-2">
                        {rental.assessment.items.map((item, i) => (
                          <li key={i} className="grid gap-0.5">
                            <div className="flex justify-between gap-2">
                              <span className="font-medium">{item.label}</span>
                              <span className="font-medium">{money(item.amountCents, rental.currency)}</span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              “{item.evidence}”{" "}
                              {item.evidenceVerified === true && <span className="text-emerald-700">· quoted verbatim from the report</span>}
                              {item.evidenceVerified === false && (
                                <span className="text-destructive">· quote NOT found in the report — treat this line with caution</span>
                              )}
                              {item.evidenceVerified === null && <span>· quote could not be checked</span>}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-muted-foreground">No deductible damage found in the report — full release proposed.</p>
                    )}
                    <Separator />
                    <div className="flex justify-between text-sm">
                      <span>
                        Proposed deduction · confidence {Math.round(rental.assessment.confidence * 100)}% · prompt{" "}
                        {rental.assessment.promptVersion}
                      </span>
                      <span className="font-semibold">{money(proposedCents, rental.currency)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      This proposal is derived only from the submitted report. It is not independent proof of damage,
                      not an objective adjudication, and the amounts are illustrative — not verified repair costs.
                    </p>
                  </div>
                ) : (
                  <Alert>
                    <AlertTitle>AI proposal unavailable — manual review</AlertTitle>
                    <AlertDescription>{rental.assessmentError}</AlertDescription>
                  </Alert>
                )}

                <h3 className="font-medium pt-2">Step 5 · Owner decides (owner key required)</h3>
                <p className="text-sm text-muted-foreground">
                  The AI only proposes. The owner confirms the final amount, capped at the authorized hold of{" "}
                  {money(rental.depositCents, rental.currency)}. A final capture settles that amount; per PayPal's
                  documentation the authorization is then voided and the uncaptured remainder is released.
                </p>
                {isOwner ? (
                  <div className="flex flex-wrap items-end gap-2">
                    <div className="grid gap-1">
                      <Label htmlFor="capture-amount">Deduction ({rental.currency})</Label>
                      <Input
                        id="capture-amount"
                        type="number"
                        min="0.01"
                        max={(rental.depositCents / 100).toFixed(2)}
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className="w-32"
                      />
                    </div>
                    <Button
                      disabled={busy !== null || !Number(amount)}
                      onClick={() => run("capture", () => api.resolve(rental.id, "capture", Number(amount), newIdempotencyKey()))}
                    >
                      {busy === "capture" ? "Capturing…" : "Capture deduction"}
                    </Button>
                    <Button variant="outline" disabled={busy !== null} onClick={() => run("release", () => api.resolve(rental.id, "release", undefined, newIdempotencyKey()))}>
                      {busy === "release" ? "Releasing…" : "Release full deposit"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Waiting for the owner. Capture and release require the owner key.</p>
                )}
              </div>
            )}

            {rental.state === "attention" && rental.pendingCapture && (
              <div className="grid gap-3">
                <Alert>
                  <AlertTitle>Capture pending at PayPal — not confirmed yet</AlertTitle>
                  <AlertDescription>
                    PayPal accepted a capture of {money(rental.pendingCapture.amountCents, rental.currency)} but has not
                    completed it
                    {rental.pendingCapture.statusDetails?.reason ? ` (reason: ${rental.pendingCapture.statusDetails.reason})` : ""}.
                    No confirmed outcome is shown until PayPal reports one.
                  </AlertDescription>
                </Alert>
                {isOwner ? (
                  <Button onClick={() => run("reconcile", () => api.reconcile(rental.id))} disabled={busy !== null}>
                    {busy === "reconcile" ? "Checking…" : "Check capture status at PayPal"}
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">Reconciling the capture requires the owner key.</p>
                )}
              </div>
            )}

            {rental.state === "resolved_captured" && rental.resolution && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 grid gap-1">
                <h3 className="font-medium text-emerald-900">Receipt</h3>
                <p className="text-sm">
                  Captured <strong>{money(rental.resolution.amountCents, rental.currency)}</strong> for the owner.
                </p>
                <p className="text-sm">
                  {rental.resolution.authorizationStatus === "VOIDED" ? (
                    <>
                      PayPal reports the authorization as <strong>VOIDED</strong> after this final capture — per PayPal's
                      documentation, the uncaptured remainder ({money(rental.depositCents - rental.resolution.amountCents, rental.currency)})
                      is released to {rental.renterName}.
                    </>
                  ) : rental.resolution.authorizationStatus ? (
                    <>
                      PayPal reports the authorization status as <strong>{rental.resolution.authorizationStatus}</strong>.
                    </>
                  ) : (
                    <>The post-capture authorization status could not be refreshed — verify the remainder in the PayPal sandbox dashboard.</>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Verified capture · ID {rental.resolution.captureId} · status {rental.resolution.status}
                  {rental.paypal.mode === "simulated" && " · SIMULATED — no real sandbox transaction"}
                </p>
              </div>
            )}

            {rental.state === "resolved_released" && (
              <div className="rounded-md border border-emerald-300 bg-emerald-50 p-4 grid gap-1">
                <h3 className="font-medium text-emerald-900">Receipt</h3>
                <p className="text-sm">
                  The authorization was voided — the hold of <strong>{money(rental.depositCents, rental.currency)}</strong> was
                  released and {rental.renterName} was never charged.
                  {rental.paypal.mode === "simulated" && (
                    <span className="text-xs text-muted-foreground block">SIMULATED — no real sandbox transaction.</span>
                  )}
                </p>
              </div>
            )}

            {rental.state === "cancelled" && <p className="text-sm text-muted-foreground">This rental was cancelled. Any hold was voided; nothing was captured.</p>}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 content-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payment references</CardTitle>
          </CardHeader>
          <CardContent className="text-xs grid gap-1 break-all">
            <div>Mode: {rental.paypal.mode}{rental.paypal.mode === "simulated" && " (labeled simulation)"}</div>
            <div>Order: {rental.paypal.orderId ?? "—"}</div>
            <div>Authorization: {rental.paypal.authorizationId ?? "—"}</div>
            <div>Capture: {rental.paypal.captureId ?? "—"}</div>
            <div>Hold expires: {rental.paypal.expiresAt ? new Date(rental.paypal.expiresAt).toLocaleString() : "—"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Audit timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <Timeline events={events} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
