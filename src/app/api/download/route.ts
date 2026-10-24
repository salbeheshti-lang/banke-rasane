import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    // Try multiple possible paths
    const possiblePaths = [
      join(process.cwd(), 'download', 'BankResaneh-Portable-2.0.0.zip'),
      join(process.cwd(), '..', 'download', 'BankResaneh-Portable-2.0.0.zip'),
      '/home/z/my-project/download/BankResaneh-Portable-2.0.0.zip',
    ];
    
    let filePath: string | null = null;
    for (const p of possiblePaths) {
      if (existsSync(p)) {
        filePath = p;
        break;
      }
    }
    
    if (!filePath) {
      return NextResponse.json({ 
        error: 'File not found', 
        tried: possiblePaths,
        cwd: process.cwd() 
      }, { status: 404 });
    }
    
    const stats = await stat(filePath);
    const data = await readFile(filePath);
    
    return new NextResponse(data, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="BankResaneh-Portable-2.0.0.zip"',
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    return NextResponse.json({ error: 'Server error', details: String(error) }, { status: 500 });
  }
}
