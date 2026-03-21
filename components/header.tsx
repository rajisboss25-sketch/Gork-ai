"use client"

import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Eye, EyeOff, Sparkles, Check, Settings, Trash2 } from "lucide-react"
import { clearHistory, getHistory } from "@/lib/history"

interface HeaderProps {
  apiKey: string
  onSaveApiKey: (key: string) => void
  showSettings: boolean
  onToggleSettings: (show: boolean) => void
}

export function Header({ apiKey, onSaveApiKey, showSettings, onToggleSettings }: HeaderProps) {
  const [inputKey, setInputKey] = useState(apiKey)
  const [showKey, setShowKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [historyCount, setHistoryCount] = useState(0)

  useEffect(() => {
    setInputKey(apiKey)
  }, [apiKey])

  useEffect(() => {
    const history = getHistory()
    setHistoryCount(history.length)
  }, [])

  const handleSave = () => {
    onSaveApiKey(inputKey)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleClearHistory = () => {
    clearHistory()
    setHistoryCount(0)
  }

  const isKeyValid = inputKey.startsWith("xai-") && inputKey.length > 10

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="size-8 rounded-lg bg-foreground flex items-center justify-center">
            <Sparkles className="size-5 text-background" />
          </div>
          <span className="font-semibold text-lg hidden sm:inline text-foreground">Grok Studio</span>
        </div>

        <div className="flex items-center gap-3 flex-1 justify-end max-w-xl">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Input
                type={showKey ? "text" : "password"}
                placeholder="xai-... (Your xAI API Key)"
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                className="pr-10 bg-input border-border text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
            <Button 
              size="sm" 
              onClick={handleSave}
              variant={saved ? "secondary" : "default"}
              className="shrink-0 gap-1"
              disabled={!inputKey}
            >
              {saved ? (
                <>
                  <Check className="size-3" />
                  Saved
                </>
              ) : (
                "Save"
              )}
            </Button>
          </div>
          
          <Badge 
            variant={isKeyValid ? "default" : "outline"} 
            className={`hidden md:flex border-border ${isKeyValid ? "bg-green-500/10 text-green-500 border-green-500/20" : "text-muted-foreground"}`}
          >
            {isKeyValid ? "Connected" : "No API Key"}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0 border-border">
                <Settings className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              <div className="p-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="show-options" className="text-sm">
                    Show advanced options
                  </label>
                  <Switch
                    id="show-options"
                    checked={showSettings}
                    onCheckedChange={onToggleSettings}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Duration, aspect ratio, resolution settings
                </p>
              </div>

              <DropdownMenuSeparator />

              <div className="p-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">History</span>
                  <Badge variant="secondary" className="text-xs">
                    {historyCount} items
                  </Badge>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full gap-2"
                  onClick={handleClearHistory}
                  disabled={historyCount === 0}
                >
                  <Trash2 className="size-3" />
                  Clear History
                </Button>
              </div>

              <DropdownMenuSeparator />

              <div className="p-2 text-xs text-muted-foreground">
                <p>API key and history are saved locally in your browser.</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
