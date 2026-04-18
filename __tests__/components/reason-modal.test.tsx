import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReasonModal } from "@/components/ui/reason-modal";

// Component coverage for the ReasonModal shipped in P2b (commit 9018781).
// Unblocks future UI PDRs (P3 expiring grants UI, Ch 8 maintenance banner).
describe("ReasonModal", () => {
  const baseProps = {
    open: true,
    onOpenChange: () => {},
    title: "Deactivate Beneficiary",
    description: "Provide a reason for compliance review.",
    reasonLabel: "Reason for deactivation",
    confirmButtonText: "Deactivate",
    onConfirm: vi.fn(() => Promise.resolve()),
  };

  it("renders title, description, and reason label", () => {
    render(<ReasonModal {...baseProps} />);
    expect(
      screen.getByRole("heading", { name: "Deactivate Beneficiary" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Provide a reason for compliance review."),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Reason for deactivation")).toBeInTheDocument();
  });

  it("disables confirm button when reason textarea is empty", () => {
    render(<ReasonModal {...baseProps} onConfirm={vi.fn(() => Promise.resolve())} />);
    const confirm = screen.getByRole("button", { name: "Deactivate" });
    expect(confirm).toBeDisabled();
  });

  it("disables confirm when trimmed reason is shorter than minReasonLength", async () => {
    const user = userEvent.setup();
    render(<ReasonModal {...baseProps} onConfirm={vi.fn(() => Promise.resolve())} />);
    const textarea = screen.getByLabelText("Reason for deactivation");
    // Whitespace-only input — trim length is 0 even though .length > 0.
    await user.type(textarea, "     ");
    const confirm = screen.getByRole("button", { name: "Deactivate" });
    expect(confirm).toBeDisabled();
  });

  it("enables confirm when trimmed reason meets minReasonLength", async () => {
    const user = userEvent.setup();
    render(<ReasonModal {...baseProps} onConfirm={vi.fn(() => Promise.resolve())} />);
    const textarea = screen.getByLabelText("Reason for deactivation");
    await user.type(textarea, "valid reason here");
    const confirm = screen.getByRole("button", { name: "Deactivate" });
    expect(confirm).toBeEnabled();
  });

  it("passes the trimmed reason to onConfirm when confirm is clicked", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn(() => Promise.resolve());
    render(<ReasonModal {...baseProps} onConfirm={onConfirm} />);
    const textarea = screen.getByLabelText("Reason for deactivation");
    await user.type(textarea, "  valid reason here  ");
    await user.click(screen.getByRole("button", { name: "Deactivate" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith("valid reason here");
  });

  it("calls onOpenChange(false) when cancel is clicked", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <ReasonModal
        {...baseProps}
        onOpenChange={onOpenChange}
        onConfirm={vi.fn(() => Promise.resolve())}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
