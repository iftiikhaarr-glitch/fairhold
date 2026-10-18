import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { RentalKeys } from "@/types/fairhold";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="grid gap-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input readOnly value={value} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button
          type="button"
          variant="outline"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export function KeyHandoff({ keys, onDone }: { keys: RentalKeys; onDone: () => void }) {
  return (
    <Card className="border-primary">
      <CardHeader>
        <CardTitle>Save the role keys — shown once</CardTitle>
        <CardDescription>
          FairHold protects payment-changing actions with per-rental keys. The server stores only hashes; these
          plaintext keys cannot be recovered later. They are also saved in this browser's local storage automatically.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Alert>
          <AlertTitle>Why keys?</AlertTitle>
          <AlertDescription>
            A button alone proves nothing. Capturing or voiding money requires the <strong>owner key</strong>;
            approving the hold requires the <strong>renter key</strong>. In a real deployment this would be accounts
            and OAuth — the keys are the demo-grade equivalent.
          </AlertDescription>
        </Alert>
        <CopyField label="Owner key (capture / release / cancel / reconcile)" value={keys.ownerKey} />
        <CopyField label="Renter key (approve hold / file report)" value={keys.renterKey} />
        <Button onClick={onDone}>I've saved the keys — continue</Button>
      </CardContent>
    </Card>
  );
}
