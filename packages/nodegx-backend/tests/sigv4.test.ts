/**
 * BAK-006: verifies the hand-rolled SigV4 signer (src/storage/sigv4.ts)
 * against REAL fixtures from AWS's own `aws4_testsuite` conformance suite —
 * the same suite the AWS SDKs test themselves against. These are not
 * self-consistency checks; `creq`/`sts`/`authz` below are copied verbatim
 * from https://github.com/saibotsivad/aws-sig-v4-test-suite (an npm-published
 * mirror of the suite AWS itself used to publish), fetched while writing this
 * test — see BAK-006-NOTES.md.
 */
import { canonicalRequest, stringToSign, signAws4, credentialScope } from '../src/storage/sigv4';
import * as crypto from 'crypto';

const CREDS = {
  accessKeyId: 'AKIDEXAMPLE',
  secretAccessKey: 'wJalrXUtnFEMI/K7MDENG+bPxRfiCYEXAMPLEKEY',
  region: 'us-east-1',
  service: 'service'
};
const AMZ_DATE = '20150830T123600Z';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

describe('sigv4 (AWS aws4_testsuite fixtures)', () => {
  it('get-vanilla: canonical request, string-to-sign, and Authorization match AWS exactly', () => {
    const input = {
      method: 'GET',
      path: '/',
      headers: { Host: 'example.amazonaws.com', 'X-Amz-Date': AMZ_DATE },
      payloadHash: EMPTY_SHA256
    };
    const { creq } = canonicalRequest(input);
    expect(creq).toBe(
      'GET\n/\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\n' + EMPTY_SHA256
    );

    const hashedCreq = crypto.createHash('sha256').update(creq).digest('hex');
    const scope = credentialScope(AMZ_DATE, CREDS);
    const sts = stringToSign(AMZ_DATE, scope, hashedCreq);
    expect(sts).toBe(
      'AWS4-HMAC-SHA256\n20150830T123600Z\n20150830/us-east-1/service/aws4_request\n' +
        'bb579772317eb040ac9ed261061d46c1f17a8133879d6129b6e1c25292927e63'
    );

    const { authorization } = signAws4(input, CREDS, AMZ_DATE);
    expect(authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=5fa00fa31553b73ebf1942676e86291e8372ff2a2260956d9b8aae1d763fbf31'
    );
  });

  it('get-unreserved: path with every unreserved character is left unescaped', () => {
    const path = '/-._~0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const input = {
      method: 'GET',
      path,
      headers: { Host: 'example.amazonaws.com', 'X-Amz-Date': AMZ_DATE },
      payloadHash: EMPTY_SHA256
    };
    const { creq } = canonicalRequest(input);
    expect(creq).toBe(`GET\n${path}\n\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\nhost;x-amz-date\n${EMPTY_SHA256}`);

    const { authorization } = signAws4(input, CREDS, AMZ_DATE);
    expect(authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=07ef7494c76fa4850883e2b006601f940f8a34d404d0cfa977f52a65bbf5f24f'
    );
  });

  it('get-vanilla-query-order-key: duplicate query keys sort by VALUE too (byte order)', () => {
    // Source URI: /?Param1=value2&Param1=Value1 -> canonical sorts to Value1 before value2.
    const input = {
      method: 'GET',
      path: '/',
      query: [['Param1', 'value2'], ['Param1', 'Value1']] as Array<[string, string]>,
      headers: { Host: 'example.amazonaws.com', 'X-Amz-Date': AMZ_DATE },
      payloadHash: EMPTY_SHA256
    };
    const { creq } = canonicalRequest(input);
    expect(creq).toBe(
      'GET\n/\nParam1=Value1&Param1=value2\nhost:example.amazonaws.com\nx-amz-date:20150830T123600Z\n\n' +
        'host;x-amz-date\n' +
        EMPTY_SHA256
    );

    const { authorization } = signAws4(input, CREDS, AMZ_DATE);
    expect(authorization).toBe(
      'AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE/20150830/us-east-1/service/aws4_request, ' +
        'SignedHeaders=host;x-amz-date, ' +
        'Signature=eedbc4e291e521cf13422ffca22be7d2eb8146eecf653089df300a15b2382bd1'
    );
  });

  it('rejects nothing about the driver-owned key shape: hash-bucketed keys need no encoding beyond "/"', () => {
    const input = {
      method: 'PUT',
      path: '/my-bucket/ab/cd/abcd1234-ef567890.bin',
      headers: {
        Host: 's3.example.com',
        'X-Amz-Date': AMZ_DATE,
        'x-amz-content-sha256': EMPTY_SHA256
      },
      payloadHash: EMPTY_SHA256
    };
    const { creq } = canonicalRequest(input);
    expect(creq.split('\n')[1]).toBe('/my-bucket/ab/cd/abcd1234-ef567890.bin');
  });
});
