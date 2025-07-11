import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { getBrowserUseClient } from "@/lib/browser-use";

// URL validation schema with security checks
const urlImportSchema = z.object({
  url: z
    .string()
    .url("Please enter a valid URL")
    .refine((url) => {
      try {
        const urlObj = new URL(url);
        return urlObj.protocol === "http:" || urlObj.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must start with http:// or https://")
    .refine((url) => {
      try {
        const urlObj = new URL(url);
        // Security: Block localhost and private IPs to prevent SSRF attacks
        const hostname = urlObj.hostname.toLowerCase();

        // Block localhost variations
        if (
          hostname === "localhost" ||
          hostname === "127.0.0.1" ||
          hostname === "0.0.0.0"
        ) {
          return false;
        }

        // Block private IP ranges
        const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipPattern.test(hostname)) {
          const parts = hostname.split(".").map(Number);
          // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
          if (
            parts[0] === 10 ||
            (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
            (parts[0] === 192 && parts[1] === 168)
          ) {
            return false;
          }
        }

        return true;
      } catch {
        return false;
      }
    }, "URL is not allowed for security reasons"),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = urlImportSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { url } = validation.data;

    try {
      // Extract recipe using Browser Use
      const browserUseClient = getBrowserUseClient();
      const recipeData = await browserUseClient.extractRecipeFromUrl({ url });

      return NextResponse.json(recipeData);
    } catch (error) {
      console.error("[Recipe Import] Browser Use error:", error);
      return NextResponse.json(
        {
          error: "Failed to extract recipe from URL",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("[Recipe Import] Route error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details:
          process.env.NODE_ENV === "development"
            ? error instanceof Error
              ? error.message
              : String(error)
            : undefined,
      },
      { status: 500 }
    );
  }
}
