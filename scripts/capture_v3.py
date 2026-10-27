#!/usr/bin/env python3
"""Capture screenshots from Bank Rasane (port 3001) - new design"""
import asyncio
import os
from playwright.async_api import async_playwright

SCREENSHOTS_DIR = '/home/z/my-project/download/preview'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

# Clean old screenshots
for f in os.listdir(SCREENSHOTS_DIR):
    if f.endswith('.png'):
        os.remove(os.path.join(SCREENSHOTS_DIR, f))
print('🧹 Cleaned old screenshots')

BASE_URL = 'http://localhost:3001'

async def capture_screenshots():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1440, 'height': 900},
            device_scale_factor=2,
        )
        page = await context.new_page()
        
        captures = [
            ('/', '01-login.png', 'Login page (cinematic green + logo)'),
            ('/dashboard', '02-dashboard.png', 'Dashboard (cream + liquid glass)'),
            ('/programs', '03-programs-grid.png', 'Programs (grid view)'),
            ('/genre/1', '04-genre-decor.png', 'Genre: Decor (560 programs)'),
            ('/genre/3', '05-genre-documentary.png', 'Genre: Documentaries'),
            ('/dashboard/reports', '06-reports.png', 'Reports'),
        ]
        
        for path, filename, description in captures:
            print(f'📸 {description}...')
            try:
                await page.goto(f'{BASE_URL}{path}', wait_until='domcontentloaded', timeout=30000)
                await page.wait_for_timeout(5000)  # Wait for animations + data
                await page.screenshot(
                    path=os.path.join(SCREENSHOTS_DIR, filename),
                    full_page=False
                )
                print(f'   ✓ Saved {filename}')
            except Exception as e:
                print(f'   ⚠ Failed: {e}')
        
        # Selection mode
        print('📸 Selection mode...')
        try:
            await page.goto(f'{BASE_URL}/programs', wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3000)
            
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.text_content()
                if text and 'انتخاب چندتایی' in text:
                    await btn.click()
                    break
            await page.wait_for_timeout(1500)
            
            cards = await page.query_selector_all('.program-card')
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
        print('📱 Mobile view (login)...')
        try:
            await page.set_viewport_size({'width': 375, 'height': 812})
            await page.goto(f'{BASE_URL}/', wait_until='domcontentloaded', timeout=30000)
            await page.wait_for_timeout(3500)
            await page.screenshot(
                path=os.path.join(SCREENSHOTS_DIR, '08-mobile-login.png'),
                full_page=False
            )
            print('   ✓ Saved 08-mobile-login.png')
        except Exception as e:
            print(f'   ⚠ Failed: {e}')
        
        await browser.close()
        print(f'\n✅ All screenshots saved to: {SCREENSHOTS_DIR}')

asyncio.run(capture_screenshots())
