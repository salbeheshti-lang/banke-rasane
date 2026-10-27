#!/usr/bin/env python3
"""Enrich talk show data with Persian descriptions, links, and social post text"""
import json
import re
from urllib.parse import quote

with open('/home/z/my-project/public/talk-shows-data.json', 'r', encoding='utf-8') as f:
    shows = json.load(f)

def get_persian_desc(name, category):
    name_lower = name.lower()
    if 'late night' in name_lower or 'tonight' in name_lower or 'late show' in name_lower:
        return 'برنامهٔ گفتگوی شبانه با میزبانانی برجسته، شامل مصاحبه با سلبریتی‌ها، اجرای موسیقی زنده و طنز. هر شب با مهمانان جدید و موضوعات داغ روز.'
    if 'morning' in name_lower or 'breakfast' in name_lower or 'sunrise' in name_lower or 'morgen' in name_lower:
        return 'برنامهٔ صبحگاهی روزانه با اخبار، مصاحبه‌ها، آشپزی، سلامت و سرگرمی. مناسب برای شروع روز با انرژی و اطلاعات.'
    if 'news' in name_lower or 'press' in name_lower or 'polit' in name_lower or 'headline' in name_lower:
        return 'برنامهٔ خبری-تحلیلی با بررسی رویدادهای روز، مصاحبه با کارشناسان و تحلیل سیاسی. پوشش زنده اخبار داخلی و خارجی.'
    if 'comedy' in name_lower or 'funny' in name_lower or 'laugh' in name_lower or 'bang' in name_lower:
        return 'برنامهٔ طنز و کمدی با اسکچ‌های طنز، مصاحبه‌های خنده‌دار و اجرای استندآپ کمدی. سرگرمی خالص با طنز.'
    if 'cook' in name_lower or 'food' in name_lower or 'kitchen' in name_lower or 'chef' in name_lower:
        return 'برنامهٔ آشپزی با آموزش دستور پخت غذاهای متنوع، نکات آشپزی حرفه‌ای و مصاحبه با سرآشپزهای معروف.'
    if 'talk' in name_lower or 'interview' in name_lower or 'conversation' in name_lower or 'chat' in name_lower:
        return 'برنامهٔ مصاحبه‌محور با گفتگوی عمیق با مهمانان از دنیای هنر، فرهنگ و اجتماع. بررسی مسائل روز و تجربیات شخصی.'
    if 'sport' in name_lower or 'futbol' in name_lower or 'football' in name_lower or 'espn' in name_lower:
        return 'برنامهٔ ورزشی با تحلیل مسابقات، اخبار ورزشی، مصاحبه با ورزشکاران و بحث پنلی دربارهٔ football و سایر ورزش‌ها.'
    if 'music' in name_lower or 'concert' in name_lower or 'song' in name_lower or 'sketchbook' in name_lower:
        return 'برنامهٔ موسیقی با اجرای زنده، مصاحبه با هنرمندان و بررسی جدیدترین آهنگ‌ها. فضایی برای کشف استعدادهای موسیقی.'
    if 'culture' in name_lower or 'art' in name_lower or 'literar' in name_lower or 'book' in name_lower:
        return 'برنامهٔ فرهنگی-هنری با بررسی کتاب‌ها، نمایشگاه‌ها، سینما و هنر. گفتگو با نویسندگان، هنرمندان و روشنفکران.'
    if 'fashion' in name_lower or 'beauty' in name_lower:
        return 'برنامهٔ مد و زیبایی با بررسی ترندهای روز، نکات آرایشی، مشاوره مد و مصاحبه با طراحان.'
    if 'kid' in name_lower or 'child' in name_lower or 'elmo' in name_lower:
        return 'برنامهٔ کودک با بازی، آموزش، انیمیشن و سرگرمی مناسب برای کودکان. فضایی شاد و امن برای رشد خلاقیت.'
    if 'game' in name_lower or 'gaming' in name_lower or 'arcade' in name_lower:
        return 'برنامهٔ بازی‌های ویدیویی با بررسی بازی‌های جدید، اخبار گیمینگ و مسابقات. فضایی برای گیمرها.'
    if 'radio' in name_lower or 'audio' in name_lower:
        return 'برنامهٔ رادیویی-صوتی با گفتگو، موسیقی و داستان‌سرایی. مناسب برای شنیدار در حال حرکت.'
    if 'reality' in name_lower or 'competition' in name_lower or 'talent' in name_lower or 'genius' in name_lower:
        return 'برنامهٔ مسابقه‌ای-رئالیتی با چالش‌های هیجان‌انگیز، رأی‌گیری بینندگان و مسابقات استعدادیابی.'
    if 'doctor' in name_lower or 'health' in name_lower or 'medical' in name_lower:
        return 'برنامهٔ سلامت با مشاوره پزشکی، نکات بهداشتی و بررسی بیماری‌های شایع. پاسخ به سؤالات سلامتی بینندگان.'
    if 'travel' in name_lower or 'world' in name_lower or 'tour' in name_lower:
        return 'برنامهٔ سفر و گردشگری با معرفی مقاصد، فرهنگ‌ها و تجربیات سفر. کشف دنیا از طریق تصویر.'
    return 'برنامهٔ گفتگومی تلویزیونی با مصاحبه، بحث و بررسی موضوعات متنوع. فضایی صمیمی برای گفتگو با مهمانان.'

def get_links(name):
    encoded = quote(name)
    return {
        'youtube': f'https://www.youtube.com/results?search_query={encoded}',
        'imdb': f'https://www.imdb.com/find?q={encoded}',
        'wikipedia': f'https://fa.wikipedia.org/w/index.php?search={encoded}',
    }

def get_social_post(name, category, summary):
    cat_clean = re.sub(r'^\d+\.\s*', '', category) if category else ''
    cat_short = cat_clean[:30] if cat_clean else ''
    summ = summary[:100] if summary and summary != '—' else 'برنامهٔ گفتگومی تلویزیونی'
    return f'🎬 {name}\n\n📝 {summ}\n\n🏷 {cat_short}\n\n#بانک_رسانه #تاک_شو #برنامه_تلویزیونی'

for s in shows:
    s['descriptionFa'] = get_persian_desc(s['name'], s.get('category', ''))
    links = get_links(s['name'])
    s['youtube'] = links['youtube']
    s['imdb'] = links['imdb']
    s['wikipedia'] = links['wikipedia']
    s['socialPost'] = get_social_post(s['name'], s.get('category', ''), s.get('summary', ''))

with open('/home/z/my-project/public/talk-shows-data.json', 'w', encoding='utf-8') as f:
    json.dump(shows, f, ensure_ascii=False, indent=2)

print(f'Enriched {len(shows)} shows')
print('Sample (first show):')
print(json.dumps(shows[0], ensure_ascii=False, indent=2)[:800])
