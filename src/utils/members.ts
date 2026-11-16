/** People allowed into Fina. firestore.rules holds the same emails and must stay in step. */

export interface Member {
  email: string;
  name: string;
  isLedgerOwner: boolean;
}

export const MEMBERS: Member[] = [
  { email: 'pemilik@example.com', name: 'Andi', isLedgerOwner: true },
  { email: 'pasangan@example.com', name: 'Sari', isLedgerOwner: false },
];

export const LEDGER_OWNER_NAME = 'Andi';

export function findMember(email: string | null | undefined): Member | null {
  const normalized = email?.toLowerCase();
  return MEMBERS.find((member) => member.email === normalized) ?? null;
}

/** Everything saved before Fina was shared came from the ledger owner's account. */
export function recordedBy(transaction: { createdByName?: string }): string {
  return transaction.createdByName || LEDGER_OWNER_NAME;
}

/** Each person's Finn chat is private. The owner keeps the original document. */
export function chatDocumentId(member: Member, uid: string): string {
  return member.isLedgerOwner ? 'chat' : `chat_${uid}`;
}
