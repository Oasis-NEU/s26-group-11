import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 300_000,       // 5 min — don't re-fetch if data is fresh
      gcTime: 600_000,          // 10 min — keep in cache while browsing
      retry: 1,
      refetchOnWindowFocus: false,  // don't hammer the API on every tab switch
      refetchOnMount: false,        // rely on stale-time, not mount events
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
