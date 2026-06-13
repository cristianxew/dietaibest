"use client";

import { RecipeCategory } from "@/generated/prisma";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

interface RecipeFormBasicsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: any; // Using any to avoid complex type matching with react-hook-form
  categories: RecipeCategory[];
  loadingCategories: boolean;
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function RecipeFormBasics({
  form,
  categories,
  loadingCategories,
  onAddTag,
  onRemoveTag,
}: RecipeFormBasicsProps) {
  const t = useTranslations("recipes");
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recipe Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Recipe Title</FormLabel>
              <FormControl>
                <Input placeholder="Enter recipe title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Brief description of the recipe"
                  className="min-h-[100px]"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Optional: A short description of your recipe
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="imageUrl"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Image URL</FormLabel>
              <FormControl>
                <Input placeholder="https://example.com/image.jpg" {...field} />
              </FormControl>
              <FormDescription>
                Optional: URL to an image of the dish
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="prepTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Prep Time (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="15"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="cookTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cook Time (minutes)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="30"
                    value={field.value ?? ""}
                    onChange={(e) =>
                      field.onChange(
                        e.target.value ? parseInt(e.target.value) : undefined
                      )
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="servings"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Servings</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min="1"
                    value={field.value}
                    onChange={(e) =>
                      field.onChange(parseInt(e.target.value) || 1)
                    }
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="difficulty"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Difficulty</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-4">
          <FormLabel>Categories</FormLabel>
          {loadingCategories ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading categories...
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {categories.map((category) => (
                <FormField
                  key={category.id}
                  control={form.control}
                  name="categoryIds"
                  render={({ field }) => {
                    const isChecked = field.value?.includes(category.id);
                    return (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(checked) => {
                              const current = field.value || [];
                              if (checked) {
                                field.onChange([...current, category.id]);
                              } else {
                                field.onChange(
                                  current.filter(
                                    (id: string) => id !== category.id
                                  )
                                );
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal cursor-pointer">
                          {category.name}
                        </FormLabel>
                      </FormItem>
                    );
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="tag-input">Tags</Label>
            <div className="flex-1 flex gap-2">
              <Input
                id="tag-input"
                placeholder="Add a tag and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    const input = e.target as HTMLInputElement;
                    onAddTag(input.value.trim());
                    input.value = "";
                  }
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {(form.watch("tags") || []).map((tag: string) => (
              <Badge
                key={tag}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => onRemoveTag(tag)}
              >
                {tag}
                <Trash2 className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>

        <FormField
          control={form.control}
          name="isPublic"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center space-x-2">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <FormLabel className="text-sm font-normal">
                {t("makePublicLabel")}
              </FormLabel>
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
