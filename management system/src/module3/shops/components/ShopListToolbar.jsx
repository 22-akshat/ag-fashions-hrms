import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export function ShopListToolbar({
  search,
  onSearchChange,
  filter,
  onFilterChange,
  onAddClick,
  disabled,
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
      <div className="relative min-w-0 flex-1 sm:max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8aa3b5]" />
        <Input
          type="search"
          placeholder="Search by shop name…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          disabled={disabled}
          className="h-10 rounded-xl border-[#d5e6ed] bg-white pl-9"
          aria-label="Search shops"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={onFilterChange} disabled={disabled}>
          <SelectTrigger className="h-10 w-[160px] rounded-xl border-[#d5e6ed] bg-white">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All shops</SelectItem>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="inactive">Inactive only</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="button"
          onClick={onAddClick}
          disabled={disabled}
          className="h-10 rounded-xl bg-gradient-to-r from-[#2e7ca0] to-[#5faecf] font-semibold text-white"
        >
          <Plus className="mr-1 h-4 w-4" />
          Add shop
        </Button>
      </div>
    </div>
  )
}
