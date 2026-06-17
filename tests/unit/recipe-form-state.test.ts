import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

// Mock the server-action seams so no server code runs under jsdom. The form's
// zodResolver validation and react-hook-form state stay REAL — that's the logic
// under test.
vi.mock("@/actions/recipe", () => ({
  persistRecipe: vi.fn(),
  updateRecipe: vi.fn(),
  getCategories: vi.fn(async () => ({ data: [] })),
}));
vi.mock("@/actions/nutrition", () => ({
  analyzeRecipeProfileForFormAction: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { updateRecipe } from "@/actions/recipe";
import { analyzeRecipeProfileForFormAction } from "@/actions/nutrition";
import { toast } from "sonner";
import { useRecipeFormState } from "@/hooks/use-recipe-form";
import type { Profile } from "@/lib/fdc";

const PROFILE_KEYS: (keyof Profile)[] = [
  "calories", "protein", "carbs", "fat", "fiber",
  "sugar", "sodium", "cholesterol", "saturatedFat", "transFat",
  "vitaminA", "vitaminC", "vitaminD", "vitaminE", "vitaminK",
  "vitaminB12", "folate", "iron", "calcium", "magnesium", "potassium", "zinc",
];

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  const base = Object.fromEntries(PROFILE_KEYS.map((k) => [k, 0])) as Profile;
  return { ...base, ...overrides };
}

const VALID_RECIPE = {
  title: "Grilled Chicken Bowl",
  description: "",
  imageUrl: "",
  servings: 2,
  ingredients: [{ name: "chicken breast", amount: 200, unit: "g" }],
  instructions: ["Grill the chicken"],
  tags: [],
  categoryIds: [],
  isPublic: false,
};

function renderForm(mode: "create" | "edit", extras: Record<string, unknown> = {}) {
  const onSubmitSuccess = vi.fn();
  const onValidationError = vi.fn();
  const hook = renderHook(() =>
    useRecipeFormState({
      mode,
      recipeId: mode === "edit" ? "recipe-1" : null,
      isOpen: true,
      onSubmitSuccess,
      onValidationError,
    })
  );
  return { ...hook, onSubmitSuccess, onValidationError, ...extras };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("analyzeNutrition", () => {
  it("does NOT wipe existing values when the analysis resolves to an all-zero profile", async () => {
    vi.mocked(analyzeRecipeProfileForFormAction).mockResolvedValue({
      success: true,
      data: makeProfile(), // all zeros — FDC matched nothing
    });

    const { result } = renderForm("edit");

    // Existing recipe already has nutrition loaded into the form.
    act(() => {
      result.current.form.reset({ ...VALID_RECIPE, calories: 540, protein: 42 });
    });

    await act(async () => {
      await result.current.analyzeNutrition();
    });

    // Values must be preserved, not zeroed.
    expect(result.current.form.getValues("calories")).toBe(540);
    expect(result.current.form.getValues("protein")).toBe(42);
    expect(toast.error).toHaveBeenCalled();
  });

  it("fills macros/micros when the analysis returns a real profile", async () => {
    vi.mocked(analyzeRecipeProfileForFormAction).mockResolvedValue({
      success: true,
      data: makeProfile({ calories: 250.4, protein: 30.27, carbs: 5 }),
    });

    const { result } = renderForm("edit");
    act(() => {
      result.current.form.reset({ ...VALID_RECIPE });
    });

    await act(async () => {
      await result.current.analyzeNutrition();
    });

    expect(result.current.form.getValues("calories")).toBe(250.4);
    expect(result.current.form.getValues("protein")).toBe(30.3); // rounded to 1 decimal
    expect(toast.error).not.toHaveBeenCalled();
  });
});

describe("handleSubmit", () => {
  it("surfaces validation errors instead of silently doing nothing", async () => {
    const { result, onValidationError } = renderForm("edit");

    // Invalid: title too short + empty instruction (z.string().min(1)).
    act(() => {
      result.current.form.reset({
        ...VALID_RECIPE,
        title: "ab",
        instructions: [""],
      });
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    expect(updateRecipe).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalled();
    expect(onValidationError).toHaveBeenCalled();
  });

  it("saves when the form is valid", async () => {
    vi.mocked(updateRecipe).mockResolvedValue({ data: { id: "recipe-1" } } as never);

    const { result, onSubmitSuccess } = renderForm("edit");
    act(() => {
      result.current.form.reset({ ...VALID_RECIPE });
    });

    await act(async () => {
      await result.current.handleSubmit();
    });

    await waitFor(() => expect(updateRecipe).toHaveBeenCalledTimes(1));
    expect(toast.error).not.toHaveBeenCalled();
    expect(onSubmitSuccess).toHaveBeenCalled();
  });
});
