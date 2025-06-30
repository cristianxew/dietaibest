"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { calculateMacros } from "@/utils/macroCalculator";

// Validation schemas
const demographicsSchema = z.object({
  dateOfBirth: z.string().datetime(),
  gender: z.enum(["male", "female", "other"]),
  heightCm: z.number().min(100).max(250),
  weightKg: z.number().min(30).max(300),
  activityLevel: z.enum(["sedentary", "light", "moderate", "very", "extra"]),
});

const goalsSchema = z.object({
  dietaryGoal: z.enum(["lose", "maintain", "gain"]),
  dailyCalories: z.number(),
  proteinGrams: z.number(),
  carbsGrams: z.number(),
  fatGrams: z.number(),
});

const preferencesSchema = z.object({
  dietaryType: z.array(z.string()),
  allergies: z.array(z.string()),
  cuisinePrefs: z.array(z.string()),
});

const familyMemberSchema = z.object({
  name: z.string(),
  relationship: z.string(),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(["male", "female", "other"]),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  dietaryNeeds: z.array(z.string()),
});

const onboardingSchema = z.object({
  demographics: demographicsSchema,
  goals: goalsSchema,
  preferences: preferencesSchema,
  familyMembers: z.array(familyMemberSchema),
});

export async function estimateMacros(
  data: z.infer<typeof demographicsSchema> & { dietaryGoal: string }
) {
  try {
    // Validate input
    const validatedDemographics = demographicsSchema.parse({
      ...data,
      dietaryGoal: undefined,
    });

    // Calculate macros
    const macros = calculateMacros({
      dateOfBirth: new Date(validatedDemographics.dateOfBirth),
      gender: validatedDemographics.gender,
      heightCm: validatedDemographics.heightCm,
      weightKg: validatedDemographics.weightKg,
      activityLevel: validatedDemographics.activityLevel,
      dietaryGoal: data.dietaryGoal,
    });

    return { data: macros, error: null };
  } catch (error) {
    console.error("Error calculating macros:", error);
    return { data: null, error: "Failed to calculate macros" };
  }
}

export async function completeOnboarding(
  data: z.infer<typeof onboardingSchema>
) {
  try {
    // Get authenticated user
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { data: null, error: "Unauthorized" };
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return { data: null, error: "User not found" };
    }

    // Validate input
    const validatedData = onboardingSchema.parse(data);

    // Check if user already has a profile
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId: user.id },
    });

    if (existingProfile) {
      // Update existing profile instead of creating new one
      const profile = await prisma.userProfile.update({
        where: { userId: user.id },
        data: {
          // Demographics
          dateOfBirth: new Date(validatedData.demographics.dateOfBirth),
          gender: validatedData.demographics.gender,
          heightCm: parseFloat(validatedData.demographics.heightCm.toString()),
          weightKg: parseFloat(validatedData.demographics.weightKg.toString()),
          activityLevel: validatedData.demographics.activityLevel,
          // Goals
          dietaryGoal: validatedData.goals.dietaryGoal,
          dailyCalories: validatedData.goals.dailyCalories,
          proteinGrams: validatedData.goals.proteinGrams,
          carbsGrams: validatedData.goals.carbsGrams,
          fatGrams: validatedData.goals.fatGrams,
          // Preferences
          dietaryType: validatedData.preferences.dietaryType,
          allergies: validatedData.preferences.allergies,
          cuisinePrefs: validatedData.preferences.cuisinePrefs,
          // Mark as completed
          onboardingCompleted: true,
        },
      });

      // Handle family members separately for updates
      if (validatedData.familyMembers.length > 0) {
        // Delete existing family members
        await prisma.familyMember.deleteMany({
          where: { profileId: profile.id },
        });

        // Create new family members
        await prisma.familyMember.createMany({
          data: validatedData.familyMembers.map((member) => ({
            profileId: profile.id,
            name: member.name,
            relationship: member.relationship,
            dateOfBirth: new Date(member.dateOfBirth),
            gender: member.gender,
            heightCm: member.heightCm
              ? parseFloat(member.heightCm.toString())
              : null,
            weightKg: member.weightKg
              ? parseFloat(member.weightKg.toString())
              : null,
            dietaryNeeds: member.dietaryNeeds,
          })),
        });
      }

      return { data: { profileId: profile.id }, error: null };
    }

    // Create new user profile
    const profile = await prisma.userProfile.create({
      data: {
        userId: user.id,
        // Demographics
        dateOfBirth: new Date(validatedData.demographics.dateOfBirth),
        gender: validatedData.demographics.gender,
        heightCm: parseFloat(validatedData.demographics.heightCm.toString()),
        weightKg: parseFloat(validatedData.demographics.weightKg.toString()),
        activityLevel: validatedData.demographics.activityLevel,
        // Goals
        dietaryGoal: validatedData.goals.dietaryGoal,
        dailyCalories: validatedData.goals.dailyCalories,
        proteinGrams: validatedData.goals.proteinGrams,
        carbsGrams: validatedData.goals.carbsGrams,
        fatGrams: validatedData.goals.fatGrams,
        // Preferences
        dietaryType: validatedData.preferences.dietaryType,
        allergies: validatedData.preferences.allergies,
        cuisinePrefs: validatedData.preferences.cuisinePrefs,
        // Mark as completed
        onboardingCompleted: true,
      },
    });

    // Create family members separately to avoid nested transaction issues
    if (validatedData.familyMembers.length > 0) {
      await prisma.familyMember.createMany({
        data: validatedData.familyMembers.map((member) => ({
          profileId: profile.id,
          name: member.name,
          relationship: member.relationship,
          dateOfBirth: new Date(member.dateOfBirth),
          gender: member.gender,
          heightCm: member.heightCm
            ? parseFloat(member.heightCm.toString())
            : null,
          weightKg: member.weightKg
            ? parseFloat(member.weightKg.toString())
            : null,
          dietaryNeeds: member.dietaryNeeds,
        })),
      });
    }

    return { data: { profileId: profile.id }, error: null };
  } catch (error) {
    console.error("Error completing onboarding - Full error details:", error);

    // More detailed error logging
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }

    // Handle Prisma-specific errors
    if (error && typeof error === "object" && "code" in error) {
      const prismaError = error as { code?: string; meta?: unknown };
      console.error("Prisma error code:", prismaError.code);
      console.error("Prisma error meta:", prismaError.meta);
    }

    return { data: null, error: "Failed to complete onboarding" };
  }
}

export async function checkOnboardingStatus() {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return { completed: false, error: null };
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { profile: true },
    });

    if (!user) {
      return { completed: false, error: "User not found" };
    }

    return {
      completed: user.profile?.onboardingCompleted || false,
      error: null,
    };
  } catch (error) {
    console.error("Error checking onboarding status:", error);
    return { completed: false, error: "Failed to check status" };
  }
}
