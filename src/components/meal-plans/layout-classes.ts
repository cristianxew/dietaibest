export const GRID_LABEL_COL = '72px';
export const GRID_COL_MIN_REGULAR = '[--grid-col-min:148px] lg:[--grid-col-min:132px]';
export const GRID_COL_MIN_DENSE = '[--grid-col-min:128px] lg:[--grid-col-min:110px]';

// Phones (below `sm`) always get one column: meals render as full-width rows
// there (MealCell `variant="row"`), so columns only start at the tablet tier.
export function stackSlotCols(numSlots: number): string {
  if (numSlots <= 2) return 'grid-cols-1 sm:grid-cols-2';
  if (numSlots === 3) return 'grid-cols-1 sm:grid-cols-3';
  if (numSlots === 4) return 'grid-cols-1 sm:grid-cols-2 min-[768px]:grid-cols-4';
  return 'grid-cols-1 sm:grid-cols-2 min-[768px]:grid-cols-3 lg:grid-cols-5';
}

export function splitSlotCols(numSlots: number): string {
  if (numSlots <= 2) return 'grid-cols-1 sm:grid-cols-2';
  if (numSlots === 3) return 'grid-cols-1 sm:grid-cols-3';
  return 'grid-cols-1 sm:grid-cols-2 min-[768px]:grid-cols-4';
}
