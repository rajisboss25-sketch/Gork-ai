import { NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, duration = 6, aspectRatio = "16:9", resolution = "720p", apiKey, imageUrl, videoUrl } = body

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    }

    // Build request body based on type
    const requestBody: Record<string, unknown> = {
      model: "grok-imagine-video",
      prompt,
      duration,
      aspect_ratio: aspectRatio,
      resolution,
    }

    // If imageUrl is provided, it's image-to-video
    // The xAI API expects image as an object with url property
    if (imageUrl) {
      requestBody.image = { url: imageUrl }
    }

    // If videoUrl is provided, it's video editing/extending
    // The xAI API expects video as an object with url property
    if (videoUrl) {
      requestBody.video = { url: videoUrl }
    }

    // Start generation request
    const startResponse = await fetch("https://api.x.ai/v1/videos/generations", {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
    })

    if (!startResponse.ok) {
      const errorData = await startResponse.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.error?.message || `API error: ${startResponse.status}` },
        { status: startResponse.status }
      )
    }

    const { request_id } = await startResponse.json()

    // Return the request_id for polling
    return NextResponse.json({ requestId: request_id })
  } catch (error) {
    console.error("Video generation error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start video generation" },
      { status: 500 }
    )
  }
}
