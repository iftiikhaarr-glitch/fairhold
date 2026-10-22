import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ModeBadges } from "@/components/fairhold/ModeBadges";
import { CreateRentalForm } from "@/components/fairhold/CreateRentalForm";
import { RentalDetail } from "@/components/fairhold/RentalDetail";
import { KeyHandoff } from "@/components/fairhold/KeyHandoff";
import { api, money, storeKeys } from "@/lib/api";
import type { AppConfig, Rental, RentalEvent, RentalKeys } from "@/types/fairhold";

export default function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [events, setEvents] = useState<RentalEvent[]>([]);
  const [creating, setCreating] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<{ rentalId: string; keys: RentalKeys } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [{ rentals: list }] = await Promise.all([api.listRentals()]);
    setRentals(list);
    return list;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const cfg = await api.config();
        setConfig(cfg);
        const list = await refresh();
        const returnedOrder = new URLSearchParams(window.location.search).get("token");
        const returnedRental = list.find((r) => r.paypal.orderId === returnedOrder);
        if (list.length) setSelectedId(returnedRental?.id ?? list[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    })();
  }, [refresh]);

  useEffect(() => {
    if (!selectedId) {
      setEvents([]);
      return;
    }
    api
      .getRental(selectedId)
      .then(({ events }) => setEvents(events))
      .catch(() => setEvents([]));
  }, [selectedId, rentals]);

  const selected = rentals.find((r) => r.id === selectedId) ?? null;

  const handleChanged = (updated: Rental) => {
    setRentals((list) => list.map((r) => (r.id === updated.id ? updated : r)));
  };

  if (!config) {
    return <main className="p-8 text-sm text-muted-foreground">{error ?? "Loading FairHold…"}</main>;
  }

  return (
    <main className="mx-auto max-w-6xl p-4 md:p-8 grid gap-6">
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">FairHold</h1>
            <p className="text-sm text-muted-foreground">
              AI-assisted refundable deposits on PayPal — hold now, propose fairly, and let the owner settle when the
              item comes back.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ModeBadges config={config} />
            {config.demoAccessEnabled && <form method="post" action="/demo/logout"><Button type="submit" variant="outline" size="sm">Sign out demo</Button></form>}
          </div>
        </div>
        <Separator />
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="grid gap-6 md:grid-cols-[280px_1fr] items-start">
        <aside className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          <Button variant={creating || !selected ? "default" : "outline"} onClick={() => { setCreating(true); setSelectedId(null); setPendingKeys(null); }}>
            + New deposit hold
          </Button>
          {rentals.map((r) => (
            <Card
              key={r.id}
              role="button"
              tabIndex={0}
              onClick={() => { setCreating(false); setPendingKeys(null); setSelectedId(r.id); }}
              onKeyDown={(e) => e.key === "Enter" && (setCreating(false), setSelectedId(r.id))}
              className={`min-w-0 cursor-pointer transition-colors ${selectedId === r.id ? "border-primary" : "hover:border-muted-foreground/40"}`}
            >
              <CardContent className="p-3 grid gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 flex-1 text-sm font-medium truncate">{r.itemName}</span>
                  <Badge variant="outline" className="shrink-0 text-xs">{r.state.replace(/_/g, " ")}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {money(r.depositCents, r.currency)} hold · {new Date(r.createdAt).toLocaleDateString()}
                </span>
              </CardContent>
            </Card>
          ))}
          <Separator />
          {config.canResetDemo && <Button
            variant="ghost"
            className="text-muted-foreground"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.resetDemo();
                setSelectedId(null);
                setCreating(true);
                setPendingKeys(null);
                await refresh();
              } finally {
                setBusy(false);
              }
            }}
          >
            Reset demo data
          </Button>}
          <p className="text-xs text-muted-foreground">
            Sandbox / demo project. All people, items, and reports are synthetic. No real money can move: PayPal runs in
            the free sandbox, or in a clearly labeled simulation when credentials are absent.
          </p>
        </aside>

        <section>
          {pendingKeys ? (
            <KeyHandoff
              keys={pendingKeys.keys}
              onDone={() => {
                setCreating(false);
                setSelectedId(pendingKeys.rentalId);
                setPendingKeys(null);
              }}
            />
          ) : creating || !selected ? (
            <CreateRentalForm
              busy={busy}
              onCreate={async (input) => {
                setBusy(true);
                setError(null);
                try {
                  const { rental, keys } = await api.createRental(input);
                  storeKeys(rental.id, keys);
                  await refresh();
                  setPendingKeys({ rentalId: rental.id, keys });
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Create failed");
                } finally {
                  setBusy(false);
                }
              }}
            />
          ) : (
            <RentalDetail rental={selected} events={events} config={config} onChanged={handleChanged} />
          )}
        </section>
      </div>
    </main>
  );
}

