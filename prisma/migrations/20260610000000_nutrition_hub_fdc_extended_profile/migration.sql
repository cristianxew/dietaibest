-- Nutrition Hub: track which nutrient set a cached FDC row holds.
-- Legacy rows were fetched with only the 5 core macros ("core");
-- new fetches request the full extended registry ("extended").
ALTER TABLE "FdcCache" ADD COLUMN "nutrientProfile" TEXT NOT NULL DEFAULT 'core';
