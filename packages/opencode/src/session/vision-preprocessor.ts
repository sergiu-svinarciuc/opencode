import { Log } from "../util/log"
import type { MessageV2 } from "./message-v2"
import type { VisionConfig } from "../config/vision-config"
import { GeminiVision } from "../provider/gemini-vision"

export namespace VisionPreprocessor {
  const log = Log.create({ service: "vision-preprocessor" })

  export type UserWithVision = MessageV2.User & { visionAnalysis: string }

  /* Check if message parts contain any images */
  export function hasImages(parts: MessageV2.Part[]): boolean {
    return parts.some((part) => part.type === "file" && isImageMime(part.mime))
  }

  /* Analyze images in a user message */
  export async function analyzeImages(
    sessionID: string,
    userMessage: { parts: MessageV2.Part[] },
    config: VisionConfig,
  ): Promise<string> {
    const imageParts = userMessage.parts
      .filter((part) => part.type === "file" && isImageMime(part.mime))
      .slice(0, config.maxImages || 10) as MessageV2.FilePart[]

    if (imageParts.length === 0) {
      return ""
    }

    if (!config.enabled) {
      return ""
    }

    try {
      const analysis = await GeminiVision.analyze(imageParts, config)
      return analysis
    } catch (error: any) {
      log.warn("vision analysis failed", { sessionID, error: error.message })
      return ""
    }
  }

  /* Inject vision analysis into user message */
  export function injectAnalysis(userMessage: MessageV2.User, analysis: string): UserWithVision {
    return {
      ...userMessage,
      visionAnalysis: analysis,
    }
  }

  /* Check if MIME type is an image */
  function isImageMime(mime: string): boolean {
    return mime.startsWith("image/")
  }
}
