import { Badge } from "@/components/ui/badge";
import type { AppConfig } from "@/types/fairhold";

export function ModeBadges({ config }: { config: AppConfig }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {config.modes.paypal === "sandbox" ? (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">PayPal sandbox · live</Badge>
      ) : (
        <Badge variant="destructive">SIMULATED payments — configure PayPal sandbox credentials</Badge>
      )}
      {config.modes.ai === "live" ? (
        <Badge className="bg-emerald-600 hover:bg-emerald-600">AI model · live</Badge>
      ) : (
        <Badge variant="secondary" className="border border-amber-500 text-amber-700">
          FIXTURE AI — keyword demo, set AI_API_KEY for a live model
        </Badge>
      )}
    </div>
  );
}
