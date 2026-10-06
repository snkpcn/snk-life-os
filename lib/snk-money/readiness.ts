import { SNK_OS_DEFAULT_URL, supabaseRpc, type Rpc } from './_personal-finance-ledger';
import { pfEnabled } from './_personal-finance-core';
export async function personalReadiness(env: Record<string, string | undefined> = process.env, rpc: Rpc = supabaseRpc) {
  let encryptionConfigured = false;
  try { encryptionConfigured = Buffer.from(env.SNK_OS_GROUP_ENCRYPTION_KEY ?? '', 'base64url').length === 32; } catch {}
  const body = {
    system: 'snk', scope: 'personal', ok: false, ready: false, pullOnly: true,
    flagEnabled: pfEnabled(env), serviceKeyConfigured: Boolean(env.SNK_OS_SERVICE_ROLE_KEY?.trim()),
    projectCorrect: (env.SNK_OS_SUPABASE_URL || SNK_OS_DEFAULT_URL).replace(/\/$/, '') === SNK_OS_DEFAULT_URL,
    lineSecretConfigured: Boolean(env.LINE_CHANNEL_SECRET?.trim()),
    replyTokenConfigured: Boolean(env.LINE_CHANNEL_ACCESS_TOKEN?.trim()), encryptionConfigured,
    slipExtractionConfigured: Boolean(env.GEMINI_API_KEY?.trim()),
    secretaryAiConfigured: Boolean(env.GEMINI_API_KEY?.trim()),
    ledgerReachable: false, migrationPresent: false, moneyReady: false, secretaryReady: false, bindingReady: false, activeGroup: false,
    problem: ''
  };
  if (!body.serviceKeyConfigured || !body.projectCorrect) {
    body.problem = !body.projectCorrect ? 'wrong_snk_project' : 'service_key_missing';
    return body;
  }
  try {
    const result = await rpc('snk_personal_readiness', {}) as Record<string, boolean>;
    body.ledgerReachable = result.backend === true;
    body.migrationPresent = result.snapshot === true;
    body.moneyReady = result.money === true;
    body.secretaryReady = result.secretary === true;
    body.bindingReady = result.binding === true;
    body.activeGroup = result.active_group === true;
    body.ok = body.ledgerReachable && body.migrationPresent && body.moneyReady && body.secretaryReady && body.bindingReady;
    body.ready = body.ok && body.flagEnabled && body.activeGroup && body.lineSecretConfigured && body.replyTokenConfigured && encryptionConfigured && body.slipExtractionConfigured && body.secretaryAiConfigured;
    if (!body.ready) body.problem = body.ok ? 'personal_configuration_incomplete' : 'personal_migration_incomplete';
  } catch { body.problem = 'snk_backend_unavailable'; }
  return body;
}
