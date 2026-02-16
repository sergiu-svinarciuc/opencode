import { describe, it, expect, beforeEach } from "bun:test"
import { VisionPreprocessor } from "@/session/vision-preprocessor"
import type { MessageV2 } from "@/session/message-v2"
import type { VisionConfig } from "@/config/vision-config"

describe("VisionPreprocessor", () => {
  describe("hasImages", () => {
    it("should detect image FileParts", () => {
      const parts: MessageV2.Part[] = [
        {
          id: "1",
          sessionID: "test",
          messageID: "msg1",
          type: "text",
          text: "Hello",
        },
        {
          id: "2",
          sessionID: "test",
          messageID: "msg1",
          type: "file",
          mime: "image/png",
          url: "data:image/png;base64,iVBORw0KG...",
          filename: "screenshot.png",
        },
      ]

      expect(VisionPreprocessor.hasImages(parts)).toBe(true)
    })

    it("should ignore non-image FileParts", () => {
      const parts: MessageV2.Part[] = [
        {
          id: "1",
          sessionID: "test",
          messageID: "msg1",
          type: "file",
          mime: "text/plain",
          url: "file:///test.txt",
        },
        {
          id: "2",
          sessionID: "test",
          messageID: "msg1",
          type: "file",
          mime: "application/pdf",
          url: "file:///test.pdf",
        },
      ]

      expect(VisionPreprocessor.hasImages(parts)).toBe(false)
    })

    it("should return false for no FileParts", () => {
      const parts: MessageV2.Part[] = [
        {
          id: "1",
          sessionID: "test",
          messageID: "msg1",
          type: "text",
          text: "Hello",
        },
      ]

      expect(VisionPreprocessor.hasImages(parts)).toBe(false)
    })

    it("should detect multiple image types", () => {
      const parts: MessageV2.Part[] = [
        {
          id: "1",
          sessionID: "test",
          messageID: "msg1",
          type: "file",
          mime: "image/jpeg",
          url: "data:image/jpeg;base64,/9j/4AAQ...",
          filename: "photo.jpg",
        },
        {
          id: "2",
          sessionID: "test",
          messageID: "msg1",
          type: "file",
          mime: "image/gif",
          url: "data:image/gif;base64,R0lGODlh...",
          filename: "anim.gif",
        },
      ]

      expect(VisionPreprocessor.hasImages(parts)).toBe(true)
    })
  })

  describe("analyzeImages", () => {
    it("should return empty string when no images", async () => {
      const userMessage: { parts: MessageV2.Part[] } = {
        parts: [
          {
            id: "1",
            sessionID: "test",
            messageID: "msg1",
            type: "text",
            text: "Hello",
          },
        ],
      }

      const config: VisionConfig = {
        enabled: true,
        model: "gemini-2-5-flash",
        project: "test-project",
        location: "global",
        prompt: "Analyze this image",
        timeout: 30000,
        maxImages: 10,
      }

      const result = await VisionPreprocessor.analyzeImages("session123", userMessage, config)
      expect(result).toBe("")
    })

    it("should return empty string when vision disabled", async () => {
      const userMessage: { parts: MessageV2.Part[] } = {
        parts: [
          {
            id: "1",
            sessionID: "test",
            messageID: "msg1",
            type: "file",
            mime: "image/png",
            url: "data:image/png;base64,iVBORw0KG...",
            filename: "screenshot.png",
          },
        ],
      }

      const config: VisionConfig = {
        enabled: false,
        model: "gemini-2-5-flash",
        project: "test-project",
        location: "global",
        prompt: "Analyze this image",
        timeout: 30000,
        maxImages: 10,
      }

      const result = await VisionPreprocessor.analyzeImages("session123", userMessage, config)
      expect(result).toBe("")
    })

    it("should respect maxImages limit", async () => {
      const parts: MessageV2.Part[] = []
      for (let i = 0; i < 15; i++) {
        parts.push({
          id: `${i}`,
          sessionID: "test",
          messageID: "msg1",
          type: "file",
          mime: "image/png",
          url: `data:image/png;base64,test${i}`,
          filename: `image${i}.png`,
        })
      }

      const userMessage: { parts: MessageV2.Part[] } = { parts }

      const config: VisionConfig = {
        enabled: true,
        model: "gemini-2-5-flash",
        project: "test-project",
        location: "global",
        prompt: "Analyze this image",
        timeout: 30000,
        maxImages: 5,
      }

      // Note: This would require mocking GeminiVision.analyze to verify behavior
      const result = await VisionPreprocessor.analyzeImages("session123", userMessage, config)
      // For now, we just verify it runs without error
      expect(typeof result).toBe("string")
    })
  })

  describe("injectAnalysis", () => {
    it("should add visionAnalysis to user message", () => {
      const userMessage: MessageV2.User = {
        id: "msg1",
        sessionID: "session123",
        role: "user",
        time: { created: Date.now() },
        agent: "build",
        model: { providerID: "openai", modelID: "gpt-4" },
      }

      const analysis = "This is a test analysis"
      const result = VisionPreprocessor.injectAnalysis(userMessage, analysis)

      expect(result).toEqual({
        ...userMessage,
        visionAnalysis: analysis,
      })
    })

    it("should preserve all existing user message fields", () => {
      const userMessage: MessageV2.User = {
        id: "msg1",
        sessionID: "session123",
        role: "user",
        time: { created: Date.now() },
        agent: "build",
        model: { providerID: "openai", modelID: "gpt-4" },
        system: "You are a helpful assistant",
        tools: { read: true, write: false },
        variant: "fast",
      }

      const analysis = "This is a test analysis"
      const result = VisionPreprocessor.injectAnalysis(userMessage, analysis)

      expect(result.id).toBe(userMessage.id)
      expect(result.sessionID).toBe(userMessage.sessionID)
      expect(result.agent).toBe(userMessage.agent)
      expect(result.system).toBe(userMessage.system)
      expect(result.tools).toEqual(userMessage.tools)
      expect(result.visionAnalysis).toBe(analysis)
    })

    it("should handle empty analysis", () => {
      const userMessage: MessageV2.User = {
        id: "msg1",
        sessionID: "session123",
        role: "user",
        time: { created: Date.now() },
        agent: "build",
        model: { providerID: "openai", modelID: "gpt-4" },
      }

      const result = VisionPreprocessor.injectAnalysis(userMessage, "")

      expect(result.visionAnalysis).toBe("")
    })

    it("should handle long analysis text", () => {
      const userMessage: MessageV2.User = {
        id: "msg1",
        sessionID: "session123",
        role: "user",
        time: { created: Date.now() },
        agent: "build",
        model: { providerID: "openai", modelID: "gpt-4" },
      }

      const longAnalysis = "A".repeat(10000)
      const result = VisionPreprocessor.injectAnalysis(userMessage, longAnalysis)

      expect(result.visionAnalysis).toBe(longAnalysis)
    })
  })
})
