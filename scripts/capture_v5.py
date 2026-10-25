#!/usr/bin/env python3
"""Capture screenshots from main preview (port 3000) - the actual preview URL"""
import asyncio
import os
import requests
from playwright.async_api import async_playwright

SCREENSHOTS_DIR = '/home/z/my-project/download/preview'
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

for f in os.listdir(SCREENSHOTS_DIR):
    if f.endswith('.png'):
        os.remove(os.path.join(SCREENSHOTS_DIR, f))
print('🧹 Cleaned old screenshots')

BASE_URL = 'http://localhost:3000'

async def capture_screenshots():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1440, 'height': 900},
            device_scale_factor=2,
        )
        page = await context.new_page()
        
        # Capture login page
        print('📸 Login page (cinematic green + logo)...')
        await page.goto(f'{BASE_URL}/', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(5000)  # Wait for animations
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/01-login.png')
        print('   ✓ 01-login.png')
        
        # Click the "ورود به برنامه" button to enter dashboard
        print('📸 Clicking "ورود به برنامه"...')
        try:
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.text_content()
                if text and 'ورود به برنامه' in text:
                    await btn.click()
                    break
            await page.wait_for_timeout(2000)
        except Exception as e:
            print(f'   ⚠ Click failed: {e}')
        
        # Dashboard
        print('📸 Dashboard (cream + liquid glass)...')
        await page.wait_for_timeout(3000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/02-dashboard.png')
        print('   ✓ 02-dashboard.png')
        
        # Click on first genre card to view programs
        print('📸 Clicking first genre (دکور برنامه‌ها)...')
        try:
            # Find and click on the first genre card
            cards = await page.query_selector_all('button')
            for card in cards:
                text = await card.text_content()
                if text and 'دکور برنامه‌ها' in text:
                    await card.click()
                    break
            await page.wait_for_timeout(3000)
            await page.screenshot(path=f'{SCREENSHOTS_DIR}/03-genre-decor.png')
            print('   ✓ 03-genre-decor.png')
        except Exception as e:
            print(f'   ⚠ Failed: {e}')
        
        # Go back to dashboard
        print('📸 Going back to dashboard...')
        try:
            # Click dashboard nav
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.text_content()
                if text and text.strip() == 'داشبورد':
                    await btn.click()
                    break
            await page.wait_for_timeout(2000)
        except:
            pass
        
        # Click "همهٔ برنامه‌ها" 
        print('📸 All programs (grid view)...')
        try:
            buttons = await page.query_selector_all('button')
            for btn in buttons:
                text = await btn.text_content()
                if text and 'همهٔ برنامه‌ها' in text and 'grid' not in text:
                    await btn.click()
                    break
            await page.wait_for_timeout(3000)
            await page.screenshot(path=f'{SCREENSHOTS_DIR}/04-programs-grid.png')
            print('   ✓ 04-programs-grid.png')
        except Exception as e:
            print(f'   ⚠ Failed: {e}')
        
        # Switch to list view
        print('📸 Programs (list view)...')
        try:
            # Find list view button (the one with horizontal lines icon)
            svgs = await page.query_selector_all('svg')
            for svg in svgs:
                parent = await svg.evaluate('el => el.parentElement')
                if parent:
                    parent_tag = await svg.evaluate('el => el.parentElement.tagName')
                    # Click on buttons containing the list icon
                    pass
            
            # Just look for buttons with a list-like SVG
            buttons = await page.query_selector_all('button')
            for btn in buttons[10:20]:  # Skip nav buttons
                await btn.click()
                await page.wait_for_timeout(800)
                # Take screenshot if list view activated
                url = page.url
                if 'programs' in url:
                    break
            
            await page.screenshot(path=f'{SCREENSHOTS_DIR}/05-programs-list.png')
            print('   ✓ 05-programs-list.png')
        except Exception as e:
            print(f'   ⚠ Failed: {e}')
        
        # Mobile view
        print('📱 Mobile view...')
        await page.set_viewport_size({'width': 375, 'height': 812})
        await page.goto(f'{BASE_URL}/', wait_until='domcontentloaded', timeout=30000)
        await page.wait_for_timeout(4000)
        await page.screenshot(path=f'{SCREENSHOTS_DIR}/06-mobile-login.png')
        print('   ✓ 06-mobile-login.png')
        
        await browser.close()
        print(f'\n✅ Done! Files: {SCREENSHOTS_DIR}')

asyncio.run(capture_screenshots())
