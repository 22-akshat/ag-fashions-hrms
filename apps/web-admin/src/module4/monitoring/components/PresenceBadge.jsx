import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export function PresenceBadge({ known, inside, className }) {
  if (!known) {
    return (
      <Badge variant="secondary" className={cn(className)}>
        No GPS
      </Badge>
    )
  }
  if (inside) {
    return (
      <Badge className={cn('bg-[#dcf5e6] text-[#2d8a58]', className)}>Inside</Badge>
    )
  }
  return (
    <Badge className={cn('bg-[#ffe2df] text-[#bf4d47]', className)}>Outside</Badge>
  )
}
