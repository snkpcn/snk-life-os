import assert from 'node:assert/strict';
import test from 'node:test';
import { extractSnkSlip } from '../lib/snk-money/_line-media';

test('SNK slip extraction uses the configured personal Gemini key and passes the image bytes', async()=>{
  const originalKey=process.env.GEMINI_API_KEY;
  const originalOpenAi=process.env.OPENAI_API_KEY;
  const originalFetch=globalThis.fetch;
  process.env.GEMINI_API_KEY='test-snk-key';
  delete process.env.OPENAI_API_KEY;
  const bytes=Buffer.from('receipt-image-bytes');
  let calls=0;
  try {
    globalThis.fetch=(async(url,init)=>{
      calls++;
      assert.match(String(url),/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\//);
      assert.equal((init?.headers as Record<string,string>)['x-goog-api-key'],'test-snk-key');
      const body=JSON.parse(String(init?.body));
      assert.equal(body.contents[0].parts[1].inline_data.data,bytes.toString('base64'));
      assert.equal(body.contents[0].parts[1].inline_data.mime_type,'image/jpeg');
      return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify({
        document_type:'transfer_slip',amount_total:209,document_date_local:'2026-10-06',
        merchant:'recipient',reference_number:'ref-209',bank:'KBank',confidence:0.95,
      })}]}}]}),{status:200});
    }) as typeof fetch;
    const extraction=await extractSnkSlip(bytes,'image/jpeg');
    assert.equal(extraction.amount_total,209);
    assert.equal(extraction.document_date_local,'2026-10-06');
    assert.equal(calls,1);
  }finally{
    globalThis.fetch=originalFetch;
    if(originalKey===undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY=originalKey;
    if(originalOpenAi===undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY=originalOpenAi;
  }
});
