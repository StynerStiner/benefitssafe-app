"use client";

import GenerateContentChart from '@/components/charts/generate-content-chart';
import CustomSelect from "@/components/shared/custom-select";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from 'react';

interface Document {
  fileType: string;
  createdAt: string;
}

const GenerateContentCard = () => {
  const [documentStats, setDocumentStats] = useState({ text: 0, image: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/documents");
        const documents = (await res.json()) as Document[];

        // Count document types
        const now = new Date();
        const thisMonth = documents.filter((d) => {
          const date = new Date(d.createdAt);
          return (
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear()
          );
        });

        const textDocs = thisMonth.filter(
          (d) => d.fileType?.includes("text") || d.fileType?.includes("pdf") || d.fileType?.includes("doc")
        ).length;
        const imageDocs = thisMonth.filter(
          (d) => d.fileType?.includes("image") || d.fileType?.includes("png") || d.fileType?.includes("jpg")
        ).length;

        setDocumentStats({ text: textDocs, image: imageDocs });
      } catch (error) {
        console.error("Failed to fetch document stats:", error);
        // Fallback to showing zeros if API fails
        setDocumentStats({ text: 0, image: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <Card className="card">
        <CardContent className="px-0">
          <p className="text-sm text-neutral-500 text-center py-8">Loading...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="card">
      <CardContent className="px-0">
        <div className="flex flex-wrap items-center justify-between">
          <h6 className="text-lg mb-0">Uploaded Documents</h6>
          <CustomSelect
            placeholder="Monthly"
            options={["Yearly", "Monthly", "Weekly", "Today"]}
          />
        </div>
        <ul className="flex flex-wrap items-center mt-4 gap-3">
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">
              Documents:
              <span className="text-neutral-600 dark:text-neutral-100 font-bold">
                {documentStats.text}
              </span>
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
            <span className="text-neutral-500 dark:text-neutral-300 text-sm font-semibold">
              Receipts:
              <span className="text-neutral-600 dark:text-neutral-100 font-bold">
                {documentStats.image}
              </span>
            </span>
          </li>
        </ul>

        <div className="mt-4">
          <GenerateContentChart />
        </div>
      </CardContent>
    </Card>
  );
};

export default GenerateContentCard;