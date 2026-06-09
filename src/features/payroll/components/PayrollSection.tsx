import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { PayrollRunTab } from './PayrollRunTab'
import { usePayrollRuns } from '../hooks/usePayrollRuns'
import { useTeamSettings } from '@/features/settings/hooks/useTeamSettings'
import { usePlan } from '@/hooks/usePlan'
import { UpgradeWall } from '@/components/shared/UpgradeWall'

export function PayrollSection() {
  const plan = usePlan()
  const { staff, isLoading: staffLoading }                       = useTeamSettings()
  const { data: payrollRuns, isLoading: runsLoading, runPayroll } = usePayrollRuns()

  if (plan === 'free') return <UpgradeWall title="Payroll" feature="Payroll" showTitle={false} />

  if (staffLoading || runsLoading) return <LoadingSkeleton rows={3} />

  return (
    <PayrollRunTab
      staff={staff}
      payrollRuns={payrollRuns}
      isLoading={false}
      onRun={runPayroll}
    />
  )
}
