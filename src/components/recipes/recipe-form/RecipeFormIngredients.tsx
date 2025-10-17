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
    <Card>
      <CardHeader>
        <CardTitle>Ingredients</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <FormField
              control={form.control}
              name={`ingredients.${index}.amount`}
              render={({ field }) => (
                <FormItem className="w-24">
                  <FormControl>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="1"
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
                <FormItem className="w-32">
                  <FormControl>
                    <Input placeholder="cup" {...field} />
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
                    <Input placeholder="Ingredient name" {...field} />
                    {/* <IngredientAutocomplete
                      value={field.value}
                      onChange={field.onChange}
                      placeholder="Search ingredient..."
                    /> */}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => remove(index)}
              disabled={fields.length === 1}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          onClick={() => append({ name: "", amount: 1, unit: "" })}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Ingredient
        </Button>
      </CardContent>
    </Card>
  );
}
