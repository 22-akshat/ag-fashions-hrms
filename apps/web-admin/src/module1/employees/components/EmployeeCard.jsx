import { User } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

export function EmployeeCard({ employee, deviceCount = 0, onOpen, className }) {
  return (
    <Card
      className={cn(
        'cursor-pointer border-border/80 shadow-sm transition hover:border-primary/40 hover:shadow-md',
        className,
      )}
      onClick={() => onOpen?.(employee)}
    >
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar className="h-12 w-12">
          <AvatarImage src={employee.personel_image} alt="" />
          <AvatarFallback>
            <User className="h-6 w-6 text-muted-foreground" aria-hidden />
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-foreground">
            {employee.full_name || 'Unnamed employee'}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            Card: {employee.card_no || '—'}
          </p>
          <p className="truncate text-sm text-muted-foreground">
            Department: {employee.department || '—'}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            Face: {employee.face_registered ? 'Registered' : 'Not registered'} · Devices bound:{' '}
            {Number(deviceCount) || 0}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

