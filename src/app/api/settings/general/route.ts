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

  return NextResponse.json({ retryCount });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.retryCount !== undefined) {
    const retryCount = Math.min(10, Math.max(0, parseInt(body.retryCount, 10) || 0));
    let content = getEnvContent();
    content = setEnvVar(content, 'RETRY_FAILED_COUNT', String(retryCount));
    writeFileSync(ENV_PATH, content);
    process.env.RETRY_FAILED_COUNT = String(retryCount);
    return NextResponse.json({ retryCount, message: 'Retry count saved.' });
  }

  return NextResponse.json({ error: 'No valid setting provided' }, { status: 400 });
}
