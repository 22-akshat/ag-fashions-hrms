import { DayPicker } from 'react-day-picker'
import 'react-day-picker/style.css'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

function Calendar({ className, showOutsideDays = true, components, ...props }) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        root: cn('rdp-root'),
        months: cn('relative flex gap-6'),
        month: cn('space-y-3'),
        month_caption: cn('flex h-10 items-center justify-center px-1'),
        caption_label: cn('text-sm font-medium'),
        nav: cn(
          'absolute inset-x-0 top-3 flex justify-between [&_svg]:opacity-75 [&_button:hover_svg]:opacity-100',
        ),
        button_previous: cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-7 w-7 z-10 opacity-85'),
        button_next: cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'h-7 w-7 z-10 opacity-85'),
        month_grid: cn('w-full caption-bottom border-collapse'),
        weekdays: cn('flex w-full gap-1'),
        weekday: cn('w-10 text-[0.8rem] font-normal text-muted-foreground'),
        weeks: cn('mt-3'),
        week: cn('mt-2 flex gap-1'),
        day: cn('relative rounded-md'),
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'h-9 w-10 p-0 font-normal [&[data-selected-single=true]]:bg-accent [&[data-selected-single=true]]:text-accent-foreground',
        ),
        selected: cn('bg-accent text-accent-foreground rounded-md'),
        today: cn('bg-accent/15 text-accent font-semibold rounded-md'),
        outside: cn('text-muted-foreground opacity-50'),
        disabled: cn('text-muted-foreground opacity-40'),
        hidden: cn('invisible'),
      }}
      components={{
        Chevron: ({ orientation, className: chClass, ...rest }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('size-4', chClass)} {...rest} />
          ) : (
            <ChevronRight className={cn('size-4', chClass)} {...rest} />
          ),
        ...components,
      }}
      {...props}
    />
  )
}

export { Calendar }
