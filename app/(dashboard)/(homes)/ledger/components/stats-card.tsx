import CardSmallChartTwo from '@/components/charts/card-small-chart-two';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import cryptoCurrencyImage1 from '@/public/assets/images/currency/crypto-img1.png';
import cryptoCurrencyImage2 from '@/public/assets/images/currency/crypto-img2.png';
import cryptoCurrencyImage3 from '@/public/assets/images/currency/crypto-img3.png';
import cryptoCurrencyImage4 from '@/public/assets/images/currency/crypto-img4.png';
import cryptoCurrencyImage5 from '@/public/assets/images/currency/crypto-img5.png';
import Image from 'next/image';

interface Grant { totalAmount: string; spentAmount: string; remainingAmount: string; }
interface LedgerEntry { type: string; amount: string; }

const StatsCard = ({ grants, ledgerEntries }: { grants: Grant[]; ledgerEntries: LedgerEntry[] }) => {
    const totalCredits = ledgerEntries.filter((l) => l.type === "CREDIT").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
    const totalDebits = ledgerEntries.filter((l) => l.type === "DEBIT").reduce((s, l) => s + parseFloat(l.amount || "0"), 0);
    const netBalance = grants.reduce((s, g) => s + parseFloat(g.remainingAmount || "0"), 0);
    const totalAllocated = grants.reduce((s, g) => s + parseFloat(g.totalAmount || "0"), 0);
    const entryCount = ledgerEntries.length;

    const cryptoItems = [
        {
            id: "credits",
            name: "Total Credits",
            symbol: "IN",
            price: `$${totalCredits.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            change: `${entryCount > 0 ? ledgerEntries.filter((l) => l.type === "CREDIT").length : 0} entries`,
            changeType: "success" as const,
            image: cryptoCurrencyImage1,
            chartId: "bitcoinAreaChart",
            gradient: "from-yellow-600/10",
            chartBg: "#F98C08",
        },
        {
            id: "debits",
            name: "Total Debits",
            symbol: "OUT",
            price: `$${totalDebits.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            change: `${ledgerEntries.filter((l) => l.type === "DEBIT").length} entries`,
            changeType: "danger" as const,
            image: cryptoCurrencyImage2,
            chartId: "ethereumAreaChart",
            gradient: "from-blue-600/10",
            chartBg: "#5F80FF",
        },
        {
            id: "balance",
            name: "Net Balance",
            symbol: "BAL",
            price: `$${netBalance.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            change: `${grants.length} grants`,
            changeType: "success" as const,
            image: cryptoCurrencyImage3,
            chartId: "solanaAreaChart",
            gradient: "from-purple-600/10",
            chartBg: "#C817F8",
        },
        {
            id: "allocated",
            name: "Total Allocated",
            symbol: "ALL",
            price: `$${totalAllocated.toLocaleString("en-US", { maximumFractionDigits: 0 })}`,
            change: `${grants.length} grants`,
            changeType: "success" as const,
            image: cryptoCurrencyImage4,
            chartId: "litecoinAreaChart",
            gradient: "from-blue-600/10",
            chartBg: "#2171EA",
        },
        {
            id: "entries",
            name: "Ledger Entries",
            symbol: "LOG",
            price: entryCount.toLocaleString(),
            change: "total entries",
            changeType: "success" as const,
            image: cryptoCurrencyImage5,
            chartId: "dogecoinAreaChart",
            gradient: "from-yellow-600/10",
            chartBg: "#C2A633",
        },
    ];

    return (
        <>
            {
                cryptoItems.map((crypto) => (
                    <Card
                        key={crypto.id}
                        className={cn(
                            "card shadow-none !border border-neutral-200 dark:border-slate-600 bg-gradient-to-l to-bg-white",
                            crypto.gradient
                        )}
                    >
                    <CardContent className="card-body p-0">
                        <div className="flex flex-wrap items-center gap-3">
                            <Image
                                src={crypto.image}
                                alt={crypto.name}
                                width={40}
                                height={40}
                                className="rounded-full shrink-0"
                            />
                            <div className="grow">
                                <h6 className="text-xl mb-1">{crypto.name}</h6>
                                <p className="font-medium text-neutral-500 dark:text-neutral-300 mb-0">{crypto.symbol}</p>
                            </div>
                        </div>
                        <div className="mt-4 flex flex-wrap justify-between items-center gap-1">
                            <div>
                                <h6 className="mb-2">{crypto.price}</h6>
                                <span
                                className={cn(
                                    "text-base",
                                    crypto.changeType === "success"
                                    ? "text-green-600"
                                    : "text-red-600"
                                )}
                                >
                                    {crypto.change}
                                </span>
                            </div>

                            <div className="remove-tooltip-title rounded-tooltip-value remove-tooltip-marker">
                                <CardSmallChartTwo chartColor={crypto.chartBg} />
                            </div>

                        </div>

                    </CardContent>
                </Card>
            ))
        }
        </>
    );
};

export default StatsCard;
