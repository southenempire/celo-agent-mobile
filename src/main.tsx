import { Buffer } from 'buffer'
window.Buffer = Buffer
window.process = { env: {} } as any

import React from 'react'
import ReactDOM from 'react-dom/client'
import { WagmiProvider } from 'wagmi'
import { QueryClientProvider } from '@tanstack/react-query'
import { wagmiAdapter, queryClient } from './wagmi'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
            <QueryClientProvider client={queryClient}>
                <App />
            </QueryClientProvider>
        </WagmiProvider>
    </React.StrictMode>,
)
