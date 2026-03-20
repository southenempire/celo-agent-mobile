export interface Contact {
    name: string;
    address: string;
    addedAt: number;
}

const STORAGE_KEY = 'cria_contacts';

export class LocalMemory {
    static getContacts(): Contact[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch {
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
        
        localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
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
        localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
    }
}
