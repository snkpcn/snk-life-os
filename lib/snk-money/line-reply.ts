/** Personal responses use Reply exclusively; there is no Push fallback. */
export async function replyToLine(replyToken: string, text: string, fetcher: typeof fetch = fetch): Promise<void> {
  if (!replyToken?.trim() || /^0+$/.test(replyToken)) return;
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not configured');
  const response = await fetcher('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({ replyToken, messages: [{ type: 'text', text: text.slice(0, 4800) }] }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error('LINE reply failed ' + response.status);
}
