"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";

interface Grant {
  id: string;
  name: string;
  status: string;
  totalAmount: string;
  remainingAmount: string;
}

interface Expense {
  id: string;
  description: string;
  amount: string;
  status: string;
  createdAt: string;
  grant?: { name: string };
}

const TabsWithTableCard = () => {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [grantsRes, expensesRes] = await Promise.all([
          fetch("/api/grants?limit=10"),
          fetch("/api/expenses?limit=10"),
        ]);

        const grantsJson = await grantsRes.json();
        const expensesJson = await expensesRes.json();
        setGrants(Array.isArray(grantsJson) ? grantsJson : grantsJson.data ?? []);
        setExpenses(Array.isArray(expensesJson) ? expensesJson : expensesJson.data ?? []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const statusColor = (status: string) => {
    switch (status) {
      case "ACTIVE": case "APPROVED": case "PAID": return "text-green-600 bg-green-100 dark:bg-green-600/25";
      case "PENDING": return "text-amber-600 bg-amber-100 dark:bg-amber-600/25";
      case "REJECTED": case "BLOCKED": return "text-red-600 bg-red-100 dark:bg-red-600/25";
      default: return "text-neutral-600 bg-neutral-100 dark:bg-neutral-600/25";
    }
  };

  return (
    <Card className="card">
      <CardContent className="px-0">
        <Tabs defaultValue="myGrants" className="gap-4">
          <TabsList className="active-gradient bg-transparent dark:bg-transparent rounded-none h-[50px]">
            <TabsTrigger value="myGrants" className="py-2.5 px-4 font-semibold text-lg inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-primary dark:data-[state=active]:border-primary rounded-[0] data-[state=active]:shadow-none cursor-pointer">
              My Grants
              <span className="text-white px-2 py-0.5 bg-neutral-600 rounded-full text-sm">
                {loading ? "..." : grants.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="myExpenses" className="py-2.5 px-4 font-semibold text-lg inline-flex items-center gap-3 dark:bg-transparent text-neutral-600 hover:text-primary dark:text-white dark:hover:text-blue-500 data-[state=active]:bg-gradient border-0 border-t-2 border-neutral-200 dark:border-neutral-500 data-[state=active]:border-primary dark:data-[state=active]:border-primary rounded-[0] data-[state=active]:shadow-none cursor-pointer">
              My Expenses
              <span className="text-white px-2 py-0.5 bg-neutral-600 rounded-full text-sm">
                {loading ? "..." : expenses.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="myGrants">
            {loading ? (
              <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
            ) : grants.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-8">No grants assigned yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Grant Name</th>
                      <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Total</th>
                      <th className="text-right py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grants.map((g) => (
                      <tr key={g.id} className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="py-3 px-4 text-neutral-900 dark:text-white">{g.name}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(g.status)}`}>
                            {g.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-neutral-900 dark:text-white">${parseFloat(g.totalAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                        <td className="py-3 px-4 text-right text-neutral-900 dark:text-white">${parseFloat(g.remainingAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="myExpenses">
            {loading ? (
              <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
            ) : expenses.length === 0 ? (
              <p className="text-sm text-neutral-500 text-center py-8">No expenses submitted yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Description</th>
                      <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Grant</th>
                      <th className="text-left py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Status</th>
                      <th className="text-right py-3 px-4 font-medium text-neutral-600 dark:text-neutral-300">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenses.map((e) => (
                      <tr key={e.id} className="border-b border-neutral-100 dark:border-neutral-800">
                        <td className="py-3 px-4 text-neutral-900 dark:text-white">{e.description}</td>
                        <td className="py-3 px-4 text-neutral-600 dark:text-neutral-300">{e.grant?.name || "-"}</td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor(e.status)}`}>
                            {e.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right text-neutral-900 dark:text-white">${parseFloat(e.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default TabsWithTableCard;