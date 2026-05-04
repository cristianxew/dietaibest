import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { useRecipeFlowState } from "@/hooks/use-recipe-flow";
import type { RecipeFormData, ImportedRecipe } from "@/types/recipe";

const makeOpts = () => ({
  onResetForm: vi.fn(),
  onResetFormWithData: vi.fn(),
  validateScreen: vi.fn().mockResolvedValue(true),
});

const editData: RecipeFormData = {
  title: "My Recipe",
  description: "",
  imageUrl: "",
  servings: 2,
  ingredients: [{ name: "Salt", amount: 1, unit: "g" }],
  instructions: ["Mix it"],
  tags: [],
  categoryIds: [],
  isPublic: false,
};

const importedPreviewData: ImportedRecipe = {
  title: "Imported Recipe",
  ingredients: [{ name: "Flour", amount: 200, unit: "g" }],
  instructions: ["Mix and bake"],
};

describe("useRecipeFlowState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("starts closed with create mode and entry screen", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      expect(result.current.isOpen).toBe(false);
      expect(result.current.screen).toBe("entry");
      expect(result.current.mode).toBe("create");
      expect(result.current.enteredVia).toBe("manual");
      expect(result.current.recipeId).toBeNull();
      expect(result.current.importedPreview).toBeNull();
    });
  });

  describe("openCreate", () => {
    it("opens modal in create mode and calls onResetForm", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());

      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe("create");
      expect(result.current.enteredVia).toBe("manual");
      expect(result.current.screen).toBe("entry");
      expect(result.current.recipeId).toBeNull();
      expect(opts.onResetForm).toHaveBeenCalledOnce();
    });

    it("clears importedPreview when opening create", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.setImportedPreview(importedPreviewData));
      act(() => result.current.openCreate());

      expect(result.current.importedPreview).toBeNull();
    });
  });

  describe("openEdit", () => {
    it("opens modal in edit mode and calls onResetFormWithData", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openEdit("recipe-1", editData));

      expect(result.current.isOpen).toBe(true);
      expect(result.current.mode).toBe("edit");
      expect(result.current.enteredVia).toBe("edit");
      expect(result.current.screen).toBe("step0");
      expect(result.current.recipeId).toBe("recipe-1");
      expect(opts.onResetFormWithData).toHaveBeenCalledWith(editData);
    });
  });

  describe("close", () => {
    it("sets isOpen to false immediately", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());
      act(() => result.current.close());

      expect(result.current.isOpen).toBe(false);
    });

    it("resets flow state and calls onResetForm after 300ms", async () => {
      vi.useFakeTimers();
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openEdit("r1", editData));
      act(() => result.current.goToScreen("step1"));
      act(() => result.current.close());

      expect(opts.onResetForm).not.toHaveBeenCalled();

      await act(async () => { vi.advanceTimersByTime(300); });

      expect(opts.onResetForm).toHaveBeenCalledOnce();
      expect(result.current.screen).toBe("entry");
      expect(result.current.mode).toBe("create");
      expect(result.current.recipeId).toBeNull();
    });

    afterEach(() => {
      vi.useRealTimers();
    });
  });

  describe("goToScreen", () => {
    it("navigates to the given screen", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.goToScreen("step1"));

      expect(result.current.screen).toBe("step1");
    });
  });

  describe("setImportedPreview", () => {
    it("stores the imported preview data", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.setImportedPreview(importedPreviewData));

      expect(result.current.importedPreview).toEqual(importedPreviewData);
    });

    it("derives enteredVia as import when importedPreview is set in create mode", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());
      act(() => result.current.setImportedPreview(importedPreviewData));

      expect(result.current.enteredVia).toBe("import");
    });
  });

  describe("goBack — create / manual", () => {
    it("closes from entry screen (no previous screen)", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());
      act(() => result.current.goBack());

      expect(result.current.isOpen).toBe(false);
    });

    it("returns to entry from step0 when manual create", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());
      act(() => result.current.goToScreen("step0"));
      act(() => result.current.goBack());

      expect(result.current.screen).toBe("entry");
    });

    it("returns to step0 from step1", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());
      act(() => result.current.goToScreen("step1"));
      act(() => result.current.goBack());

      expect(result.current.screen).toBe("step0");
    });

    it("returns to step1 from step2", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());
      act(() => result.current.goToScreen("step2"));
      act(() => result.current.goBack());

      expect(result.current.screen).toBe("step1");
    });
  });

  describe("goBack — create / import", () => {
    it("returns to preview from step0 when entered via import", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openCreate());
      act(() => result.current.setImportedPreview(importedPreviewData));
      act(() => result.current.goToScreen("step0"));
      act(() => result.current.goBack());

      expect(result.current.screen).toBe("preview");
    });
  });

  describe("goBack — edit", () => {
    it("closes from step0 in edit mode (no previous screen)", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openEdit("r1", editData));
      act(() => result.current.goBack());

      expect(result.current.isOpen).toBe(false);
    });

    it("returns to step0 from step1 in edit mode", () => {
      const opts = makeOpts();
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.openEdit("r1", editData));
      act(() => result.current.goToScreen("step1"));
      act(() => result.current.goBack());

      expect(result.current.screen).toBe("step0");
    });
  });

  describe("goToNextStep", () => {
    it("advances to the next step when validation passes", async () => {
      const opts = makeOpts();
      opts.validateScreen.mockResolvedValue(true);
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.goToScreen("step0"));

      await act(async () => { await result.current.goToNextStep(); });

      expect(result.current.screen).toBe("step1");
    });

    it("stays on current screen when validation fails", async () => {
      const opts = makeOpts();
      opts.validateScreen.mockResolvedValue(false);
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.goToScreen("step0"));

      await act(async () => { await result.current.goToNextStep(); });

      expect(result.current.screen).toBe("step0");
    });

    it("stays on step2 since there is no next step", async () => {
      const opts = makeOpts();
      opts.validateScreen.mockResolvedValue(true);
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.goToScreen("step2"));

      await act(async () => { await result.current.goToNextStep(); });

      expect(result.current.screen).toBe("step2");
    });

    it("advances from step0 to step1 to step2 with passing validation", async () => {
      const opts = makeOpts();
      opts.validateScreen.mockResolvedValue(true);
      const { result } = renderHook(() => useRecipeFlowState(opts));

      act(() => result.current.goToScreen("step0"));

      await act(async () => { await result.current.goToNextStep(); });
      expect(result.current.screen).toBe("step1");

      await act(async () => { await result.current.goToNextStep(); });
      expect(result.current.screen).toBe("step2");
    });
  });
});
