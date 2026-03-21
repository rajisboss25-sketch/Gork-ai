import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  try {
    const { requestId } = await params
    const apiKey = request.headers.get("x-api-key")

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 })
    }

    const response = await fetch(`https://api.x.ai/v1/videos/${requestId}`, {
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: errorData.error?.message || `API error: ${response.status}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      status: data.status,
      video: data.video,
      model: data.model,
    })
  } catch (error) {
    console.error("Video status error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to check video status" },
      { status: 500 }
    )
  }
}
