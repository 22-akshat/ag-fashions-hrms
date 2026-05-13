import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const STYLES = {
  critical: 'bg-[#ffe2df] text-[#b91c1c] ring-1 ring-[#f0a6a2]',
  warning: 'bg-[#fff2d9] text-[#b07621] ring-1 ring-[#eac98c]',
  info: 'bg-[#e0efff] text-[#3967b4] ring-1 ring-[#aac5ef]',
}

export function AlertSeverityBadge({ severity, className }) {
  const label = severity === 'critical' ? 'Critical' : severity === 'warning' ? 'Warning' : 'Info'
  return (
    <Badge className={cn('text-[10px] font-bold uppercase tracking-wide', STYLES[severity] ?? STYLES.info, className)}>
      {label}
    </Badge>
  )
}
