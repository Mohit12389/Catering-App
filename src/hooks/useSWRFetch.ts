import useSWR from 'swr'
import { fetcher } from '@/lib/fetcher'

interface UseSWRFetchOptions {
  revalidateOnFocus?: boolean
  revalidateOnReconnect?: boolean
  dedupingInterval?: number
  refreshInterval?: number
}

export function useSWRFetch<T>(
  url: string | null,
  options: UseSWRFetchOptions = {}
) {
  const {
    revalidateOnFocus = false,
    revalidateOnReconnect = false,
    dedupingInterval = 5000, // 5 seconds - faster cache invalidation
    refreshInterval = 0,
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
