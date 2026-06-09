import { useAuthStore } from '@/stores/authStore'

export function usePlan(): 'free' | 'basic' | 'pro' {
  const stationPlan = useAuthStore((s) => s.station?.plan ?? 'free')
  const viewPlan    = useAuthStore((s) => s.viewPlan)
  return viewPlan ?? stationPlan
}
