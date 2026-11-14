import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { requireUser, gatePermissionAny } from '@/lib/server-auth';
import { getDataFile } from '@/lib/data-dir';

export const runtime = 'nodejs';

// Store report settings in the writable data directory (NOT process.cwd()/data,
// which is read-only under Program Files on Windows). The data dir resolves to:
//   - Electron production: %APPDATA%\banke-rasane\
//   - Dev mode: project root /data
const SETTINGS_FILE = getDataFile('report-settings.json');

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
// Auth: any authenticated user (admin/editor/viewer). The settings contain
// only the report title/subtitle/organization — no secrets — but we still
// require login so anonymous users cannot probe the endpoint. Previously
// this was fully public, which contradicted the file's own comment.
export async function GET(request: NextRequest) {
  const user = await requireUser(request);
  if (!user) {
    return NextResponse.json({ ok: false, error: 'احراز هویت لازم است' }, { status: 401 });
  }
  return NextResponse.json(readSettings());
}

// POST → save updated settings. Body: { title?, subtitle?, organization? }
// Auth: admins and managers/editors who can export reports may manage report defaults.
export async function POST(request: NextRequest) {
  // --- Auth: only admins (manage_settings permission) can change report settings ---
  const gate = await gatePermissionAny(request, 'manage_settings', 'export_reports');
  if (!gate.ok) {
    return NextResponse.json({ ok: false, error: gate.status === 401 ? 'احراز هویت لازم است' : 'دسترسی غیرمجاز — فقط مدیران و مدیران اجرایی می‌توانند تنظیمات گزارش را تغییر دهند' }, { status: gate.status });
  }
  const admin = gate.user;
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
