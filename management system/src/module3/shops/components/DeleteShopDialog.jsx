import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function DeleteShopDialog({ shop, open, onOpenChange, onConfirm, deleting }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-3xl border-[#d2e4eb] bg-[#fbfeff]">
        <DialogHeader>
          <DialogTitle>Delete shop?</DialogTitle>
          <DialogDescription className="text-left">
            This will remove <span className="font-semibold text-foreground">{shop?.name || 'this shop'}</span> from
            the database. Access requests that pointed to this shop will have their store reference cleared
            (on delete set null). Mobile geofence may fall back to another shop or env coordinates—confirm before
            deleting production stores.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => onConfirm?.()}
            disabled={deleting || !shop}
          >
            {deleting ? 'Deleting…' : 'Delete shop'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
