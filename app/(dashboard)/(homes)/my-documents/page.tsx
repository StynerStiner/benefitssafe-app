"use client";

import DashboardBreadcrumb from "@/components/layout/dashboard-breadcrumb";
import LoadingSkeleton from "@/components/loading-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle,
  CloudUpload,
  Download,
  FileText,
  Shield,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";

interface Document {
  id: string;
  entityType: string;
  entityId: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  uploadedById: string;
  createdAt: string;
}

const FILE_TYPE_LABELS: Record<string, string> = {
  benefits_letter: "Benefits Letter",
  id_document: "ID Document",
  verification: "Verification",
  receipt: "Receipt",
  invoice: "Invoice",
  contract: "Contract",
  grant_letter: "Grant Letter",
  other: "Other",
};

const FILE_TYPE_COLORS: Record<string, string> = {
  benefits_letter: "bg-blue-500/15 text-blue-600",
  id_document: "bg-purple-500/15 text-purple-600",
  verification: "bg-green-500/15 text-green-600",
  receipt: "bg-yellow-500/15 text-yellow-600",
  other: "bg-neutral-500/15 text-neutral-600",
};

const MyDocumentsPage = () => {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileType, setFileType] = useState("benefits_letter");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(() => {
    fetch("/api/documents?limit=100")
      .then((r) => (r.ok ? r.json() : { documents: [] }))
      .then((data) => {
        const docs = Array.isArray(data) ? data : data?.documents || [];
        setDocuments(docs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const valid: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type !== "application/pdf") {
        toast.error(`${file.name}: Only PDF files are supported`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name}: File must be under 10MB`);
        continue;
      }
      valid.push(file);
    }

    if (valid.length > 0) {
      setSelectedFiles((prev) => [...prev, ...valid]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      toast.error("Please select at least one file");
      return;
    }

    setUploading(true);
    let successCount = 0;

    try {
      // Get current user session to use as entityId
      const sessionRes = await fetch("/api/auth/session");
      const session = await sessionRes.json();
      const userId = session?.user?.id;

      if (!userId) {
        toast.error("Session expired. Please log in again.");
        setUploading(false);
        return;
      }

      for (const file of selectedFiles) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("entityType", "beneficiary");
        formData.append("entityId", userId);
        formData.append("fileType", fileType);

        const res = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        if (res.ok) {
          successCount++;
        } else {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          toast.error(`${file.name}: ${err.error}`);
        }
      }

      if (successCount > 0) {
        toast.success(
          `${successCount} document${successCount > 1 ? "s" : ""} uploaded successfully`
        );
        setSelectedFiles([]);
        fetchDocuments();
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <>
        <DashboardBreadcrumb title="My Documents" text="My Documents" />
        <LoadingSkeleton />
      </>
    );
  }

  return (
    <>
      <DashboardBreadcrumb title="My Documents" text="My Documents" />

      {/* Upload Section */}
      <Card className="card rounded-lg border-0 mb-6">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Upload Documents</CardTitle>
              <CardDescription>
                Upload your benefits letters, ID documents, and verification files.
                Your nonprofit administrator will be able to review these securely.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Document Type Selector */}
          <div>
            <label className="text-sm font-medium text-neutral-600 dark:text-neutral-300 mb-2 block">
              Document Type
            </label>
            <Select value={fileType} onValueChange={setFileType}>
              <SelectTrigger className="border border-neutral-300 dark:border-slate-500 focus:border-primary dark:focus:border-primary h-12 rounded-lg !shadow-none !ring-0 w-full max-w-sm">
                <SelectValue placeholder="Select document type" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-slate-900">
                <SelectItem value="benefits_letter">SSI/SSDI Benefits Letter</SelectItem>
                <SelectItem value="verification">Medi-Cal/Medicaid Verification</SelectItem>
                <SelectItem value="id_document">Photo ID</SelectItem>
                <SelectItem value="receipt">Receipt</SelectItem>
                <SelectItem value="other">Other Document</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Drop Zone */}
          <div
            className="relative border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-8 bg-neutral-50 dark:bg-neutral-900 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-primary/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <div className="text-center">
              <CloudUpload className="w-10 h-10 text-neutral-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                PDF files only -- Max 10MB per file
              </p>
            </div>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-400 uppercase tracking-wide">
                Ready to Upload ({selectedFiles.length})
              </p>
              <div className="space-y-2">
                {selectedFiles.map((file, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-2 bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-lg border border-neutral-200 dark:border-neutral-700"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                      <div className="min-w-0">
                        <span className="text-sm text-neutral-700 dark:text-neutral-300 truncate block">
                          {file.name}
                        </span>
                        <span className="text-xs text-neutral-500">
                          {(file.size / 1024).toFixed(0)} KB
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-500 flex-shrink-0" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFile(idx);
                        }}
                        className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-neutral-400 hover:text-red-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleUpload}
                disabled={uploading}
                className="w-full h-12 mt-3"
              >
                {uploading ? (
                  "Uploading..."
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload {selectedFiles.length} Document{selectedFiles.length > 1 ? "s" : ""}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="card rounded-lg border-0 !p-0">
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-slate-600">
            <h3 className="font-bold text-lg mb-0">My Uploaded Documents</h3>
            <span className="text-sm text-neutral-500 dark:text-neutral-400">
              {documents.length} document{documents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-800 mb-4">
                <FileText className="w-8 h-8 text-neutral-400" />
              </div>
              <h3 className="text-base font-semibold mb-1">No documents yet</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-sm">
                Upload your benefits letters, ID documents, and verification files using the form above.
                Your nonprofit administrator will review them securely.
              </p>
            </div>
          ) : (
            <Table className="table-auto border-spacing-0 border-separate">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-14 text-start">
                    Document
                  </TableHead>
                  <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-14 text-center">
                    Type
                  </TableHead>
                  <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-14 text-center">
                    Uploaded
                  </TableHead>
                  <TableHead className="bg-neutral-100 dark:bg-slate-700 text-base px-6 h-14 text-center">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc, index) => {
                  const isLast = index === documents.length - 1;
                  const colorClass =
                    FILE_TYPE_COLORS[doc.fileType] || FILE_TYPE_COLORS.other;

                  return (
                    <TableRow key={doc.id}>
                      <TableCell
                        className={`${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-start`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <h6 className="text-sm font-medium mb-0 truncate max-w-[200px]">
                              {doc.fileName}
                            </h6>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell
                        className={`${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}
                      >
                        <span
                          className={`px-3 py-1.5 rounded-md font-medium text-xs ${colorClass}`}
                        >
                          {FILE_TYPE_LABELS[doc.fileType] || doc.fileType}
                        </span>
                      </TableCell>
                      <TableCell
                        className={`${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center text-sm text-neutral-600 dark:text-neutral-300`}
                      >
                        {new Date(doc.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </TableCell>
                      <TableCell
                        className={`${isLast ? "border-0" : "border-b border-neutral-200"} dark:border-neutral-600 py-3.5 px-6 text-center`}
                      >
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                        >
                          <Download className="w-4 h-4" />
                          View
                        </a>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default MyDocumentsPage;
