import { useWalletClient, usePublicClient } from 'wagmi';
import { useMemo } from 'react';
import { CeloAgent } from '../lib/agent-core';

export const useAgent = () => {
    const { data: walletClient } = useWalletClient();
    const publicClient = usePublicClient();

    const agent = useMemo(() => {
        if (!walletClient || !publicClient) return null;
        return new CeloAgent(walletClient as any, publicClient as any);
    }, [walletClient, publicClient]);

    return agent;
};
