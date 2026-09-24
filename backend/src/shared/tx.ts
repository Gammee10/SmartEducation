// Shared kernel: typed transaction client.
// Domains accept this instead of `any` so refactors stay type-safe.
// `Prisma.TransactionClient` is what `$transaction(async (tx) => ...)`
// provides; the shared Prisma client also satisfies it structurally.
import { Prisma } from '@prisma/client';

export type TxClient = Prisma.TransactionClient;

/** Minimal writer surface for audit logging (shared client or tx). */
export type AuditWriter = Pick<TxClient, 'auditLog'>;

/** Minimal writer surface for notifications (shared client or tx). */
export type NotifyWriter = Pick<TxClient, 'notification'>;
