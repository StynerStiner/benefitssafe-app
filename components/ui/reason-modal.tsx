"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ButtonVariant =
  | "default"
  | "destructive"
  | "outline"
  | "secondary"
  | "ghost"
  | "link";

interface ReasonModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmButtonText: string;
  confirmButtonVariant?: ButtonVariant;
  minReasonLength?: number;
  maxReasonLength?: number;
  onConfirm: (reason: string) => Promise<void>;
}

export function ReasonModal({
  open,
  onOpenChange,
  title,
  description,
  reasonLabel = "Reason",
  reasonPlaceholder = "Provide a reason…",
  confirmButtonText,
  confirmButtonVariant = "destructive",
  minReasonLength = 10,
  maxReasonLength = 500,
  onConfirm,
}: ReasonModalProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setReason("");
      setSubmitting(false);
    }
  }, [open]);

  const trimmedLength = reason.trim().length;
  const tooShort = trimmedLength < minReasonLength;
  const tooLong = trimmedLength > maxReasonLength;
  const disabled = submitting || tooShort || tooLong;

  const handleConfirm = async () => {
    if (disabled) return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (submitting ? null : onOpenChange(next))}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reason-modal-textarea">{reasonLabel}</Label>
          <Textarea
            id="reason-modal-textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={reasonPlaceholder}
            rows={4}
            disabled={submitting}
            aria-invalid={tooShort && reason.length > 0 ? true : undefined}
          />
          <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-300">
            <span>
              Minimum {minReasonLength} characters.
              {tooShort && reason.length > 0
                ? ` ${minReasonLength - trimmedLength} more needed.`
                : ""}
            </span>
            <span className={tooLong ? "text-red-500" : undefined}>
              {trimmedLength}/{maxReasonLength}
            </span>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant={confirmButtonVariant}
            onClick={handleConfirm}
            disabled={disabled}
          >
            {submitting ? "Processing…" : confirmButtonText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ReasonModal;
