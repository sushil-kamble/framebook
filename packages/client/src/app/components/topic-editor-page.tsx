import { useEffect, useRef, useState } from "react"
import { ArrowLeft, ImagePlus, Loader2, Pencil, X } from "lucide-react"
import { useDropzone } from "react-dropzone"
import { validateTopicDraft } from "@app/lib/topic-form"
import { aspectRatioOptions } from "../lib/constants"
import {
  referenceImageConfig,
  referenceImageDropErrorMessage,
  referenceImageDropzoneAccept,
} from "../lib/reference-images"
import {
  createClientId,
  createObjectUrl,
  revokeObjectUrl,
  topicReferenceImageUrl,
} from "../lib/utils"
import { AppBreadcrumb } from "./app-breadcrumb"
import { ReferenceImageDropOverlay } from "./reference-image-drop-overlay"
import type { ReactNode } from "react"
import type { DropzoneState } from "react-dropzone"
import type {
  AspectRatio,
  ReferenceImage,
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

interface PendingReferenceImage {
  id: string
  file: File
  previewUrl: string
}

export function TopicEditorPage({
  editor,
  onCancel,
  onTopicsClick,
  onTopicClick,
  onDraftChange,
  onReferenceImageError,
  onAddReferenceImages,
  onRemoveReferenceImage,
  onSubmit,
}: {
  editor: {
    mode: "create" | "edit"
    draft: TopicDraft
    topicId?: string
    topicName?: string
    referenceImages?: Array<ReferenceImage>
  }
  onCancel: () => void
  onTopicsClick: () => void
  onTopicClick: () => void
  onDraftChange?: (draft: TopicDraft) => void
  onReferenceImageError: (message: string) => void
  onAddReferenceImages: (topicId: string, files: Array<File>) => Promise<void>
  onRemoveReferenceImage: (
    topicId: string,
    referenceImageId: string
  ) => Promise<void>
  onSubmit: (draft: TopicDraft, referenceFiles: Array<File>) => Promise<void>
}) {
  const [draft, setDraft] = useState(editor.draft)
  const [errors, setErrors] = useState<
    Partial<Record<keyof TopicDraft, string>>
  >({})
  const [isSaving, setIsSaving] = useState(false)
  const [isMutatingReferences, setIsMutatingReferences] = useState(false)
  const [pendingReferences, setPendingReferences] = useState<
    Array<PendingReferenceImage>
  >([])
  const pendingReferencesRef = useRef(pendingReferences)
  const existingReferenceImages = editor.referenceImages ?? []
  const referenceCount =
    existingReferenceImages.length + pendingReferences.length
  const availableReferenceSlots = referenceImageConfig.maxFiles - referenceCount
  const referenceImageDropzone = useDropzone({
    accept: referenceImageDropzoneAccept,
    disabled: availableReferenceSlots <= 0 || isMutatingReferences || isSaving,
    maxFiles: Math.max(1, availableReferenceSlots),
    maxSize: referenceImageConfig.maxBytes,
    multiple: true,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: (files) => {
      void addReferenceImages(files)
    },
    onDropRejected: (rejections) => {
      onReferenceImageError(referenceImageDropErrorMessage(rejections))
    },
  })

  useEffect(() => {
    if (editor.mode === "create") {
      onDraftChange?.(draft)
    }
  }, [draft, editor.mode, onDraftChange])

  useEffect(() => {
    pendingReferencesRef.current = pendingReferences
  }, [pendingReferences])

  useEffect(
    () => () => {
      for (const referenceImage of pendingReferencesRef.current) {
        revokeObjectUrl(referenceImage.previewUrl)
      }
    },
    []
  )

  const updateDraft = <TKey extends keyof TopicDraft>(
    key: TKey,
    value: TopicDraft[TKey]
  ) => {
    setDraft((current) => ({ ...current, [key]: value }))
  }

  const addReferenceImages = async (files: Array<File>) => {
    if (files.length === 0) {
      return
    }

    if (files.length > availableReferenceSlots) {
      onReferenceImageError(
        `You can attach up to ${referenceImageConfig.maxFiles} images`
      )
    }

    const selectedFiles = files.slice(0, Math.max(0, availableReferenceSlots))
    if (selectedFiles.length === 0) {
      return
    }

    if (editor.mode === "edit" && editor.topicId) {
      setIsMutatingReferences(true)
      try {
        await onAddReferenceImages(editor.topicId, selectedFiles)
      } finally {
        setIsMutatingReferences(false)
      }
      return
    }

    setPendingReferences((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: createClientId(),
        file,
        previewUrl: createObjectUrl(file),
      })),
    ])
  }

  const removePendingReferenceImage = (referenceImageId: string) => {
    setPendingReferences((current) => {
      const removed = current.find(
        (referenceImage) => referenceImage.id === referenceImageId
      )
      if (removed) {
        revokeObjectUrl(removed.previewUrl)
      }

      return current.filter(
        (referenceImage) => referenceImage.id !== referenceImageId
      )
    })
  }

  const removeExistingReferenceImage = async (referenceImageId: string) => {
    if (!editor.topicId) {
      return
    }

    setIsMutatingReferences(true)
    try {
      await onRemoveReferenceImage(editor.topicId, referenceImageId)
    } finally {
      setIsMutatingReferences(false)
    }
  }

  const submit = async () => {
    const nextErrors = validateTopicDraft(draft)
    setErrors(nextErrors)

    if (Object.keys(nextErrors).length > 0) {
      return
    }

    setIsSaving(true)
    try {
      await onSubmit(
        draft,
        pendingReferences.map((referenceImage) => referenceImage.file)
      )
    } finally {
      setIsSaving(false)
    }
  }

  const heading = editor.mode === "create" ? "Create Topic" : "Edit Topic"
  const isReferenceImageDragActive =
    referenceImageDropzone.isDragActive ||
    isDropzoneGloballyActive(referenceImageDropzone)
  const breadcrumbItems =
    editor.mode === "create"
      ? [{ label: "Topics", onClick: onTopicsClick }, { label: heading }]
      : [
          { label: "Topics", onClick: onTopicsClick },
          {
            label: editor.topicName ?? "Topic",
            onClick: onTopicClick,
          },
          { label: heading },
        ]

  return (
    <div
      {...referenceImageDropzone.getRootProps({
        "aria-label": "Topic reference image dropzone",
        "data-testid": "topic-editor-dropzone",
        className: "topic-editor-stage relative flex min-h-svh flex-col",
      })}
    >
      <input {...referenceImageDropzone.getInputProps()} />
      {isReferenceImageDragActive ? (
        <ReferenceImageDropOverlay
          isRejecting={referenceImageDropzone.isDragReject}
          body="Drop it anywhere to add it to this topic."
        />
      ) : null}
      <div className="topic-editor-vignette pointer-events-none absolute inset-0" />

      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/92 px-5 py-4 shadow-sm backdrop-blur-sm sm:px-10 lg:px-14">
        <AppBreadcrumb items={breadcrumbItems} />
      </header>

      <div className="relative z-10 flex flex-1 items-center justify-center p-5 sm:p-10 lg:p-14">
        <div className="topic-editor-panel relative w-full max-w-3xl overflow-hidden rounded-3xl">
          <div className="topic-editor-glow topic-editor-glow-violet pointer-events-none" />
          <div className="topic-editor-glow topic-editor-glow-orange pointer-events-none" />

          <div className="relative grid gap-5 p-6 sm:p-9 lg:p-10">
            <Field label="Topic Name" error={errors.name}>
              <input
                value={draft.name}
                onChange={(event) => updateDraft("name", event.target.value)}
                className="topic-editor-input h-11 w-full rounded-xl px-3.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/20 md:text-sm"
                placeholder="e.g. Travel Poster Study"
              />
            </Field>

            <AspectRatioPicker
              value={draft.defaultAspectRatio}
              onChange={(value) => updateDraft("defaultAspectRatio", value)}
            />

            <Field label="Base Prompt">
              <Textarea
                value={draft.basePrompt}
                onChange={(event) =>
                  updateDraft("basePrompt", event.target.value)
                }
                rows={6}
                className="topic-editor-input min-h-32 resize-y"
                placeholder="Add reusable base prompt text, style notes, constraints, or recurring elements for this topic."
              />
            </Field>

            <ReferenceImageManager
              topicId={editor.topicId}
              existingReferenceImages={existingReferenceImages}
              pendingReferences={pendingReferences}
              isBusy={isMutatingReferences || isSaving}
              availableReferenceSlots={availableReferenceSlots}
              onOpen={referenceImageDropzone.open}
              onRemoveExistingReferenceImage={(referenceImageId) => {
                void removeExistingReferenceImage(referenceImageId)
              }}
              onRemovePendingReferenceImage={removePendingReferenceImage}
            />

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
                disabled={isSaving || isMutatingReferences}
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

function ReferenceImageManager({
  topicId,
  existingReferenceImages,
  pendingReferences,
  isBusy,
  availableReferenceSlots,
  onOpen,
  onRemoveExistingReferenceImage,
  onRemovePendingReferenceImage,
}: {
  topicId?: string
  existingReferenceImages: Array<ReferenceImage>
  pendingReferences: Array<PendingReferenceImage>
  isBusy: boolean
  availableReferenceSlots: number
  onOpen: () => void
  onRemoveExistingReferenceImage: (referenceImageId: string) => void
  onRemovePendingReferenceImage: (referenceImageId: string) => void
}) {
  const hasReferences =
    existingReferenceImages.length > 0 || pendingReferences.length > 0

  return (
    <section className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">Reference Images</div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={availableReferenceSlots <= 0 || isBusy}
          onClick={onOpen}
        >
          <ImagePlus data-icon="inline-start" />
          Add
        </Button>
      </div>
      <div className="min-h-28 rounded-xl border border-dashed border-border/60 bg-background/45 p-3 transition-colors">
        {hasReferences ? (
          <div className="flex flex-wrap gap-2">
            {existingReferenceImages.map((referenceImage) => (
              <ReferenceImageTile
                key={referenceImage.id}
                src={
                  topicId
                    ? topicReferenceImageUrl(topicId, referenceImage.id)
                    : ""
                }
                name={referenceImage.originalName}
                width={referenceImage.width}
                height={referenceImage.height}
                disabled={isBusy}
                onRemove={() =>
                  onRemoveExistingReferenceImage(referenceImage.id)
                }
              />
            ))}
            {pendingReferences.map((referenceImage) => (
              <ReferenceImageTile
                key={referenceImage.id}
                src={referenceImage.previewUrl}
                name={referenceImage.file.name}
                disabled={isBusy}
                onRemove={() =>
                  onRemovePendingReferenceImage(referenceImage.id)
                }
              />
            ))}
          </div>
        ) : (
          <button
            type="button"
            className="flex min-h-20 w-full items-center justify-center rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/40"
            disabled={availableReferenceSlots <= 0 || isBusy}
            onClick={onOpen}
          >
            <ImagePlus className="mr-2 size-4" />
            Add reference images
          </button>
        )}
      </div>
    </section>
  )
}

function ReferenceImageTile({
  src,
  name,
  width,
  height,
  disabled,
  onRemove,
}: {
  src: string
  name: string
  width?: number
  height?: number
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <div
      className="relative size-20 overflow-hidden rounded-xl border border-border/50 bg-muted"
      title={name}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          width={width}
          height={height}
          className="size-full object-cover"
        />
      ) : null}
      <Button
        type="button"
        variant="secondary"
        size="icon-xs"
        className="absolute top-1 right-1"
        disabled={disabled}
        aria-label={`Remove ${name}`}
        onClick={onRemove}
      >
        <X data-icon="inline-start" />
      </Button>
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

function isDropzoneGloballyActive(dropzone: DropzoneState) {
  return dropzone.isDragGlobal
}
