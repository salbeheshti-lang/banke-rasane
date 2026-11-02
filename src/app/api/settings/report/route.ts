import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';

const SETTINGS_FILE = path.join(process.cwd(), 'data', 'report-settings.json');

interface ReportSettings {
  title: string;
  subtitle: string;
  organization: string;
  updatedAt?: string;
}

const DEFAULTS: ReportSettings = {
  title: 'گزارش جامع آرشیو برنامه‌های تلویزیونی',
  subtitle: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی',
  organization: 'بانک رسانه',
};

function readSettings(): ReportSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const raw = fs.readFileSync(SETTINGS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title : DEFAULTS.title,
        subtitle: typeof parsed.subtitle === 'string' && parsed.subtitle.trim() ? parsed.subtitle : DEFAULTS.subtitle,
        organization: typeof parsed.organization === 'string' && parsed.organization.trim() ? parsed.organization : DEFAULTS.organization,
        updatedAt: parsed.updatedAt,
      };
    }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULTS };
}

function writeSettings(s: ReportSettings) {
  const dir = path.dirname(SETTINGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...s, updatedAt: new Date().toISOString() }, null, 2), 'utf-8');
}

// GET → return current persisted settings (or defaults).
export async function GET() {
  return NextResponse.json(readSettings());
}

// POST → save updated settings. Body: { title?, subtitle?, organization? }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const current = readSettings();
    const next: ReportSettings = {
      title: typeof body.title === 'string' && body.title.trim() ? body.title.trim() : current.title,
      subtitle: typeof body.subtitle === 'string' && body.subtitle.trim() ? body.subtitle.trim() : current.subtitle,
      organization: typeof body.organization === 'string' && body.organization.trim() ? body.organization.trim() : current.organization,
    };
    writeSettings(next);
    return NextResponse.json({ ok: true, settings: next });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
