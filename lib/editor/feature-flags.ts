import architecture from "@/lib/editor/architecture.json"

type Role = "admin" | "operator" | "customer" | "supplier" | string
type Tier = "free" | "pro"

const freeSet = new Set(architecture.monetization_flags.free_tier)
const proSet = new Set(architecture.monetization_flags.pro_tier)

export function getUserTier(role: Role): Tier {
  if (role === "admin" || role === "operator") return "pro"
  return "free"
}

export function canUseFeature(feature: string, role: Role): boolean {
  const tier = getUserTier(role)
  if (tier === "pro") return freeSet.has(feature) || proSet.has(feature)
  return freeSet.has(feature)
}

export function getExportOptions() {
  return architecture.export_system
}

export function getCanvasConstraints() {
  return architecture.core_modules.canvas.constraints
}

export function isAiEnabled(module: keyof typeof architecture.ai_modules) {
  return Boolean(architecture.ai_modules[module])
}
