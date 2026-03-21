"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/header"
import { TextToVideo } from "@/components/text-to-video"
import { ImageToVideo } from "@/components/image-to-video"
import { VideoExtend } from "@/components/video-extend"
import { ImageGeneration } from "@/components/image-generation"
import { History } from "@/components/history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Video, Image, FileVideo, Sparkles, Clock } from "lucide-react"
import { getSavedApiKey, saveApiKey } from "@/lib/history"

export default function GrokVideoStudio() {
  const [apiKey, setApiKey] = useState("")
  const [showSettings, setShowSettings] = useState(false)

  useEffect(() => {
    const savedKey = getSavedApiKey()
    if (savedKey) {
      setApiKey(savedKey)
    }
    // Load settings preference
    const savedSettings = localStorage.getItem("grok-show-settings")
    if (savedSettings !== null) {
      setShowSettings(savedSettings === "true")
    }
  }, [])

  const handleSaveApiKey = (key: string) => {
    setApiKey(key)
    saveApiKey(key)
  }

  const handleToggleSettings = (show: boolean) => {
    setShowSettings(show)
    localStorage.setItem("grok-show-settings", String(show))
  }

  return (
    <div className="min-h-screen bg-background">
      <Header 
        apiKey={apiKey} 
        onSaveApiKey={handleSaveApiKey}
        showSettings={showSettings}
        onToggleSettings={handleToggleSettings}
      />
      
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground mb-2 text-balance">
            Grok Video Studio
          </h1>
          <p className="text-muted-foreground text-pretty">
            Generate stunning videos and images with xAI Grok Imagine API
          </p>
        </div>

        <Tabs defaultValue="text-to-video" className="w-full">
          <TabsList className="grid w-full grid-cols-5 bg-secondary/50 border border-border">
            <TabsTrigger 
              value="text-to-video" 
              className="gap-2 data-[state=active]:bg-background data-[state=active]:border-border"
            >
              <Video className="size-4" />
              <span className="hidden sm:inline">Text to Video</span>
              <span className="sm:hidden">T2V</span>
            </TabsTrigger>
            <TabsTrigger 
              value="image-to-video"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:border-border"
            >
              <Image className="size-4" />
              <span className="hidden sm:inline">Image to Video</span>
              <span className="sm:hidden">I2V</span>
            </TabsTrigger>
            <TabsTrigger 
              value="video-extend"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:border-border"
            >
              <FileVideo className="size-4" />
              <span className="hidden sm:inline">Video Extend</span>
              <span className="sm:hidden">Ext</span>
            </TabsTrigger>
            <TabsTrigger 
              value="image-generation"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:border-border"
            >
              <Sparkles className="size-4" />
              <span className="hidden sm:inline">Image Gen</span>
              <span className="sm:hidden">Img</span>
            </TabsTrigger>
            <TabsTrigger 
              value="history"
              className="gap-2 data-[state=active]:bg-background data-[state=active]:border-border"
            >
              <Clock className="size-4" />
              <span className="hidden sm:inline">History</span>
              <span className="sm:hidden">Hist</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text-to-video" className="mt-6">
            <TextToVideo apiKey={apiKey} showSettings={showSettings} />
          </TabsContent>

          <TabsContent value="image-to-video" className="mt-6">
            <ImageToVideo apiKey={apiKey} showSettings={showSettings} />
          </TabsContent>

          <TabsContent value="video-extend" className="mt-6">
            <VideoExtend apiKey={apiKey} showSettings={showSettings} />
          </TabsContent>

          <TabsContent value="image-generation" className="mt-6">
            <ImageGeneration apiKey={apiKey} showSettings={showSettings} />
          </TabsContent>

          <TabsContent value="history" className="mt-6">
            <History />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
