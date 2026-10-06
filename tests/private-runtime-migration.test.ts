import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { freshDb, OWNER_ID } from './helpers/pf-pglite';

test('private key migration rotates only the existing binding ciphertext and restricts lookup to service_role', async () => {
  const { db, rpc } = await freshDb();
  const groupHash = createHash('sha256').update('c_snk_private_group').digest('hex');
  const legacyCiphertext = 'v1.legacy-ciphertext';
  const nextCiphertext = 'v2.YWJj.ZGVm.Z2hp';
  await db.query(
    `insert into public.finance_channel_bindings(owner_id,group_id_hash,group_id_enc,status)
     values($1,$2,$3,'ACTIVE')`,
    [OWNER_ID, groupHash, legacyCiphertext],
  );

  const before = {
    tasks: Number((await db.query('select count(*)::int n from public.tasks')).rows[0].n),
    transactions: Number((await db.query('select count(*)::int n from public.transactions')).rows[0].n),
  };
  const lookup = await rpc('finance_binding_lookup_any', { p_group_hash: groupHash }) as Record<string, unknown>;
  assert.equal(lookup.status, 'ACTIVE');
  assert.equal(lookup.group_id_enc, legacyCiphertext);

  const rotated = await rpc('finance_binding_refresh_ciphertext', { p_group_hash: groupHash, p_group_enc: nextCiphertext }) as Record<string, unknown>;
  assert.deepEqual(rotated, { ok: true, updated: true });
  const duplicate = await rpc('finance_binding_refresh_ciphertext', { p_group_hash: groupHash, p_group_enc: nextCiphertext }) as Record<string, unknown>;
  assert.deepEqual(duplicate, { ok: true, updated: false });
  const after = await rpc('finance_binding_lookup_any', { p_group_hash: groupHash }) as Record<string, unknown>;
  assert.equal(after.group_id_enc, nextCiphertext);
  assert.deepEqual({
    tasks: Number((await db.query('select count(*)::int n from public.tasks')).rows[0].n),
    transactions: Number((await db.query('select count(*)::int n from public.transactions')).rows[0].n),
  }, before);
  assert.equal(Number((await db.query(`select count(*)::int n from public.activity_log where action='GROUP_ID_ENCRYPTION_ROTATED'`)).rows[0].n), 1);

  await db.exec('set role anon');
  try {
    await assert.rejects(() => db.query(`select public.finance_binding_lookup_any('${groupHash}')`), /permission denied/);
  } finally {
    await db.exec('reset role');
  }
  await db.close();
});
