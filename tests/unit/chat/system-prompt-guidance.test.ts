import { describe, it, expect } from "vitest";
import { z } from "zod";

import { buildSystemPrompt } from "@/lib/chat/system-prompt";
import type { AnyTool } from "@/lib/chat/tools/types";

/**
 * The system prompt is composed from the ACTIVE tool set (DIE candidate #2):
 * each tool carries its own behavioral `guidance`, and buildSystemPrompt folds
 * the guidance of exactly the tools it is handed into the prompt. This is the
 * invariant the old architecture could not express — buildSystemPrompt did not
 * know the tool set at all, so the prompt and the registry could silently
 * desync (two independent feature-flag checks that had to agree).
 */

function fakeTool(name: string, guidance?: string): AnyTool {
  return {
    name,
    description: `desc for ${name}`,
    inputSchema: z.object({}),
    statusKey: "tool.invoked",
    guidance,
    execute: async () => ({ ok: true, data: {} }),
  } as AnyTool;
}

describe("buildSystemPrompt — tool guidance composition", () => {
  it("includes the guidance of tools in the active set", () => {
    const tools = [fakeTool("alpha", "ALPHA_GUIDANCE_MARKER")];
    const prompt = buildSystemPrompt("en", undefined, tools);
    expect(prompt).toContain("ALPHA_GUIDANCE_MARKER");
  });

  it("omits the guidance of tools NOT in the active set (desync invariant)", () => {
    const present = fakeTool("alpha", "ALPHA_GUIDANCE_MARKER");
    const absent = fakeTool("beta", "BETA_GUIDANCE_MARKER");
    // Only `present` is handed to the prompt; `absent` exists but is filtered out.
    const prompt = buildSystemPrompt("en", undefined, [present]);
    expect(prompt).toContain("ALPHA_GUIDANCE_MARKER");
    expect(prompt).not.toContain("BETA_GUIDANCE_MARKER");
  });

  it("does not break for tools without guidance", () => {
    const tools = [fakeTool("alpha"), fakeTool("beta")];
    expect(() => buildSystemPrompt("en", undefined, tools)).not.toThrow();
    // A guidance-less tool contributes nothing identifiable.
    const prompt = buildSystemPrompt("en", undefined, tools);
    expect(prompt).not.toContain("undefined");
  });

  it("still carries the core medical-refusal policy when tools are present", () => {
    // Composition must not displace Category-1 global policy.
    const prompt = buildSystemPrompt("en", undefined, [fakeTool("alpha", "X")]);
    expect(prompt.toLowerCase()).toMatch(/healthcare|professional/);
  });
});
