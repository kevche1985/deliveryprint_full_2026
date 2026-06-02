"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"

export default function AdminSettingsPage() {
  const { toast } = useToast()
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [provider, setProvider] = useState("openai")
  const [model, setModel] = useState("dall-e-3")
  const [baseUrl, setBaseUrl] = useState("")
  const [maxOutputTokens, setMaxOutputTokens] = useState(2048)
  const [temperature, setTemperature] = useState(0.2)
  const [timeoutMs, setTimeoutMs] = useState(30000)
  const [isActive, setIsActive] = useState(false)
  const [apiKeyMasked, setApiKeyMasked] = useState("")
  const [hasApiKey, setHasApiKey] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState("")
  const [clearApiKey, setClearApiKey] = useState(false)

  const providerDefaultBaseUrl = useMemo(() => {
    if (provider === "openrouter") return "https://openrouter.ai/api/v1"
    if (provider === "openai") return "https://api.openai.com/v1"
    return ""
  }, [provider])

  useEffect(() => {
    if (!authLoading && !user) {
      toast({ title: "Authentication Required", description: "Please log in to access settings.", variant: "destructive" })
      router.push("/auth/login")
    }
  }, [authLoading, user, router, toast])

  const loadSettings = async () => {
    setLoading(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        toast({ title: "Authentication Required", description: "Please log in again.", variant: "destructive" })
        return
      }

      const res = await fetch("/api/admin/ai-settings", {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        const msg = await res.json().catch(() => null)
        throw new Error(msg?.error || "Failed to load AI settings")
      }

      const settings = await res.json()
      setProvider(settings.provider || "openai")
      setModel(settings.model || "dall-e-3")
      setBaseUrl(settings.base_url || "")
      setMaxOutputTokens(Number(settings.max_output_tokens ?? 2048))
      setTemperature(Number(settings.temperature ?? 0.2))
      setTimeoutMs(Number(settings.timeout_ms ?? 30000))
      setIsActive(Boolean(settings.is_active ?? false))
      setHasApiKey(Boolean(settings.has_api_key))
      setApiKeyMasked(settings.api_key_masked || "")
      setApiKeyInput("")
      setClearApiKey(false)
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to load settings", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) loadSettings()
  }, [user])

  const saveSettings = async () => {
    setSaving(true)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        toast({ title: "Authentication Required", description: "Please log in again.", variant: "destructive" })
        return
      }

      const res = await fetch("/api/admin/ai-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          provider,
          model,
          base_url: baseUrl || providerDefaultBaseUrl,
          max_output_tokens: maxOutputTokens,
          temperature,
          timeout_ms: timeoutMs,
          is_active: isActive,
          api_key: apiKeyInput.trim() ? apiKeyInput.trim() : undefined,
          clear_api_key: clearApiKey,
        }),
      })

      if (!res.ok) {
        const msg = await res.json().catch(() => null)
        throw new Error(msg?.error || "Failed to save AI settings")
      }

      toast({ title: "Saved", description: "AI integration settings updated." })
      await loadSettings()
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || "Failed to save settings", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Configure integrations used across the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI Provider</CardTitle>
          <CardDescription>Used by AI Design Studio and AI Chatbot.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">Primary</p>
              <p className="text-xs text-gray-500">Enable or disable AI features platform-wide.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} disabled={loading || saving} />
          </div>

          <div className="mt-6 grid gap-4">
            <div className="grid gap-2">
              <Label>Provider</Label>
              <Select value={provider} onValueChange={setProvider} disabled={loading || saving}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI</SelectItem>
                  <SelectItem value="openrouter">OpenRouter (OpenAI-compatible)</SelectItem>
                  <SelectItem value="openai_compatible">Custom (OpenAI-compatible)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} disabled={loading || saving} />
            </div>

            <div className="grid gap-2">
              <Label>Base URL (optional)</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={providerDefaultBaseUrl || ""}
                disabled={loading || saving}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="grid gap-2">
                <Label>Max output tokens</Label>
                <Input
                  type="number"
                  value={maxOutputTokens}
                  onChange={(e) => setMaxOutputTokens(Number(e.target.value))}
                  disabled={loading || saving}
                />
              </div>
              <div className="grid gap-2">
                <Label>Temperature</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  disabled={loading || saving}
                />
              </div>
              <div className="grid gap-2">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  disabled={loading || saving}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-2">
                  <Label>API key</Label>
                  <Input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder={hasApiKey ? apiKeyMasked : "Set API key"}
                    disabled={loading || saving}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setClearApiKey((v) => !v)}
                  disabled={loading || saving}
                >
                  {clearApiKey ? "Undo clear" : "Clear key"}
                </Button>
              </div>
              <p className="text-xs text-gray-500">
                Leave blank to keep the current key. The key is never shown again after saving.
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={loadSettings} disabled={loading || saving}>
                Reload
              </Button>
              <Button type="button" onClick={saveSettings} disabled={loading || saving}>
                Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
