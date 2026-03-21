"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Wand2, Download, AlertCircle, Loader2, Plus, Trash2 } from "lucide-react"
import { addToHistory } from "@/lib/history"

interface TextToVideoProps {
  apiKey: string
  showSettings: boolean
}

interface Generation {
  id: string
  status: "generating" | "done" | "error"
  progress: number
  videoUrl: string | null
  error: string | null
  prompt: string
}

export function TextToVideo({ apiKey, showSettings }: TextToVideoProps) {
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState("6")
  const [aspectRatio, setAspectRatio] = useState("16:9")
  const [resolution, setResolution] = useState("720p")
  const [generations, setGenerations] = useState<Generation[]>([])

  const pollForResult = async (requestId: string, generationId: string, genPrompt: string) => {
    const maxAttempts = 120
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`/api/video/status/${requestId}`, {
          headers: {
            "x-api-key": apiKey,
          },
        })

        const data = await response.json()

        if (!response.ok) {
          throw new Error(data.error || "Failed to check status")
        }

        if (data.status === "done" && data.video?.url) {
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === generationId
                ? { ...g, status: "done", progress: 100, videoUrl: data.video.url }
                : g
            )
          )

          addToHistory({
            type: "text-to-video",
            prompt: genPrompt,
            outputUrl: data.video.url,
            duration: parseInt(duration),
            aspectRatio,
            resolution,
          })

          return
        } else if (data.status === "failed") {
          throw new Error("Video generation failed")
        } else if (data.status === "expired") {
          throw new Error("Request expired")
        }

        setGenerations((prev) =>
          prev.map((g) =>
            g.id === generationId
              ? { ...g, progress: Math.min(95, (attempts / maxAttempts) * 100) }
              : g
          )
        )
        attempts++
        await new Promise((resolve) => setTimeout(resolve, 5000))
      } catch (err) {
        throw err
      }
    }

    throw new Error("Generation timed out")
  }

  const handleGenerate = async () => {
    if (!prompt.trim() || !apiKey) return

    const generationId = `gen-${Date.now()}`
    const currentPrompt = prompt

    // Add new generation to the list
    setGenerations((prev) => [
      {
        id: generationId,
        status: "generating",
        progress: 0,
        videoUrl: null,
        error: null,
        prompt: currentPrompt,
      },
      ...prev,
    ])

    // Clear prompt for next generation
    setPrompt("")

    try {
      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          duration: parseInt(duration),
          aspectRatio,
          resolution,
          apiKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start generation")
      }

      await pollForResult(data.requestId, generationId, currentPrompt)
    } catch (err) {
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === generationId
            ? {
                ...g,
                status: "error",
                error: err instanceof Error ? err.message : "An error occurred",
              }
            : g
        )
      )
    }
  }

  const handleDownload = async (videoUrl: string) => {
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `grok-video-${Date.now()}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(videoUrl, "_blank")
    }
  }

  const removeGeneration = (id: string) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id))
  }

  const isGenerating = generations.some((g) => g.status === "generating")

  const getCost = () => {
    const d = parseInt(duration)
    if (d <= 5) return "$0.25"
    if (d <= 10) return "$0.50"
    return "$0.75"
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Video Prompt</label>
          <Textarea
            placeholder="Describe the scene, motion, and camera angles... (e.g., 'A cinematic shot of ocean waves crashing against rocky cliffs at sunset, camera slowly pulling back to reveal the coastline')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 bg-input border-border resize-none"
          />
        </div>

        {showSettings && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Duration</label>
              <Select value={duration} onValueChange={setDuration}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 seconds</SelectItem>
                  <SelectItem value="5">5 seconds</SelectItem>
                  <SelectItem value="6">6 seconds</SelectItem>
                  <SelectItem value="8">8 seconds</SelectItem>
                  <SelectItem value="10">10 seconds</SelectItem>
                  <SelectItem value="15">15 seconds</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Aspect Ratio</label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                  <SelectItem value="3:2">3:2 (Photo)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Resolution</label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="480p">480p (Faster)</SelectItem>
                  <SelectItem value="720p">720p (HD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!apiKey && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <AlertCircle className="size-4 shrink-0" />
            <span>Please enter your xAI API key in the header to generate videos.</span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || !apiKey}
          className="w-full gap-2"
          size="lg"
        >
          <Plus className="size-4" />
          {isGenerating ? `Add to Queue (~${getCost()})` : `Generate Video (~${getCost()})`}
        </Button>

        {/* Generation Queue */}
        {generations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Generations</h3>
            <div className="space-y-3">
              {generations.map((gen) => (
                <div
                  key={gen.id}
                  className="border border-border rounded-lg overflow-hidden bg-secondary/30 p-4"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <p className="text-sm text-foreground line-clamp-2 flex-1">{gen.prompt}</p>
                    {(gen.status === "done" || gen.status === "error") && (
                      <button
                        onClick={() => removeGeneration(gen.id)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </div>

                  {gen.status === "generating" && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="size-4 animate-spin" />
                        <span>Generating... {Math.round(gen.progress)}%</span>
                      </div>
                      <Progress value={gen.progress} className="h-1" />
                    </div>
                  )}

                  {gen.status === "error" && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="size-4" />
                      <span>{gen.error}</span>
                    </div>
                  )}

                  {gen.status === "done" && gen.videoUrl && (
                    <div className="space-y-3">
                      <div className="aspect-video bg-secondary rounded-lg overflow-hidden border border-border">
                        <video
                          src={gen.videoUrl}
                          className="w-full h-full object-contain"
                          controls
                          autoPlay
                          loop
                          muted
                        />
                      </div>
                      <Button
                        onClick={() => handleDownload(gen.videoUrl!)}
                        variant="secondary"
                        size="sm"
                        className="w-full gap-2 border border-border"
                      >
                        <Download className="size-4" />
                        Download Video
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
