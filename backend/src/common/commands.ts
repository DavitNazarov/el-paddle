import crypto from 'crypto';
import type { Prisma } from '../generated/prisma/client.js';
import { jsonError } from './http.js';

export function requireCommandId(value: unknown) {
  const commandId = typeof value === 'string' ? value.trim() : '';
  if (!/^[A-Za-z0-9:_-]{8,128}$/.test(commandId)) jsonError('A valid commandId is required.');
  return commandId;
}

export function payloadHash(payload: unknown) {
  return crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export async function findCommandReceipt(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  commandId: string,
  hash: string,
) {
  const receipt = await tx.commandReceipt.findUnique({
    where: { actorId_action_commandId: { actorId, action, commandId } },
  });
  if (receipt && receipt.payloadHash !== hash) jsonError('Command ID was reused with different data.', 409);
  return receipt;
}

export async function saveCommandReceipt(
  tx: Prisma.TransactionClient,
  input: { actorId: string; action: string; commandId: string; hash: string; response?: Prisma.InputJsonValue },
) {
  return tx.commandReceipt.create({
    data: {
      actorId: input.actorId,
      action: input.action,
      commandId: input.commandId,
      payloadHash: input.hash,
      response: input.response,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
}

