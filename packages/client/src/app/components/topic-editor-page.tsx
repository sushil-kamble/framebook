import { useState } from "react"
import { Loader2, Pencil } from "lucide-react"
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
  editor: { mode: "create" | "edit"; draft: TopicDraft }
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

  return (
    <div className="mx-auto flex w-full max-w-180 min-w-0 flex-col gap-6">
      <header className="flex flex-col gap-3 border-b border-border/60 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xs font-medium text-muted-foreground/60">
            Topics <span className="opacity-60">/</span>{" "}
            {editor.mode === "create" ? "New Topic" : "Edit Topic"}
          </div>
          <h2 className="mt-1.5 font-heading text-2xl font-bold tracking-tight">
            {editor.mode === "create" ? "Create Topic" : "Edit Topic"}
          </h2>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" size="sm" disabled={isSaving} onClick={submit}>
            {isSaving ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : (
              <Pencil data-icon="inline-start" />
            )}
            Save Topic
          </Button>
        </div>
      </header>

      <section className="grid gap-4">
        <div>
          <FormSection title="Topic Brief">
            <div className="flex flex-col gap-4">
              <Field label="Topic Name" error={errors.name}>
                <input
                  value={draft.name}
                  onChange={(event) => updateDraft("name", event.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-input px-3.5 text-base transition-[background-color,box-shadow,border-color] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-sm"
                  placeholder="e.g. Travel Poster Study"
                />
              </Field>

              <Field
                label="Description / Topic Instruction"
                error={errors.instruction}
              >
                <Textarea
                  value={draft.instruction}
                  onChange={(event) =>
                    updateCreativeDirection(event.target.value)
                  }
                  rows={5}
                  className="min-h-32 resize-y"
                  placeholder="Describe what this topic is about and the direction every generation should follow."
                />
              </Field>
            </div>
          </FormSection>
        </div>

        <aside className="flex flex-col gap-4">
          <FormSection title="Generation Defaults">
            <div className="flex flex-col gap-4">
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
                      className="w-full"
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

              <Field label="Base Prompt Details">
                <Textarea
                  value={draft.basePromptDetails}
                  onChange={(event) =>
                    updateDraft("basePromptDetails", event.target.value)
                  }
                  rows={6}
                  className="min-h-40 resize-y"
                />
              </Field>
            </div>
          </FormSection>
        </aside>
      </section>
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
          className="w-full"
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

function FormSection({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 border-b border-border/40 pb-3">
        <h3 className="font-heading text-sm font-semibold tracking-tight">
          {title}
        </h3>
      </div>
      {children}
    </section>
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
