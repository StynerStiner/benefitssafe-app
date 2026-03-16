import { Info } from "lucide-react";

export function ComplianceDisclaimer() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        This classification is guidance based on general SSI/Medi-Cal rules, not
        legal advice. Consult a benefits attorney or WIPA specialist for
        decisions affecting government benefits.
      </p>
    </div>
  );
}
