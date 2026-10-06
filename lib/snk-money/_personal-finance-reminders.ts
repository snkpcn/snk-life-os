// SNK MONEY x THONGTHAI -- due-date reminders.
//
// Reminders go ONLY to the single verified finance group (the one ACTIVE binding in the
// ledger).  Never to the owner group, customer chats, arbitrary users, web or Messenger.
// Claiming happens inside Postgres, so concurrent / repeated cron runs cannot double-send.

import { bangkokToday, finalizeReply, money, pfEnabled, thaiDate } from './_personal-finance-core';
import { PfBindingClient, PfLedger, assertLedgerConfigured, supabaseRpc, type Rpc } from './_personal-finance-ledger';
import { decryptGroupId, lineIdHash } from './_private-crypto';

type Claimed = Awaited<ReturnType<PfLedger['claimReminders']>>[number];

export type ReminderDeps = {
  rpc: Rpc;
  push: (groupId: string, text: string) => Promise<void>;
  decrypt: (value: string) => string | null;
  hash: (value: string) => string | null;
  now: () => Date;
  enabled: boolean;
};

export type ReminderResult = { skipped?: string; claimed: number; sent: number; failed: number };

function when(item: Claimed): string {
  if (item.overdue) return `⚠ เลยกำหนด ${Math.abs(item.days_until)} วันแล้ว`;
  if (item.days_until === 0) return '⏰ ครบกำหนดวันนี้';
  if (item.days_until === 1) return '⏰ พรุ่งนี้ครบกำหนด';
  return `อีก ${item.days_until} วัน (${thaiDate(item.due_date)})`;
}

export function composeReminder(items: Claimed[]): string[] {
  const lines = items.map(item => {
    const sign = item.kind === 'INCOME' ? 'จะได้รับ' : 'ต้องจ่าย';
    const amount = item.amount !== null ? money(item.amount) : 'ยังไม่ระบุจำนวน';
    return `• ${when(item)} — ${item.title} ${sign} ${amount}${item.default_account ? ` (${item.default_account})` : ''}`;
  });
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += 10) {
    const head = i === 0 ? 'แจ้งเตือนรายการการเงินครับ' : 'แจ้งเตือนต่อครับ';
    const tail = i + 10 >= lines.length ? '\nจ่ายแล้วพิมพ์ “จ่ายแล้ว” ได้เลยครับ ผมจะปิดรายการและขยับงวดถัดไปให้' : '';
    chunks.push(finalizeReply(`${head}\n${lines.slice(i, i + 10).join('\n')}${tail}`));
  }
  return chunks;
}

export async function runPersonalFinanceReminders(_deps: ReminderDeps): Promise<ReminderResult> {
  return { claimed: 0, sent: 0, failed: 0, skipped: 'pull_only_disabled' };
}

export async function defaultReminderDeps(): Promise<ReminderDeps> {
  assertLedgerConfigured();
  return {
    rpc: supabaseRpc,
    decrypt: decryptGroupId,
    hash: lineIdHash,
    now: () => new Date(),
    enabled: false,
    push: async (groupId, text) => {
      throw new Error('personal_push_disabled');
    },
  };
}
