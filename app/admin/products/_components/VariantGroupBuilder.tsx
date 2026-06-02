"use client"

import { Fragment, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { GripVertical, Plus, Trash2 } from "lucide-react"

export type AdminVariantOption = {
  id: string
  label: string
  priceModifier: number
  tierPricing?: any | null
  isAvailable: boolean
  sortOrder: number
}

export type AdminVariantGroup = {
  id: string
  name: string
  display: "dropdown" | "chips"
  sortOrder: number
  options: AdminVariantOption[]
}

function generateId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export default function VariantGroupBuilder({
  groups,
  onChange,
  disabled,
}: {
  groups: AdminVariantGroup[]
  onChange: (groups: AdminVariantGroup[]) => void
  disabled?: boolean
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({})
  const [draggingGroupId, setDraggingGroupId] = useState<string | null>(null)
  const [draggingOption, setDraggingOption] = useState<{ groupId: string; optionId: string } | null>(null)

  const sortedGroups = useMemo(() => groups.slice().sort((a, b) => a.sortOrder - b.sortOrder), [groups])

  const reindexGroups = (next: AdminVariantGroup[]) => next.map((g, idx) => ({ ...g, sortOrder: idx }))
  const reindexOptions = (opts: AdminVariantOption[]) => opts.map((o, idx) => ({ ...o, sortOrder: idx }))

  const updateGroup = (id: string, patch: Partial<AdminVariantGroup>) => {
    onChange(groups.map((g) => (g.id === id ? { ...g, ...patch } : g)))
  }

  const removeGroup = (id: string) => {
    onChange(reindexGroups(groups.filter((g) => g.id !== id)))
  }

  const addGroup = () => {
    const id = generateId()
    onChange(
      reindexGroups([
        ...groups,
        {
          id,
          name: "",
          display: "dropdown",
          sortOrder: groups.length,
          options: [],
        },
      ]),
    )
    setExpanded((p) => ({ ...p, [id]: true }))
  }

  const moveGroup = (dragId: string, overId: string) => {
    if (dragId === overId) return
    const current = sortedGroups.slice()
    const from = current.findIndex((g) => g.id === dragId)
    const to = current.findIndex((g) => g.id === overId)
    if (from === -1 || to === -1) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    onChange(reindexGroups(current))
  }

  const addOption = (groupId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const option: AdminVariantOption = {
      id: generateId(),
      label: "",
      priceModifier: 0,
      tierPricing: null,
      isAvailable: true,
      sortOrder: group.options.length,
    }
    updateGroup(groupId, { options: reindexOptions([...group.options, option]) })
    setExpanded((p) => ({ ...p, [groupId]: true }))
  }

  const updateOption = (groupId: string, optionId: string, patch: Partial<AdminVariantOption>) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const nextOpts = group.options.map((o) => (o.id === optionId ? { ...o, ...patch } : o))
    updateGroup(groupId, { options: nextOpts })
  }

  const normalizeTierPricing = (raw: any) => {
    const src =
      raw && typeof raw === "object" && !Array.isArray(raw) && Array.isArray((raw as any).tiers) ? (raw as any).tiers : raw
    if (!Array.isArray(src)) return []
    return (src as any[])
      .map((t) => ({
        quantity: Number.parseInt(String(t?.quantity ?? t?.qty ?? ""), 10),
        price: Number.parseFloat(String(t?.price ?? "")),
      }))
      .filter((t) => Number.isFinite(t.quantity) && t.quantity > 0 && Number.isFinite(t.price) && t.price >= 0)
      .sort((a, b) => a.quantity - b.quantity)
  }

  const setTierRow = (groupId: string, optionId: string, index: number, patch: { quantity?: string; price?: string }) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const opt = group.options.find((o) => o.id === optionId)
    if (!opt) return
    const tiers = normalizeTierPricing(opt.tierPricing)
    const next = tiers.map((t, i) => {
      if (i !== index) return t
      const nextQty = patch.quantity != null ? Number.parseInt(String(patch.quantity), 10) : t.quantity
      const nextPrice = patch.price != null ? Number.parseFloat(String(patch.price)) : t.price
      return {
        quantity: Number.isFinite(nextQty) ? nextQty : t.quantity,
        price: Number.isFinite(nextPrice) ? nextPrice : t.price,
      }
    })
    updateOption(groupId, optionId, { tierPricing: { mode: "tiers", tiers: next } })
  }

  const addTierRow = (groupId: string, optionId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const opt = group.options.find((o) => o.id === optionId)
    if (!opt) return
    const tiers = normalizeTierPricing(opt.tierPricing)
    const lastQty = tiers[tiers.length - 1]?.quantity
    const nextQty = typeof lastQty === "number" && Number.isFinite(lastQty) ? lastQty + 1 : 1
    const next = [...tiers, { quantity: nextQty, price: 0 }]
    updateOption(groupId, optionId, { tierPricing: { mode: "tiers", tiers: next } })
    setExpandedOptions((p) => ({ ...p, [optionId]: true }))
  }

  const removeTierRow = (groupId: string, optionId: string, index: number) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const opt = group.options.find((o) => o.id === optionId)
    if (!opt) return
    const tiers = normalizeTierPricing(opt.tierPricing)
    const next = tiers.filter((_, i) => i !== index)
    updateOption(groupId, optionId, { tierPricing: next.length ? { mode: "tiers", tiers: next } : null })
  }

  const toggleTierPricing = (groupId: string, optionId: string, enabled: boolean) => {
    if (!enabled) {
      updateOption(groupId, optionId, { tierPricing: null })
      return
    }
    updateOption(groupId, optionId, { tierPricing: { mode: "tiers", tiers: [{ quantity: 70, price: 0 }] } })
    setExpandedOptions((p) => ({ ...p, [optionId]: true }))
  }

  const removeOption = (groupId: string, optionId: string) => {
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    updateGroup(groupId, { options: reindexOptions(group.options.filter((o) => o.id !== optionId)) })
  }

  const moveOption = (groupId: string, dragId: string, overId: string) => {
    if (dragId === overId) return
    const group = groups.find((g) => g.id === groupId)
    if (!group) return
    const current = group.options.slice().sort((a, b) => a.sortOrder - b.sortOrder)
    const from = current.findIndex((o) => o.id === dragId)
    const to = current.findIndex((o) => o.id === overId)
    if (from === -1 || to === -1) return
    const [moved] = current.splice(from, 1)
    current.splice(to, 0, moved)
    updateGroup(groupId, { options: reindexOptions(current) })
  }

  return (
    <div className="space-y-4">
      {sortedGroups.map((group) => {
        const isOpen = expanded[group.id] ?? true
        return (
          <div
            key={group.id}
            className="rounded-lg border border-gray-200 bg-white"
            draggable={!disabled}
            onDragStart={() => setDraggingGroupId(group.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => (draggingGroupId ? moveGroup(draggingGroupId, group.id) : null)}
            onDragEnd={() => setDraggingGroupId(null)}
          >
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <div className="mt-1 text-gray-400">
                  <GripVertical className="h-4 w-4" />
                </div>
                <div className="space-y-3">
                  <Input
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                    placeholder="Group name"
                    disabled={disabled}
                    className="h-9 w-[260px]"
                  />
                  <RadioGroup
                    value={group.display}
                    onValueChange={(v) => updateGroup(group.id, { display: v as any })}
                    className="flex items-center gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="dropdown" id={`${group.id}-dropdown`} />
                      <Label htmlFor={`${group.id}-dropdown`}>Dropdown</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="chips" id={`${group.id}-chips`} />
                      <Label htmlFor={`${group.id}-chips`}>Chips</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" onClick={() => setExpanded((p) => ({ ...p, [group.id]: !isOpen }))}>
                  {isOpen ? "Collapse" : "Expand"}
                </Button>
                <Button type="button" variant="outline" onClick={() => removeGroup(group.id)} disabled={disabled}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {isOpen ? (
              <div className="border-t border-gray-200 p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Label</TableHead>
                      <TableHead className="w-[160px]">Price modifier</TableHead>
                      <TableHead className="w-[120px]">Tiers</TableHead>
                      <TableHead className="w-[120px]">Available</TableHead>
                      <TableHead className="w-[44px]"></TableHead>
                      <TableHead className="w-[44px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.options
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((opt) => {
                        const tiersEnabled = normalizeTierPricing(opt.tierPricing).length > 0
                        const optionOpen = expandedOptions[opt.id] ?? false
                        return (
                          <Fragment key={opt.id}>
                            <TableRow
                              draggable={!disabled}
                              onDragStart={() => setDraggingOption({ groupId: group.id, optionId: opt.id })}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={() =>
                                draggingOption && draggingOption.groupId === group.id
                                  ? moveOption(group.id, draggingOption.optionId, opt.id)
                                  : null
                              }
                              onDragEnd={() => setDraggingOption(null)}
                            >
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <GripVertical className="h-4 w-4 text-gray-400" />
                                  <Input
                                    value={opt.label}
                                    onChange={(e) => updateOption(group.id, opt.id, { label: e.target.value })}
                                    placeholder="Option label"
                                    disabled={disabled}
                                    className="h-9"
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={String(opt.priceModifier)}
                                  onChange={(e) => updateOption(group.id, opt.id, { priceModifier: Number(e.target.value || 0) })}
                                  disabled={disabled || tiersEnabled}
                                  className="h-9"
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center justify-between gap-2">
                                  <Switch
                                    checked={tiersEnabled}
                                    onCheckedChange={(checked) => toggleTierPricing(group.id, opt.id, checked)}
                                    disabled={disabled}
                                  />
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setExpandedOptions((p) => ({ ...p, [opt.id]: !optionOpen }))}
                                    disabled={disabled || !tiersEnabled}
                                  >
                                    {optionOpen ? "Hide" : "Edit"}
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Switch
                                    checked={opt.isAvailable}
                                    onCheckedChange={(checked) => updateOption(group.id, opt.id, { isAvailable: checked })}
                                    disabled={disabled}
                                  />
                                </div>
                              </TableCell>
                              <TableCell>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  onClick={() => removeOption(group.id, opt.id)}
                                  disabled={disabled}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>

                            {tiersEnabled && optionOpen ? (
                              <TableRow key={`${opt.id}-tiers`}>
                                <TableCell colSpan={6}>
                                  <div className="space-y-3 rounded-md border border-gray-200 bg-gray-50 p-3">
                                    <div className="flex items-center justify-between">
                                      <p className="text-sm font-medium text-gray-900">Tier prices (total)</p>
                                      <Button type="button" variant="outline" size="sm" onClick={() => addTierRow(group.id, opt.id)} disabled={disabled}>
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add tier
                                      </Button>
                                    </div>
                                    <div className="grid gap-2">
                                      {normalizeTierPricing(opt.tierPricing).map((tier: any, idx: number) => (
                                        <div key={`${opt.id}-tier-${idx}`} className="grid grid-cols-1 gap-2 md:grid-cols-6">
                                          <div className="md:col-span-2">
                                            <Input
                                              type="number"
                                              value={String(tier.quantity)}
                                              onChange={(e) => setTierRow(group.id, opt.id, idx, { quantity: e.target.value })}
                                              disabled={disabled}
                                              className="h-9"
                                            />
                                          </div>
                                          <div className="md:col-span-3">
                                            <Input
                                              type="number"
                                              step="0.01"
                                              value={String(tier.price)}
                                              onChange={(e) => setTierRow(group.id, opt.id, idx, { price: e.target.value })}
                                              disabled={disabled}
                                              className="h-9"
                                            />
                                          </div>
                                          <div className="md:col-span-1">
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              onClick={() => removeTierRow(group.id, opt.id, idx)}
                                              disabled={disabled}
                                            >
                                              <Trash2 className="h-4 w-4" />
                                            </Button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ) : null}
                          </Fragment>
                        )
                      })}
                    <TableRow>
                      <TableCell colSpan={6}>
                        <Button type="button" variant="outline" onClick={() => addOption(group.id)} disabled={disabled}>
                          <Plus className="mr-2 h-4 w-4" />
                          Add option
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ) : null}
          </div>
        )
      })}

      <Button type="button" variant="outline" onClick={addGroup} disabled={disabled}>
        <Plus className="mr-2 h-4 w-4" />
        Add variant group
      </Button>
    </div>
  )
}
