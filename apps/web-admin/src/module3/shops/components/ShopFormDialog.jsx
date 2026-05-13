import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { validateShopPayload } from '@/module3/shops/lib/shopValidation'

const emptyForm = () => ({
  name: '',
  lat: '',
  lng: '',
  radius_meters: '200',
  is_active: true,
})

export function ShopFormDialog({ open, mode, shop, onOpenChange, onSubmit, submitting }) {
  const [form, setForm] = useState(emptyForm)
  const [localError, setLocalError] = useState('')

  useEffect(() => {
    if (!open) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form when dialog opens / shop changes
    setLocalError('')
    if (mode === 'edit' && shop) {
      setForm({
        name: shop.name ?? '',
        lat: String(shop.lat ?? ''),
        lng: String(shop.lng ?? ''),
        radius_meters: String(shop.radius_meters ?? 200),
        is_active: Boolean(shop.is_active),
      })
    } else {
      setForm(emptyForm())
    }
  }, [open, mode, shop])

  function handleSubmit(e) {
    e.preventDefault()
    const v = validateShopPayload({
      name: form.name,
      lat: form.lat,
      lng: form.lng,
      radius_meters: form.radius_meters,
      is_active: form.is_active,
    })
    if (!v.ok) {
      setLocalError(v.message)
      return
    }
    setLocalError('')
    onSubmit?.(v.payload)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg rounded-3xl border-[#d2e4eb] bg-[#fbfeff]">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? 'Edit shop' : 'Create shop'}</DialogTitle>
          <DialogDescription>
            Geofence uses latitude, longitude, and radius (meters). Mobile attendance reads these values from
            Supabase.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="shop-name">Name</Label>
            <Input
              id="shop-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-xl border-[#d5e6ed]"
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="shop-lat">Latitude</Label>
              <Input
                id="shop-lat"
                inputMode="decimal"
                value={form.lat}
                onChange={(e) => setForm((f) => ({ ...f, lat: e.target.value }))}
                className="rounded-xl border-[#d5e6ed]"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="shop-lng">Longitude</Label>
              <Input
                id="shop-lng"
                inputMode="decimal"
                value={form.lng}
                onChange={(e) => setForm((f) => ({ ...f, lng: e.target.value }))}
                className="rounded-xl border-[#d5e6ed]"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="shop-radius">Radius (meters)</Label>
            <Input
              id="shop-radius"
              inputMode="numeric"
              value={form.radius_meters}
              onChange={(e) => setForm((f) => ({ ...f, radius_meters: e.target.value }))}
              className="rounded-xl border-[#d5e6ed]"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              id="shop-active"
              type="checkbox"
              className="h-4 w-4 rounded border-[#cbd5e1]"
              checked={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
            />
            <Label htmlFor="shop-active" className="font-normal">
              Shop is active (inactive shops stay in DB but can be excluded from mobile defaults)
            </Label>
          </div>
          {localError ? <p className="text-sm text-destructive">{localError}</p> : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting} className="bg-[#2e7ca0] hover:bg-[#256f8f]">
              {submitting ? 'Saving…' : mode === 'edit' ? 'Save changes' : 'Create shop'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
