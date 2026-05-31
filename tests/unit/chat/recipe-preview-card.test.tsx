import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { RecipePreviewCard } from "@/components/chat/RecipePreviewCard";

const messages = {
  chat: {
    preview: {
      save: "Save recipe",
      cancel: "Cancel",
      ingredients: "Ingredients",
      steps: "Steps",
      servings: "Servings",
      prep: "Prep",
      cook: "Cook",
      minutesShort: "min",
    },
  },
};

function renderCard(props: Parameters<typeof RecipePreviewCard>[0]) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <RecipePreviewCard {...props} />
    </NextIntlClientProvider>
  );
}

describe("RecipePreviewCard", () => {
  const recipe = {
    title: "Chocolate Chip Cookies",
    description: "A classic.",
    servings: 12,
    prepTime: 15,
    cookTime: 12,
    ingredients: [
      { name: "flour", amount: 2, unit: "cup" },
      { name: "sugar", amount: 1, unit: "cup" },
    ],
    instructions: ["Mix", "Bake"],
  };

  it("renders title, ingredients, and steps", () => {
    renderCard({ recipe, onSave: vi.fn(), onCancel: vi.fn() });
    expect(screen.getByText("Chocolate Chip Cookies")).toBeTruthy();
    expect(screen.getByText(/flour/)).toBeTruthy();
    expect(screen.getByText("Mix")).toBeTruthy();
  });

  it("fires onSave and onCancel", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    renderCard({ recipe, onSave, onCancel });
    fireEvent.click(screen.getByText("Save recipe"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
