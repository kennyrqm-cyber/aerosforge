import {createHmac,timingSafeEqual} from 'crypto';
import {canonicalJson} from './integrity';

export type CertificatePayload={certificateId:string;studentId:string;courseId:string;scenarioVersion:string;issuedAt:string;score:number;issuer:string};
export const CERTIFICATE_SIGNATURE_VERSION='hmac-sha256-v1';

export function signCertificate(payload:CertificatePayload,secret:string){
  if(secret.length<32) throw new Error('Certificate signing secret must be at least 32 characters');
  return createHmac('sha256',secret).update(canonicalJson(payload)).digest('hex');
}

export function verifyCertificate(payload:CertificatePayload,signature:string,secret:string){
  if(!/^[a-f0-9]{64}$/i.test(signature)||secret.length<32) return false;
  const expected=Buffer.from(signCertificate(payload,secret),'hex');
  const received=Buffer.from(signature,'hex');
  return expected.length===received.length&&timingSafeEqual(expected,received);
}
