import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { VariablePill, VariablePillList } from "./variable-pill";
import { NegativeKeywordInput } from "./negative-keyword-input";
import { ActionButtonsManager } from "./action-button";

describe("VariablePill & VariablePillList", () => {
  it("renders variable pill and handles onSelect", () => {
    const handleSelect = vi.fn();
    const item = { key: "commenter_name", label: "اسم العميل", desc: "اسم صاحب التعليق" };

    const { container } = render(<VariablePill variable={item} onSelect={handleSelect} />);
    const btn = screen.getByRole("button", { name: "إدراج المتغير اسم العميل" });
    fireEvent.click(btn);

    expect(handleSelect).toHaveBeenCalledWith("commenter_name");
    expect(container).toMatchSnapshot();
  });

  it("renders list of variables", () => {
    const handleSelect = vi.fn();
    render(<VariablePillList onSelect={handleSelect} />);

    expect(screen.getByText("إدراج متغيرات بالرسالة:")).toBeInTheDocument();
    expect(screen.getByText("👤 اسم العميل")).toBeInTheDocument();
  });
});

describe("NegativeKeywordInput", () => {
  it("adds a new negative keyword and handles presets", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <NegativeKeywordInput
        keywords={["نصابين"]}
        onChange={handleChange}
      />
    );

    expect(screen.getByText("1 مستثناة")).toBeInTheDocument();
    expect(screen.getByText("نصابين")).toBeInTheDocument();

    const input = screen.getByLabelText("إدخال كلمة سلبية جديدة");
    fireEvent.change(input, { target: { value: "مزيف" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(handleChange).toHaveBeenCalledWith(["نصابين", "مزيف"]);
    expect(container).toMatchSnapshot();
  });

  it("removes a negative keyword when delete button clicked", () => {
    const handleChange = vi.fn();
    render(
      <NegativeKeywordInput
        keywords={["نصابين", "غالي"]}
        onChange={handleChange}
      />
    );

    const removeBtn = screen.getByLabelText("حذف الكلمة السلبية نصابين");
    fireEvent.click(removeBtn);

    expect(handleChange).toHaveBeenCalledWith(["غالي"]);
  });
});

describe("ActionButtonsManager", () => {
  it("renders existing buttons and matches snapshot", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <ActionButtonsManager
        buttons={[{ label: "رابط المتجر", url: "https://store.example.com", type: "url" }]}
        onChange={handleChange}
      />
    );

    expect(screen.getByText("رابط المتجر")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(container).toMatchSnapshot();
  });

  it("opens add form and allows adding a button", () => {
    const handleChange = vi.fn();
    render(
      <ActionButtonsManager
        buttons={[]}
        onChange={handleChange}
      />
    );

    const openAddBtn = screen.getByRole("button", { name: "إضافة زر تفاعلي جديد" });
    fireEvent.click(openAddBtn);

    const labelInput = screen.getByLabelText("عنوان الزر");
    const urlInput = screen.getByLabelText("رابط الزر أو رقم الاتصال");
    const submitBtn = screen.getByRole("button", { name: "حفظ الزر وإضافته للرسالة" });

    fireEvent.change(labelInput, { target: { value: "شراء سريع" } });
    fireEvent.change(urlInput, { target: { value: "https://checkout.example.com" } });
    fireEvent.click(submitBtn);

    expect(handleChange).toHaveBeenCalledWith([
      { label: "شراء سريع", url: "https://checkout.example.com", type: "url" },
    ]);
  });
});
