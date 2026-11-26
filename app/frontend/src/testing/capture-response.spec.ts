import { CAPTURES, captureResponse } from './capture-response';

describe('captureResponse', () => {
  it('reproduces status, headers and body of a capture', async () => {
    const res = captureResponse('submit-400-validation');
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(await res.text()).toBe(CAPTURES['submit-400-validation'].response.body);
  });

  it('splits the body into chunks of the requested size without changing it', async () => {
    const body = CAPTURES['chat-unchanged'].response.body;
    const reader = captureResponse('chat-unchanged', 7).body!.getReader();
    const sizes: number[] = [];
    const parts: Uint8Array[] = [];
    for (let r = await reader.read(); !r.done; r = await reader.read()) {
      sizes.push(r.value.length);
      parts.push(r.value);
    }
    expect(Math.max(...sizes)).toBe(7);
    expect(sizes.length).toBeGreaterThan(10);
    const joined = new TextDecoder().decode(new Uint8Array(parts.flatMap((p) => [...p])));
    expect(joined).toBe(body);
  });
});
