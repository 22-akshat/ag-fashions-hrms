import { useMemo, useState } from 'react'
import { Loader2, Radio, Store } from 'lucide-react'
import { DeleteShopDialog } from '@/module3/shops/components/DeleteShopDialog'
import { ShopFormDialog } from '@/module3/shops/components/ShopFormDialog'
import { ShopListToolbar } from '@/module3/shops/components/ShopListToolbar'
import { ShopTable } from '@/module3/shops/components/ShopTable'
import { useShops } from '@/module3/shops/hooks/useShops'
import { createShop, deleteShop, setShopActive, updateShop } from '@/module3/shops/lib/shopsApi'
import { formatSupabaseError } from '@/module1/employees/lib/supabase/errors'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

function matchesFilter(shop, filter) {
  if (filter === 'active') return shop.is_active
  if (filter === 'inactive') return !shop.is_active
  return true
}

function matchesSearch(shop, q) {
  if (!q.trim()) return true
  return String(shop.name ?? '')
    .toLowerCase()
    .includes(q.trim().toLowerCase())
}

export function ShopsPage() {
  const { shops, loading, error, refresh, remote, realtimeStatus } = useShops()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [formMode, setFormMode] = useState(/** @type {'create'|'edit'} */ ('create'))
  const [editingShop, setEditingShop] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [busyId, setBusyId] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [deleteSubmitting, setDeleteSubmitting] = useState(false)

  const filteredShops = useMemo(() => {
    return shops.filter((s) => matchesFilter(s, filter) && matchesSearch(s, search))
  }, [shops, filter, search])

  const liveLabel =
    realtimeStatus === 'subscribed'
      ? { variant: 'success', text: 'Realtime connected' }
      : realtimeStatus === 'error'
        ? { variant: 'destructive', text: 'Realtime error' }
        : { variant: 'secondary', text: 'Realtime idle' }

  function openCreate() {
    setFormMode('create')
    setEditingShop(null)
    setFormOpen(true)
  }

  function openEdit(shop) {
    setFormMode('edit')
    setEditingShop(shop)
    setFormOpen(true)
  }

  async function handleFormSubmit(payload) {
    setFormSubmitting(true)
    try {
      if (formMode === 'create') {
        await createShop(payload)
        toast({ title: 'Shop created', description: payload.name })
      } else if (editingShop) {
        await updateShop(editingShop.id, payload)
        toast({ title: 'Shop updated', description: payload.name })
      }
      setFormOpen(false)
    } catch (e) {
      toast({
        title: 'Could not save shop',
        description: formatSupabaseError(e),
        variant: 'destructive',
      })
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleToggle(shop) {
    setBusyId(shop.id)
    try {
      await setShopActive(shop.id, !shop.is_active)
      toast({
        title: shop.is_active ? 'Shop deactivated' : 'Shop activated',
        description: shop.name,
      })
    } catch (e) {
      toast({
        title: 'Update failed',
        description: formatSupabaseError(e),
        variant: 'destructive',
      })
    } finally {
      setBusyId('')
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    setDeleteSubmitting(true)
    try {
      await deleteShop(deleteTarget.id)
      toast({ title: 'Shop deleted', description: deleteTarget.name })
      setDeleteTarget(null)
    } catch (e) {
      toast({
        title: 'Delete failed',
        description: formatSupabaseError(e),
        variant: 'destructive',
      })
    } finally {
      setDeleteSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      {remote ? (
        <p className="text-xs font-medium uppercase tracking-wide text-accent">Data source: Supabase shops</p>
      ) : null}

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 px-5 py-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#193250] md:text-3xl">Shops</h1>
            <p className="mt-1 text-sm text-[#667f97]">
              Manage store locations and geofence radii used by the attendance app and access requests.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={liveLabel.variant} className="gap-1 uppercase">
              <Radio className="h-3 w-3" />
              {liveLabel.text}
            </Badge>
            <Button type="button" variant="outline" size="sm" className="h-8" onClick={() => void refresh()}>
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void refresh()}>
            Retry
          </Button>
        </div>
      ) : null}

      <div className="rounded-3xl border border-[#d2e4eb] bg-white/95 p-4 shadow-sm">
        <ShopListToolbar
          search={search}
          onSearchChange={setSearch}
          filter={filter}
          onFilterChange={setFilter}
          onAddClick={openCreate}
          disabled={!remote || loading}
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 py-16 text-[#627f97]">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading shops…
        </div>
      ) : !remote ? (
        <div className="rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 px-6 py-14 text-center text-sm text-[#627f97]">
          <Store className="mx-auto mb-3 h-10 w-10 text-[#8ab8c7]" />
          <p className="font-medium text-[#193250]">Supabase not configured</p>
          <p className="mt-1">Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to manage shops.</p>
        </div>
      ) : filteredShops.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-[#d2e4eb] bg-white/80 px-6 py-14 text-center text-sm text-[#627f97]">
          <Store className="mx-auto mb-3 h-10 w-10 text-[#8ab8c7]" />
          <p className="font-medium text-[#193250]">No shops match your filters</p>
          <p className="mt-1">
            {shops.length === 0
              ? 'Create your first shop to enable geofence-based attendance.'
              : 'Try clearing search or changing the status filter.'}
          </p>
          {shops.length === 0 ? (
            <Button type="button" className="mt-4" onClick={openCreate}>
              Add shop
            </Button>
          ) : null}
        </div>
      ) : (
        <ShopTable
          shops={filteredShops}
          busyId={busyId}
          onEdit={openEdit}
          onToggleActive={handleToggle}
          onDelete={setDeleteTarget}
        />
      )}

      <ShopFormDialog
        open={formOpen}
        mode={formMode}
        shop={editingShop}
        onOpenChange={(open) => {
          if (!open) setFormOpen(false)
        }}
        onSubmit={handleFormSubmit}
        submitting={formSubmitting}
      />

      <DeleteShopDialog
        shop={deleteTarget}
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
        onConfirm={handleDeleteConfirm}
        deleting={deleteSubmitting}
      />
    </div>
  )
}
