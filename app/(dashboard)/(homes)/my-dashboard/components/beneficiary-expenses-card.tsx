"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Loader2, PlusCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

interface ExpenseItem {
  id: string;
  description: string;
  amount: string;
  status: string;
  createdAt: string;
  grant: { name: string } | null;
}

const statusVariant: Record<string, "warning" | "success" | "danger" | "info" | "default"> = {
  PENDING: "warning",
  APPROVED: "success",
  REJECTED: "danger",
  PAID: "info",
  CANCELLED: "danger",
};

const BeneficiaryExpensesCard = () => {
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(() => {
    setLoading(true);
    fetch("/api/expenses?limit=5")
      .then((r) => r.ok ? r.json() : { data: [] })
      .then((json) => {
        const data = Array.isArray(json) ? json : (json?.data || []);
        setExpenses(data.slice(0, 5));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchExpenses();
  }, [fetchExpenses]);

  const formatAmount = (a: string) =>
    `$${parseFloat(a || "0").toLocaleString("en-US", { minimumFractionDigits: 2 })}`;

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("en-US", { day: "numeric", month: "short" });

  return (
    <Card className="card h-full border-0">
      <CardContent className="card-body">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            <h6 className="mb-0 font-bold text-lg">My Expenses</h6>
          </div>
          <Link href="/expenses">
            <Button variant="default" size="sm" className="gap-1.5">
              <PlusCircle className="w-4 h-4" />
              Submit Expense
            </Button>
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-neutral-400" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
            <p className="text-sm text-neutral-500 mb-3">No expense requests yet</p>
            <Link href="/expenses">
              <Button variant="default" size="sm" className="gap-1.5">
                <PlusCircle className="w-4 h-4" />
                Submit Your First Request
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{exp.description}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400">
                    {exp.grant?.name || "No grant"} &middot; {formatDate(exp.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-3">
                  <span className="text-sm font-semibold">{formatAmount(exp.amount)}</span>
                  <Badge variant={statusVariant[exp.status] || "default"} className="text-xs">
                    {exp.status}
                  </Badge>
                </div>
              </div>
            ))}
            <Link href="/expenses" className="block text-center">
              <Button variant="outline" size="sm" className="w-full mt-2">
                View All Expenses
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BeneficiaryExpensesCard;
