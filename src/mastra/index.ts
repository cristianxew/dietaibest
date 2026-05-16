import { Mastra } from "@mastra/core";
import { PinoLogger } from "@mastra/loggers";
import { generateMealPlanWorkflow } from "./workflows/generateMealPlan";

export const mastra = new Mastra({
  workflows: { generateMealPlanWorkflow },
  logger: new PinoLogger({ name: "DietAI", level: "info" }),
  // Storage intentionally omitted — defaults to in-memory for v1 (DIE-37 AC).
  // LibSQL/Postgres adapter wired but disabled behind MASTRA_STORAGE_URL env:
  // storage: process.env.MASTRA_STORAGE_URL ? new LibSQLStore({ url: process.env.MASTRA_STORAGE_URL }) : undefined,
});
