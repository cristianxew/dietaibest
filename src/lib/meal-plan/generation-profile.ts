/**
 * Profile defaults for AI meal-plan generation.
 *
 * The chat tool only knows what the user typed. Calorie/macro targets and the
 * dietary preferences + allergies the user already entered during onboarding
 * live on `UserProfile`. This module loads them and merges them with the tool
 * input so generation honours the profile without the user restating it.
 *
 * Precedence: explicit tool input > profile > nothing.
 */
import prisma from "@/lib/prisma";

export interface GenerationTargets {
  targetCalories?: number;
  targetProtein?: number;
  targetCarbs?: number;
  targetFat?: number;
  dietary?: string[];
}

export interface GenerationProfile {
  dailyCalories: number | null;
  proteinGrams: number | null;
  carbsGrams: number | null;
  fatGrams: number | null;
  dietaryType: string[];
  allergies: string[];
}

export interface ResolvedGenerationTargets extends GenerationTargets {
  /** Hard exclusions from the profile. Never overridden by tool input. */
  allergies: string[];
}

export async function loadGenerationProfile(
  userId: string
): Promise<GenerationProfile | null> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
    select: {
      dailyCalories: true,
      proteinGrams: true,
      carbsGrams: true,
      fatGrams: true,
      dietaryType: true,
      allergies: true,
    },
  });
  return profile ?? null;
}

/** The workflow schema requires strictly positive targets; 0/null means "unset". */
function positive(n: number | null | undefined): number | undefined {
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : undefined;
}

/** Trim, drop empties, dedupe case-insensitively while keeping first spelling. */
function normalizeList(...lists: Array<string[] | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const list of lists) {
    for (const raw of list ?? []) {
      const value = raw.trim();
      const key = value.toLowerCase();
      if (!value || seen.has(key)) continue;
      seen.add(key);
      out.push(value);
    }
  }
  return out;
}

export function mergeGenerationTargets(
  input: GenerationTargets,
  profile: GenerationProfile | null
): ResolvedGenerationTargets {
  const dietary = normalizeList(input.dietary, profile?.dietaryType);
  return {
    targetCalories: positive(input.targetCalories) ?? positive(profile?.dailyCalories),
    targetProtein: positive(input.targetProtein) ?? positive(profile?.proteinGrams),
    targetCarbs: positive(input.targetCarbs) ?? positive(profile?.carbsGrams),
    targetFat: positive(input.targetFat) ?? positive(profile?.fatGrams),
    dietary: dietary.length ? dietary : undefined,
    allergies: normalizeList(profile?.allergies),
  };
}
