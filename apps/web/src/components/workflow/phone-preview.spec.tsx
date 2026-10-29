import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PhonePreview } from "./phone-preview";

describe("PhonePreview", () => {
  it("renders with default props and replaces dynamic variables", () => {
    const { container } = render(
      <PhonePreview
        pageName="متجر النور"
        commenterName="سارة أحمد"
        commentText="بكام الفستان ده؟"
        publicReplyText="أهلاً بك {{commenter_name}}، تم الرد بالخاص 📩"
        privateReplyText="مرحباً {{commenter_name}} في {{page_name}}، السعر 200 جنيه"
      />
    );

    // Dynamic Island and Page Name
    expect(screen.getAllByText("متجر النور")[0]).toBeInTheDocument();
    // Default tab is dm
    expect(screen.getByText(/مرحباً سارة أحمد في متجر النور/)).toBeInTheDocument();
    // Match snapshot
    expect(container).toMatchSnapshot();
  });

  it("switches to post tab when clicked", () => {
    render(
      <PhonePreview
        pageName="متجر النور"
        commenterName="سارة أحمد"
        commentText="بكام الفستان ده؟"
        postPreviewText="أحدث تشكيلة صيفية متوفرة الآن"
      />
    );

    const postTabButton = screen.getByRole("button", { name: "المنشور" });
    fireEvent.click(postTabButton);

    expect(screen.getByText("أحدث تشكيلة صيفية متوفرة الآن")).toBeInTheDocument();
    expect(screen.getByText("بكام الفستان ده؟")).toBeInTheDocument();
  });

  it("renders action buttons in DM mode", () => {
    const buttons = [
      { label: "اطلب الآن", url: "https://example.com/order", type: "url" as const },
      { label: "واتساب", url: "https://wa.me/201000", type: "whatsapp" as const },
    ];

    render(
      <PhonePreview
        buttons={buttons}
        privateReplyText="تفاصيل العرض كاملة هنا"
      />
    );

    expect(screen.getByText("اطلب الآن")).toBeInTheDocument();
    expect(screen.getByText("واتساب")).toBeInTheDocument();
  });
});
