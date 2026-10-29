import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FlowTemplatesModal } from "./flow-templates-modal";

describe("FlowTemplatesModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <FlowTemplatesModal
        isOpen={false}
        onClose={vi.fn()}
        onApplyTemplate={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders modal and template list with accessible dialog attributes", () => {
    const { container } = render(
      <FlowTemplatesModal
        isOpen={true}
        onClose={vi.fn()}
        onApplyTemplate={vi.fn()}
      />
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByText("قوالب أتمتة ManyChat الجاهزة")).toBeInTheDocument();
    expect(screen.getByText("استفسارات الأسعار والطلب المباشر")).toBeInTheDocument();

    // Snapshot test
    expect(container).toMatchSnapshot();
  });

  it("triggers onApplyTemplate when clicking on a template action button", () => {
    const handleApply = vi.fn();
    render(
      <FlowTemplatesModal
        isOpen={true}
        onClose={vi.fn()}
        onApplyTemplate={handleApply}
      />
    );

    const applyButtons = screen.getAllByRole("button", { name: /استخدام قالب/ });
    expect(applyButtons.length).toBeGreaterThan(0);
    fireEvent.click(applyButtons[0]!);

    expect(handleApply).toHaveBeenCalledTimes(1);
    expect(handleApply).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "price-inquiry",
      })
    );
  });

  it("calls onClose when close button is clicked", () => {
    const handleClose = vi.fn();
    render(
      <FlowTemplatesModal
        isOpen={true}
        onClose={handleClose}
        onApplyTemplate={vi.fn()}
      />
    );

    const closeButtons = screen.getAllByRole("button", { name: "إغلاق نافذة القوالب" });
    fireEvent.click(closeButtons[0]!);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
