const recip = "Charles Duke Alaba Naomi bank paystack-titan acct 9854748374";
const accMatch = recip.match(/(?:acct|account)\s*(?:number)?\s*(\d{10,15})/i);
const bankMatch = recip.match(/bank\s*(?:name)?\s*(.*?)(?=\s+name\s+|\s+acct\s+|\s+account\s+|$)/i);
let nameMatch = recip.match(/name\s*(?:of)?\s*(?:the)?\s*(?:acct|account)?\s*(?:holder)?\s*(.*?)(?=\s+bank\s+|\s+acct\s+|\s+account\s+|$)/i);

let accountName = nameMatch ? nameMatch[1].trim() : null;

// Fallback: If no explicit 'name' keyword, the name might be at the start of recip (e.g. "Send 5 to John bank...")
if (!accountName) {
    const nameFallback = recip.match(/^(.*?)(?=\s+bank\s+|\s+acct\s+|\s+account\s+|$)/i);
    if (nameFallback && nameFallback[1].trim()) {
        accountName = nameFallback[1].trim();
    }
}

console.log({
    accountNumber: accMatch ? accMatch[1] : null,
    bankName: bankMatch ? bankMatch[1].trim() : null,
    accountName: accountName
});
