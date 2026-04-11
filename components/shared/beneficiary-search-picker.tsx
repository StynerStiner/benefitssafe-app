"use client";

import { Input } from "@/components/ui/input";
import { Loader2, Search, User, X } from "lucide-react";
import { getInitials } from "@/lib/utils/get-initials";
import { useCallback, useEffect, useRef, useState } from "react";

interface BeneficiaryOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role?: string;
  addressCity: string | null;
  addressState: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  nonprofit_admin: "Admin",
  nonprofit_staff: "Staff",
  beneficiary: "Beneficiary",
  vendor: "Vendor",
  cpa: "CPA",
  auditor: "Auditor",
  attorney: "Attorney",
  grant_officer: "Grant Officer",
  platform_admin: "Platform Admin",
  support_agent: "Support",
  compliance_officer: "Compliance",
  billing_admin: "Billing",
};

const ROLE_COLORS: Record<string, string> = {
  beneficiary: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-400",
  vendor: "bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-400",
  nonprofit_admin: "bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400",
  nonprofit_staff: "bg-indigo-100 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400",
  cpa: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  auditor: "bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400",
  attorney: "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400",
  grant_officer: "bg-teal-100 dark:bg-teal-950/40 text-teal-700 dark:text-teal-400",
};

interface BeneficiarySearchPickerProps {
  value: string; // selected beneficiary ID
  onChange: (id: string, beneficiary?: BeneficiaryOption) => void;
  placeholder?: string;
  role?: string;
}

export function BeneficiarySearchPicker({
  value,
  onChange,
  placeholder = "Search by name, email, phone, or ID...",
  role = "beneficiary",
}: BeneficiarySearchPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BeneficiaryOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<BeneficiaryOption | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Fetch selected beneficiary on mount if value is set
  useEffect(() => {
    if (value && !selected) {
      fetch(`/api/users?role=${role}&search=${value}&limit=1`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.users?.[0]) {
            setSelected(data.users[0]);
          }
        })
        .catch(() => {});
    }
  }, [value, role, selected]);

  // Search with debounce
  const doSearch = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ role, limit: "15" });
      if (q) params.set("search", q);
      const res = await fetch(`/api/users?${params}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.users || []);
        setTotal(data.total || 0);
      }
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, doSearch]);

  // Load initial results when opened
  useEffect(() => {
    if (open && results.length === 0 && !loading) {
      doSearch("");
    }
  }, [open, results.length, loading, doSearch]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (b: BeneficiaryOption) => {
    setSelected(b);
    onChange(b.id, b);
    setOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    setSelected(null);
    onChange("");
    setQuery("");
  };

  // If a beneficiary is selected, show the selection
  if (selected) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border bg-muted/30 px-3 py-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white shrink-0 text-xs font-bold">
          {getInitials(`${selected.firstName} ${selected.lastName}`)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold truncate">
              {selected.firstName} {selected.lastName}
            </p>
            <span className="text-xs font-mono text-neutral-500 dark:text-neutral-300/60">
              {selected.id.substring(selected.id.length - 6).toUpperCase()}
            </span>
            {selected.role && (
              <span className={`text-xs font-semibold rounded px-1.5 py-0.5 ${ROLE_COLORS[selected.role] || "bg-muted text-neutral-500 dark:text-neutral-300"}`}>
                {ROLE_LABELS[selected.role] || selected.role}
              </span>
            )}
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-300 truncate">
            {selected.email}
            {selected.addressCity && ` -- ${selected.addressCity}${selected.addressState ? `, ${selected.addressState}` : ""}`}
          </p>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="flex h-7 w-7 items-center justify-center rounded-md text-neutral-500 dark:text-neutral-300 hover:text-foreground hover:bg-muted transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-500 dark:text-neutral-300" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="pl-9 pr-8 h-10"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-neutral-500 dark:text-neutral-300" />
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border bg-background shadow-lg overflow-hidden">
          {/* Results count */}
          <div className="px-3 py-2 border-b bg-muted/30">
            <p className="text-xs font-semibold text-neutral-500 dark:text-neutral-300 uppercase tracking-wider">
              {loading ? "Searching..." : `${total.toLocaleString()} beneficiar${total === 1 ? "y" : "ies"} found`}
            </p>
          </div>

          {/* Results list */}
          <div className="max-h-[280px] overflow-y-auto">
            {results.length === 0 && !loading ? (
              <div className="px-3 py-6 text-center">
                <User className="h-8 w-8 text-neutral-500 dark:text-neutral-300/30 mx-auto mb-2" />
                <p className="text-sm text-neutral-500 dark:text-neutral-300">
                  {query ? "No beneficiaries match your search" : "No beneficiaries in your organization"}
                </p>
              </div>
            ) : (
              results.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left border-b border-border/30 last:border-0"
                  onClick={() => handleSelect(b)}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary shrink-0 text-xs font-bold">
                    {getInitials(`${b.firstName} ${b.lastName}`)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-medium truncate">
                        {b.firstName} {b.lastName}
                      </p>
                      {b.role && (
                        <span className={`text-xs font-bold rounded px-1 py-0.5 shrink-0 ${ROLE_COLORS[b.role] || "bg-muted text-neutral-500 dark:text-neutral-300"}`}>
                          {ROLE_LABELS[b.role] || b.role}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-300 truncate">
                      {b.email}
                      {b.phone ? ` -- ${b.phone}` : ""}
                      {b.addressCity ? ` -- ${b.addressCity}${b.addressState ? `, ${b.addressState}` : ""}` : ""}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-neutral-500 dark:text-neutral-300/60 shrink-0">
                    {b.id.substring(b.id.length - 6).toUpperCase()}
                  </span>
                </button>
              ))
            )}

            {results.length > 0 && results.length < total && (
              <div className="px-3 py-2 text-center border-t bg-muted/20">
                <p className="text-xs text-neutral-500 dark:text-neutral-300">
                  Showing {results.length} of {total.toLocaleString()}. Type to narrow results.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
