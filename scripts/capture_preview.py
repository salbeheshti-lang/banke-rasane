#!/usr/bin/env python3
"""Capture screenshots of the Bank Rasane app for preview"""
import asyncio
import os
from playwright.async_api import async_playwright

SCREENSHOTS_DIR = '/home/z/my-project/download/preview'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

BASE_URL = 'http://localhost:3000'

async def capture_screenshots():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1440, 'height': 900},
            device_scale_factor=2,
        )
        page = await context.new_page()
        
        # 1. Login page
        print('📸 Capturing login page...')
        await page.goto(f'{BASE_URL}/', wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/01-login.png', full_page=False)
        print(f'  ✓ Saved 01-login.png')
        
        # 2. Dashboard
        print('📸 Capturing dashboard...')
        await page.goto(f'{BASE_URL}/dashboard', wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(3000)  # Wait for data to load
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/02-dashboard.png', full_page=False)
        print(f'  ✓ Saved 02-dashboard.png')
        
        # 3. Programs page (grid view)
        print('📸 Capturing programs page (grid)...')
        await page.goto(f'{BASE_URL}/programs', wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/03-programs-grid.png', full_page=False)
        print(f'  ✓ Saved 03-programs-grid.png')
        
        # 4. Programs with selection mode
        print('📸 Capturing selection mode...')
        # Click the selection toggle button
        try:
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.text_content()
                if text and 'انتخاب' in text:
                    await btn.click()
                    break
            await page.wait_for_timeout(1500)
            # Try to select a few programs
            cards = await page.query_selector_all('.cinema-card')
            for i, card in enumerate(cards[:3]):
                try:
                    await card.click()
                    await page.wait_for_timeout(200)
                except:
                    pass
            await page.wait_for_timeout(1000)
            await page.screenshot(path=f'{SCREENSHOTS_DIR}/04-selection-mode.png', full_page=False)
            print(f'  ✓ Saved 04-selection-mode.png')
        except Exception as e:
            print(f'  ⚠ Selection mode capture failed: {e}')
        
        # 5. Genre page (decor - 560 programs)
        print('📸 Capturing genre page (decor)...')
        await page.goto(f'{BASE_URL}/genre/1', wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/05-genre-decor.png', full_page=False)
        print(f'  ✓ Saved 05-genre-decor.png')
        
        # 6. Reports page
        print('📸 Capturing reports page...')
        await page.goto(f'{BASE_URL}/dashboard/reports', wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/06-reports.png', full_page=False)
        print(f'  ✓ Saved 06-reports.png')
        
        # 7. Mobile view (responsive check)
        print('📸 Capturing mobile view...')
        await page.set_viewport_size({'width': 375, 'height': 812})
        await page.goto(f'{BASE_URL}/', wait_until='networkidle', timeout=30000)
        await page.wait_for_timeout(2000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/07-mobile-login.png', full_page=False)
        print(f'  ✓ Saved 07-mobile-login.png')
        
        await browser.close()
        print(f'\n✅ All screenshots saved to: {SCREENSHOTS_DIR}')

asyncio.run(capture_screenshots())
