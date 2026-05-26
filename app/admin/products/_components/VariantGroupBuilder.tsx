"use client"

import { useMemo, useState } from "react"
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
                      <TableHead className="w-[120px]">Available</TableHead>
                      <TableHead className="w-[44px]"></TableHead>
                      <TableHead className="w-[44px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {group.options
                      .slice()
                      .sort((a, b) => a.sortOrder - b.sortOrder)
                      .map((opt) => (
                        <TableRow
                          key={opt.id}
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
                              disabled={disabled}
                              className="h-9"
                            />
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
                            <Button type="button" variant="outline" size="icon" onClick={() => removeOption(group.id, opt.id)} disabled={disabled}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                          <TableCell></TableCell>
                        </TableRow>
                      ))}
                    <TableRow>
                      <TableCell colSpan={5}>
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

