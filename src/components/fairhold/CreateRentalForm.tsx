import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface CreateRentalInput {
  itemName: string;
  ownerName: string;
  renterName: string;
  checkoutCondition: string;
  deposit: number;
}

const EMPTY = { itemName: "", ownerName: "", renterName: "", checkoutCondition: "", deposit: "60" };

const SAMPLE = {
  itemName: "TrailBlazer 2-person tent",
  ownerName: "Alex",
  renterName: "Sam",
  checkoutCondition:
    "Poles straight and complete (4), rainfly intact, footprint included. Known wear: minor scuff on the carry bag, noted at checkout.",
  deposit: "60",
};

export function CreateRentalForm({
  onCreate,
  busy,
}: {
  onCreate: (input: CreateRentalInput) => Promise<void>;
  busy: boolean;
}) {
  const [form, setForm] = useState(EMPTY);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Step 1 · Create a deposit hold</CardTitle>
        <CardDescription>
          The owner lists an item, records its baseline condition, and sets the refundable deposit. FairHold creates a
          PayPal order with <code>intent=AUTHORIZE</code> — a hold, not a charge.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await onCreate({
              itemName: form.itemName,
              ownerName: form.ownerName,
              renterName: form.renterName,
              checkoutCondition: form.checkoutCondition,
              deposit: Number(form.deposit),
            });
            setForm(EMPTY);
          }}
        >
          <div className="grid gap-2">
            <Label htmlFor="itemName">Item</Label>
            <Input id="itemName" required maxLength={80} value={form.itemName} onChange={set("itemName")} placeholder="e.g. TrailBlazer 2-person tent" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="ownerName">Owner</Label>
              <Input id="ownerName" required maxLength={60} value={form.ownerName} onChange={set("ownerName")} placeholder="Alex" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="renterName">Renter</Label>
              <Input id="renterName" required maxLength={60} value={form.renterName} onChange={set("renterName")} placeholder="Sam" />
            </div>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="checkoutCondition">Baseline condition at checkout</Label>
            <Textarea
              id="checkoutCondition"
              rows={3}
              maxLength={1200}
              value={form.checkoutCondition}
              onChange={set("checkoutCondition")}
              placeholder="What shape is the item in before it goes out? Known wear is recorded here so it is never deducted later."
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="deposit">Deposit hold (USD, $1–$500 demo cap)</Label>
            <Input id="deposit" required type="number" min="1" max="500" step="0.01" value={form.deposit} onChange={set("deposit")} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>
              {busy ? "Creating order…" : "Create PayPal hold"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setForm(SAMPLE)}>
              Fill sample scenario
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
