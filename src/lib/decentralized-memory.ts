import { SecurityUtils } from './security';

export class DecentralizedMemory {
    private static readonly STORAGE_KEY = 'cria_memory_cid';
    private static salt = 'cria-vault-default';

    static setSalt(address: string) {
        this.salt = address;
    }

    // Fallback IPFS hash generator if the user hasn't configured Pinata keys
    private static generateSimulatedCID(content: string): string {
        const hash = btoa(content).substring(0, 20);
        return `bafybeig${hash.toLowerCase()}`;
    }

    /**
     * Stores contacts to decentralized storage (Filecoin/IPFS via Pinata)
     */
    static async pinContactsToFilecoin(contacts: any): Promise<string> {
        console.log("[FilecoinStorage] Preparing to pin encrypted agent memory to IPFS network...");
        
        // 1. Serialize data
        const rawJson = JSON.stringify({
            version: "2.0_Encrypted",
            timestamp: Date.now(),
            context: "CRIA_AgentVault",
            records: contacts
        });

        // 2. Encrypt for Decentralized Storage
        const encryptedBlob = SecurityUtils.encrypt(rawJson, this.salt);
        const dataBlob = JSON.stringify({
            payload: encryptedBlob,
            encrypted: true,
            hint: "CRIA Vault V2"
        });

        // 2. Check for Pinata JWT
        const pinataJwt = import.meta.env.VITE_PINATA_JWT;
        
        // 3. Fallback logic for testers without keys
        if (!pinataJwt) {
            console.warn("[FilecoinStorage] VITE_PINATA_JWT missing from environment. Using deterministic fallbackCID for local development.");
            await new Promise(resolve => setTimeout(resolve, 800)); // Simulate network
            const cid = this.generateSimulatedCID(dataBlob);
            localStorage.setItem(this.STORAGE_KEY, cid);
            return cid;
        }

        // 4. Real IPFS Pinning Protocol via Pinata API
        try {
            const formData = new FormData();
            const blob = new Blob([dataBlob], { type: "application/json" });
            formData.append('file', blob, 'agent_memory.json');

            const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${pinataJwt}`,
                },
                body: formData,
            });

            if (!res.ok) {
                const error = await res.text();
                throw new Error(`Pinata API Error: ${error}`);
            }

            const data = await res.json();
            
            if (data.IpfsHash) {
                console.log(`[FilecoinStorage] Successfully pinned to Filecoin/IPFS via Pinata. CID: ${data.IpfsHash}`);
                localStorage.setItem(this.STORAGE_KEY, data.IpfsHash);
                return data.IpfsHash;
            }
            
            throw new Error("Pinata failed to return a valid IPFS Hash.");
        } catch (e) {
            console.error("[FilecoinStorage] Error pinning to decentralized network:", e);
            throw e;
        }
    }

    /**
     * Retrieves the latest active CID for the agent's memory
     */
    static getActiveCID(): string | null {
        return localStorage.getItem(this.STORAGE_KEY);
    }
}
