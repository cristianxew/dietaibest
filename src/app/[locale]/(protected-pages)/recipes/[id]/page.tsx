import { getTranslations } from "next-intl/server";
import { getRecipe } from "@/actions/recipe";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, Users, ChefHat, Edit } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { RecipeDeleteButton } from "../../../../../components/recipes/RecipeDeleteButton";
import { RecipeFavoriteButton } from "../../../../../components/recipes/RecipeFavoriteButton";
import { MacroDisplay } from "../../../../../components/recipes/MacroDisplay";
import { IngredientsList } from "../../../../../components/recipes/IngredientsList";
import { InstructionsList } from "../../../../../components/recipes/InstructionsList";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const { data: recipe } = await getRecipe(id);
  const t = await getTranslations({ locale, namespace: "recipes" });

  if (!recipe) {
    return {
      title: t("notFound"),
    };
  }

  return {
    title: `${recipe.title} - ${t("title")}`,
    description: recipe.description || t("description"),
  };
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  const t = await getTranslations({ locale, namespace: "recipes" });
  const { data: recipe, error } = await getRecipe(id);

  if (error || !recipe) {
    notFound();
  }

  const isOwner = recipe.userId === recipe.user.id;
  const isFavorited = recipe.favoritedBy.length > 0;

  return (
    <div className="container mx-auto py-8 lg:py-12 space-y-8">
      {/* Header Navigation */}
      <div className="relative z-10">
        <Link
          href={`/${locale}/recipes`}
          className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-primary transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t("backToRecipes")}
        </Link>
      </div>

      {/* Main Content Area */}
      {/* Main Content Area */}
      {/* Main Content Area */}
      <div className="space-y-12">

        {/* Top Section: Image & Details */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-16 items-start">

          {/* Image Column */}
          <div className="lg:col-span-5 relative">
            {recipe.imageUrl ? (
              <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl shadow-2xl shadow-stone-900/5 border border-black/5 dark:border-white/10">
                <Image
                  src={recipe.imageUrl}
                  alt={recipe.title}
                  fill
                  className="object-cover transition-transform duration-700 hover:scale-105"
                  priority
                />
              </div>
            ) : (
              <div className="aspect-[4/3] w-full rounded-2xl bg-muted/20 border border-border flex items-center justify-center text-muted-foreground">
                No Image
              </div>
            )}
          </div>

          {/* Details Column */}
          <div className="lg:col-span-7 space-y-8">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground leading-[1.1]">
                    {recipe.title}
                  </h1>
                  <div className="flex items-center gap-2 shrink-0">
                    <RecipeFavoriteButton
                      recipeId={recipe.id}
                      initialFavorited={isFavorited}
                    />
                    {isOwner && (
                      <div className="flex gap-2">
                        <Link href={`/${locale}/recipes/${id}/edit`}>
                          <Button variant="outline" size="icon" className="h-9 w-9 border-input hover:bg-accent hover:text-accent-foreground transition-colors">
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <RecipeDeleteButton
                          recipeId={recipe.id}
                          recipeName={recipe.title}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {recipe.description && (
                  <p className="text-xl text-muted-foreground leading-relaxed font-light">
                    {recipe.description}
                  </p>
                )}
              </div>

              {/* Meta Icons Row - Clean & Minimal */}
              <div className="flex flex-wrap items-center gap-x-8 gap-y-4 text-sm pt-2">
                {recipe.prepTime && (
                  <div className="flex items-center gap-2.5 text-muted-foreground/80">
                    <Clock className="h-5 w-5 text-brand-500" />
                    <div className="flex flex-col leading-none">
                      <span className="font-semibold text-foreground">{recipe.prepTime}m</span>
                      <span className="text-xs">{t("prepTime")}</span>
                    </div>
                  </div>
                )}
                {recipe.cookTime && (
                  <div className="flex items-center gap-2.5 text-muted-foreground/80">
                    <Clock className="h-5 w-5 text-brand-500" />
                    <div className="flex flex-col leading-none">
                      <span className="font-semibold text-foreground">{recipe.cookTime}m</span>
                      <span className="text-xs">{t("cookTime")}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2.5 text-muted-foreground/80">
                  <Users className="h-5 w-5 text-brand-500" />
                  <div className="flex flex-col leading-none">
                    <span className="font-semibold text-foreground">{recipe.servings} p</span>
                    <span className="text-xs">{t("servings")}</span>
                  </div>
                </div>
                {recipe.difficulty && (
                  <div className="flex items-center gap-2.5">
                    <ChefHat className="h-5 w-5 text-brand-500" />
                    <Badge
                      variant="secondary"
                      className={
                        (recipe.difficulty.toLowerCase() === 'easy')
                          ? 'badge-success hover:bg-success/20'
                          : (recipe.difficulty.toLowerCase() === 'medium')
                            ? 'badge-brand hover:bg-brand-500/20'
                            : 'badge-gold hover:bg-gold-500/20'
                      }
                    >
                      {t(`difficulty.${recipe.difficulty}`)}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Tags - Minimal */}
              {(recipe.categories.length > 0 || recipe.tags.length > 0) && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {recipe.categories.map((category) => (
                    <Badge key={category.id} className="badge-brand px-3 py-1">
                      {category.name}
                    </Badge>
                  ))}
                  {recipe.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="border-border/60 text-muted-foreground px-3 py-1 font-normal">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-border to-transparent opacity-60" />

        {/* Bottom Section: Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start">

          {/* Left Column: Ingredients */}
          <div className="lg:col-span-12 xl:col-span-5 space-y-10">
            <section className="space-y-6">
              <h2 className="text-3xl font-display font-bold flex items-center gap-3">
                <div className="h-8 w-1 bg-brand-500 rounded-full" />
                Ingredients
              </h2>
              <div className="bg-stone-50/50 dark:bg-stone-900/20 rounded-xl p-1 -mx-2 sm:mx-0">
                <IngredientsList ingredients={recipe.ingredients} />
              </div>
            </section>

            {/* Nutrition Section - Moved Here */}
            <section className="space-y-6 pt-4">
              <h2 className="text-2xl font-display font-semibold flex items-center gap-3 text-muted-foreground/80">
                <div className="h-6 w-1 bg-amber-400 rounded-full" />
                Nutrition
              </h2>
              <div className="bg-transparent border-t border-b border-border/40 py-2">
                <MacroDisplay
                  calories={recipe.calories}
                  protein={recipe.protein}
                  carbs={recipe.carbs}
                  fat={recipe.fat}
                  fiber={recipe.fiber}
                />
              </div>
            </section>
          </div>

          {/* Right Column: Instructions */}
          <div className="lg:col-span-12 xl:col-span-7 space-y-8">
            <section className="space-y-6">
              <h2 className="text-3xl font-display font-bold flex items-center gap-3">
                <div className="h-8 w-1 bg-brand-500 rounded-full" />
                Instructions
              </h2>
              <div className="prose prose-stone dark:prose-invert max-w-none">
                <InstructionsList instructions={recipe.instructions} />
              </div>
            </section>

            {/* Source */}
            {recipe.sourceUrl && (
              <div className="pt-8 border-t border-border/40">
                <p className="text-sm text-muted-foreground italic">
                  {t("source")}:{" "}
                  <a
                    href={recipe.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 font-medium transition-colors border-b border-primary/30 hover:border-primary"
                  >
                    {new URL(recipe.sourceUrl).hostname}
                  </a>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
