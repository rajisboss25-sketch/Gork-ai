"use client"

import { useState, useCallback, useRef } from "react"
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
import { Upload, X, Download, AlertCircle, Loader2, Plus, Trash2, RefreshCw, Pencil, Check } from "lucide-react"
import { addToHistory } from "@/lib/history"

interface ImageToVideoProps {
  apiKey: string
  showSettings: boolean
}

interface Generation {
  id: string
  status: "uploading" | "generating" | "done" | "error"
  progress: number
  videoUrl: string | null
  error: string | null
  imagePreview: string
  imageFile: File | null
  blobUrl: string | null
  prompt: string
  duration: number
  aspectRatio: string
  resolution: string
  isEditingPrompt?: boolean
  editedPrompt?: string
}

export function ImageToVideo({ apiKey, showSettings }: ImageToVideoProps) {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [prompt, setPrompt] = useState("")
  const [duration, setDuration] = useState("6")
  const [aspectRatio, setAspectRatio] = useState("16:9")
  const [resolution, setResolution] = useState("720p")
  const [isDragging, setIsDragging] = useState(false)
  const [generations, setGenerations] = useState<Generation[]>([])
  const editInputRef = useRef<HTMLTextAreaElement>(null)

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith("image/")) {
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
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
      setUploadedFile(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setUploadedImage(null)
    setUploadedFile(null)
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
      throw new Error(data.error || "Failed to upload image")
    }

    const data = await response.json()
    console.log("[v0] Image uploaded to Blob:", data.url)
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
        console.log("[v0] Poll response:", data)

        if (!response.ok) {
          throw new Error(data.error || "Failed to check status")
        }

        if (data.status === "done" && data.video?.url) {
          const gen = generations.find((g) => g.id === generationId)
          
          setGenerations((prev) =>
            prev.map((g) =>
              g.id === generationId
                ? { ...g, status: "done", progress: 100, videoUrl: data.video.url }
                : g
            )
          )

          addToHistory({
            type: "image-to-video",
            prompt: gen?.prompt || "Image animation",
            inputUrl: gen?.imagePreview,
            outputUrl: data.video.url,
            duration: gen?.duration || parseInt(duration),
            aspectRatio: gen?.aspectRatio || aspectRatio,
            resolution: gen?.resolution || resolution,
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

  const startGeneration = async (
    generationId: string,
    imageFile: File,
    imagePreview: string,
    genPrompt: string,
    genDuration: number,
    genAspectRatio: string,
    genResolution: string,
    existingBlobUrl?: string | null
  ) => {
    try {
      // Step 1: Upload image to Blob storage to get a public URL (if not already uploaded)
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === generationId ? { ...g, status: "uploading", progress: 10 } : g
        )
      )

      let imageUrl = existingBlobUrl
      if (!imageUrl) {
        imageUrl = await uploadToBlob(imageFile)
        // Save the blob URL for regeneration
        setGenerations((prev) =>
          prev.map((g) =>
            g.id === generationId ? { ...g, blobUrl: imageUrl } : g
          )
        )
      }

      console.log("[v0] Using image URL for generation:", imageUrl)

      // Step 2: Start video generation with the public image URL
      setGenerations((prev) =>
        prev.map((g) =>
          g.id === generationId ? { ...g, status: "generating", progress: 20 } : g
        )
      )

      const requestBody = {
        prompt: genPrompt,
        duration: genDuration,
        aspectRatio: genAspectRatio,
        resolution: genResolution,
        apiKey,
        imageUrl,
      }
      console.log("[v0] Sending request to API:", JSON.stringify(requestBody, null, 2))

      const response = await fetch("/api/video/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()
      console.log("[v0] API response:", data)

      if (!response.ok) {
        throw new Error(data.error || "Failed to start generation")
      }

      await pollForResult(data.requestId, generationId)
    } catch (err) {
      console.error("[v0] Generation error:", err)
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

  const handleGenerate = async () => {
    if (!uploadedFile || !uploadedImage || !apiKey) return

    const generationId = `gen-${Date.now()}`
    const currentPrompt = prompt || "Animate this image with natural motion"
    const currentDuration = parseInt(duration)
    const currentAspectRatio = aspectRatio
    const currentResolution = resolution

    // Add new generation to the list
    setGenerations((prev) => [
      {
        id: generationId,
        status: "uploading",
        progress: 0,
        videoUrl: null,
        error: null,
        imagePreview: uploadedImage,
        imageFile: uploadedFile,
        blobUrl: null,
        prompt: currentPrompt,
        duration: currentDuration,
        aspectRatio: currentAspectRatio,
        resolution: currentResolution,
      },
      ...prev,
    ])

    // Store file reference before clearing
    const fileToUse = uploadedFile
    const previewToUse = uploadedImage

    // Clear inputs for next generation
    setUploadedImage(null)
    setUploadedFile(null)
    setPrompt("")

    await startGeneration(
      generationId,
      fileToUse,
      previewToUse,
      currentPrompt,
      currentDuration,
      currentAspectRatio,
      currentResolution
    )
  }

  const handleRegenerate = async (gen: Generation) => {
    if (!gen.imageFile || !apiKey) return

    const generationId = `gen-${Date.now()}`
    const newPrompt = gen.editedPrompt || gen.prompt

    // Add new generation to the list
    setGenerations((prev) => [
      {
        id: generationId,
        status: "uploading",
        progress: 0,
        videoUrl: null,
        error: null,
        imagePreview: gen.imagePreview,
        imageFile: gen.imageFile,
        blobUrl: gen.blobUrl,
        prompt: newPrompt,
        duration: gen.duration,
        aspectRatio: gen.aspectRatio,
        resolution: gen.resolution,
      },
      ...prev,
    ])

    await startGeneration(
      generationId,
      gen.imageFile,
      gen.imagePreview,
      newPrompt,
      gen.duration,
      gen.aspectRatio,
      gen.resolution,
      gen.blobUrl
    )
  }

  const toggleEditPrompt = (genId: string) => {
    setGenerations((prev) =>
      prev.map((g) =>
        g.id === genId
          ? { ...g, isEditingPrompt: !g.isEditingPrompt, editedPrompt: g.editedPrompt || g.prompt }
          : g
      )
    )
  }

  const updateEditedPrompt = (genId: string, newPrompt: string) => {
    setGenerations((prev) =>
      prev.map((g) =>
        g.id === genId ? { ...g, editedPrompt: newPrompt } : g
      )
    )
  }

  const confirmEditPrompt = (genId: string) => {
    setGenerations((prev) =>
      prev.map((g) =>
        g.id === genId
          ? { ...g, prompt: g.editedPrompt || g.prompt, isEditingPrompt: false }
          : g
      )
    )
  }

  const handleDownload = async (videoUrl: string) => {
    try {
      const response = await fetch(videoUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `grok-i2v-${Date.now()}.mp4`
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

  return (
    <Card className="bg-card border-border">
      <CardContent className="p-6 space-y-6">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Base Image</label>
          {!uploadedImage ? (
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
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                <Upload className="size-10 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-1">
                  Drag and drop an image here, or click to browse
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Supports PNG, JPG, WEBP (max 10MB)
                </p>
              </label>
            </div>
          ) : (
            <div className="relative aspect-video bg-secondary rounded-lg overflow-hidden border border-border group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedImage}
                alt="Uploaded preview"
                className="w-full h-full object-contain"
              />
              <button
                onClick={handleRemoveImage}
                className="absolute top-2 right-2 p-1.5 bg-background/80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-background"
              >
                <X className="size-4 text-foreground" />
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            Motion Prompt (Optional)
          </label>
          <Textarea
            placeholder="Describe how you want the image to animate... (e.g., 'Gentle camera zoom in, clouds slowly drifting, birds flying across the sky')"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-24 bg-input border-border resize-none"
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
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Aspect Ratio
              </label>
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
            <span>Please enter your xAI API key in the header to animate images.</span>
          </div>
        )}

        <Button
          onClick={handleGenerate}
          disabled={!uploadedImage || !apiKey}
          className="w-full gap-2"
          size="lg"
        >
          <Plus className="size-4" />
          {isGenerating ? "Add to Queue (~$0.50)" : "Animate Image (~$0.50)"}
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
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={gen.imagePreview}
                          alt="Input"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      
                      {/* Prompt with edit functionality */}
                      <div className="space-y-1">
                        {gen.isEditingPrompt ? (
                          <div className="space-y-2">
                            <Textarea
                              ref={editInputRef}
                              value={gen.editedPrompt || gen.prompt}
                              onChange={(e) => updateEditedPrompt(gen.id, e.target.value)}
                              className="min-h-16 text-xs bg-input border-border resize-none"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => confirmEditPrompt(gen.id)}
                                className="gap-1 text-xs"
                              >
                                <Check className="size-3" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => toggleEditPrompt(gen.id)}
                                className="text-xs"
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start gap-2">
                            <p className="text-xs text-muted-foreground line-clamp-2 flex-1">
                              {gen.prompt}
                            </p>
                            {(gen.status === "done" || gen.status === "error") && (
                              <button
                                onClick={() => toggleEditPrompt(gen.id)}
                                className="text-muted-foreground hover:text-foreground shrink-0"
                                title="Edit prompt"
                              >
                                <Pencil className="size-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
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
                            <p className="text-xs text-muted-foreground">
                              Uploading image...
                            </p>
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
                      
                      {/* Action buttons */}
                      {(gen.status === "done" || gen.status === "error") && (
                        <div className="flex gap-2">
                          {gen.status === "done" && gen.videoUrl && (
                            <Button
                              onClick={() => handleDownload(gen.videoUrl!)}
                              variant="secondary"
                              size="sm"
                              className="flex-1 gap-2 border border-border"
                            >
                              <Download className="size-3" />
                              Download
                            </Button>
                          )}
                          <Button
                            onClick={() => handleRegenerate(gen)}
                            variant="secondary"
                            size="sm"
                            className={`gap-2 border border-border ${gen.status === "error" ? "flex-1" : ""}`}
                            disabled={!gen.imageFile}
                          >
                            <RefreshCw className="size-3" />
                            {gen.isEditingPrompt ? "Regenerate with Edit" : "Regenerate"}
                          </Button>
                        </div>
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
