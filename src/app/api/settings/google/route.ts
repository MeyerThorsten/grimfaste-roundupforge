import { NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const ENV_PATH = join(process.cwd(), '.env');

function getEnvContent(): string {
  if (!existsSync(ENV_PATH)) return '';
  return readFileSync(ENV_PATH, 'utf-8');
}

function setEnvVar(content: string, key: string, value: string): string {
  const regex = new RegExp(`^${key}=.*$`, 'm');
  if (regex.test(content)) {
    return content.replace(regex, `${key}=${value}`);
  }
  return content.trimEnd() + `\n${key}=${value}\n`;
}

export async function GET() {
  const hasServiceAccount = Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const sheetId = process.env.GOOGLE_SHEET_ID || '';

  let serviceAccountEmail = '';
  if (hasServiceAccount) {
    try {
      const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON!);
      serviceAccountEmail = creds.client_email || '';
    } catch {}
  }

  return NextResponse.json({
    configured: hasServiceAccount,
    serviceAccountEmail,
    sheetId,
  });
}

export async function POST(request: Request) {
  const body = await request.json();

  if (body.serviceAccountJson) {
    // Validate JSON
    let parsed;
    try {
      parsed = typeof body.serviceAccountJson === 'string'
        ? JSON.parse(body.serviceAccountJson)
        : body.serviceAccountJson;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in service account file' }, { status: 400 });
    }

    if (!parsed.client_email || !parsed.private_key) {
      return NextResponse.json(
        { error: 'JSON is missing required fields (client_email, private_key). Make sure you uploaded a service account key file.' },
        { status: 400 }
      );
    }

    // Save to .env
    const jsonStr = JSON.stringify(parsed);
    let env = getEnvContent();
    env = setEnvVar(env, 'GOOGLE_SERVICE_ACCOUNT_JSON', `'${jsonStr}'`);
    writeFileSync(ENV_PATH, env);

    // Update runtime env so it takes effect without restart
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON = jsonStr;

    return NextResponse.json({
      ok: true,
      serviceAccountEmail: parsed.client_email,
      message: 'Service account configured. Share your Google Sheet with: ' + parsed.client_email,
    });
  }

  if (body.sheetId !== undefined) {
    let env = getEnvContent();
    env = setEnvVar(env, 'GOOGLE_SHEET_ID', body.sheetId);
    writeFileSync(ENV_PATH, env);
    process.env.GOOGLE_SHEET_ID = body.sheetId;

    return NextResponse.json({ ok: true, sheetId: body.sheetId });
  }

  return NextResponse.json({ error: 'No action specified' }, { status: 400 });
}
