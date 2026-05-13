import { EmployeeMonitorRow } from '@/module4/monitoring/components/EmployeeMonitorRow'

export function EmployeeMonitorTable({ rows }) {
  if (!rows.length) return null

  return (
    <div className="overflow-x-auto rounded-xl border border-[#d2e4eb] bg-white shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-[#edf6fb]">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-[#607b94]">Employee</th>
            <th className="hidden px-4 py-3 text-left font-semibold text-[#607b94] sm:table-cell">GPS</th>
            <th className="px-4 py-3 text-left font-semibold text-[#607b94]">Shop</th>
            <th className="hidden px-4 py-3 text-left font-semibold text-[#607b94] md:table-cell">Reference</th>
            <th className="px-4 py-3 text-left font-semibold text-[#607b94]">Last fix</th>
            <th className="hidden px-4 py-3 text-left font-semibold text-[#607b94] lg:table-cell">Coords</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e2edf2]">
          {rows.map((row) => (
            <EmployeeMonitorRow key={row.employee.id} row={row} />
          ))}
        </tbody>
      </table>
    </div>
  )
}
