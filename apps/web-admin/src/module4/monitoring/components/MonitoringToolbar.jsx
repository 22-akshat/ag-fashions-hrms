import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function MonitoringToolbar({
  search,
  onSearchChange,
  freshnessFilter,
  onFreshnessFilterChange,
  presenceFilter,
  onPresenceFilterChange,
  disabled,
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
      <div className="relative min-w-0 flex-1 lg:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa3b5]" />
        <Input
          type="search"
          placeholder="Search name or card no…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className="h-10 rounded-xl border-[#d5e6ed] bg-white pl-9"
          aria-label="Search employees"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Select value={freshnessFilter} onValueChange={onFreshnessFilterChange} disabled={disabled}>
          <SelectTrigger className="h-10 w-[160px] rounded-xl border-[#d5e6ed] bg-white">
            <SelectValue placeholder="GPS status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All GPS states</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="stale">Stale</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
        <Select value={presenceFilter} onValueChange={onPresenceFilterChange} disabled={disabled}>
          <SelectTrigger className="h-10 w-[160px] rounded-xl border-[#d5e6ed] bg-white">
            <SelectValue placeholder="Shop" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All presence</SelectItem>
            <SelectItem value="inside">Inside shop</SelectItem>
            <SelectItem value="outside">Outside shop</SelectItem>
            <SelectItem value="unknown">No GPS / unknown</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
