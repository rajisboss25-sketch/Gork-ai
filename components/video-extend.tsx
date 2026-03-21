"use client"

import { useState, useCallback } from "react"
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
import { FileVideo, X, FastForward, Download, AlertCircle, Loader2, Plus, Trash2 } from "lucide-react"
import { addToHistory } from "@/lib/history"

interface VideoExtendProps {
  apiKey: string
  showSettings: boolean
}

interface Generation {
  id: string
  status: "uploading" | "generating" | "done" | "error"
  progress: number
  videoUrl: string | null
  error: string | null
  inputPreview: string
  prompt: string
}

export function VideoExtend({ apiKey, showSettings }: VideoExtendProps) {
  const [uploadedVideo, setUploadedVideo] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [videoName, setVideoName] = useState("")
  const [prompt, setPrompt] = useState("")
  const [extensionLength, setExtensionLength] = useState("5")
  const [isDragging, setIsDragging] = useState(false)
  const [generations, setGenerations] = useState<Generation[]>([])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("video/")) {
      setVideoName(file.name)
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedVideo(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setVideoName(file.name)
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedVideo(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveVideo = () => {
    setUploadedVideo(null)
    setUploadedFile(null)
    setVideoName("")
  }

  const uploadToBlob = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append("file", file)

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || "Failed to upload video")
    }

    const data = await response.json()
    return data.url
  }

  const pollForResult = async (requestId: string, generationId: string) => {
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

          const gen = generations.find((g) => g.id === generationId)
          addToHistory({
            type: "video-extend",
            prompt: gen?.prompt || "Video extension",
            inputUrl: gen?.inputPreview,
            outputUrl: data.video.url,
            duration: parseInt(extensionLength),
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
    if (!uploadedFile || !uploadedVideo || !apiKey) return

    const generationId = `gen-${Date.now()}`
    const currentPrompt = prompt || "Continue this video naturally"

    // Add new generation to the list
    setGenerations((prev) => [
      {
        id: generationId,
        status: "uploading",
        progress: 0,
        videoUrl: null,
        error: null,
        inputPreview: uploadedVideo,
        prompt: currentPrompt,
      },
      ...prev,
    ])

    // Clear inputs for next generation
    setUploadedVideo(null)
    setUploadedFile(null)
    setVideoName("")
    setPrompt("")

    try {
      // Step 1: Upload video to Blob storage to get a public URL
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === generationId ? { ...g, status: "uploading", progress: 10 } : g
        )
      )

      const videoUrl = await uploadToBlob(uploadedFile)

      // Step 2: Start video extension with the public video URL
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === generationId ? { ...g, status: "generating", progress: 20 } : g
        )
      )

      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: currentPrompt,
          duration: parseInt(extensionLength),
          apiKey,
          videoUrl, // Now using the public Blob URL
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to start generation")
      }

      await pollForResult(data.requestId, generationId)
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
      a.download = `grok-extended-${Date.now()}.mp4`
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

  const isGenerating = generations.some(
    (g) => g.status === "uploading" || g.status === "generating"
  )

  const getCost = () => {
    const d = parseInt(extensionLength)
    if (d <= 5) return "$0.50"
    return "$1.00"
  }

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Source Video</label>
          {!uploadedVideo ? (
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              className={`
                border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${
                  isDragging
                    ? "border-foreground bg-secondary/50"
                    : "border-border hover:border-muted-foreground"
                }
              `}
            >
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                id="video-upload"
              />
              <label htmlFor="video-upload" className="cursor-pointer">
                <FileVideo className="size-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-1">
                  Drag and drop a video here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Supports MP4, MOV, WEBM (max 8.7s, will be capped)
                </p>
              </label>
            </div>
          ) : (
            <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden border border-border group">
              <video src={uploadedVideo} className="w-full h-full object-contain" controls />
              <div className="absolute top-2 left-2 bg-background/80 px-2 py-1 rounded text-xs text-foreground">
                {videoName}
              </div>
              <button
                onClick={handleRemoveVideo}
                className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              >
                <X className="size-4 text-foreground" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Extension Instructions (Optional)
          </label>
          <Textarea
            placeholder="Describe how the video should continue... (e.g., 'Continue the camera movement, slowly revealing more of the landscape with the sun setting further')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-24 bg-input border-border resize-none"
          />
        </div>

        {showSettings && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Extension Length</label>
            <Select value={extensionLength} onValueChange={setExtensionLength}>
              <SelectTrigger className="bg-input border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">+3 seconds</SelectItem>
                <SelectItem value="5">+5 seconds</SelectItem>
                <SelectItem value="8">+8 seconds</SelectItem>
                <SelectItem value="10">+10 seconds</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {!apiKey && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <AlertCircle className="size-4 shrink-0" />
            <span>Please enter your xAI API key in the header to extend videos.</span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={!uploadedVideo || !apiKey}
          className="w-full gap-2"
          size="lg"
        >
          <Plus className="size-4" />
          {isGenerating ? `Add to Queue (~${getCost()})` : `Extend Video (~${getCost()})`}
        </Button>

        {/* Generation Queue */}
        {generations.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-foreground">Generations</h3>
            <div className="space-y-3">
              {generations.map((gen) => (
                <div
                  key={gen.id}
                  className="border border-border rounded-lg overflow-hidden bg-secondary/30"
                >
                  <div className="grid md:grid-cols-2 gap-4 p-4">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Input</p>
                      <div className="aspect-video bg-secondary rounded-lg overflow-hidden border border-border">
                        <video
                          src={gen.inputPreview}
                          className="w-full h-full object-contain"
                          controls
                          muted
                        />
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{gen.prompt}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">Output</p>
                        {(gen.status === "done" || gen.status === "error") && (
                          <button
                            onClick={() => removeGeneration(gen.id)}
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <Trash2 className="size-3" />
                          </button>
                        )}
                      </div>
                      <div className="aspect-video bg-secondary rounded-lg overflow-hidden border border-border flex items-center justify-center">
                        {gen.status === "uploading" && (
                          <div className="text-center space-y-2 p-4">
                            <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">Uploading video...</p>
                          </div>
                        )}
                        {gen.status === "generating" && (
                          <div className="text-center space-y-2 p-4 w-full">
                            <Loader2 className="size-6 animate-spin mx-auto text-muted-foreground" />
                            <p className="text-xs text-muted-foreground">
                              Generating... {Math.round(gen.progress)}%
                            </p>
                            <Progress value={gen.progress} className="h-1" />
                          </div>
                        )}
                        {gen.status === "error" && (
                          <div className="text-center space-y-2 p-4">
                            <AlertCircle className="size-6 mx-auto text-destructive" />
                            <p className="text-xs text-destructive">{gen.error}</p>
                          </div>
                        )}
                        {gen.status === "done" && gen.videoUrl && (
                          <video
                            src={gen.videoUrl}
                            className="w-full h-full object-contain"
                            controls
                            autoPlay
                            loop
                            muted
                          />
                        )}
                      </div>
                      {gen.status === "done" && gen.videoUrl && (
                        <Button
                          onClick={() => handleDownload(gen.videoUrl!)}
                          variant="secondary"
                          size="sm"
                          className="w-full gap-2 border border-border"
                        >
                          <Download className="size-3" />
                          Download
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
