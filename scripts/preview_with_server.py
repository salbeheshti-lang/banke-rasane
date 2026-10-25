#!/usr/bin/env python3
"""
Start Next.js dev server and capture screenshots in the same process.
This ensures the dev server stays alive during capture.
"""
import subprocess
import time
import os
import sys
import asyncio
import signal
import requests
from playwright.async_api import async_playwright

PROJECT_DIR = '/home/z/my-project/workspace/new_repo'
SCREENSHOTS_DIR = '/home/z/my-project/download/preview'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

BASE_URL = 'http://127.0.0.1:3000'

def wait_for_server(timeout=60):
    """Wait for server to be ready"""
    print('Waiting for server...', end='', flush=True)
    for i in range(timeout):
        try:
            r = requests.get(BASE_URL, timeout=2)
            if r.status_code in (200, 304):
                print(f' Ready! (HTTP {r.status_code})')
                return True
        except:
            pass
        print('.', end='', flush=True)
        time.sleep(1)
    print(' Failed!')
    return False

async def capture_screenshots():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1440, 'height': 900},
            device_scale_factor=1,
        )
        page = await context.new_page()
        
        captures = [
            ('/', '01-login.png', 'Login page'),
            ('/dashboard', '02-dashboard.png', 'Dashboard'),
            ('/programs', '03-programs-grid.png', 'Programs (grid)'),
            ('/genre/1', '04-genre-decor.png', 'Genre: Decor (560 programs)'),
            ('/genre/3', '05-genre-documentary.png', 'Genre: Documentaries'),
            ('/dashboard/reports', '06-reports.png', 'Reports'),
        ]
        
        for path, filename, description in captures:
            print(f'📸 {description}...')
            try:
                await page.goto(f'{BASE_URL}{path}', wait_until='domcontentloaded', timeout=30000)
                # Wait for content to render (data fetching, etc.)
                await page.wait_for_timeout(4000)
                await page.screenshot(
                    path=os.path.join(SCREENSHOTS_DIR, filename),
                    full_page=False
                )
                print(f'   ✓ Saved {filename}')
            except Exception as e:
                print(f'   ⚠ Failed: {e}')
        
        # Selection mode capture (with interaction)
        print('📸 Selection mode...')
        try:
            await page.goto(f'{BASE_URL}/programs', wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3000)
            
            # Find and click the selection mode button
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.text_content()
                if text and ('انتخاب چندتایی' in text or 'انتخاب' in text):
                    await btn.click()
                    break
            await page.wait_for_timeout(1500)
            
            # Click on first 3 program cards
            cards = await page.query_selector_all('.cinema-card')
            for i, card in enumerate(cards[:4]):
                try:
                    await card.click()
                    await page.wait_for_timeout(300)
                except:
                    pass
            await page.wait_for_timeout(1000)
            await page.screenshot(
                path=os.path.join(SCREENSHOTS_DIR, '07-selection-mode.png'),
                full_page=False
            )
            print('   ✓ Saved 07-selection-mode.png')
        except Exception as e:
            print(f'   ⚠ Failed: {e}')
        
        # Mobile view
        print('📱 Mobile view...')
        try:
            await page.set_viewport_size({'width': 375, 'height': 812})
            await page.goto(f'{BASE_URL}/', wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3000)
            await page.screenshot(
                path=os.path.join(SCREENSHOTS_DIR, '08-mobile-login.png'),
                full_page=False
            )
            print('   ✓ Saved 08-mobile-login.png')
        except Exception as e:
            print(f'   ⚠ Failed: {e}')
        
        await browser.close()
        print(f'\n✅ All screenshots saved to: {SCREENSHOTS_DIR}')

def main():
    # Kill any existing next dev server
    subprocess.run(['pkill', '-f', 'next dev'], capture_output=True)
    subprocess.run(['pkill', '-f', 'next-server'], capture_output=True)
    time.sleep(2)
    
    # Start dev server
    print('🚀 Starting Next.js dev server...')
    env = os.environ.copy()
    env['DATABASE_URL'] = f'file:{PROJECT_DIR}/prisma/dev.db'
    
    server = subprocess.Popen(
        ['node', 'node_modules/.bin/next', 'dev', '-p', '3000', '-H', '127.0.0.1'],
        cwd=PROJECT_DIR,
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    
    try:
        if not wait_for_server(60):
            # Print server output for debugging
            print('\n=== Server output ===')
            server.terminate()
            try:
                out, _ = server.communicate(timeout=5)
                print(out.decode()[-2000:])
            except:
                pass
            sys.exit(1)
        
        # Capture screenshots
        print('\n📸 Starting screenshot capture...\n')
        asyncio.run(capture_screenshots())
        
    finally:
        # Kill the server process group
        print('\n🛑 Stopping dev server...')
        try:
            os.killpg(os.getpgid(server.pid), signal.SIGTERM)
        except:
            pass
        try:
            server.wait(timeout=5)
        except:
            try:
                os.killpg(os.getpgid(server.pid), signal.SIGKILL)
            except:
                pass

if __name__ == '__main__':
    main()
