#!/usr/bin/env python3
"""
All-in-one: start dev server, capture screenshots, stop server.
This is the only reliable way in this sandboxed environment.
"""
import subprocess
import time
import os
import sys
import asyncio
import signal
import requests
from playwright.async_api import async_playwright

PROJECT_DIR = '/home/z/my-project'
SCREENSHOTS_DIR = '/home/z/my-project/download/preview'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# Clean old
for f in os.listdir(SCREENSHOTS_DIR):
    if f.endswith('.png'):
        os.remove(os.path.join(SCREENSHOTS_DIR, f))
print('🧹 Cleaned old screenshots')

BASE_URL = 'http://127.0.0.1:3000'

def wait_for_server(timeout=90):
    print('⏳ Waiting for server...', end='', flush=True)
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
            device_scale_factor=2,
        )
        page = await context.new_page()
        
        # Login page
        print('📸 Login page...')
        await page.goto(f'{BASE_URL}/', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(5000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/01-login.png')
        print('   ✓ 01-login.png')
        
        # Click "ورود به برنامه"
        print('📸 Clicking "ورود به برنامه"...')
        try:
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.text_content()
                if text and 'ورود به برنامه' in text:
                    await btn.click()
                    break
            await page.wait_for_timeout(2500)
        except Exception as e:
            print(f'   ⚠ Click failed: {e}')
        
        # Dashboard
        print('📸 Dashboard...')
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/02-dashboard.png')
        print('   ✓ 02-dashboard.png')
        
        # Click first genre card
        print('📸 Clicking دکور برنامه‌ها genre...')
        try:
            cards = await page.query_selector_all('button')
            for card in cards:
                text = await card.text_content()
                if text and 'دکور برنامه‌ها' in text and 'مشاهده' in text:
                    await card.click()
                    break
            await page.wait_for_timeout(3000)
            await page.screenshot(path=f'{SCREENSHOTS_DIR}/03-genre-decor.png')
            print('   ✓ 03-genre-decor.png')
        except Exception as e:
            print(f'   ⚠ Failed: {e}')
        
        # Mobile view
        print('📱 Mobile view...')
        await page.set_viewport_size({'width': 375, 'height': 812})
        await page.goto(f'{BASE_URL}/', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(4000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/04-mobile-login.png')
        print('   ✓ 04-mobile-login.png')
        
        await browser.close()
        print(f'\n✅ Done! Files in: {SCREENSHOTS_DIR}')

def main():
    # Kill any existing dev servers
    subprocess.run(['pkill', '-9', '-f', 'next'], capture_output=True)
    subprocess.run(['pkill', '-9', '-f', 'bun'], capture_output=True)
    time.sleep(3)
    
    print('🚀 Starting Next.js dev server...')
    
    server = subprocess.Popen(
        ['bun', 'run', 'dev'],
        cwd=PROJECT_DIR,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        preexec_fn=os.setsid,
    )
    
    try:
        if not wait_for_server(90):
            server.terminate()
            try:
                out, _ = server.communicate(timeout=5)
                print(out.decode()[-2000:])
            except:
                pass
            sys.exit(1)
        
        print('\n📸 Capturing screenshots...\n')
        asyncio.run(capture_screenshots())
        
    finally:
        print('\n🛑 Stopping server...')
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
