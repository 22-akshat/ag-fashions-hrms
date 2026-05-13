import { MapPin, Pencil, Power, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export function ShopTable({ shops, busyId, onEdit, onToggleActive, onDelete }) {
  if (shops.length === 0) return null

  return (
    <div className="overflow-hidden rounded-xl border border-[#d2e4eb] bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-[#edf6fb]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-[#607b94]">Shop</th>
            <th className="hidden px-4 py-3 text-left font-semibold text-[#607b94] md:table-cell">Coordinates</th>
            <th className="px-4 py-3 text-left font-semibold text-[#607b94]">Radius (m)</th>
            <th className="px-4 py-3 text-left font-semibold text-[#607b94]">Status</th>
            <th className="px-4 py-3 text-right font-semibold text-[#607b94]">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2edf2]">
          {shops.map((shop) => (
            <tr key={shop.id} className="transition-colors hover:bg-[#f8fcfe]">
              <td className="px-4 py-3">
                <p className="font-medium text-[#193250]">{shop.name || '—'}</p>
                <p className="text-xs text-muted-foreground md:hidden">
                  {Number(shop.lat).toFixed(5)}, {Number(shop.lng).toFixed(5)}
                </p>
              </td>
              <td className="hidden px-4 py-3 font-mono text-xs text-[#4a6b82] md:table-cell">
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-[#5faecf]" />
                  {Number(shop.lat).toFixed(6)}, {Number(shop.lng).toFixed(6)}
                </span>
              </td>
              <td className="px-4 py-3 text-[#27445d]">{Number(shop.radius_meters).toLocaleString()}</td>
              <td className="px-4 py-3">
                {shop.is_active ? (
                  <Badge className="bg-[#dcf5e6] text-[#2d8a58] hover:bg-[#dcf5e6]">Active</Badge>
                ) : (
                  <Badge variant="secondary">Inactive</Badge>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 border-[#d5e6ed]"
                    aria-label={`Edit ${shop.name}`}
                    disabled={busyId === shop.id}
                    onClick={() => onEdit(shop)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 border-[#d5e6ed]"
                    aria-label={shop.is_active ? 'Deactivate' : 'Activate'}
                    disabled={busyId === shop.id}
                    onClick={() => onToggleActive(shop)}
                  >
                    <Power className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0 border-[#fecaca] text-[#b91c1c] hover:bg-[#fef2f2]"
                    aria-label={`Delete ${shop.name}`}
                    disabled={busyId === shop.id}
                    onClick={() => onDelete(shop)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
