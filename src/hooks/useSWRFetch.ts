import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

interface UseSWRFetchOptions<T = unknown> { // CHANGED: + T for fallbackData
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  dedupingInterval?: number
  refreshInterval?: number
  /** CHANGED: data already loaded on the server — shown at once, then re-checked. */
  fallbackData?: T
}

export function useSWRFetch<T>(
  url: string | null,
  options: UseSWRFetchOptions<T> = {}
) {
  const {
    revalidateOnFocus = false,
    revalidateOnReconnect = false,
    dedupingInterval = 5000, // 5 seconds - faster cache invalidation
    refreshInterval = 0,
    fallbackData, // CHANGED
  } = options

  const { data, error, isLoading, mutate } = useSWR<{ success: boolean; data: T }>(
    url,
    fetcher,
    {
      revalidateOnFocus,
      revalidateOnReconnect,
      dedupingInterval,
      refreshInterval,
      revalidateIfStale: true,
      revalidateOnMount: true,
      // CHANGED: wrapped in the API's { success, data } shape so `data` reads the same either way
      fallbackData: fallbackData === undefined ? undefined : { success: true, data: fallbackData },
    }
  )

  return {
    data: data?.data,
    isLoading,
    isError: error || (data && !data.success),
    mutate,
    refresh: () => mutate(), // Easy refresh function
  }
}
