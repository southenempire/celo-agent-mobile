import { SecurityUtils } from './security';

export interface Contact {
    name: string;
    address: string;
    addedAt: number;
}

const STORAGE_KEY = 'cria_contacts_v2_encrypted'; // New key for encrypted data

export class LocalMemory {
    private static salt = 'cria-vault-default';

    static setSalt(address: string) {
        this.salt = address;
    }

    static getContacts(): Contact[] {
        try {
            const encoded = localStorage.getItem(STORAGE_KEY);
            if (!encoded) return [];
            const decoded = SecurityUtils.decrypt(encoded, this.salt);
            return JSON.parse(decoded);
        } catch (e) {
            console.error("AgentVault: Decryption failed. Data might be corrupted or salt mismatch.", e);
            return [];
        }
    }

    static saveContact(name: string, address: string): void {
        const contacts = this.getContacts();
        const existingIndex = contacts.findIndex(c => c.name.toLowerCase() === name.toLowerCase());
        
        if (existingIndex > -1) {
            contacts[existingIndex].address = address;
            contacts[existingIndex].addedAt = Date.now();
        } else {
            contacts.push({ name, address, addedAt: Date.now() });
        }
        
        const data = JSON.stringify(contacts);
        const encoded = SecurityUtils.encrypt(data, this.salt);
        localStorage.setItem(STORAGE_KEY, encoded);
    }

    static resolveName(name: string): string | null {
        const contacts = this.getContacts();
        const contact = contacts.find(c => c.name.toLowerCase() === name.toLowerCase());
        return contact ? contact.address : null;
    }

    static resolveAddress(address: string): string | null {
        const contacts = this.getContacts();
        const contact = contacts.find(c => c.address.toLowerCase() === address.toLowerCase());
        return contact ? contact.name : null;
    }

    static deleteContact(name: string): void {
        const contacts = this.getContacts().filter(c => c.name.toLowerCase() !== name.toLowerCase());
        const data = JSON.stringify(contacts);
        const encoded = SecurityUtils.encrypt(data, this.salt);
        localStorage.setItem(STORAGE_KEY, encoded);
    }
}
