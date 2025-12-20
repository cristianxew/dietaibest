"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { revalidatePath } from "next/cache";

// Validation schemas
const personalInfoSchema = z.object({
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
  name: z.string().min(1, "Name is required"),
  relationship: z.string().min(1, "Relationship is required"),
  dateOfBirth: z.string().datetime(),
  gender: z.enum(["male", "female", "other"]),
  heightCm: z.number().optional(),
  weightKg: z.number().optional(),
  dietaryNeeds: z.array(z.string()),
});

// Helper to get authenticated user profile
async function getAuthenticatedUserProfile() {
  const session = await getServerSession();
  if (!session?.user?.email) {
    return { profile: null, error: "Unauthorized" };
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      profile: {
        include: {
          familyMembers: true,
        },
      },
    },
  });

  if (!user) {
    return { profile: null, error: "User not found" };
  }

  return { profile: user.profile, user, error: null };
}

// Get full user profile with family members
export async function getUserProfile() {
  try {
    const { profile, error } = await getAuthenticatedUserProfile();

    if (error) {
      return { data: null, error };
    }

    if (!profile) {
      return { data: null, error: "Profile not found. Please complete onboarding." };
    }

    return {
      data: {
        id: profile.id,
        // Personal info
        dateOfBirth: profile.dateOfBirth.toISOString(),
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel,
        // Goals
        dietaryGoal: profile.dietaryGoal,
        dailyCalories: profile.dailyCalories,
        proteinGrams: profile.proteinGrams,
        carbsGrams: profile.carbsGrams,
        fatGrams: profile.fatGrams,
        // Preferences
        dietaryType: profile.dietaryType,
        allergies: profile.allergies,
        cuisinePrefs: profile.cuisinePrefs,
        // Family members
        familyMembers: profile.familyMembers.map((member) => ({
          id: member.id,
          name: member.name,
          relationship: member.relationship,
          dateOfBirth: member.dateOfBirth.toISOString(),
          gender: member.gender,
          heightCm: member.heightCm,
          weightKg: member.weightKg,
          dietaryNeeds: member.dietaryNeeds,
        })),
        // Metadata
        onboardingCompleted: profile.onboardingCompleted,
      },
      error: null,
    };
  } catch {
    return { data: null, error: "Failed to get profile" };
  }
}

// Update personal information (demographics)
export async function updatePersonalInfo(
  data: z.infer<typeof personalInfoSchema>
) {
  try {
    const { profile, error } = await getAuthenticatedUserProfile();

    if (error) {
      return { data: null, error };
    }

    if (!profile) {
      return { data: null, error: "Profile not found" };
    }

    const validatedData = personalInfoSchema.parse(data);

    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        dateOfBirth: new Date(validatedData.dateOfBirth),
        gender: validatedData.gender,
        heightCm: validatedData.heightCm,
        weightKg: validatedData.weightKg,
        activityLevel: validatedData.activityLevel,
      },
    });

    revalidatePath("/profile");

    return { data: { id: updated.id }, error: null };
  } catch {
    return { data: null, error: "Failed to update personal info" };
  }
}

// Update nutritional goals
export async function updateGoals(data: z.infer<typeof goalsSchema>) {
  try {
    const { profile, error } = await getAuthenticatedUserProfile();

    if (error) {
      return { data: null, error };
    }

    if (!profile) {
      return { data: null, error: "Profile not found" };
    }

    const validatedData = goalsSchema.parse(data);

    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        dietaryGoal: validatedData.dietaryGoal,
        dailyCalories: validatedData.dailyCalories,
        proteinGrams: validatedData.proteinGrams,
        carbsGrams: validatedData.carbsGrams,
        fatGrams: validatedData.fatGrams,
      },
    });

    revalidatePath("/profile");

    return { data: { id: updated.id }, error: null };
  } catch {
    return { data: null, error: "Failed to update goals" };
  }
}

// Update dietary preferences
export async function updatePreferences(
  data: z.infer<typeof preferencesSchema>
) {
  try {
    const { profile, error } = await getAuthenticatedUserProfile();

    if (error) {
      return { data: null, error };
    }

    if (!profile) {
      return { data: null, error: "Profile not found" };
    }

    const validatedData = preferencesSchema.parse(data);

    const updated = await prisma.userProfile.update({
      where: { id: profile.id },
      data: {
        dietaryType: validatedData.dietaryType,
        allergies: validatedData.allergies,
        cuisinePrefs: validatedData.cuisinePrefs,
      },
    });

    revalidatePath("/profile");

    return { data: { id: updated.id }, error: null };
  } catch {
    return { data: null, error: "Failed to update preferences" };
  }
}

// Add a family member
export async function addFamilyMember(
  data: z.infer<typeof familyMemberSchema>
) {
  try {
    const { profile, error } = await getAuthenticatedUserProfile();

    if (error) {
      return { data: null, error };
    }

    if (!profile) {
      return { data: null, error: "Profile not found" };
    }

    const validatedData = familyMemberSchema.parse(data);

    const member = await prisma.familyMember.create({
      data: {
        profileId: profile.id,
        name: validatedData.name,
        relationship: validatedData.relationship,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        gender: validatedData.gender,
        heightCm: validatedData.heightCm
          ? parseFloat(validatedData.heightCm.toString())
          : null,
        weightKg: validatedData.weightKg
          ? parseFloat(validatedData.weightKg.toString())
          : null,
        dietaryNeeds: validatedData.dietaryNeeds,
      },
    });

    revalidatePath("/profile");

    return { data: { id: member.id }, error: null };
  } catch {
    return { data: null, error: "Failed to add family member" };
  }
}

// Update a family member
export async function updateFamilyMember(
  memberId: string,
  data: z.infer<typeof familyMemberSchema>
) {
  try {
    const { profile, error } = await getAuthenticatedUserProfile();

    if (error) {
      return { data: null, error };
    }

    if (!profile) {
      return { data: null, error: "Profile not found" };
    }

    // Verify the member belongs to this profile
    const existingMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        profileId: profile.id,
      },
    });

    if (!existingMember) {
      return { data: null, error: "Family member not found" };
    }

    const validatedData = familyMemberSchema.parse(data);

    const member = await prisma.familyMember.update({
      where: { id: memberId },
      data: {
        name: validatedData.name,
        relationship: validatedData.relationship,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        gender: validatedData.gender,
        heightCm: validatedData.heightCm
          ? parseFloat(validatedData.heightCm.toString())
          : null,
        weightKg: validatedData.weightKg
          ? parseFloat(validatedData.weightKg.toString())
          : null,
        dietaryNeeds: validatedData.dietaryNeeds,
      },
    });

    revalidatePath("/profile");

    return { data: { id: member.id }, error: null };
  } catch {
    return { data: null, error: "Failed to update family member" };
  }
}

// Delete a family member
export async function deleteFamilyMember(memberId: string) {
  try {
    const { profile, error } = await getAuthenticatedUserProfile();

    if (error) {
      return { data: null, error };
    }

    if (!profile) {
      return { data: null, error: "Profile not found" };
    }

    // Verify the member belongs to this profile
    const existingMember = await prisma.familyMember.findFirst({
      where: {
        id: memberId,
        profileId: profile.id,
      },
    });

    if (!existingMember) {
      return { data: null, error: "Family member not found" };
    }

    await prisma.familyMember.delete({
      where: { id: memberId },
    });

    revalidatePath("/profile");

    return { data: { success: true }, error: null };
  } catch {
    return { data: null, error: "Failed to delete family member" };
  }
}
