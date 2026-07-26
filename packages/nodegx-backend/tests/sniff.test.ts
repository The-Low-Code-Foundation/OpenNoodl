/**
 * BAK-006: content-type sniffing by magic bytes. The success criterion this
 * exists for: "a PNG renamed .pdf is stored as what it is" — the declared
 * name/extension must never override a real signature match.
 */
import { sniff } from '../src/storage/sniff';

// 1x1 transparent PNG.
const PNG_BYTES = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
    '01f15c4890000000a49444154789c6360000002000155e21bd6000000004945' +
    '4e44ae426082',
  'hex'
);
const JPEG_HEADER = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const GIF_HEADER = Buffer.from('GIF89a' + 'x'.repeat(20), 'ascii');
const PDF_HEADER = Buffer.from('%PDF-1.4\n%rest of a fake pdf', 'ascii');
const WEBP_HEADER = Buffer.concat([Buffer.from('RIFF', 'ascii'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP', 'ascii')]);

describe('sniff', () => {
  it('recognizes PNG by magic bytes regardless of declared name', () => {
    expect(sniff(PNG_BYTES, 'photo.png').contentType).toBe('image/png');
    expect(sniff(PNG_BYTES, 'definitely-not-a-png.pdf').contentType).toBe('image/png');
    expect(sniff(PNG_BYTES, 'evil.exe').contentType).toBe('image/png');
  });

  it('recognizes JPEG, GIF, PDF, WEBP by magic bytes', () => {
    expect(sniff(JPEG_HEADER).contentType).toBe('image/jpeg');
    expect(sniff(GIF_HEADER).contentType).toBe('image/gif');
    expect(sniff(PDF_HEADER).contentType).toBe('application/pdf');
    expect(sniff(WEBP_HEADER).contentType).toBe('image/webp');
  });

  it('a PDF renamed .png is still detected as a PDF (the literal success criterion)', () => {
    const result = sniff(PDF_HEADER, 'totally-a-photo.png');
    expect(result.contentType).toBe('application/pdf');
  });

  it('falls back to JSON detection for valid JSON text', () => {
    const buf = Buffer.from(JSON.stringify({ a: 1, b: [1, 2, 3] }));
    expect(sniff(buf).contentType).toBe('application/json');
  });

  it('falls back to text/plain for plain text with no other signal', () => {
    const buf = Buffer.from('just some plain text, not json, not xml');
    expect(sniff(buf).contentType).toBe('text/plain');
  });

  it('detects SVG (XML-declared) as image/svg+xml even though it is text', () => {
    const buf = Buffer.from('<?xml version="1.0"?>\n<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(sniff(buf).contentType).toBe('image/svg+xml');
  });

  it('detects a bare <svg> root without an XML declaration', () => {
    const buf = Buffer.from('<svg width="10" height="10"></svg>');
    expect(sniff(buf).contentType).toBe('image/svg+xml');
  });

  it('falls back to application/octet-stream for unrecognized binary data', () => {
    const buf = Buffer.from([0x00, 0x01, 0x02, 0xde, 0xad, 0xbe, 0xef, 0x00, 0xff]);
    expect(sniff(buf).contentType).toBe('application/octet-stream');
  });

  it('uses the declared extension only to disambiguate among text formats (csv vs plain)', () => {
    const buf = Buffer.from('a,b,c\n1,2,3');
    expect(sniff(buf, 'data.csv').contentType).toBe('text/csv');
    expect(sniff(buf, 'data.txt').contentType).toBe('text/plain');
  });
});
