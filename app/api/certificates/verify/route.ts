import { NextResponse } from 'next/server';
import { verifyCertificate, CERTIFICATE_SIGNATURE_VERSION, type CertificatePayload } from '../../../../lib/certificate';

export const dynamic = 'force-dynamic';

type VerifyBody = {
  payload?: CertificatePayload;
  signature?: string;
  signatureVersion?: string;
};

function isCertificatePayload(value: unknown): value is CertificatePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Record<string, unknown>;
  return typeof payload.certificateId === 'string'
    && typeof payload.studentId === 'string'
    && typeof payload.courseId === 'string'
    && typeof payload.scenarioVersion === 'string'
    && typeof payload.issuedAt === 'string'
    && typeof payload.score === 'number'
    && Number.isFinite(payload.score)
    && payload.score >= 0
    && payload.score <= 100
    && !Number.isNaN(Date.parse(payload.issuedAt))
    && payload.certificateId.length > 0
    && payload.studentId.length > 0
    && payload.courseId.length > 0
    && typeof payload.issuer === 'string'
    && payload.issuer.length > 0;
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get('content-length') || '0');
  if (contentLength > 32_768) {
    return NextResponse.json({ valid: false, error: 'Request too large.' }, { status: 413 });
  }

  let body: VerifyBody;
  try {
    body = await request.json() as VerifyBody;
  } catch {
    return NextResponse.json({ valid: false, error: 'Invalid JSON.' }, { status: 400 });
  }

  if (!isCertificatePayload(body.payload) || typeof body.signature !== 'string') {
    return NextResponse.json({ valid: false, error: 'Invalid certificate payload.' }, { status: 400 });
  }
  if (body.signatureVersion !== CERTIFICATE_SIGNATURE_VERSION) {
    return NextResponse.json({ valid: false, error: 'Unsupported signature version.' }, { status: 400 });
  }

  const secret = process.env.AEROCOMM_CERTIFICATE_SIGNING_SECRET;
  if (!secret || secret.length < 32) {
    return NextResponse.json({ valid: false, error: 'Certificate verification is not configured.' }, { status: 503 });
  }

  const valid = verifyCertificate(body.payload, body.signature, secret);
  return NextResponse.json(
    { valid, signatureVersion: CERTIFICATE_SIGNATURE_VERSION },
    { status: valid ? 200 : 422, headers: { 'Cache-Control': 'no-store' } }
  );
}
