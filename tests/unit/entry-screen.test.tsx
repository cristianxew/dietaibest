import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import type { MutableRefObject } from "react";

import { EntryScreen } from "@/components/recipes/modal/screens/EntryScreen";
import {
  useRecipeFlowState,
  RecipeFlowContext,
  type RecipeFlowCtx,
} from "@/hooks/use-recipe-flow";
import {
  useRecipeFormState,
  RecipeFormContext,
  type RecipeFormCtx,
} from "@/hooks/use-recipe-form";
import { importedToFormData } from "@/lib/recipe-utils";
import type { ImportedRecipe } from "@/types/recipe";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/actions/recipe", () => ({
  getCategories: vi.fn().mockResolvedValue({ data: [] }),
  persistRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

vi.mock("@/actions/nutrition", () => ({
  analyzeRecipeProfileForFormAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const messages = {
  recipeModal: {
    entry: {
      title: "Create a recipe",
      subtitle: "Choose how you'd like to start",
      optionManualTitle: "Manual entry",
      optionManualDesc: "Type it yourself",
      optionAiTitle: "Ask the assistant",
      optionAiDesc: "Chat your way to a recipe",
      optionImportTitle: "Import from a link",
      optionImportDesc: "Paste a URL",
    },
  },
};

// Renders EntryScreen behind the REAL flow + form hooks (not mocks) so the
// test exercises the actual context wiring `handleManual` reads from, not a
// re-implementation of it.
function Harness({
  flowRef,
  formRef,
}: {
  flowRef: MutableRefObject<RecipeFlowCtx | null>;
  formRef: MutableRefObject<RecipeFormCtx | null>;
}) {
  const flow = useRecipeFlowState({
    onResetForm: () => {},
    onResetFormWithData: () => {},
    validateScreen: async () => true,
  });
  const form = useRecipeFormState({
    mode: "create",
    recipeId: null,
    // isOpen only gates the getCategories() fetch effect (irrelevant here);
    // false avoids an unrelated act() warning from that async resolution.
    isOpen: false,
    onSubmitSuccess: () => {},
  });
  flowRef.current = flow;
  formRef.current = form;
  return (
    <RecipeFlowContext.Provider value={flow}>
      <RecipeFormContext.Provider value={form}>
        <EntryScreen />
      </RecipeFormContext.Provider>
    </RecipeFlowContext.Provider>
  );
}

function renderEntryScreen() {
  const flowRef: MutableRefObject<RecipeFlowCtx | null> = { current: null };
  const formRef: MutableRefObject<RecipeFormCtx | null> = { current: null };
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness flowRef={flowRef} formRef={formRef} />
    </NextIntlClientProvider>
  );
  return { flowRef, formRef };
}

describe("EntryScreen — manual entry after an abandoned import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const preview: ImportedRecipe = {
    title: "Imported Pasta",
    ingredients: [{ name: "Flour", amount: 200, unit: "g" }],
    instructions: ["Mix"],
    sourceUrl: "https://example.com/pasta",
    dedupSourceRecipeId: "src-1",
  };

  it("clears importedPreview and the form's sourceUrl when the user picks Manual entry", () => {
    const { flowRef, formRef } = renderEntryScreen();

    // Simulate having gone through the import preview: applyImported() sets
    // importedPreview and resets the form with its sourceUrl (see
    // EntryScreen's applyImported callback).
    act(() => {
      flowRef.current!.setImportedPreview(preview);
      formRef.current!.form.reset(importedToFormData(preview));
    });
    expect(formRef.current!.form.getValues("sourceUrl")).toBe(
      "https://example.com/pasta"
    );

    fireEvent.click(screen.getByText("Manual entry"));

    expect(flowRef.current!.importedPreview).toBeNull();
    expect(formRef.current!.form.getValues("sourceUrl")).toBeFalsy();
  });
});
