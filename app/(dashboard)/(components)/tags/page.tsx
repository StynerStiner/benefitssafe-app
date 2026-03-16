import DefaultCardComponent from "@/app/(dashboard)/components/default-card-component";
import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import FlagImage from "@/public/assets/images/flags/flag-tag.png";
import { X } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";

const metadata: Metadata = {
  title: "Tags & Label Elements | BenefitsSafe Admin Dashboard",
  description:
    "Manage and display tag components and label elements for categorization and UI organization in the BenefitsSafe Admin Dashboard built with Next.js and Tailwind CSS.",
};

const TypographyPage = () => {
  return (
    <>
      <DashboardBreadcrumb title="Tags" text="Tags" />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <DefaultCardComponent title="Default Tags">
          <ul className="flex flex-wrap items-center gap-4 md:gap-8">
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium">Label</li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium">Label</li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium">Label</li>
          </ul>
          <ul className="tag-list flex flex-wrap items-center gap-3 sm:gap-5 mt-5">
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-1">
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-1">
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-1">
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
          </ul>
        </DefaultCardComponent>
        <DefaultCardComponent title="Colors tags">
          <ul className="flex flex-wrap items-center gap-4 md:gap-8">
            <li className="text-white bg-primary border border-primary rounded px-2 py-1.5 text-sm line-height-1 font-medium">Label</li>
            <li className="text-white bg-purple-600 border border-purple-600 rounded px-2 py-1.5 text-sm line-height-1 font-medium">Label</li>
            <li className="text-white bg-yellow-600 border border-yellow-600 rounded px-2 py-1.5 text-sm line-height-1 font-medium">Label</li>
          </ul>
          <ul className="tag-list flex flex-wrap items-center gap-3 sm:gap-5 mt-5">

            <li className="dark:text-purple-400 border border-purple-600 rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-1">
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
            <li className="text-yellow-600 border border-yellow-600 rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-1">
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
          </ul>
        </DefaultCardComponent>
        <DefaultCardComponent title="Tags With Image">
          <ul className="flex flex-wrap items-center gap-3 sm:gap-5 mt-5">
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <Image src={FlagImage} width={16} height={16} className="rounded-full" alt="Thumbnail" />
              Label
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <Image src={FlagImage} width={16} height={16} className="rounded-full" alt="Thumbnail" />
              Label
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <Image src={FlagImage} width={16} height={16} className="rounded-full" alt="Thumbnail" />
              Label
            </li>
          </ul>
          <ul className="tag-list flex flex-wrap items-center gap-3 sm:gap-5 mt-5">
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <Image src={FlagImage} width={16} height={16} className="rounded-full" alt="Thumbnail" />
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <Image src={FlagImage} width={16} height={16} className="rounded-full" alt="Thumbnail" />
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <Image src={FlagImage} width={16} height={16} className="rounded-full" alt="Thumbnail" />
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
          </ul>
        </DefaultCardComponent>
        <DefaultCardComponent title="Tags Indicator">
          <ul className="flex flex-wrap items-center gap-4 md:gap-8">
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Label
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Label
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-1.5 text-sm line-height-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Label
            </li>
          </ul>
          <ul className="tag-list flex flex-wrap items-center gap-3 sm:gap-5 mt-5">
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
            <li className="text-neutral-500 dark:text-neutral-300 border rounded px-2 py-2 text-sm line-height-1 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-green-600 rounded-full"></span>
              Label
              <button className="remove-tag text-lg flex justify-center items-center" type="button">
                <X className="w-4 h-4" />
              </button>
            </li>
          </ul>
        </DefaultCardComponent>
      </div>
    </>
  );
};
export default TypographyPage;
