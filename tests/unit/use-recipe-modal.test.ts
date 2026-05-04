import { describe, expect, it } from "vitest";
import {
  STEPPER_CONFIG,
  currentStepIndex,
  nextStep,
  prevStep,
  previousScreen,
  validationFieldsFor,
  type ModalScreen,
  type EnteredVia,
} from "../../src/hooks/use-recipe-modal";

describe("use-recipe-modal helpers", () => {
  describe("STEPPER_CONFIG", () => {
    it("should export steps in order", () => {
      expect(STEPPER_CONFIG.map(s => s.id)).toEqual(["step0", "step1", "step2"]);
    });
  });

  describe("currentStepIndex", () => {
    it("returns correct index for valid steps", () => {
      expect(currentStepIndex("step0")).toBe(0);
      expect(currentStepIndex("step1")).toBe(1);
      expect(currentStepIndex("step2")).toBe(2);
    });

    it("returns -1 for non-step screens", () => {
      expect(currentStepIndex("entry")).toBe(-1);
      expect(currentStepIndex("preview")).toBe(-1);
      expect(currentStepIndex("loading")).toBe(-1);
      expect(currentStepIndex("success")).toBe(-1);
    });
  });

  describe("nextStep", () => {
    it("returns the next step ID if one exists", () => {
      expect(nextStep("step0")).toBe("step1");
      expect(nextStep("step1")).toBe("step2");
    });

    it("returns null if already at the last step", () => {
      expect(nextStep("step2")).toBeNull();
    });

    it("returns null for non-step screens", () => {
      expect(nextStep("entry")).toBeNull();
    });
  });

  describe("prevStep", () => {
    it("returns the previous step ID if one exists", () => {
      expect(prevStep("step1")).toBe("step0");
      expect(prevStep("step2")).toBe("step1");
    });

    it("returns null if already at the first step", () => {
      expect(prevStep("step0")).toBeNull();
    });

    it("returns null for non-step screens", () => {
      expect(prevStep("entry")).toBeNull();
    });
  });

  describe("previousScreen", () => {
    it("returns null for entry (should close)", () => {
      expect(previousScreen("entry", "create", "manual")).toBeNull();
    });

    it("returns entry for loading/preview", () => {
      expect(previousScreen("loading", "create", "manual")).toBe("entry");
      expect(previousScreen("preview", "create", "manual")).toBe("entry");
    });

    describe("step0 navigation", () => {
      it("returns null for edit mode (should close)", () => {
        expect(previousScreen("step0", "edit", "edit")).toBeNull();
      });

      it("returns preview for imported recipes", () => {
        expect(previousScreen("step0", "create", "import")).toBe("preview");
      });

      it("returns entry for manual recipes", () => {
        expect(previousScreen("step0", "create", "manual")).toBe("entry");
      });
    });

    it("returns previous step for other steps", () => {
      expect(previousScreen("step1", "create", "manual")).toBe("step0");
      expect(previousScreen("step2", "create", "manual")).toBe("step1");
    });
  });

  describe("validationFieldsFor", () => {
    it("returns correct validation fields for each step", () => {
      expect(validationFieldsFor("step0")).toEqual(["title", "servings"]);
      expect(validationFieldsFor("step1")).toEqual(["ingredients", "instructions"]);
      expect(validationFieldsFor("step2")).toEqual([]);
    });

    it("returns empty array for non-step screens", () => {
      expect(validationFieldsFor("entry")).toEqual([]);
    });

    it("returns a new array reference", () => {
      const fields1 = validationFieldsFor("step0");
      const fields2 = validationFieldsFor("step0");
      expect(fields1).not.toBe(fields2);
    });
  });
});
