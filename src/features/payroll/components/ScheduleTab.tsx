import { useState } from 'react'
import { CalendarDays, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/EmptyState'
import { ScheduleModal } from './ScheduleModal'
import type { StaffMember } from '@/features/settings/hooks/useTeamSettings'
import type { StaffSchedule, StaffScheduleInput } from '../types'
import type { DayKey } from '@/features/settings/types'

const DAY_ORDER: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
const DAY_SHORT: Record<DayKey, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

interface ScheduleTabProps {
  staff: StaffMember[]
  schedules: StaffSchedule[]
  onSave: (staffId: string, days: StaffScheduleInput[]) => Promise<void>
}

export function ScheduleTab({ staff, schedules, onSave }: ScheduleTabProps) {
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null)

  const editingStaff = staff.find((s) => s.id === editingStaffId) ?? null
  const editingSchedules = schedules.filter((s) => s.staff_id === editingStaffId)

  if (staff.length === 0) {
    return (
      <EmptyState
        icon={<User className="h-6 w-6" />}
        title="No team members yet"
        description="Add employees in the roster above before setting schedules."
      />
    )
  }

  return (
    <>
      <div className="space-y-2">
        {staff.map((member) => {
          const memberSchedules = schedules.filter((s) => s.staff_id === member.id)
          const activeDays = DAY_ORDER.filter((day) => memberSchedules.some((s) => s.day_of_week === day))

          return (
            <div key={member.id} className="rounded-lg border border-border bg-card px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium truncate">{member.full_name}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEditingStaffId(member.id)}>
                  Edit
                </Button>
              </div>

              {activeDays.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {activeDays.map((day) => {
                    const s = memberSchedules.find((sc) => sc.day_of_week === day)!
                    return (
                      <span key={day} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{DAY_SHORT[day]}</span>
                        {s.shift_start}–{s.shift_end}
                      </span>
                    )
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No schedule set — all days off</p>
              )}
            </div>
          )
        })}
      </div>

      {editingStaff && (
        <ScheduleModal
          isOpen={!!editingStaffId}
          onClose={() => setEditingStaffId(null)}
          staffId={editingStaff.id}
          staffName={editingStaff.full_name}
          existingSchedules={editingSchedules}
          onSave={onSave}
        />
      )}
    </>
  )
}
