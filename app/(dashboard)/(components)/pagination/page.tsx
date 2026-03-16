import DefaultCardComponent from "@/app/(dashboard)/components/default-card-component";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

const metadata: Metadata = {
  title: "Cards & Content Containers | BenefitsSafe Admin Dashboard",
  description:
    "Showcase versatile card components and content containers for organized layout in the BenefitsSafe Admin Dashboard built with Next.js and Tailwind CSS.",
};

const TypographyPage = () => {
  return (
    <>
      <DashboardBreadcrumb title="Pagination" text="Pagination" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <DefaultCardComponent title="Default Solid">
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48]" href="#">First</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48]" href="#">Previous</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48] w-[48px] bg-primary dark:bg-primary text-white" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48]" href="#">Next</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48]" href="#">Last</Link>
            </li>
          </ul>
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center mt-6">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Previous</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link  font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Next</Link>
            </li>
          </ul>
        </DefaultCardComponent>
        <DefaultCardComponent title="Outline">
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center">
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">First</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Previous</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700  font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px] border border-primary text-primary dark:border-primary dark:text-primary" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Next</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Last</Link>
            </li>
          </ul>
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center mt-6">
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Previous</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700  font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px] border border-primary text-primary dark:border-primary dark:text-primary" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-white dark:bg-slate-700 border border-neutral-200 dark:border-neutral-600 text-neutral-900 dark:text-white font-medium rounded-lg px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Next</Link>
            </li>
          </ul>
        </DefaultCardComponent>
        <DefaultCardComponent title="Square with icon">
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link  font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">4</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">5</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronRight className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
          </ul>
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center mt-6">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link  font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
          </ul>
        </DefaultCardComponent>
        <DefaultCardComponent title="Rounded with icon">
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">4</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">5</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronRight className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
          </ul>
          <ul className="pagination flex flex-wrap items-center gap-2 justify-center mt-6">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium rounded-full border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
          </ul>
        </DefaultCardComponent>
        <DefaultCardComponent title="Default Solid">
          <div className="p-6 bg-blue-50 dark:bg-primary/25 inline-block rounded-xl bg-blue-success-gradient justify-center mx-auto">
            <ul className="pagination flex flex-wrap items-center gap-2 justify-center">
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Page 1of 11</Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                  <ChevronsLeft className="w-6" />
                </Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
              </li>
              <li className="page-item">
                <Link className="page-link font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">2</Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">4</Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">5</Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">...</Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                  <ChevronsRight className="w-6" />
                </Link>
              </li>
              <li className="page-item">
                <Link className="page-link bg-white dark:bg-slate-700 text-neutral-900 dark:text-white font-medium rounded-lg border-0 px-5 py-2.5 flex items-center justify-center h-[48px]" href="#">Last</Link>
              </li>
            </ul>
          </div>
        </DefaultCardComponent>
        <DefaultCardComponent title="No Spacing">
          <ul className="pagination flex flex-wrap items-center justify-center">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px] rounded-s-full" href="#">
                <ChevronsLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">4</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">5</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">
                <ChevronRight className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px] rounded-e-full" href="#">
                <ChevronsRight className="w-6" />
              </Link>
            </li>
          </ul>
          <ul className="pagination flex flex-wrap items-center justify-center mt-6">
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]  rounded-s-full" href="#">
                <ChevronLeft className="w-6" />
              </Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">1</Link>
            </li>
            <li className="page-item">
              <Link className="page-link dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px] bg-primary dark:bg-primary text-white" href="#">2</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">3</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">4</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px]" href="#">5</Link>
            </li>
            <li className="page-item">
              <Link className="page-link bg-blue-50 dark:bg-primary/25 text-neutral-900 dark:text-white font-medium border-0 flex items-center justify-center h-[48px] w-[48px] rounded-e-full" href="#">
                <ChevronRight className="w-6" />
              </Link>
            </li>
          </ul>
        </DefaultCardComponent>

      </div>
    </>
  );
};
export default TypographyPage;
