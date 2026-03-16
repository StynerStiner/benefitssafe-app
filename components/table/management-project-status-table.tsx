"use client";

import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface Project {
    projectName: string;
    client: string;
    budget: string;
    duration: string;
    progress: number;
    trend: "up" | "down";
    status: "Pending" | "Completed" | "InProgress" | "Cancelled";
    statusColor: "yellow" | "green" | "purple" | "red";
}

const projects: Project[] = [
    {
        projectName: "UX/UI Design",
        client: "Robert Fox",
        budget: "$24,000",
        duration: "24 Days",
        progress: 95,
        trend: "up",
        status: "Pending",
        statusColor: "yellow",
    },
    {
        projectName: "HTML Developer",
        client: "Leslie Alexander",
        budget: "$32,700",
        duration: "16 Days",
        progress: 95,
        trend: "down",
        status: "Completed",
        statusColor: "green",
    },
    {
        projectName: "React Development",
        client: "Devon Lane",
        budget: "$7,250",
        duration: "7 Days",
        progress: 95,
        trend: "up",
        status: "InProgress",
        statusColor: "purple",
    },
    {
        projectName: "Python Research",
        client: "Savannah Nguyen",
        budget: "$24,500",
        duration: "3 Days",
        progress: 95,
        trend: "up",
        status: "Pending",
        statusColor: "yellow",
    },
    {
        projectName: "Laravel Project",
        client: "Esther Howard",
        budget: "$30,000",
        duration: "5 Days",
        progress: 95,
        trend: "up",
        status: "Cancelled",
        statusColor: "red",
    },
];

const statusColorMap: Record<string, string> = {
    yellow: "bg-yellow-500/15 text-yellow-500 dark:text-yellow-500",
    green: "bg-green-500/15 text-green-500 dark:text-green-500",
    purple: "bg-purple-500/15 text-purple-500 dark:text-purple-500",
    red: "bg-red-500/15 text-red-500 dark:text-red-500",
};

const ManagementProjectStatusTable = () => {
    return (
        <Table className="table-auto border-spacing-0 border-separate">
            <TableHeader>
                <TableRow className="border-0">
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tl-lg">
                        Project Name
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Clients
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Budget
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Duration
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600">
                        Progress
                    </TableHead>
                    <TableHead className="bg-neutral-100 dark:bg-slate-700 first:border-s last:border-e text-base px-4 h-15 border-t border-neutral-200 dark:border-slate-600 rounded-tr-lg">
                        Status
                    </TableHead>
                </TableRow>
            </TableHeader>

            <TableBody>
                {
                    projects.map((project, index) => {
                        const isLast = index === projects.length - 1;
                        
                        return (
                            <TableRow key={index}>
                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                    }`}>
                                    {project.projectName}
                                </TableCell>
                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                    }`}>
                                    {project.client}
                                </TableCell>
                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                    }`}>
                                    {project.budget}
                                </TableCell>
                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                    }`}>
                                    {project.duration}
                                </TableCell>
                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-bl-lg" : ""
                                    }`}>
                                    <span
                                        className={`px-1.5 py-1 rounded font-semibold text-sm inline-flex items-center gap-1 ${project.trend === "up"
                                            ? "bg-green-500/15 text-green-500"
                                            : "bg-red-500/15 text-red-500"
                                            }`}
                                    >
                                        {project.trend === "up" ? (
                                            <ArrowUpRight className="w-4 h-4" />
                                        ) : (
                                            <ArrowDownLeft className="w-4 h-4" />
                                        )}
                                        {project.progress}%
                                    </span>
                                </TableCell>
                                <TableCell className={`py-4.5 px-4 border-b first:border-s last:border-e border-neutral-200 dark:border-slate-600 ${isLast ? "rounded-br-lg" : ""
                                    }`}>
                                    <span
                                        className={`px-4 py-1 rounded font-semibold text-sm ${statusColorMap[project.statusColor]
                                            }`}
                                    >
                                        {project.status}
                                    </span>
                                </TableCell>
                            </TableRow>
                        )
                    })
                }
            </TableBody>
        </Table>
    );
};

export default ManagementProjectStatusTable;
