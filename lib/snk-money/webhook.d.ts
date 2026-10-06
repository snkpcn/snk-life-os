export type LineGroupEvent = {
  source?: { type?: string };
  [key: string]: unknown;
};

export function verifyLineSignature(rawBody: string, signature: string | undefined, channelSecret: string): boolean;
export function routeLineGroupEvents(input: {
  rawBody: string;
  signature: string | undefined;
  channelSecret: string;
  processEvent: (event: LineGroupEvent) => Promise<boolean>;
}): Promise<{ status: number; body: { ok: boolean; error?: string; handledIndexes?: number[] } }>;
