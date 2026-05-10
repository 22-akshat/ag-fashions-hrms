import { format, parseISO, isValid } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export function DatePickerField({ id, value, onChange, placeholder = 'Pick a date', disabled, className }) {
  const date = value && isValid(parseISO(value)) ? parseISO(value) : undefined
  const currentYear = new Date().getFullYear()

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-9 w-full justify-start text-left font-normal',
            !date && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, 'PPP') : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto overflow-hidden p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(d) => onChange?.(d ? format(d, 'yyyy-MM-dd') : '')}
          captionLayout="dropdown"
          startMonth={new Date(currentYear - 60, 0)}
          endMonth={new Date(currentYear + 20, 11)}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  )
}
