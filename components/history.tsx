"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Video, 
  Image, 
  FileVideo, 
  Sparkles, 
  Download, 
  Trash2, 
  Clock,
  ExternalLink
} from "lucide-react"
import { getHistory, removeFromHistory, clearHistory, type HistoryItem } from "@/lib/history"

const typeIcons = {
  "text-to-video": Video,
  "image-to-video": Image,
  "video-extend": FileVideo,
  "image-generation": Sparkles,
}

const typeLabels = {
  "text-to-video": "Text to Video",
  "image-to-video": "Image to Video",
  "video-extend": "Video Extend",
  "image-generation": "Image Generation",
}

export function History() {
  const [history, setHistory] = useState<HistoryItem[]>([])

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  const handleRemove = (id: string) => {
    removeFromHistory(id)
    setHistory(getHistory())
  }

  const handleClearAll = () => {
    if (confirm("Are you sure you want to clear all history? This cannot be undone.")) {
      clearHistory()
      setHistory([])
    }
  }

  const handleDownload = async (item: HistoryItem) => {
    const isVideo = item.type !== "image-generation"
    const ext = isVideo ? "mp4" : "png"
    
    try {
      const response = await fetch(item.outputUrl)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `grok-${item.type}-${item.id}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      window.open(item.outputUrl, "_blank")
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  if (history.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="p-12 text-center">
          <Clock className="size-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No History Yet</h3>
          <p className="text-muted-foreground text-sm">
            Your generated videos and images will appear here.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {history.length} item{history.length !== 1 ? "s" : ""} in history
        </p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClearAll}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="size-4 mr-2" />
          Clear All
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {history.map((item) => {
          const Icon = typeIcons[item.type]
          const isVideo = item.type !== "image-generation"

          return (
            <Card key={item.id} className="bg-card border-border overflow-hidden group">
              <div className="relative aspect-video bg-secondary">
                {isVideo && item.outputUrl ? (
                  <video
                    src={item.outputUrl}
                    className="w-full h-full object-cover"
                    muted
                    loop
                    onMouseEnter={(e) => e.currentTarget.play()}
                    onMouseLeave={(e) => {
                      e.currentTarget.pause()
                      e.currentTarget.currentTime = 0
                    }}
                  />
                ) : !isVideo && item.outputUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.outputUrl}
                    alt={item.prompt}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Icon className="size-8 text-muted-foreground" />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="absolute bottom-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleDownload(item)}
                    className="p-2 bg-background/80 rounded-lg hover:bg-background transition-colors"
                    title="Download"
                  >
                    <Download className="size-4 text-foreground" />
                  </button>
                  <a
                    href={item.outputUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 bg-background/80 rounded-lg hover:bg-background transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="size-4 text-foreground" />
                  </a>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-2 bg-background/80 rounded-lg hover:bg-destructive/20 transition-colors"
                    title="Remove from history"
                  >
                    <Trash2 className="size-4 text-foreground" />
                  </button>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="gap-1 border-border text-xs">
                    <Icon className="size-3" />
                    {typeLabels[item.type]}
                  </Badge>
                  {item.duration && (
                    <Badge variant="outline" className="border-border text-xs">
                      {item.duration}s
                    </Badge>
                  )}
                  {item.resolution && (
                    <Badge variant="outline" className="border-border text-xs">
                      {item.resolution}
                    </Badge>
                  )}
                </div>

                <p className="text-sm text-foreground line-clamp-2">{item.prompt}</p>

                <p className="text-xs text-muted-foreground">
                  {formatDate(item.createdAt)}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
