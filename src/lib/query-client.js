import { QueryClient } from '@tanstack/react-query';

export const queryClientInstance = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      // Keeps data "fresh" for 30 seconds to reduce database load
      staleTime: 1000 * 30, 
    },
  },
});