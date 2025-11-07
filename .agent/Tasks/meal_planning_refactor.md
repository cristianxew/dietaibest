# Meal Planning Architecture Refactor

## Overview

Transform meal plans from fixed-date instances to reusable templates with calendar scheduling.

## Database Schema Changes

1.  Create MealPlanTemplate model

- Fields: id, userId, name, duration (days), mealSlots, macros, isPublic, shareToken
- Remove: startDate, endDate, isActive
- This is the reusable template (no dates)

2.  Create MealPlanSchedule model

- Fields: id, templateId, userId, startDate, status
- endDate calculated from template.duration
- Tracks when/where templates are used on calendar
- Unique constraint: prevent overlapping dates per user

3.  Modify MealPlanDay

- Change: Link to templateId (not scheduleId)
- Change: Use dayNumber (1-7) instead of specific date
- Date calculated dynamically: schedule.startDate + dayNumber

4.  Keep MealPlanMeal unchanged

- Already links to MealPlanDay

## Server Actions Changes

5.  Update createMealPlan

- Remove: startDate/endDate parameters
- Add: duration parameter
- Create template only (no schedule yet)

6.  Replace scheduleMealPlan

- Create MealPlanSchedule record (not duplicate template)
- Check for date overlaps before scheduling
- Calculate endDate from startDate + template.duration

7.  Add updateTemplate

- Edit template meals/macros
- Changes auto-reflect in all schedules (read from same template)

8.  Add unscheduleTemplate

- Remove schedule without deleting template

## UI Component Changes

9.  Update MealPlanForm

- Remove: startDate/endDate pickers
- Add: duration input (number of days)
- Show: "Create Template" instead of "Create Plan"

10. Update SavedPlansCalendar

- Display: Calculate dates from schedules + template.duration
- Drag handler: Create schedule (not duplicate)
- Add: "Edit Template" button on calendar instances
- Overlap prevention: Check schedules before allowing drop

11. Add MealPlanTemplateLibrary component

- Show all user templates (no dates)
- Quick actions: Edit, Schedule, Delete, Duplicate

## Data Migration

12. Create migration script

- Convert existing MealPlan → MealPlanTemplate
- Calculate duration from existing startDate/endDate
- Create MealPlanSchedule for each existing plan
- Update MealPlanDay.dayNumber from date offset
- Preserve all meal assignments
