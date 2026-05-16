import { Store } from "lucide-react";
import { APP_NAME } from "@/lib/constants";

type BrandBadgeProps = {
  subtitle?: string;
  compact?: boolean;
  iconClassName?: string;
};

export function BrandBadge({ subtitle, compact = false, iconClassName }: BrandBadgeProps) {
  if (compact) {
    return (
      <div
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm ${iconClassName ?? ""}`}
        aria-label={APP_NAME}
      >
        <Store className="h-5 w-5" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm ${iconClassName ?? ""}`}
        aria-hidden="true"
      >
        <Store className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-base font-bold text-slate-900">{APP_NAME}</p>
        {subtitle ? <p className="truncate text-xs font-medium text-slate-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}
