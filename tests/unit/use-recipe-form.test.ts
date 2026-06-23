import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { useRecipeFormState } from "@/hooks/use-recipe-form";
import type { ImportedRecipe } from "@/types/recipe";

vi.mock("@/actions/recipe", () => ({
  getCategories: vi.fn().mockResolvedValue({ data: [] }),
  persistRecipe: vi.fn(),
  updateRecipe: vi.fn(),
}));

vi.mock("@/actions/nutrition", () => ({
  analyzeRecipeProfileForFormAction: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const baseOpts = {
  mode: "create" as const,
  recipeId: null,
  isOpen: false,
  onSubmitSuccess: vi.fn(),
};

const validFormValues = {
  title: "Test Recipe",
  description: "",
  imageUrl: "",
  servings: 2,
  ingredients: [{ name: "Water", amount: 1, unit: "cup" }],
  instructions: ["Boil it"],
  tags: [],
  categoryIds: [],
  isPublic: false,
};

describe("useRecipeFormState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("starts with empty title and single placeholder ingredient and instruction", () => {
      const { result } = renderHook(() => useRecipeFormState(baseOpts));

      const values = result.current.form.getValues();
      expect(values.title).toBe("");
      expect(values.servings).toBe(1);
      expect(values.ingredients).toHaveLength(1);
      expect(values.instructions).toHaveLength(1);
    });

    it("exposes ingredient field array with one placeholder entry", () => {
      const { result } = renderHook(() => useRecipeFormState(baseOpts));

      expect(result.current.ingredientFields.fields).toHaveLength(1);
      // instructions is a string[] so RHF field array reflects via form values
      expect(result.current.form.getValues("instructions")).toHaveLength(1);
    });

    it("starts with cleared nutrition and submit state", () => {
      const { result } = renderHook(() => useRecipeFormState(baseOpts));

      expect(result.current.nutritionResult).toBeNull();
      expect(result.current.nutritionLoading).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
      expect(result.current.savedRecipeId).toBeNull();
    });
  });

  describe("hydration from ImportedRecipe", () => {
    it("form.reset with ImportedRecipe data reflects in getValues", () => {
      const { result } = renderHook(() => useRecipeFormState(baseOpts));

      const imported: ImportedRecipe = {
        title: "Pasta Carbonara",
        ingredients: [
          { name: "Pasta", amount: 200, unit: "g" },
          { name: "Eggs", amount: 2, unit: "" },
        ],
        instructions: ["Boil pasta", "Mix eggs and cheese"],
        servings: 4,
      };

      act(() => {
        result.current.form.reset({
          title: imported.title,
          servings: imported.servings ?? 1,
          ingredients: imported.ingredients,
          instructions: imported.instructions,
          description: "",
          imageUrl: "",
          tags: [],
          categoryIds: [],
          isPublic: false,
        });
      });

      const values = result.current.form.getValues();
      expect(values.title).toBe("Pasta Carbonara");
      expect(values.servings).toBe(4);
      expect(values.ingredients).toHaveLength(2);
      expect(values.instructions).toHaveLength(2);
    });
  });

  describe("resetForm", () => {
    it("resets form fields to blank defaults", () => {
      const { result } = renderHook(() => useRecipeFormState(baseOpts));

      act(() => {
        result.current.form.reset({ ...validFormValues, title: "Some Recipe" });
      });

      act(() => {
        result.current.resetForm();
      });

      const values = result.current.form.getValues();
      expect(values.title).toBe("");
      expect(values.servings).toBe(1);
    });

    it("clears nutritionResult and savedRecipeId on reset", async () => {
      const { persistRecipe } = await import("@/actions/recipe");
      (persistRecipe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: "r1" },
      });

      const onSubmitSuccess = vi.fn();
      const { result } = renderHook(() =>
        useRecipeFormState({ ...baseOpts, onSubmitSuccess })
      );

      act(() => {
        result.current.form.reset(validFormValues);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(result.current.savedRecipeId).toBe("r1");

      act(() => {
        result.current.resetForm();
      });

      expect(result.current.savedRecipeId).toBeNull();
      expect(result.current.nutritionResult).toBeNull();
    });
  });

  describe("handleSubmit — create mode", () => {
    it("calls persistRecipe with form data and invokes onSubmitSuccess", async () => {
      const { persistRecipe } = await import("@/actions/recipe");
      (persistRecipe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: "recipe-123" },
      });

      const onSubmitSuccess = vi.fn();
      const { result } = renderHook(() =>
        useRecipeFormState({ ...baseOpts, onSubmitSuccess })
      );

      act(() => {
        result.current.form.reset(validFormValues);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(persistRecipe).toHaveBeenCalled();
      expect(onSubmitSuccess).toHaveBeenCalledOnce();
      expect(result.current.savedRecipeId).toBe("recipe-123");
    });

    it("does not call onSubmitSuccess when persistRecipe returns an error", async () => {
      const { persistRecipe } = await import("@/actions/recipe");
      (persistRecipe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        error: "Server error",
      });

      const onSubmitSuccess = vi.fn();
      const { result } = renderHook(() =>
        useRecipeFormState({ ...baseOpts, onSubmitSuccess })
      );

      act(() => {
        result.current.form.reset(validFormValues);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(onSubmitSuccess).not.toHaveBeenCalled();
    });
  });

  describe("handleSubmit — edit mode", () => {
    it("calls updateRecipe with recipeId and invokes onSubmitSuccess", async () => {
      const { updateRecipe } = await import("@/actions/recipe");
      (updateRecipe as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        data: { id: "recipe-456" },
      });

      const onSubmitSuccess = vi.fn();
      const { result } = renderHook(() =>
        useRecipeFormState({
          mode: "edit",
          recipeId: "recipe-456",
          isOpen: false,
          onSubmitSuccess,
        })
      );

      act(() => {
        result.current.form.reset(validFormValues);
      });

      await act(async () => {
        await result.current.handleSubmit();
      });

      expect(updateRecipe).toHaveBeenCalledWith("recipe-456", expect.any(Object));
      expect(onSubmitSuccess).toHaveBeenCalledOnce();
    });
  });
});
