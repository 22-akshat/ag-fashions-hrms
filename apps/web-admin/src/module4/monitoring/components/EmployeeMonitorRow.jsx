import { memo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { LiveStatusBadge } from '@/module4/monitoring/components/LiveStatusBadge'
import { PresenceBadge } from '@/module4/monitoring/components/PresenceBadge'

function formatTime(iso) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return '—'
  }
}

function EmployeeMonitorRowInner({ row }) {
  const { employee, location, freshness, referenceShop, presence, outsideAlert, distanceMeters } = row
  const name = employee.full_name || 'Unnamed'
  const card = employee.card_no || '—'
  const shopLabel = referenceShop?.name?.trim() || '—'
  const dist =
    distanceMeters != null && Number.isFinite(distanceMeters) ? `${Math.round(distanceMeters)} m` : '—'

  return (
    <tr
      className={
        outsideAlert
          ? 'bg-[#fff5f5] transition-colors hover:bg-[#ffecec]'
          : 'transition-colors hover:bg-[#f8fcfe]'
      }
    >
      <td className="px-4 py-3">
        <div className="flex items-start gap-2">
          {outsideAlert ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#dc2626]" aria-label="Outside geofence" />
          ) : (
            <span className="w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-[#193250]">{name}</p>
            <p className="text-xs text-muted-foreground">Card {card}</p>
          </div>
        </div>
      </td>
      <td className="hidden px-4 py-3 sm:table-cell">
        <LiveStatusBadge status={freshness} />
      </td>
      <td className="px-4 py-3">
        <PresenceBadge known={presence.known} inside={presence.inside} />
      </td>
      <td className="hidden px-4 py-3 text-sm text-[#4a6b82] md:table-cell">
        <p className="truncate" title={shopLabel}>
          {shopLabel}
        </p>
        <p className="text-xs text-muted-foreground">{dist}</p>
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        <span className="sm:hidden">
          <LiveStatusBadge status={freshness} className="mb-1" />
        </span>
        {formatTime(location?.recorded_at)}
      </td>
      <td className="hidden px-4 py-3 font-mono text-xs text-[#4a6b82] lg:table-cell">
        {location ? `${Number(location.lat).toFixed(5)}, ${Number(location.lng).toFixed(5)}` : '—'}
      </td>
    </tr>
  )
}

function propsEqual(prev, next) {
  const a = prev.row
  const b = next.row
  return (
    a.employee?.id === b.employee?.id &&
    a.freshness === b.freshness &&
    a.outsideAlert === b.outsideAlert &&
    a.location?.recorded_at === b.location?.recorded_at &&
    a.location?.lat === b.location?.lat &&
    a.location?.lng === b.location?.lng &&
    a.presence?.inside === b.presence?.inside &&
    a.presence?.known === b.presence?.known &&
    a.distanceMeters === b.distanceMeters &&
    a.referenceShop?.id === b.referenceShop?.id &&
    a.referenceShop?.radius_meters === b.referenceShop?.radius_meters &&
    a.assignedShopId === b.assignedShopId &&
    a.nearestShop?.id === b.nearestShop?.id
  )
}

export const EmployeeMonitorRow = memo(EmployeeMonitorRowInner, propsEqual)
