import { type NextRequest, NextResponse } from "next/server"
import { getAIProviderSettings } from "@/lib/ai-provider-settings"

// Explicitly set this as a server-side only route
export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  console.log("Logo generation API route called")

  try {
    // Parse the request body
    const body = await request.json()
    const { businessName, industry, style, colors, slogan, additionalInfo, userId } = body

    console.log("Request body:", body)

    // Validate required fields
    if (!businessName || !industry || !userId) {
      console.error("Missing required fields:", { businessName, industry, userId })
      return NextResponse.json({ error: "Business name, industry, and userId are required" }, { status: 400 })
    }

    console.log("Generating logo for:", { businessName, industry, style, colors })

    try {
      const settings = await getAIProviderSettings(userId)
      if (!settings.isActive) {
        return NextResponse.json({ error: "AI is disabled" }, { status: 503 })
      }

      const apiKey = settings.apiKey
      if (!apiKey) {
        throw new Error("AI API key is not configured")
      }

      const baseUrl = settings.baseUrl.replace(/\/$/, "")
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), settings.timeoutMs)

      const safeReadErrorBody = async (res: Response) => {
        const ct = res.headers.get("content-type") || ""
        if (ct.includes("application/json")) {
          try {
            return await res.json()
          } catch {
            return null
          }
        }
        try {
          const text = await res.text()
          return text ? text.slice(0, 800) : null
        } catch {
          return null
        }
      }

      const looksLikeHtml = (value: unknown) => {
        if (typeof value !== "string") return false
        const s = value.trim().slice(0, 64).toLowerCase()
        return s.startsWith("<!doctype") || s.startsWith("<html")
      }

      // Create a detailed prompt for the logo using the new format
      const prompt = `Create Your Custom Logo

Company Name: "${businessName}"

Slogan: "${slogan || "Innovation for Tomorrow"}"

Industry: ${industry}

Preferred Colors: ${colors || "brand appropriate"}

Additional Information: ${additionalInfo || style || "modern, professional style"}

The AI will generate a logo image with:
- Your company name and slogan integrated
- A clean, simple design without any background elements

The logo should be simple, memorable, and work well at different sizes.
Create a clean logo with a white background, suitable for a professional business.`

      console.log("Sending request to AI provider", { provider: settings.provider, model: settings.model })

      // Make direct API call to OpenAI
      const response = await fetch(
        `${baseUrl}/images/generations`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: settings.model,
            prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard",
            response_format: "url",
          }),
          signal: controller.signal,
        },
      ).finally(() => clearTimeout(timeout))

      // Handle API errors
      if (!response.ok) {
        const errorBody = await safeReadErrorBody(response)
        console.error("AI provider API error response:", { status: response.status, body: errorBody })
        const message =
          typeof errorBody === "object" && errorBody && "error" in (errorBody as any) && (errorBody as any).error?.message
            ? (errorBody as any).error.message
            : typeof errorBody === "string" && errorBody
              ? errorBody
              : "Failed to generate logo"
        if (looksLikeHtml(message)) {
          throw new Error("AI provider returned HTML. Check the Base URL configured in /admin/settings (it must be an OpenAI-compatible API base, usually ending in /v1).")
        }
        throw new Error(message)
      }

      const responseCt = response.headers.get("content-type") || ""
      if (!responseCt.includes("application/json")) {
        const body = await safeReadErrorBody(response)
        console.error("AI provider returned non-JSON success response", { body })
        throw new Error("AI provider returned a non-JSON response. Check the Base URL configured in /admin/settings.")
      }

      const data = await response.json()
      console.log("AI provider API response received successfully")

      // Validate response data
      if (!data.data || !data.data[0] || !data.data[0].url) {
        console.error("Invalid response format from AI provider:", data)
        throw new Error("Invalid response format from AI provider")
      }

      const logoUrl = data.data[0].url
      console.log("Logo URL generated successfully:", logoUrl)

      // Save to database
      try {
        const { createClient } = await import("@supabase/supabase-js")
        const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

        const { data: designData, error } = await supabase
          .from("designs")
          .insert([
            {
              name: `${businessName} Logo`,
              thumbnail_url: logoUrl,
              user_id: userId,
              design_data: {
                businessName,
                industry,
                style,
                colors,
                slogan,
                additionalInfo,
                originalUrl: logoUrl,
                watermarkedUrl: logoUrl,
                type: "logo",
                generatedAt: new Date().toISOString(),
              },
              is_public: false,
              is_template: false,
            },
          ])
          .select()

        if (error) {
          console.error("Error saving design to database:", error)
        }

        return NextResponse.json({
          logoUrl,
          isAIGenerated: true,
          designId: designData?.[0]?.id,
        })
      } catch (dbError) {
        console.error("Database error:", dbError)
        return NextResponse.json({
          logoUrl,
          isAIGenerated: true,
          note: "Logo generated but not saved to database",
        })
      }
    } catch (providerError) {
      console.error("AI provider error:", providerError)

      // Fall back to mock logo generator if OpenAI fails
      console.log("Falling back to mock logo generator")
      return generateMockLogo(request, businessName, industry)
    }
  } catch (error) {
    console.error("Logo generation error:", error)
    return NextResponse.json(
      {
        error: `Error generating logo: ${error instanceof Error ? error.message : String(error)}`,
        stack: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

// Helper function to generate mock logos
function generateMockLogo(request: NextRequest, businessName: string, industry: string) {
  // Determine which mock logo to use based on the industry
  let logoUrl = ""

  // Simple logic to choose a logo based on industry
  if (industry.toLowerCase().includes("tech") || industry.toLowerCase().includes("tecnología")) {
    logoUrl = "/placeholder.svg?height=400&width=400&text=Tech+Logo"
  } else if (
    industry.toLowerCase().includes("health") ||
    industry.toLowerCase().includes("salud") ||
    industry.toLowerCase().includes("wellness") ||
    industry.toLowerCase().includes("bienestar")
  ) {
    logoUrl = "/placeholder.svg?height=400&width=400&text=Health+Logo"
  } else {
    logoUrl = "/placeholder.svg?height=400&width=400&text=Professional+Logo"
  }

  console.log("Mock logo URL:", logoUrl)

  return NextResponse.json({
    logoUrl,
    note: "Using mock logo generator for demonstration purposes",
  })
}
