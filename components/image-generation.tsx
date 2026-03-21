"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sparkles, Download, AlertCircle, Loader2, Plus, Trash2 } from "lucide-react"
import { addToHistory } from "@/lib/history"

interface ImageGenerationProps {
  apiKey: string
  showSettings: boolean
}

interface Generation {
  id: string
  status: "generating" | "done" | "error"
  images: { url: string }[]
  error: string | null
  prompt: string
}

export function ImageGeneration({ apiKey, showSettings }: ImageGenerationProps) {
  const [prompt, setPrompt] = useState("")
  const [aspectRatio, setAspectRatio] = useState("1:1")
  const [resolution, setResolution] = useState("1k")
  const [count, setCount] = useState("1")
  const [generations, setGenerations] = useState<Generation[]>([])

  const handleGenerate = async () => {
    if (!prompt.trim() || !apiKey) return

    const generationId = `gen-${Date.now()}`
    const currentPrompt = prompt

    // Add new generation to the list
    setGenerations((prev) => [
      {
        id: generationId,
        status: "generating",
        images: [],
        error: null,
        prompt: currentPrompt,
      },
      ...prev,
    ])

    // Clear prompt for next generation
    setPrompt("")

    try {
      const response = await fetch("/api/image/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          aspectRatio,
          resolution,
          n: parseInt(count),
          apiKey,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate image")
      }

      setGenerations((prev) =>
        prev.map((g) =>
          g.id === generationId ? { ...g, status: "done", images: data.images } : g
        )
      )

      // Add each image to history
      for (const img of data.images) {
        addToHistory({
          type: "image-generation",
          prompt: currentPrompt,
          outputUrl: img.url,
          aspectRatio,
          resolution,
        })
      }
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

  const handleDownload = async (url: string, index: number) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = downloadUrl
      a.download = `grok-image-${Date.now()}-${index + 1}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      window.open(url, "_blank")
    }
  }

  const removeGeneration = (id: string) => {
    setGenerations((prev) => prev.filter((g) => g.id !== id))
  }

  const isGenerating = generations.some((g) => g.status === "generating")

  const getCost = () => {
    const n = parseInt(count)
    const base = resolution === "2k" ? 0.1 : 0.05
    return `$${(base * n).toFixed(2)}`
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Image Prompt</label>
          <Textarea
            placeholder="Describe the image you want to generate... (e.g., 'A futuristic cityscape at sunset with flying cars and neon lights, hyperrealistic, cinematic lighting')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-32 bg-input border-border resize-none"
          />
        </div>

        {showSettings && (
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Aspect Ratio</label>
              <Select value={aspectRatio} onValueChange={setAspectRatio}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1:1">1:1 (Square)</SelectItem>
                  <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                  <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                  <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                  <SelectItem value="3:2">3:2 (Photo)</SelectItem>
                  <SelectItem value="2:1">2:1 (Banner)</SelectItem>
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
                  <SelectItem value="1k">1K (Standard)</SelectItem>
                  <SelectItem value="2k">2K (High Quality)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Count</label>
              <Select value={count} onValueChange={setCount}>
                <SelectTrigger className="bg-input border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 image</SelectItem>
                  <SelectItem value="2">2 images</SelectItem>
                  <SelectItem value="4">4 images</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!apiKey && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <AlertCircle className="size-4 shrink-0" />
            <span>Please enter your xAI API key in the header to generate images.</span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={!prompt.trim() || !apiKey}
          className="w-full gap-2"
          size="lg"
        >
          <Plus className="size-4" />
          {isGenerating ? `Add to Queue (~${getCost()})` : `Generate Image (~${getCost()})`}
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
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      <span>Generating...</span>
                    </div>
                  )}

                  {gen.status === "error" && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="size-4" />
                      <span>{gen.error}</span>
                    </div>
                  )}

                  {gen.status === "done" && gen.images.length > 0 && (
                    <div
                      className={`grid gap-3 ${gen.images.length > 1 ? "grid-cols-2" : ""}`}
                    >
                      {gen.images.map((img, index) => (
                        <div key={index} className="relative group">
                          <div className="aspect-square bg-secondary rounded-lg overflow-hidden border border-border">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={`Generated image ${index + 1}`}
                              className="w-full h-full object-contain"
                            />
                          </div>
                          <button
                            onClick={() => handleDownload(img.url, index)}
                            className="absolute bottom-2 right-2 p-2 bg-background/80 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
                          >
                            <Download className="size-4 text-foreground" />
                          </button>
                        </div>
                      ))}
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
