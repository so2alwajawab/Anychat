import type { Request } from 'express';
import { sha256Hex } from './crypto/hash.js';

export function clientIp(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function ipPrefixOf(ip?: string | null): string | null {
  if (!ip) return null;
  const cleaned = ip.replace(/^::ffff:/, '');
  if (cleaned.includes(':')) {
    const groups = cleaned.split(':').slice(0, 3);
    return `${groups.join(':')}::`;
  }
  const octets = cleaned.split('.');
  if (octets.length === 4) return `${octets[0]}.${octets[1]}.${octets[2]}.0`;
  return cleaned;
}

export function userAgentOf(req: Request): string | null {
  const ua = req.headers['user-agent'];
  if (!ua) return null;
  return ua.slice(0, 300);
}

export function uaHashOf(req: Request): string | null {
  const ua = userAgentOf(req);
  return ua ? sha256Hex(ua).slice(0, 32) : null;
}
