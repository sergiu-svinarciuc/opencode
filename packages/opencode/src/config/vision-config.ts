import z from "zod"

export const VisionConfig = z
  .object({
    enabled: z.boolean().default(false).describe("Enable automatic image analysis"),
    model: z
      .enum(["gemini-2-5-flash", "gemini-2-5-pro", "gemini-3-pro", "auto"])
      .default("gemini-2-5-flash")
      .describe("Vision model to use for image analysis"),
    project: z.string().optional().describe("GCP project ID (falls back to vertex-glm provider config)"),
    location: z.string().default("global").describe("GCP location (falls back to vertex-glm provider config)"),
    prompt: z
      .string()
      .default(
        "Analyze this image for a coding task. Describe:\n" +
          "1) UI components visible\n" +
          "2) Error messages or console output\n" +
          "3) Code snippets visible\n" +
          "4) Layout structure\n" +
          "5) Any bugs or issues apparent.\n" +
          "Be concise and focus on actionable details.",
      )
      .describe("Prompt to use for vision analysis"),
    timeout: z.number().default(30000).describe("Timeout in milliseconds for vision API calls"),
    maxImages: z.number().default(10).describe("Maximum number of images to analyze per message"),
  })
  .meta({
    ref: "VisionConfig",
  })

export type VisionConfig = z.infer<typeof VisionConfig>
