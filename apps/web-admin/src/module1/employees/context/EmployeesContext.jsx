/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { DEMO_EMPLOYEES } from '@/module1/employees/data/demoEmployees'
import { createEmptyEmployee } from '@/module1/employees/lib/employeeFields'
import { isSupabaseConfigured, supabase } from '@/module1/employees/lib/supabase/client'
import { rowToEmployee } from '@/module1/employees/lib/supabase/mapEmployee'
import {
  bulkInsertEmployees,
  deleteEmployeeRow,
  insertEmployee,
  listEmployees,
  updateEmployeeRow,
} from '@/module1/employees/lib/supabase/employeesApi'

const EmployeesContext = createContext(null)

function genEmpId() {
  return crypto.randomUUID?.() ?? `emp-${Date.now().toString(36)}`
}

export function EmployeesProvider({ children }) {
  const remote = isSupabaseConfigured()

  const [employees, setEmployees] = useState(() => (remote ? [] : [...DEMO_EMPLOYEES]))
  const [loading, setLoading] = useState(remote)
  const [loadError, setLoadError] = useState(/** @type {string | null} */ (null))

  const refresh = useCallback(async () => {
    if (!remote) return
    setLoading(true)
    setLoadError(null)
    try {
      const list = await listEmployees()
      setEmployees(list)
    } catch (e) {
      setLoadError(String(e?.message ?? e))
    } finally {
      setLoading(false)
    }
  }, [remote])

  useEffect(() => {
    if (!remote) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async Supabase bootstrap (handled inside refresh)
    void refresh()

    if (!supabase) return

    const channel = supabase
      .channel('employees-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'employees' }, (payload) => {
        const type = payload?.eventType
        if (type === 'INSERT') {
          const next = rowToEmployee(payload.new ?? {})
          setEmployees((prev) => [next, ...prev.filter((e) => e.id !== next.id)])
          return
        }

        if (type === 'UPDATE') {
          const next = rowToEmployee(payload.new ?? {})
          setEmployees((prev) => prev.map((e) => (e.id === next.id ? next : e)))
          return
        }

        if (type === 'DELETE') {
          const deletedId = payload?.old?.id != null ? String(payload.old.id) : ''
          if (!deletedId) return
          setEmployees((prev) => prev.filter((e) => e.id !== deletedId))
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [remote, refresh])

  const addEmployee = useCallback(
    async (payload) => {
      const normalizedPayload = {
        ...payload,
        status: String(payload.last_interview_date ?? '').trim() ? payload.status : 'Active',
      }
      if (!remote) {
        const id = genEmpId()
        setEmployees((prev) => [
          {
            ...createEmptyEmployee(id),
            ...normalizedPayload,
            id,
            created_date: normalizedPayload.created_date ?? new Date().toISOString().slice(0, 10),
            date_of_interview:
              normalizedPayload.date_of_interview ?? new Date().toISOString().slice(0, 10),
          },
          ...prev,
        ])
        return id
      }

      const created = await insertEmployee(normalizedPayload)
      setEmployees((prev) => [created, ...prev.filter((e) => e.id !== created.id)])
      return created.id
    },
    [remote],
  )

  const updateEmployee = useCallback(
    async (id, payload) => {
      const normalizedPayload = {
        ...payload,
        status: String(payload.last_interview_date ?? '').trim() ? payload.status : 'Active',
      }
      if (!remote) {
        setEmployees((prev) =>
          prev.map((e) => (e.id === id ? { ...e, ...normalizedPayload, id: e.id } : e)),
        )
        return
      }

      const updated = await updateEmployeeRow(id, normalizedPayload)
      setEmployees((prev) => prev.map((e) => (e.id === id ? updated : e)))
    },
    [remote],
  )

  const deleteEmployee = useCallback(
    async (id) => {
      if (!remote) {
        setEmployees((prev) => prev.filter((e) => e.id !== id))
        return
      }

      await deleteEmployeeRow(id)
      setEmployees((prev) => prev.filter((e) => e.id !== id))
    },
    [remote],
  )

  const importEmployeesBulk = useCallback(
    async (snakeRows) => {
      if (!remote) {
        const mapped = snakeRows.map((r) => rowToEmployee(r))
        setEmployees((prev) => [...mapped, ...prev])
        return mapped.length
      }

      await bulkInsertEmployees(snakeRows)
      await refresh()
      return snakeRows.length
    },
    [remote, refresh],
  )

  const value = useMemo(
    () => ({
      employees,
      loading,
      loadError,
      refresh,
      remote,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      importEmployeesBulk,
    }),
    [
      employees,
      loading,
      loadError,
      refresh,
      remote,
      addEmployee,
      updateEmployee,
      deleteEmployee,
      importEmployeesBulk,
    ],
  )

  return <EmployeesContext.Provider value={value}>{children}</EmployeesContext.Provider>
}

export function useEmployees() {
  const ctx = useContext(EmployeesContext)
  if (!ctx) {
    throw new Error('useEmployees must be used within EmployeesProvider')
  }
  return ctx
}

