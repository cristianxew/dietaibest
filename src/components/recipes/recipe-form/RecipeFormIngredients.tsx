"use client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2 } from "lucide-react";
// import { IngredientAutocomplete } from "@/components/recipes/IngredientAutocomplete";

interface RecipeFormIngredientsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any; // Using any to avoid complex type matching with react-hook-form
  ingredientFields: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fields: any[];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    append: (value: any) => void;
    remove: (index: number) => void;
  };
}

export function RecipeFormIngredients({
  form,
  ingredientFields,
}: RecipeFormIngredientsProps) {
  const { fields, append, remove } = ingredientFields;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-base tracking-wide">Ingredients</h3>
      <div className="space-y-3">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2 items-center">
            <FormField
              control={form.control}
              name={`ingredients.${index}.amount`}
              render={({ field }) => (
                <FormItem className="w-[80px]">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="1"
                      className="h-11 bg-secondary/40 border-border rounded-lg text-center"
                      value={field.value}
                      onChange={(e) =>
                        field.onChange(parseFloat(e.target.value) || 0)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`ingredients.${index}.unit`}
              render={({ field }) => (
                <FormItem className="w-[80px]">
                  <FormControl>
                    <Input
                      placeholder="cup"
                      className="h-11 bg-secondary/40 border-border rounded-lg text-center"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name={`ingredients.${index}.name`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormControl>
                    <Input
                      placeholder="Ingredient name"
                      className="h-11 bg-secondary/40 border-border rounded-lg pl-4"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
              className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-11 w-10 flex-shrink-0 rounded-lg"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() => append({ name: "", amount: 1, unit: "" })}
          className="w-full h-12 border border-dashed border-primary/30 text-primary hover:text-primary hover:bg-transparent dark:hover:bg-transparent hover:border-primary rounded-lg font-medium mt-4 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add ingredient
        </Button>
      </div>
    </div>
  );
}
