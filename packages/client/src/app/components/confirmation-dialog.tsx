import { Loader2 } from "lucide-react"
import { useState } from "react"
import type { ReactNode } from "react"
import { Button } from "@/shared/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog"

export function ConfirmationDialog({
  trigger,
  title,
  description,
  confirmLabel,
  isPending = false,
  onConfirm,
}: {
  trigger: ReactNode
  title: string
  description: ReactNode
  confirmLabel: string
  isPending?: boolean
  onConfirm: () => Promise<void> | void
}) {
  const [open, setOpen] = useState(false)
  const [isConfirming, setIsConfirming] = useState(false)
  const isBusy = isPending || isConfirming

  const confirm = async () => {
    setIsConfirming(true)
    try {
      await onConfirm()
      setOpen(false)
    } finally {
      setIsConfirming(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={isBusy ? undefined : setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline" disabled={isBusy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            variant="destructive"
            disabled={isBusy}
            onClick={() => void confirm()}
          >
            {isBusy ? (
              <Loader2 className="animate-spin" data-icon="inline-start" />
            ) : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
