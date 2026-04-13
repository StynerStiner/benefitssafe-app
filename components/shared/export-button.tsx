"use client";

import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

type ExportType =
    | "grant_compliance"
    | "expense_summary"
    | "transaction_history"
    | "audit_trail"
    | "ledger";

interface ExportButtonProps {
    type: ExportType;
    grantId?: string;
    startDate?: string;
    endDate?: string;
    label?: string;
    /** When true, show only CSV (used for ledger where accountants want CSV). */
    csvOnly?: boolean;
}

export default function ExportButton({
    type,
    grantId,
    startDate,
    endDate,
    label = "Export",
    csvOnly = false,
}: ExportButtonProps) {
    const buildUrl = (format: "pdf" | "csv") => {
        const params = new URLSearchParams({ type, format });
        if (grantId) params.set("grantId", grantId);
        if (startDate) params.set("startDate", startDate);
        if (endDate) params.set("endDate", endDate);
        return `/api/reports/export?${params.toString()}`;
    };

    const trigger = (format: "pdf" | "csv") => {
        // Using a direct navigation triggers the browser's download handler
        // via the Content-Disposition header from the API route.
        window.location.href = buildUrl(format);
    };

    if (csvOnly) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => trigger("csv")}
            >
                <Download className="w-4 h-4 mr-2" />
                {label}
            </Button>
        );
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-2" />
                    {label}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => trigger("pdf")}>
                    <FileText className="w-4 h-4 mr-2" />
                    Download PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => trigger("csv")}>
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Download CSV
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
