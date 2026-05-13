import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const TYPES = [
  { value: 'all', label: 'All types' },
  { value: 'outside_geofence', label: 'Outside geofence' },
  { value: 'gps_stale', label: 'GPS stale' },
  { value: 'device_offline', label: 'Device offline' },
  { value: 'rapid_movement', label: 'Rapid movement' },
  { value: 'missing_gps', label: 'Missing GPS' },
  { value: 'shop_mismatch', label: 'Shop mismatch' },
]

export function AlertFiltersToolbar({
  search,
  onSearchChange,
  severity,
  onSeverityChange,
  type,
  onTypeChange,
  disabled,
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa3b5]" />
        <Input
          type="search"
          placeholder="Search employee or alert text…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className="h-10 rounded-xl border-[#d5e6ed] bg-white pl-9"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={severity} onValueChange={onSeverityChange} disabled={disabled}>
          <SelectTrigger className="h-10 w-[140px] rounded-xl border-[#d5e6ed] bg-white">
            <SelectValue placeholder="Severity" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="critical">Critical</SelectItem>
            <SelectItem value="warning">Warning</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Select value={type} onValueChange={onTypeChange} disabled={disabled}>
          <SelectTrigger className="h-10 w-[200px] rounded-xl border-[#d5e6ed] bg-white">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
