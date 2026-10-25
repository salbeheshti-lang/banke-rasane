#!/usr/bin/env python3
"""
Translate English descriptions in the Excel file to Persian.
Only modifies the "خلاصه دکور" column - keeps everything else the same.
"""
import openpyxl
import re
import os

# Translation dictionary - maps English text (or part of it) to Persian
TRANSLATIONS = {
    # BBC Breakfast
    "A modern television studio set featuring a curved red sofa, a circular white table, and a large digital background screen.":
    "دکور استودیوی تلویزیونی مدرن با مبل قرمز منحنی، میز سفید دایره‌ای و صفحه نمایش دیجیتال بزرگ.",

    # Between Two Ferns
    "A minimalist studio with a dark background, dramatic lighting, and a single plant for decoration.":
    "دکور استودیوی مینیمالیستی با پس‌زمینه تاریک، نورپردازی دراماتیک و یک گیاه برای تزئین.",

    # Colpo Di Genio
    "This is a modern, high-tech studio with a transparent glass floor, industrial-style metal structures, and integrated live music performance areas.":
    "دکور استودیویی مدرن و پیشرفته با کف شیشه‌ای شفاف، سازه‌های فلزی صنعتی و فضای اجرای موسیقی زنده.",

    # !Comedy Bang! Bang
    "A surreal and psychedelic studio decor featuring a space-themed backdrop with a giant brain and an octopus-like creature.":
    "دکور استودیویی سوررئال و سایکدلیک با پس‌زمینه فضایی، مغز غول‌پیکر و موجودی شبیه هشت‌پا.",

    # Bokura no jidai
    "A modern, minimalist urban landscape featuring tall glass buildings, cherry blossom trees, and a solitary figure.":
    "منظره شهری مدرن و مینیمالیستی با ساختمان‌های شیشه‌ای بلند، درختان شکوفه گیلاس و یک فرد تنها.",

    # Brekky Central Sunrise
    "This is a modern, bright studio space featuring a clean white makeup area and professional lighting.":
    "دکور فضای استودیویی مدرن و روشن با بخش گریم سفید تمیز و نورپردازی حرفه‌ای.",

    # Brian Mørk Show
    "A digital virtual studio set with a space-themed background and graphic overlays.":
    "دکور استودیوی مجازی دیجیتال با پس‌زمینه فضایی و لایه‌های گرافیکی.",

    # Berman & Berman
    "This is a modern talk show studio with a warm, inviting atmosphere, featuring a purple backdrop, comfortable seating for guests and an audience.":
    "دکور استودیوی تاک‌شوی مدرن با فضایی گرم و دعوت‌کننده، پس‌زمینه بنفش، صندلی‌های راحتی برای مهمانان و تماشاگران.",

    # Lopez Tonight (mixed)
    "دکور استودیو مدرن و لوکسی با نورپردازی دراماتیک، فضای موسیقی زنده و حضور مخاطب است. This is a modern talk show studio with a dark, high-tech atmosphere featuring blue LED backdrops and a live audience.":
    "دکور استودیو مدرن و لوکسی با نورپردازی دراماتیک، فضای موسیقی زنده، پس‌زمینه LED آبی و حضور مخاطب.",

    # On ne peut pas plaire à tout le monde (mixed)
    "دکور استودیو مدرن و لوکسی با فضای باز، میز گرد برای بحث گروهی و حضور مخاطبان زنده است. This is a modern TV studio with a warm, inviting atmosphere featuring wooden structural elements and a live audience.":
    "دکور استودیو مدرن و لوکسی با فضای باز، میز گرد برای بحث گروهی، عناصر سازه‌ای چوبی و حضور مخاطبان زنده.",

    # Senkveld med HC og Tommy
    "A modern, medium-sized studio with a warm color palette and LED screens, designed for intimate interviews and live musical performances.":
    "دکور استودیوی مدرن با اندازه متوسط، پالت رنگی گرم و صفحه‌های LED، طراحی شده برای مصاحبه‌های صمیمی و اجراهای موسیقی زنده.",

    # Satyamev Jayate (mixed)
    "دکور استودیو مدرن و گرم با صحنه دایره‌ای، تماشاگران زنده و ترکیبی از عناصر فیزیکی و دیجیتال. This is a modern, high-tech studio with a large audience, featuring an LED-heavy design in blue tones.":
    "دکور استودیو مدرن و گرم با صحنه دایره‌ای، تماشاگران زنده، طراحی LED سنگین با رنگ آبی و ترکیبی از عناصر فیزیکی و دیجیتال.",

    # Sports Nation
    "A modern and high-tech sports studio featuring large LED screens, a sleek desk, and a dynamic color palette of red, blue, and black.":
    "دکور استودیوی ورزشی مدرن و پیشرفته با صفحه‌های LED بزرگ، میز شیک و پالت رنگی پویای قرمز، آبی و مشکی.",

    # Tetris
    "A modern, high-contrast studio design featuring a bold red and black color palette with a panel-style layout and visible audience seating.":
    "دکور استودیوی مدرن با کنتراست بالا، پالت رنگی جسورانه قرمز و مشکی، چیدمان پنلی و صندلی‌های تماشاگران قابل مشاهده.",

    # The Break with Michelle Wolf
    "This is a modern, luxurious talk show studio featuring a large performance stage, dramatic LED-based lighting in blue and purple tones, and a live audience.":
    "دکور استودیوی تاک‌شوی مدرن و لوکس با صحنه اجرای بزرگ، نورپردازی دراماتیک LED با رنگ‌های آبی و بنفش و تماشاگران زنده.",

    # Vecher s Vladimirom Solovyovym
    "A high-tech, modern television studio with a sleek design, featuring extensive LED screens and a cool blue color palette.":
    "دکور استودیوی تلویزیونی مدرن و پیشرفته با طراحی شیک، صفحه‌های LED گسترده و پالت رنگی آبی خنثی.",

    # Vendredi c'est Julie
    "This is a modern, large-scale talk show studio featuring a live audience, digital backdrops, and a dedicated performance area for musicians.":
    "دکور استودیوی تاک‌شوی مدرن و بزرگ با تماشاگران زنده، پس‌زمینه‌های دیجیتال و فضای اختصاصی اجرای موسیقی.",

    # Dopo Festival
    "A modern, high-tech, and luxurious studio design featuring a large circular stage, vibrant LED lighting, and a live audience.":
    "دکور استودیویی مدرن، پیشرفته و لوکس با صحنه دایره‌ای بزرگ، نورپردازی LED زنده و تماشاگران حاضر.",

    # The Ellen DeGeners Show (mixed)
    "دکور استودیو مدرن و روشن با صندلی‌های سفید، پس‌زمینه آبی LED و گیاهان زنده که فضایی دوستانه و صمیمی ایجاد کرده است. A modern and luxurious talk show studio with a live audience, featuring vibrant colors, digital screens, and a mix of physical and virtual set elements.":
    "دکور استودیو مدرن و لوکس با صندلی‌های سفید، پس‌زمینه آبی LED، گیاهان زنده، رنگ‌های زنده، صفحه‌های دیجیتال و ترکیبی از عناصر فیزیکی و مجازی که فضایی دوستانه و صمیمی با تماشاگران زنده ایجاد کرده است.",

    # Mustafas Show
    "This is a modern, large-scale talk show studio featuring colorful armchairs, a live audience, and a dynamic stage with integrated digital screens and a live band.":
    "دکور استودیوی تاک‌شوی مدرن و بزرگ با مبل‌های رنگارنگ، تماشاگران زنده، صحنه پویا با صفحه‌های دیجیتال یکپارچه و گروه موسیقی زنده.",

    # Cycology Today
    "A simple and functional studio with a blue background and a red floor, designed for panel discussions.":
    "دکور استودیویی ساده و کاربردی با پس‌زمینه آبی و کف قرمز، طراحی شده برای بحث‌های پنلی.",

    # Geneve e Chaud
    "This is a modern, medium-sized TV studio designed for panel discussions, featuring a large circular table, prominent LED background screens, and a clean, professional aesthetic.":
    "دکور استودیوی تلویزیونی مدرن با اندازه متوسط، طراحی شده برای بحث‌های پنلی، با میز دایره‌ای بزرگ، صفحه‌های LED برجسته پس‌زمینه و زیبایی‌شناسی تمیز و حرفه‌ای.",

    # Greeks on the Roof
    "This is a modern, dramatic studio design with a live band, a red sofa set, and an audience presence.":
    "دکور استودیویی مدرن و دراماتیک با گروه موسیقی زنده، مبل‌های قرمز و حضور تماشاگران.",

    # The Wright Stuff
    "A modern, colorful TV studio featuring curved desks, large windows, and a mix of panel and interview seating arrangements.":
    "دکور استودیوی تلویزیونی مدرن و رنگارنگ با میزهای منحنی، پنجره‌های بزرگ و ترکیبی از چیدمان صندلی‌های پنلی و مصاحبه.",

    # The Hour
    "This is a modern talk show studio with red armchairs, large LED screens, and a live audience.":
    "دکور استودیوی تاک‌شوی مدرن با مبل‌های قرمز، صفحه‌های LED بزرگ و تماشاگران زنده.",

    # The Late Late Show with James Corden (mixed)
    "دکور استودیوی تلویزیونی مدرن و لوکس با ترکیبی از چوب‌های گرم، نورهای بنفش دراماتیک و عناصر کتابخانه‌ای برای ایجاد فضایی صمیمی و هنری. A luxurious and eclectic talk show set featuring a cozy interview area with a library backdrop and a dedicated live music stage. دکور استودیو با طراحی مدرن و لوکس شام":
    "دکور استودیوی تلویزیونی مدرن و لوکس با ترکیبی از چوب‌های گرم، نورهای بنفش دراماتیک، عناصر کتابخانه‌ای، فضای مصاحبه دنج با پس‌زمینه کتابخانه و صحنه اختصاصی موسیقی زنده که فضایی صمیمی و هنری ایجاد کرده است.",

    # The Late Show with Stephen Colbert
    "A modern, multi-level studio with a warm, industrial aesthetic featuring a desk, guest seating, and a dedicated live music performance area.":
    "دکور استودیویی مدرن و چندسطحی با زیبایی‌شناسی صنعتی گرم، شامل میز، صندلی‌های مهمان و فضای اختصاصی اجرای موسیقی زنده.",

    # Was it something I said
    "This is a modern and vibrant TV studio set with a panel layout, featuring bold LED lighting and a colorful purple-red color scheme.":
    "دکور استودیوی تلویزیونی مدرن و پرانرژی با چیدمان پنلی، نورپردازی LED جسورانه و پالت رنگی بنفش-قرمز رنگارنگ.",

    # The Graham Norton Show (mixed)
    "دکور استودیو مدرن و لوکسی با نورپردازی بنفش و آبی، سکوهای دایره‌ای متعدد و صفحه‌های نمایشگر بزرگ LED است. This is a modern, vibrant studio with a bold color palette of red and purple, featuring a panel layout and dynamic LED lighting.":
    "دکور استودیو مدرن و لوکسی با نورپردازی بنفش و آبی، پالت رنگی جسورانه قرمز و بنفش، سکوهای دایره‌ای متعدد، صفحه‌های نمایشگر بزرگ LED و چیدمان پنلی با نورپردازی پویا.",

    # The Russell Howard Hour
    "A modern, high-tech studio with large LED screens, a live audience, and dramatic lighting.":
    "دکور استودیویی مدرن و پیشرفته با صفحه‌های LED بزرگ، تماشاگران زنده و نورپردازی دراماتیک.",

    # That's My Jam (mixed)
    "This is a modern, high-tech studio with a futuristic circular stage, dramatic lighting, and a live audience. دکور استودیو مدرن و لوکسی با تم فضایی، نورپردازی دراماتیک و ترکیبی از عناصر دیجیتال و فیزیکی است. دکور استودیو مدرن و لوکسی با نورپردازی دراماتیک، صفحه‌های LED تعاملی و فضایی مناسب برای اجرای":
    "دکور استودیویی مدرن، پیشرفته و لوکس با صحنه دایره‌ای آینده‌نگرانه، نورپردازی دراماتیک، تم فضایی، صفحه‌های LED تعاملی، تماشاگران زنده و ترکیبی از عناصر دیجیتال و فیزیکی.",
}

