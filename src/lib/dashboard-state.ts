/**
 * Dashboard State Management
 *
 * Determines the user's journey stage to show the most relevant call-to-action.
 * This eliminates duplicate empty states and creates a clear user onboarding flow.
 */

export type DashboardState =
  | 'onboarding_incomplete'    // Profile not set up
  | 'needs_first_recipe'       // Profile done, no recipes
  | 'needs_meal_plan'          // Has recipes, no plans
  | 'needs_active_plan'        // Has plans, none active
  | 'fully_active';            // Has active plan

export interface DashboardStateData {
  profileComplete: boolean;
  hasRecipes: boolean;
  hasMealPlans: boolean;
  hasActivePlan: boolean;
}

/**
 * Determines the current dashboard state based on user progress.
 *
 * The states follow a linear user journey:
 * 1. Complete profile (onboarding)
 * 2. Add first recipe
 * 3. Create meal plan
 * 4. Activate a plan
 * 5. Fully active (using the app)
 *
 * @param data - User progress data
 * @returns The current dashboard state
 */
export function getDashboardState(data: DashboardStateData): DashboardState {
  // Check in priority order - each state represents a blocker to progress
  if (!data.profileComplete) {
    return 'onboarding_incomplete';
  }

  if (!data.hasRecipes) {
    return 'needs_first_recipe';
  }

  if (!data.hasMealPlans) {
    return 'needs_meal_plan';
  }

  if (!data.hasActivePlan) {
    return 'needs_active_plan';
  }

  return 'fully_active';
}

/**
 * Helper to determine if the Hero CTA should be shown.
 *
 * @param state - The current dashboard state
 * @returns True if Hero CTA should be displayed
 */
export function shouldShowHeroCTA(state: DashboardState): boolean {
  return state !== 'fully_active';
}

/**
 * Helper to determine if data views (charts, nutrition cards) should be shown.
 *
 * Progressive disclosure: only show data views when the user has data to display.
 *
 * @param data - User progress data
 * @returns True if data views should be displayed
 */
export function shouldShowDataViews(data: DashboardStateData): boolean {
  return data.hasActivePlan || data.hasRecipes;
}
