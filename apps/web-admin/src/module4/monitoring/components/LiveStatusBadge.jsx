import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STYLES = {
  online: 'bg-[#dcf5e6] text-[#2d8a58] ring-1 ring-[#9fd6b4]',
  stale: 'bg-[#fff2d9] text-[#b07621] ring-1 ring-[#eac98c]',
  offline: 'bg-muted text-muted-foreground ring-1 ring-border',
}

export function LiveStatusBadge({ status, className }) {
  const label = status === 'online' ? 'Online' : status === 'stale' ? 'Stale' : 'Offline'
  return (
    <Badge className={cn('font-semibold uppercase tracking-wide', STYLES[status] ?? STYLES.offline, className)}>
      {label}
    </Badge>
  )
}
