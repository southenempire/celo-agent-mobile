import { WagmiAdapter } from '@reown/appkit-adapter-wagmi'
import { celoSepolia } from '@reown/appkit/networks'
import { createAppKit } from '@reown/appkit/react'
import { QueryClient } from '@tanstack/react-query'
import type { AppKitNetwork } from '@reown/appkit/networks'

export const projectId = '00000000000000000000000000000000'

if (!projectId) {
    throw new Error('Project ID is not defined')
}

// Ensure type compatibility for AppKit
export const networks = [celoSepolia] as [AppKitNetwork, ...AppKitNetwork[]]

export const wagmiAdapter = new WagmiAdapter({
    networks,
    projectId,
    ssr: true
})

export const queryClient = new QueryClient()

createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
    features: {
        analytics: true
    },
    themeMode: 'light',
    themeVariables: {
        '--w3m-accent': '#35D07F',
        '--w3m-border-radius-master': '2px',
        '--w3m-font-family': 'Inter, sans-serif',
    }
})
