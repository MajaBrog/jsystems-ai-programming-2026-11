import { loadExampleImage } from './example-images.testing';

describe('loadExampleImage (test helper)', () => {
  it('reads the real example photos from assets/example-images', async () => {
    const png = await loadExampleImage('laptop-1.png');
    expect(png.name).toBe('laptop-1.png');
    expect(png.size).toBeGreaterThan(1_000_000);
    const head = new Uint8Array(await png.slice(0, 3).arrayBuffer());
    expect([...head]).toEqual([0xff, 0xd8, 0xff]); // JPEG content despite the .png name
  });
});