# Also fix English text in the خلاصه sheet
SUMMARY_FIXES = {
    "one-on-one_interview | panel/roundtable": "مصاحبه یک‌به‌یک | پنل/میزگرد",
    "bright and mixed": "روشن و ترکیبی",
}

def is_mostly_english(text):
    """Check if text contains significant English content."""
    if not text or not isinstance(text, str):
        return False
    english_words = re.findall(r'[A-Za-z]{3,}', text)
    return len(english_words) > 3

def translate_text(text):
    """Try to translate text using the dictionary."""
    if not text or not isinstance(text, str):
        return text
    
    # Try exact match first
    if text in TRANSLATIONS:
        return TRANSLATIONS[text]
    
    # Try stripped match
    stripped = text.strip()
    if stripped in TRANSLATIONS:
        return TRANSLATIONS[stripped]
    
    # If the text contains both Persian and English, try to find a matching key
    for eng_text, fa_text in TRANSLATIONS.items():
        if text == eng_text:
            return fa_text
        # Check if the text starts with or contains the English part
        if eng_text in text:
            return fa_text
    
    return text  # Return original if no translation found

def process_workbook(input_path, output_path):
    """Process the Excel file and translate English descriptions."""
    wb = openpyxl.load_workbook(input_path)
    
    total_translated = 0
    
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        
        # Find the "خلاصه دکور" column
        decor_col = None
        for row in range(1, min(5, ws.max_row + 1)):
            for col in range(1, ws.max_column + 1):
                val = ws.cell(row=row, column=col).value
                if val and 'خلاصه' in str(val) and 'دکور' in str(val):
                    decor_col = col
                    break
            if decor_col:
                break
        
        if decor_col is None:
            # For خلاصه sheet, check all cells for English text
            if sheet_name == 'خلاصه':
                for row in range(1, ws.max_row + 1):
                    for col in range(1, ws.max_column + 1):
                        val = ws.cell(row=row, column=col).value
                        if val and isinstance(val, str):
                            for eng, fa in SUMMARY_FIXES.items():
                                if eng in val:
                                    ws.cell(row=row, column=col).value = val.replace(eng, fa)
                                    total_translated += 1
                                    print(f"  [{sheet_name}] Row {row}, Col {col}: Fixed '{eng}' -> '{fa}'")
            continue
        
        print(f"\nProcessing sheet: {sheet_name} (خلاصه دکور column: {decor_col})")
        
        # Process each row
        for row in range(1, ws.max_row + 1):
            val = ws.cell(row=row, column=decor_col).value
            if val and isinstance(val, str) and is_mostly_english(val):
                translated = translate_text(val)
                if translated != val:
                    ws.cell(row=row, column=decor_col).value = translated
                    total_translated += 1
                    name = ws.cell(row=row, column=2).value or f"Row {row}"
                    print(f"  Row {row} ({name}): TRANSLATED")
                else:
                    print(f"  Row {row}: No translation found - '{val[:60]}...'")
    
    # Save
    wb.save(output_path)
    wb.close()
    
    print(f"\n✓ Total translations applied: {total_translated}")
    print(f"✓ Saved to: {output_path}")
    return total_translated

# Run
input_file = '/home/z/my-project/upload/talk-show-categorization-by-decor.xlsx'
output_file = '/home/z/my-project/download/talk-show-categorization-by-decor-fa.xlsx'

total = process_workbook(input_file, output_file)

# Verify
print("\n=== Verification ===")
wb2 = openpyxl.load_workbook(output_file)
ws = wb2['همه برنامه‌ها']
remaining_english = 0
for row in range(3, ws.max_row + 1):
    val = ws.cell(row=row, column=14).value
    if val and is_mostly_english(val):
        remaining_english += 1
        print(f"  Still English - Row {row}: {val[:80]}")

print(f"\nRemaining English descriptions: {remaining_english}")
wb2.close()
