import { describe, it, expect } from "vitest";
import {
  parseIngredient,
  parseIngredients,
  formatParsedIngredient,
  type ParsedIngredient,
} from "@/utils/ingredientParser";

describe("ingredientParser", () => {
  describe("parseIngredient", () => {
    it("should parse simple ingredients with quantity and unit", () => {
      const result = parseIngredient("2 cups flour");

      expect(result.quantity).toBe(2);
      expect(result.unit).toBe("cup");
      expect(result.name).toBe("flour");
      expect(result.preparation).toBeNull();
      expect(result.confidence).toBeGreaterThan(0.9);
      expect(result.errors).toHaveLength(0);
    });

    it("should parse ingredients with fractions", () => {
      const testCases = [
        { input: "1/2 cup sugar", expectedQuantity: 0.5 },
        { input: "1 1/2 cups milk", expectedQuantity: 1.5 },
        { input: "¼ teaspoon salt", expectedQuantity: 0.25 },
        { input: "2 ¾ tablespoons butter", expectedQuantity: 2.75 },
      ];

      testCases.forEach(({ input, expectedQuantity }) => {
        const result = parseIngredient(input);
        expect(result.quantity).toBe(expectedQuantity);
      });
    });

    it("should normalize units", () => {
      const testCases = [
        { input: "1 tbsp olive oil", expectedUnit: "tablespoon" },
        { input: "2 tsp vanilla", expectedUnit: "teaspoon" },
        { input: "16 oz water", expectedUnit: "oz" },
        { input: "500 ml milk", expectedUnit: "ml" },
        { input: "2 lbs chicken", expectedUnit: "lb" },
      ];

      testCases.forEach(({ input, expectedUnit }) => {
        const result = parseIngredient(input);
        expect(result.unit).toBe(expectedUnit);
      });
    });

    it("should extract preparation methods", () => {
      const testCases = [
        {
          input: "1 cup onion, diced",
          expectedName: "onion",
          expectedPrep: "diced",
        },
        {
          input: "2 cloves garlic (minced)",
          expectedName: "garlic",
          expectedPrep: "minced",
        },
        {
          input: "1 cup flour, sifted",
          expectedName: "flour",
          expectedPrep: "sifted",
        },
        {
          input: "2 tablespoons butter, melted",
          expectedName: "butter",
          expectedPrep: "melted",
        },
      ];

      testCases.forEach(({ input, expectedName, expectedPrep }) => {
        const result = parseIngredient(input);
        expect(result.name).toBe(expectedName);
        expect(result.preparation).toBe(expectedPrep);
      });
    });

    it("should handle text-based quantities", () => {
      const testCases = [
        { input: "a pinch of salt", expectedQuantity: 1 },
        { input: "one tablespoon honey", expectedQuantity: 1 },
        { input: "two eggs", expectedQuantity: 2 },
        { input: "a dozen cookies", expectedQuantity: 12 },
      ];

      testCases.forEach(({ input, expectedQuantity }) => {
        const result = parseIngredient(input);
        expect(result.quantity).toBe(expectedQuantity);
      });
    });

    it("should handle ingredients without quantities", () => {
      const result = parseIngredient("salt to taste");

      expect(result.quantity).toBeNull();
      expect(result.unit).toBeNull();
      expect(result.name).toBe("salt to taste");
      expect(result.confidence).toBeLessThan(1);
    });

    it("should handle complex ingredient strings", () => {
      const result = parseIngredient("2 cups all-purpose flour, sifted");

      expect(result.quantity).toBe(2);
      expect(result.unit).toBe("cup");
      expect(result.name).toBe("all-purpose flour");
      expect(result.preparation).toBe("sifted");
    });

    it("should handle empty or invalid input", () => {
      const emptyResult = parseIngredient("");
      expect(emptyResult.name).toBe("");
      expect(emptyResult.confidence).toBe(0);
      expect(emptyResult.errors).toContain("Empty ingredient text");

      const invalidResult = parseIngredient("   ");
      expect(invalidResult.name).toBe("");
      expect(invalidResult.confidence).toBe(0);
    });

    it("should provide confidence scores", () => {
      const highConfidence = parseIngredient("2 cups flour");
      expect(highConfidence.confidence).toBeGreaterThan(0.9);

      const mediumConfidence = parseIngredient("flour");
      expect(mediumConfidence.confidence).toBeLessThan(1);
      expect(mediumConfidence.confidence).toBeGreaterThan(0.5);

      const lowConfidence = parseIngredient("2 something weird");
      expect(lowConfidence.confidence).toBeLessThan(0.8);
    });
  });

  describe("parseIngredients", () => {
    it("should parse multiple ingredients", () => {
      const ingredients = [
        "2 cups flour",
        "1 tsp salt",
        "1/2 cup butter, melted",
      ];

      const results = parseIngredients(ingredients);

      expect(results).toHaveLength(3);
      expect(results[0].name).toBe("flour");
      expect(results[1].name).toBe("salt");
      expect(results[2].name).toBe("butter");
      expect(results[2].preparation).toBe("melted");
    });
  });

  describe("formatParsedIngredient", () => {
    it("should format parsed ingredients back to string", () => {
      const parsed: ParsedIngredient = {
        originalText: "2 cups flour, sifted",
        quantity: 2,
        unit: "cup",
        name: "flour",
        preparation: "sifted",
        confidence: 0.95,
        errors: [],
      };

      const formatted = formatParsedIngredient(parsed);
      expect(formatted).toBe("2 cup flour, sifted");
    });

    it("should handle ingredients without quantities", () => {
      const parsed: ParsedIngredient = {
        originalText: "salt to taste",
        quantity: null,
        unit: null,
        name: "salt to taste",
        preparation: null,
        confidence: 0.8,
        errors: [],
      };

      const formatted = formatParsedIngredient(parsed);
      expect(formatted).toBe("salt to taste");
    });
  });

  describe("edge cases", () => {
    it("should handle unicode fractions", () => {
      const testCases = [
        { input: "½ cup milk", expectedQuantity: 0.5 },
        { input: "⅓ cup oil", expectedQuantity: 0.333333 },
        { input: "¾ teaspoon vanilla", expectedQuantity: 0.75 },
      ];

      testCases.forEach(({ input, expectedQuantity }) => {
        const result = parseIngredient(input);
        expect(result.quantity).toBeCloseTo(expectedQuantity, 5);
      });
    });

    it("should handle various unit abbreviations", () => {
      const testCases = [
        { input: "1 T sugar", expectedUnit: "tablespoon" },
        { input: "1 t salt", expectedUnit: "teaspoon" },
        { input: "1 c flour", expectedUnit: "cup" },
        { input: "1 pt cream", expectedUnit: "pint" },
        { input: "1 qt stock", expectedUnit: "quart" },
      ];

      testCases.forEach(({ input, expectedUnit }) => {
        const result = parseIngredient(input);
        expect(result.unit).toBe(expectedUnit);
      });
    });

    it("should handle ingredients with multiple preparation methods", () => {
      const result = parseIngredient("1 cup carrots, peeled and diced");

      expect(result.name).toBe("carrots");
      expect(result.preparation).toBe("peeled and diced");
    });

    it("should detect suspicious patterns", () => {
      const result = parseIngredient("cup 2 flour weird");

      expect(result.confidence).toBeLessThan(0.8);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
