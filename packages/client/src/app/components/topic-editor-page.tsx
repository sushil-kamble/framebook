import { useState } from "react"
import { ArrowLeft, Loader2, Pencil } from "lucide-react"
import { validateTopicDraft } from "@app/lib/topic-form"
import { aspectRatioOptions, enhancerModeOptions } from "../lib/constants"
import type { ReactNode } from "react"
import type {
  AspectRatio,
  EnhancerMode,
} from "@framebook/shared/contracts/framebook"
import type { TopicDraft } from "@app/lib/topic-form"
import { Button } from "@/shared/ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select"
import { Textarea } from "@/shared/ui/textarea"

export function TopicEditorPage({
  editor,
  onCancel,
  onSubmit,
}: {
  editor: {
    mode: "create" | "edit"
    draft: TopicDraft
    topicName?: string
  }
  onCancel: () => void
  onSubmit: (draft: TopicDraft) => Promise<void>
}) {
  const [draft, setDraft] = useState(editor.draft)
  const [errors, setErrors] = useState<
    Partial<Record<keyof TopicDraft, string>>
  >({})
  const [isSaving, setIsSaving] = useState(false)

  const updateDraft = <TKey extends keyof TopicDraft>(
    key: TKey,
    value: TopicDraft[TKey]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const updateCreativeDirection = (value: string) => {
    setDraft((current) => ({
      ...current,
      description: value,
      instruction: value,
    }))
  }

  const submit = async () => {
    const nextErrors = validateTopicDraft(draft)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSaving(true)
    try {
      await onSubmit(draft)
    } finally {
      setIsSaving(false)
    }
  }

  const heading = editor.mode === "create" ? "Create Topic" : "Edit Topic"
  const subheading =
    editor.mode === "create"
      ? "Shape the world this topic explores. Every prompt will inherit it."
      : `Update ${editor.topicName ?? "this topic"} and guide future generation direction.`

  return (
    <div className="topic-editor-stage relative -mx-4 -my-4 flex min-h-[100svh] flex-col md:-mx-6">
      <div className="pointer-events-none absolute inset-0 topic-editor-vignette" />

      <div className="relative z-10 flex flex-1 items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="topic-editor-panel relative w-full max-w-3xl overflow-hidden rounded-3xl">
          <div className="topic-editor-glow topic-editor-glow-violet pointer-events-none" />
          <div className="topic-editor-glow topic-editor-glow-orange pointer-events-none" />

          <div className="relative grid gap-5 p-6 sm:p-9 lg:p-10">
            <div className="flex flex-col gap-1.5">
              <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {heading}
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground/85">
                {subheading}
              </p>
            </div>

            <Field label="Topic Name" error={errors.name}>
              <input
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                className="topic-editor-input h-11 w-full rounded-xl px-3.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-sm"
                placeholder="e.g. Travel Poster Study"
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <AspectRatioPicker
                value={draft.defaultAspectRatio}
                onChange={(value) => updateDraft("defaultAspectRatio", value)}
              />

              <div className="flex flex-col gap-2">
                <label
                  className="text-sm font-semibold"
                  htmlFor="topic-enhancer-mode"
                >
                  Enhancer Mode
                </label>
                <Select
                  value={draft.enhancerMode}
                  onValueChange={(value) =>
                    updateDraft("enhancerMode", value as EnhancerMode)
                  }
                >
                  <SelectTrigger
                    id="topic-enhancer-mode"
                    className="topic-editor-input w-full"
                    aria-label="Enhancer Mode"
                  >
                    <SelectValue placeholder="Select enhancer mode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {enhancerModeOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Field
              label="Description / Topic Instruction"
              error={errors.instruction}
            >
              <Textarea
                value={draft.instruction}
                onChange={(event) => updateCreativeDirection(event.target.value)}
                rows={6}
                className="topic-editor-input min-h-32 resize-y"
                placeholder="Describe what this topic is about and the direction every generation should follow."
              />
            </Field>

            <Field label="Base Prompt Details">
              <Textarea
                value={draft.basePromptDetails}
                onChange={(event) =>
                  updateDraft("basePromptDetails", event.target.value)
                }
                rows={6}
                className="topic-editor-input min-h-32 resize-y"
              />
            </Field>

            <div className="mt-2 flex items-center justify-between border-t border-border/35 pt-5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
              >
                <ArrowLeft data-icon="inline-start" />
                Back
              </Button>
              <Button
                type="button"
                size="default"
                disabled={isSaving}
                onClick={submit}
                className="min-w-32"
              >
                {isSaving ? (
                  <Loader2 className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Pencil data-icon="inline-start" />
                )}
                Save Topic
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AspectRatioPicker({
  value,
  onChange,
}: {
  value: AspectRatio
  onChange: (value: AspectRatio) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-semibold" htmlFor="topic-aspect-ratio">
        Aspect ratio
      </label>
      <Select
        value={value}
        onValueChange={(nextValue) => onChange(nextValue as AspectRatio)}
      >
        <SelectTrigger
          id="topic-aspect-ratio"
          className="topic-editor-input w-full"
          aria-label="Aspect ratio"
        >
          <SelectValue placeholder="Select aspect ratio" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {aspectRatioOptions.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label} {option.description}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold">{label}</span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs text-destructive">{error}</span>
      ) : null}
    </label>
  )
}
