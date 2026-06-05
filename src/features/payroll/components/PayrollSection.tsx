import { LoadingSkeleton } from '@/components/shared/LoadingSkeleton'
import { PayrollRunTab } from './PayrollRunTab'
import { usePayrollRuns } from '../hooks/usePayrollRuns'
import { useTeamSettings } from '@/features/settings/hooks/useTeamSettings'

export function PayrollSection() {
  const { staff, isLoading: staffLoading }                       = useTeamSettings()
  const { data: payrollRuns, isLoading: runsLoading, runPayroll } = usePayrollRuns()

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
