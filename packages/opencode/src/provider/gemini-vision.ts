import { Log } from "../util/log"
import { Config } from "../config/config"
import { Auth } from "../auth"
import type { MessageV2 } from "../session/message-v2"
import type { VisionConfig } from "../config/vision-config"

export namespace GeminiVision {
  const log = Log.create({ service: "gemini-vision" })

  const MODEL_MAP: Record<string, string> = {
    "gemini-2-5-flash": "gemini-2.5-flash",
    "gemini-2-5-pro": "gemini-2.5-pro",
    "gemini-3-pro": "gemini-3.0-pro",
  }

  export async function analyze(images: MessageV2.FilePart[], config: VisionConfig): Promise<string> {
    if (images.length === 0) return ""

    const modelName = config.model === "auto" ? "gemini-2-5-flash" : config.model
    const model = MODEL_MAP[modelName] || modelName
    const project = config.project || (await getVertexProject())
    const location = config.location || "global"

    try {
      const payload = await buildRequestPayload(images, config.prompt)
      const analysis = await callVertexAI(payload, project, location, config.timeout || 30000, model)
      return analysis
    } catch (error: any) {
      log.warn("vision analysis failed, continuing without analysis", {
        error: error.message,
      })
      return ""
    }
  }

  async function buildRequestPayload(images: MessageV2.FilePart[], prompt: string): Promise<any> {
    const parts: any[] = []

    for (const img of images) {
      const imagePart = await extractImagePart(img)
      if (imagePart) {
        parts.push(imagePart)
      }
    }
    parts.push({ text: prompt })

    return {
      contents: {
        role: "user",
        parts,
      },
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 2048,
      },
    }
  }

  async function extractImagePart(img: MessageV2.FilePart): Promise<any> {
    if (img.url.startsWith("data:")) {
      const [mediaType, ...dataParts] = img.url.split(",")
      const data = dataParts.join(",")

      return {
        inlineData: {
          mimeType: img.mime,
          data,
        },
      }
    }

    if (img.url.startsWith("file://") || img.url.startsWith("/")) {
      try {
        const filePath = img.url.replace("file://", "")
        const file = Bun.file(filePath)
        const exists = await file.exists()

        if (!exists) {
          log.warn("image file not found", { filePath })
          return null
        }

        const buffer = await file.arrayBuffer()
        const base64 = Buffer.from(buffer).toString("base64")

        return {
          inlineData: {
            mimeType: img.mime,
            data: base64,
          },
        }
      } catch (error: any) {
        log.warn("failed to read image file", { filePath: img.url, error: error.message })
        return null
      }
    }

    return {
      fileData: {
        mimeType: img.mime,
        uri: img.url,
      },
    }
  }

  async function callVertexAI(
    payload: any,
    project: string,
    location: string,
    timeout: number,
    model: string,
  ): Promise<string> {
    const accessToken = await getAccessToken()
    const endpoint = `https://aiplatform.googleapis.com/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Vertex AI API failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      const text = extractTextFromResponse(data)

      if (!text) {
        log.warn("no text in response", { data })
        return ""
      }

      return text
    } finally {
      clearTimeout(timeoutId)
    }
  }

  function extractTextFromResponse(data: any): string {
    if (!data.candidates || data.candidates.length === 0) {
      return ""
    }

    const candidate = data.candidates[0]
    if (candidate.content && candidate.content.parts) {
      const textParts = candidate.content.parts.filter((part: any) => part.text).map((part: any) => part.text)
      return textParts.join("\n").trim()
    }

    return ""
  }

  async function getVertexProject(): Promise<string> {
    try {
      const cfg = await Config.get()
      const vertexConfig = cfg.provider?.["vertex-glm"]?.options

      if (vertexConfig?.project) {
        return vertexConfig.project
      }

      log.warn("no vertex-glm project found in config")
      return "noter-1c2a1"
    } catch (error) {
      log.warn("failed to get vertex project", { error })
      return "noter-1c2a1"
    }
  }

  async function getAccessToken(): Promise<string> {
    const result = Bun.spawnSync(["gcloud", "auth", "print-access-token"], {
      stdout: "pipe",
      stderr: "ignore",
    })

    if (result.success && result.stdout) {
      const token = result.stdout.toString().trim()
      if (token.startsWith("ya29.")) {
        return token
      }
    }

    try {
      const auth = await Auth.get("vertex-glm")

      if (!auth) {
        throw new Error("No vertex-glm auth found in OpenCode auth (and gcloud auth failed)")
      }

      if (auth.type === "api" && auth.key) {
        return auth.key
      }

      if (auth.type === "oauth" && auth.access) {
        return auth.access
      }

      throw new Error("Unsupported auth type for vertex-glm")
    } catch (error: any) {
      log.warn("failed to get vertex-glm access token", { error: error.message })
      throw error
    }
  }
}
