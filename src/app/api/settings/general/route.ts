import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENV_PATH = join(process.cwd(), '.env');

function getEnvContent(): string {
  if (!existsSync(ENV_PATH)) return '';
  return readFileSync(ENV_PATH, 'utf-8');
}

function getEnvVar(content: string, key: string): string {
  const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1] : '';
}

function setEnvVar(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  return content.trimEnd() + `\n${key}=${value}\n`;
}

export async function GET() {
  const content = getEnvContent();
  const retryCount = parseInt(getEnvVar(content, 'RETRY_FAILED_COUNT') || '4', 10);
  const maxConcurrency = parseInt(getEnvVar(content, 'MAX_CONCURRENCY') || '45', 10);

  return NextResponse.json({ retryCount, maxConcurrency });
}

export async function POST(request: Request) {
  const body = await request.json();
  let content = getEnvContent();
  let saved = false;

  if (body.retryCount !== undefined) {
    const retryCount = Math.min(10, Math.max(0, parseInt(body.retryCount, 10) || 0));
    content = setEnvVar(content, 'RETRY_FAILED_COUNT', String(retryCount));
    process.env.RETRY_FAILED_COUNT = String(retryCount);
    saved = true;
  }

  if (body.maxConcurrency !== undefined) {
    const maxConcurrency = Math.min(50, Math.max(1, parseInt(body.maxConcurrency, 10) || 45));
    content = setEnvVar(content, 'MAX_CONCURRENCY', String(maxConcurrency));
    process.env.MAX_CONCURRENCY = String(maxConcurrency);
    saved = true;
  }

  if (saved) {
    writeFileSync(ENV_PATH, content);
    const retryCount = parseInt(getEnvVar(content, 'RETRY_FAILED_COUNT') || '4', 10);
    const maxConcurrency = parseInt(getEnvVar(content, 'MAX_CONCURRENCY') || '45', 10);
    return NextResponse.json({ retryCount, maxConcurrency, message: 'Settings saved.' });
  }

  return NextResponse.json({ error: 'No valid setting provided' }, { status: 400 });
}
