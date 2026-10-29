'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

// ============================================
// TYPES
// ============================================
export type Lang = 'fa' | 'en';

// ============================================
// STRINGS DICTIONARY
// Every UI string has both a Farsi (`fa`) and an English (`en`) value.
// `t('key')` returns the string for the current language, falling back to the key.
// Placeholders use {0}, {1}, ... and are substituted by `t('key', [arg1, arg2, ...])`.
// ============================================
export const STRINGS: Record<string, { fa: string; en: string }> = {
  // ---------- Loading screen ----------
  loading: { fa: 'در حال بارگذاری...', en: 'Loading...' },

  // ---------- Login screen ----------
  login_username: { fa: 'نام کاربری', en: 'Username' },
  login_password: { fa: 'رمز عبور', en: 'Password' },
  login_show_password: { fa: 'نمایش رمز', en: 'Show password' },
  login_hide_password: { fa: 'پنهان کردن رمز', en: 'Hide password' },
  login_submit: { fa: 'ورود به برنامه', en: 'Login' },
  login_submitting: { fa: 'در حال ورود...', en: 'Logging in...' },
  login_error_required: { fa: 'نام کاربری و رمز عبور را وارد کنید', en: 'Please enter username and password' },
  login_error_failed: { fa: 'ورود ناموفق بود', en: 'Login failed' },
  login_version: { fa: 'نسخه ۲.۰.۰ • بانک اطلاعاتی برنامه‌های تلویزیونی', en: 'Version 2.0.0 • TV Programs Database' },
  login_default_label: { fa: 'نام کاربری پیش‌فرض', en: 'Default username' },
  login_password_label: { fa: 'رمز', en: 'Password' },

  // ---------- Header / TopAppBar ----------
  view_dashboard: { fa: 'آرشیو تخصصی برنامه‌های تلویزیونی', en: 'TV Programs Archive' },
  view_programs: { fa: 'همهٔ برنامه‌ها', en: 'All Programs' },
  view_genre: { fa: 'برنامه‌های ژانر', en: 'Genre Programs' },
  view_reports: { fa: 'گزارش‌ها', en: 'Reports' },
  view_add: { fa: 'افزودن / ویرایش برنامه', en: 'Add / Edit Program' },
  banke_rasane: { fa: 'بانک رسانه', en: 'BankRasaneh' },
  version_short: { fa: 'نسخه ۲.۰.۰', en: 'Version 2.0.0' },
  back: { fa: 'بازگشت', en: 'Back' },
  back_aria: { fa: 'بازگشت به صفحهٔ قبل', en: 'Go back' },
  connected: { fa: 'متصل', en: 'Connected' },
  open_menu: { fa: 'باز کردن منو', en: 'Open menu' },
  close_menu: { fa: 'بستن منو', en: 'Close menu' },
  lang_toggle_aria: { fa: 'Switch to English', en: 'تغییر به فارسی' },

  // ---------- Drawer menu ----------
  nav_dashboard: { fa: 'آرشیو', en: 'Archive' },
  nav_dashboard_desc: { fa: 'صفحهٔ اصلی و ژانرها', en: 'Home page and genres' },
  nav_programs: { fa: 'همهٔ برنامه‌ها', en: 'All Programs' },
  nav_programs_desc: { fa: 'لیست کامل ۵۶۰ برنامه', en: 'Full list of 560 programs' },
  nav_add: { fa: 'افزودن برنامه', en: 'Add Program' },
  nav_add_desc: { fa: 'افزودن یا ویرایش برنامه', en: 'Add or edit a program' },
  nav_reports: { fa: 'گزارش‌ها', en: 'Reports' },
  nav_reports_desc: { fa: 'آمار و خروجی', en: 'Stats and exports' },
  genres_section: { fa: 'ژانرها', en: 'Genres' },
  settings: { fa: '⚙ تنظیمات', en: '⚙ Settings' },
  logout: { fa: 'خروج از حساب', en: 'Logout' },
  role_admin: { fa: 'مدیر سیستم', en: 'Administrator' },
  role_editor: { fa: 'ویراستار', en: 'Editor' },
  role_viewer: { fa: 'بیننده', en: 'Viewer' },

  // ---------- Mobile bottom nav ----------
  mobile_menu: { fa: 'منو', en: 'Menu' },
  mobile_archive: { fa: 'آرشیو', en: 'Archive' },
  mobile_programs: { fa: 'برنامه‌ها', en: 'Programs' },
  mobile_genres: { fa: 'ژانرها', en: 'Genres' },
  mobile_add: { fa: 'افزودن', en: 'Add' },
  mobile_logout: { fa: 'خروج', en: 'Logout' },

  // ---------- Dashboard ----------
  analytics_card_eyebrow: { fa: 'آرشیو تخصصی برنامه‌های تلویزیونی', en: 'Specialized TV Programs Archive' },
  analytics_card_title: { fa: 'توزیع برنامه‌ها بر اساس ژانر', en: 'Programs distribution by genre' },
  analytics_card_subtitle: {
    fa: '{0} برنامه در {1} ژانر — سهم هر دسته از کل آرشیو',
    en: '{0} programs in {1} genres — share of each category in the archive',
  },
  analytics_select_genres: { fa: 'انتخاب ژانرها', en: 'Select genres' },
  analytics_select_genres_title: { fa: 'انتخاب ژانرهای آمار', en: 'Select analytics genres' },
  total_programs_count: { fa: 'برنامهٔ کل', en: 'Total programs' },
  recent_programs: { fa: 'برنامهٔ اخیر', en: 'Recent programs' },
  programs_with_images: { fa: 'برنامهٔ با تصویر', en: 'Programs with images' },
  mini_published: { fa: 'منتشر شده', en: 'Published' },
  mini_with_images: { fa: 'با تصویر', en: 'With images' },
  mini_genres: { fa: 'ژانر', en: 'Genres' },
  mini_pdf_sources: { fa: 'PDF منبع', en: 'Source PDFs' },
  top_genres_list: { fa: 'پربرنامه‌ترین ژانرها', en: 'Top genres by count' },
  top_genres_count: { fa: '۵ از {0} ژانر', en: '5 of {0} genres' },
  showcase_admin_pick: { fa: 'برگزیده‌های مدیر', en: "Admin's picks" },
  showcase_popular: { fa: 'برنامه‌های پر بازدید', en: 'Most viewed programs' },
  showcase_subtitle: { fa: 'برای مشاهدهٔ جزئیات کلیک کنید', en: 'Click to see details' },
  showcase_select: { fa: 'انتخاب برنامه‌ها', en: 'Select programs' },
  showcase_prev: { fa: 'قبلی', en: 'Previous' },
  showcase_next: { fa: 'بعدی', en: 'Next' },
  genres_title: { fa: 'ژانرها', en: 'Genres' },
  add_genre_btn: { fa: '+ افزودن ژانر', en: '+ Add Genre' },
  add_program_btn: { fa: '+ افزودن برنامه', en: '+ Add Program' },
  programs_short: { fa: 'برنامه', en: 'programs' },
  view_and_search: { fa: 'مشاهده و جستجو', en: 'View and search' },
  program_aria_n: { fa: 'برنامهٔ {0}', en: 'Program {0}' },

  // ---------- Programs view ----------
  all_programs: { fa: 'همهٔ برنامه‌ها', en: 'All Programs' },
  search_in: { fa: 'جستجو در {0}...', en: 'Search in {0}...' },
  pdf_source_badge: { fa: '📄 منبع: فایل PDF', en: '📄 Source: PDF file' },
  view_grid_aria: { fa: 'نمایش شبکه‌ای', en: 'Grid view' },
  view_list_aria: { fa: 'نمایش لیستی', en: 'List view' },
  islamic_btn: { fa: '🌍 اسلامی', en: '🌍 Islamic' },
  islamic_btn_title: { fa: 'فقط برنامه‌های مرتبط با کشورهای اسلامی', en: 'Only programs related to Islamic countries' },
  multi_select: { fa: 'انتخاب چندتایی', en: 'Multi-select' },
  multi_select_active: { fa: '✓ انتخاب ({0})', en: '✓ Selected ({0})' },
  view_only: {
    fa: '🔒 فقط مشاهده — برای افزودن یا ویرایش با حساب مدیر وارد شوید',
    en: '🔒 View only — sign in as admin to add or edit',
  },
  view_only_title: {
    fa: 'برای افزودن یا ویرایش برنامه‌ها با حساب مدیر یا ویراستار وارد شوید',
    en: 'Sign in as admin or editor to add or edit programs',
  },
  filter_size: { fa: 'اندازه:', en: 'Size:' },
  filter_style: { fa: 'سبک:', en: 'Style:' },
  filter_all: { fa: 'همه', en: 'All' },
  filter_large: { fa: 'بزرگ/لوکس', en: 'Large/Luxury' },
  filter_medium: { fa: 'متوسط', en: 'Medium' },
  filter_small: { fa: 'کوچک', en: 'Small' },
  filter_modern: { fa: 'مدرن', en: 'Modern' },
  filter_combined: { fa: 'ترکیبی', en: 'Combined' },
  filter_minimal: { fa: 'مینیمال', en: 'Minimal' },
  filter_classic: { fa: 'کلاسیک', en: 'Classic' },
  publish_social: { fa: '📱 انتشار در شبکه‌های اجتماعی', en: '📱 Publish to social media' },
  pdf_report: { fa: '📄 گزارش PDF', en: '📄 PDF report' },
  excel_report: { fa: '📊 گزارش Excel', en: '📊 Excel report' },
  cancel: { fa: 'انصراف', en: 'Cancel' },
  cancel_selection: { fa: 'لغو', en: 'Clear' },
  no_programs: { fa: 'برنامه‌ای یافت نشد', en: 'No programs found' },
  showing_limited: {
    fa: 'نمایش ۶۰ برنامه از {0} • برای مشاهده همه، جستجو را فیلتر کنید',
    en: 'Showing 60 of {0} programs • refine your search to see all',
  },
  uploaded_badge: { fa: '☁ آپلود شده', en: '☁ Uploaded' },
  program_num_label: { fa: 'شماره', en: 'Number' },
  viewers_badge: { fa: '👥 تماشاگر', en: '👥 Audience' },

  // ---------- Show detail modal ----------
  program_num_n: { fa: 'برنامهٔ شمارهٔ {0}', en: 'Program no. {0}' },
  with_viewers: { fa: '👥 با تماشاگر', en: '👥 With audience' },
  about_program: { fa: 'دربارهٔ برنامه', en: 'About the program' },
  program_videos: { fa: '🎬 ویدیوهای برنامه', en: 'Program videos' },
  videos_count_short: { fa: 'ویدیو', en: 'videos' },
  direct_access: { fa: 'دسترسی مستقیم', en: 'Direct access' },
  watch_youtube: { fa: '▶ تماشا در یوتیوب', en: '▶ Watch on YouTube' },
  imdb_page: { fa: '🎬 صفحهٔ IMDb', en: '🎬 IMDb page' },
  wikipedia_page: { fa: '📖 ویکی‌پدیا', en: '📖 Wikipedia' },
  edit_btn: { fa: '✏ ویرایش', en: '✏ Edit' },
  delete_program: { fa: '🗑 حذف برنامه', en: '🗑 Delete program' },
  delete_confirm: {
    fa: 'این برنامه حذف شود؟ (قابل بازگشت نیست)',
    en: 'Delete this program? (cannot be undone)',
  },
  delete_yes: { fa: 'بله، حذف کن', en: 'Yes, delete' },
  decor_details: { fa: 'مشخصات دکور و صحنه', en: 'Decor and stage details' },
  field_category: { fa: 'دسته‌بندی', en: 'Category' },
  field_decor_style: { fa: 'سبک دکور', en: 'Decor style' },
  field_studio_size: { fa: 'اندازهٔ استودیو', en: 'Studio size' },
  field_viewers: { fa: 'تماشاگر', en: 'Audience' },
  field_effects: { fa: 'جلوه‌ها', en: 'Effects' },
  field_layout: { fa: 'چیدمان', en: 'Layout' },
  field_lighting: { fa: 'نورپردازی', en: 'Lighting' },
  field_decor_elements: { fa: 'عناصر دکور', en: 'Decor elements' },
  field_materials: { fa: 'مواد', en: 'Materials' },
  field_coloring: { fa: 'رنگ‌آمیزی', en: 'Coloring' },
  decor_summary: { fa: 'خلاصهٔ دکور', en: 'Decor summary' },
  tags_section: { fa: '🏷 برچسب‌ها', en: '🏷 Tags' },
  detected_countries: { fa: '🌍 کشورهای شناسایی‌شده:', en: '🌍 Detected countries:' },
  origin_country: { fa: 'کشور مبدا (وارد شده):', en: 'Origin country (entered):' },
  related_programs: { fa: '🔗 برنامه‌های مرتبط', en: '🔗 Related programs' },
  program_images: { fa: '🖼 تصاویر برنامه', en: 'Program images' },
  images_count_short: { fa: 'تصویر', en: 'images' },
  image_n_of_m_aria: { fa: 'تصویر {0}', en: 'Image {0}' },

  // ---------- Add/Edit view ----------
  edit_program_title: { fa: 'ویرایش برنامه', en: 'Edit Program' },
  add_program_title: { fa: 'افزودن برنامهٔ جدید', en: 'Add New Program' },
  editing_program_n: { fa: 'ویرایش برنامهٔ شمارهٔ {0}', en: 'Editing program no. {0}' },
  fill_form_hint: { fa: 'فرم زیر را پر کنید', en: 'Please fill out the form below' },
  auto_fetch_title: { fa: '⚡ دریافت خودکار اطلاعات', en: '⚡ Auto-fetch info' },
  auto_fetch_desc: {
    fa: 'لینک IMDb یا ویکی‌پدیا برنامه را وارد کنید تا نام، توضیحات، تصویر و سایر اطلاعات خودکار دریافت شود.',
    en: 'Enter the IMDb or Wikipedia URL of the program to auto-fill name, description, image and other details.',
  },
  fetch_btn: { fa: '⚡ دریافت', en: '⚡ Fetch' },
  fetching: { fa: '⏳ در حال دریافت...', en: '⏳ Fetching...' },
  fetch_url_placeholder: {
    fa: 'https://www.imdb.com/title/... یا https://fa.wikipedia.org/...',
    en: 'https://www.imdb.com/title/... or https://en.wikipedia.org/...',
  },
  field_program_name: { fa: 'نام برنامه *', en: 'Program name *' },
  field_program_name_ph: { fa: 'مثلاً: BBC Breakfast', en: 'e.g.: BBC Breakfast' },
  field_country: { fa: 'کشور مبدا', en: 'Origin country' },
  field_country_ph: { fa: 'مثلاً: ایران، ترکیه', en: 'e.g.: Iran, Turkey' },
  field_decor_elements_ph: { fa: 'مثلاً: plants, screens/monitors', en: 'e.g.: plants, screens/monitors' },
  field_materials_ph: { fa: 'مثلاً: wood, glass, metal', en: 'e.g.: wood, glass, metal' },
  field_coloring_ph: { fa: 'مثلاً: red, blue, white', en: 'e.g.: red, blue, white' },
  description_fa_label: { fa: 'دربارهٔ برنامه (فارسی)', en: 'About the program (Farsi)' },
  description_fa_ph: {
    fa: 'توضیحات فارسی دربارهٔ برنامه — چه برنامه‌ای است، چه محتوایی دارد...',
    en: 'Farsi description of the program — what it is, what content it has...',
  },
  decor_summary_label: { fa: 'خلاصهٔ دکور', en: 'Decor summary' },
  decor_summary_ph: {
    fa: 'توضیحات کامل دکور و صحنهٔ برنامه...',
    en: 'Full description of the decor and stage...',
  },
  save_update_btn: { fa: '✓ بروزرسانی', en: '✓ Update' },
  name_required: { fa: 'نام برنامه الزامی است', en: 'Program name is required' },
  enter_imdb_link: { fa: 'لینک IMDb یا ویکی‌پدیا را وارد کنید', en: 'Enter an IMDb or Wikipedia URL' },
  info_fetched: { fa: 'اطلاعات با موفقیت دریافت شد', en: 'Info fetched successfully' },
  fetch_error: { fa: 'خطا در دریافت اطلاعات', en: 'Failed to fetch info' },
  fetch_error_msg: { fa: 'خطا: {0}', en: 'Error: {0}' },

  // ---------- Image gallery editor ----------
  images_x_of_y: { fa: '({0} از {1})', en: '({0} of {1})' },
  cover_note: { fa: 'تصویر اول = کاور', en: 'First image = cover' },
  paste_image_url: { fa: 'لینک تصویر را اینجا بچسبانید...', en: 'Paste image URL here...' },
  add_link_btn: { fa: '+ افزودن لینک', en: '+ Add link' },
  upload_file_btn: { fa: '📁 آپلود فایل', en: '📁 Upload file' },
  max_images_warning: { fa: 'حداکثر {0} تصویر مجاز است', en: 'Maximum {0} images allowed' },
  image_exists: { fa: 'این تصویر قبلاً اضافه شده', en: 'This image has already been added' },
  images_added_partial: {
    fa: 'فقط {0} تصویر اضافه شد (حداکثر {1})',
    en: 'Only {0} image(s) added (max {1})',
  },
  file_read_error: { fa: 'خطا در خواندن فایل: {0}', en: 'Error reading file: {0}' },
  no_images_hint: {
    fa: 'هنوز تصویری اضافه نشده. می‌تونید لینک بچسبانید یا فایل آپلود کنید.',
    en: 'No images added yet. You can paste a URL or upload a file.',
  },
  cover_badge: { fa: 'کاور', en: 'Cover' },
  move_left: { fa: 'به چپ', en: 'Move left' },
  move_right: { fa: 'به راست', en: 'Move right' },
  delete_image_title: { fa: 'حذف', en: 'Delete' },
  add_more_btn: { fa: 'افزودن', en: 'Add' },

  // ---------- Video links editor ----------
  youtube_search_link: { fa: 'لینک جستجوی یوتیوب (خودکار)', en: 'YouTube search URL (auto)' },
  youtube_ph: { fa: 'https://www.youtube.com/results?search_query=...', en: 'https://www.youtube.com/results?search_query=...' },
  add_video_btn: { fa: '+ افزودن ویدیو', en: '+ Add video' },
  video_url_ph: {
    fa: 'لینک ویدیو (یوتیوب، آپارات، Vimeo، تلگرام و...) را بچسبانید',
    en: 'Paste a video URL (YouTube, Aparat, Vimeo, Telegram, etc.)',
  },
  open_link_title: { fa: 'باز کردن', en: 'Open' },
  delete_video_title: { fa: 'حذف', en: 'Delete' },

  // ---------- Tags editor ----------
  tags_count_short: { fa: 'برچسب', en: 'tags' },
  tags_hint: {
    fa: 'برچسب‌ها را با کاما (، یا ,) جدا کنید — مثلاً: مدرن، گرم، چوبی',
    en: 'Separate tags with a comma (، or ,) — e.g.: modern, warm, wooden',
  },
  tags_input_ph: { fa: 'مدرن، گرم، چوبی...', en: 'modern, warm, wooden...' },
  add_tag_btn: { fa: '+ افزودن', en: '+ Add' },
  remove_tag_aria: { fa: 'حذف {0}', en: 'Remove {0}' },
  clear_all: { fa: 'پاک کردن همه', en: 'Clear all' },
  preset_tags_label: { fa: 'برچسب‌های پیشنهادی این ژانر:', en: 'Suggested tags for this genre:' },

  // ---------- Add genre modal ----------
  add_genre_modal_title: { fa: '+ افزودن ژانر جدید', en: '+ Add New Genre' },
  genre_name_label: { fa: 'نام ژانر *', en: 'Genre name *' },
  genre_name_ph: { fa: 'مثلاً: مستند، انیمیشن، کودک...', en: 'e.g.: Documentary, Animation, Kids...' },
  genre_desc_label: { fa: 'توضیحات', en: 'Description' },
  genre_desc_ph: { fa: 'توضیح کوتاه دربارهٔ این ژانر...', en: 'Short description of this genre...' },
  genre_color_label: { fa: 'رنگ ژانر', en: 'Genre color' },
  preview_label: { fa: 'پیش‌نمایش:', en: 'Preview:' },
  preview_ph: { fa: 'توضیحات...', en: 'Description...' },
  save_genre_btn: { fa: '✓ ذخیره ژانر', en: '✓ Save genre' },

  // ---------- Ticker config modal ----------
  ticker_title: { fa: 'انتخاب برنامه‌های نوار پر بازدید', en: 'Select programs for the popular ticker' },
  ticker_desc: {
    fa: 'برنامه‌هایی که می‌خواهید در نوار شیشه‌ای بالای ژانرها نمایش داده شوند',
    en: 'Programs to display in the glass bar above the genres',
  },
  search_ticker_ph: { fa: 'جستجوی نام برنامه، دسته یا توضیحات…', en: 'Search by name, category or description…' },
  only_with_images: { fa: 'فقط با تصویر', en: 'Only with images' },
  selected_count: { fa: 'برنامه انتخاب شده', en: 'programs selected' },
  results_count: { fa: 'برنامه در نتایج', en: 'programs in results' },
  reset_to_auto: { fa: 'بازنشانی به خودکار', en: 'Reset to auto' },
  save_count_btn: { fa: 'ذخیره ({0})', en: 'Save ({0})' },
  n_programs_ticker: { fa: '{0} برنامه برای نوار انتخاب شد', en: '{0} programs selected for ticker' },
  ticker_auto_restored: {
    fa: 'نوار به حالت خودکار (پر بازدیدترین‌ها) بازگشت',
    en: 'Ticker restored to automatic (most viewed)',
  },
  ticker_auto_restored_short: { fa: 'نوار به حالت خودکار بازگشت', en: 'Ticker restored to automatic' },
  error_saving_settings: { fa: 'خطا در ذخیرهٔ تنظیمات', en: 'Error saving settings' },

  // ---------- Analytics genre config modal ----------
  analytics_genres_desc: {
    fa: 'ژانرهایی که می‌خواهید در نمودار آمار نمایش داده شوند را انتخاب کنید. خالی = ۵ ژانر برتر خودکار.',
    en: 'Select the genres to show in the stats chart. Empty = top 5 genres automatically.',
  },
  n_genres_analytics: { fa: '{0} ژانر برای آمار انتخاب شد', en: '{0} genres selected for analytics' },
  analytics_auto_restored: {
    fa: 'آمار به حالت خودکار (۵ ژانر برتر) بازگشت',
    en: 'Analytics restored to automatic (top 5 genres)',
  },
  analytics_auto_restored_short: { fa: 'آمار به حالت خودکار بازگشت', en: 'Analytics restored to automatic' },
  reset_btn: { fa: 'بازنشانی', en: 'Reset' },

  // ---------- Bot config modal ----------
  bot_modal_title: { fa: '⚙ تنظیمات ربات انتشار', en: '⚙ Publish bot settings' },
  bot_help_intro: {
    fa: 'برای ارسال مستقیم پست‌ها به کانال یا گروه، یک ربات بسازید و آن را ادمین مقصد کنید:',
    en: 'To send posts directly to a channel or group, create a bot and make it admin of the target:',
  },
  bot_help_tg: { fa: '• تلگرام: ربات @BotFather → /newbot', en: '• Telegram: @BotFather bot → /newbot' },
  bot_help_bale: { fa: '• بله: ربات @BotFather@ → ساخت ربات جدید', en: '• Bale: @BotFather@ bot → Create new bot' },
  bot_help_admin: { fa: '• سپس ربات را به کانال/گروه ادمین کنید', en: '• Then make the bot admin of the channel/group' },
  platform_label: { fa: 'پلتفرم', en: 'Platform' },
  bot_token_label: { fa: 'توکن ربات (Bot Token)', en: 'Bot Token' },
  show_btn: { fa: '👁 نمایش', en: '👁 Show' },
  hide_btn: { fa: '🙈 پنهان', en: '🙈 Hide' },
  chat_id_label: { fa: 'شناسهٔ مقصد (Chat ID)', en: 'Target Chat ID' },
  chat_id_help: {
    fa: 'برای کانال: نام کاربری کانال (مثل @mychannel) یا Chat ID عددی. برای چت خصوصی: Chat ID عددی شما.',
    en: 'For channels: channel username (e.g. @mychannel) or numeric Chat ID. For private chats: your numeric Chat ID.',
  },
  test_bot_btn: { fa: '🔍 تست اتصال ربات', en: '🔍 Test bot connection' },
  testing_bot: { fa: '⏳ در حال بررسی...', en: '⏳ Checking...' },
  bot_test_ok: { fa: '✅ ربات «@{0}» شناسایی شد', en: '✅ Bot "@{0}" recognized' },
  bot_test_invalid: { fa: '❌ توکن نامعتبر', en: '❌ Invalid token' },
  bot_test_network: { fa: '❌ خطای شبکه', en: '❌ Network error' },
  bot_saved: { fa: 'تنظیمات ربات ذخیره شد', en: 'Bot settings saved' },
  save_bot_btn: { fa: '✓ ذخیره تنظیمات', en: '✓ Save settings' },
  clear_btn: { fa: '🗑 پاک کردن', en: '🗑 Clear' },
  token_required: { fa: 'توکن را وارد کنید', en: 'Please enter the token' },
  configure_bot_btn: { fa: '＋ پیکربندی ربات', en: '＋ Configure bot' },
  bot_settings_btn: { fa: '⚙ تنظیمات ربات', en: '⚙ Bot settings' },

  // ---------- Publish modal ----------
  publish_modal_title: { fa: '📱 انتشار در شبکه‌های اجتماعی', en: '📱 Publish to Social Media' },
  select_platform_label: { fa: 'انتخاب پلتفرم', en: 'Select platform' },
  post_preview_label: { fa: 'پیش‌نمایش پست', en: 'Post preview' },
  direct_send_to: { fa: '📡 ارسال مستقیم به {0}', en: '📡 Direct send to {0}' },
  bot_configured_tg: { fa: 'ربات تلگرام پیکربندی شده — مقصد: {0}', en: 'Telegram bot configured — target: {0}' },
  bot_configured_bale: { fa: 'ربات بله پیکربندی شده — مقصد: {0}', en: 'Bale bot configured — target: {0}' },
  bot_not_configured: {
    fa: 'برای ارسال مستقیم، ابتدا توکن ربات و شناسهٔ کانال را وارد کنید',
    en: 'To send directly, first enter the bot token and channel ID',
  },
  direct_send_btn: { fa: '📡 ارسال مستقیم به {0}', en: '📡 Direct send to {0}' },
  sending: { fa: '⏳ در حال ارسال...', en: '⏳ Sending...' },
  send_ok: { fa: '✅ پست به {0} ارسال شد', en: '✅ Post sent to {0}' },
  send_fail: { fa: '❌ ارسال ناموفق', en: '❌ Send failed' },
  send_network: { fa: '❌ خطای شبکه هنگام ارسال', en: '❌ Network error during send' },
  enter_bot_config_first: { fa: 'ابتدا تنظیمات ربات را وارد کنید', en: 'Please configure the bot first' },
  manual_publish_btn: { fa: '📤 انتشار دستی در {0}', en: '📤 Manual publish to {0}' },
  select_platform_first: { fa: 'ابتدا پلتفرم را انتخاب کنید', en: 'Please select a platform first' },

  // ---------- Export preview modal ----------
  pdf_preview_title: { fa: '📄 پیش‌نمایش گزارش PDF', en: '📄 PDF Report Preview' },
  excel_preview_title: { fa: '📊 پیش‌نمایش گزارش Excel', en: '📊 Excel Report Preview' },
  programs_count_label: { fa: 'تعداد برنامه‌ها', en: 'Programs count' },
  format_label: { fa: 'فرمت', en: 'Format' },
  date_label: { fa: 'تاریخ', en: 'Date' },
  report_cover_title: { fa: 'گزارش جامع آرشیو برنامه‌های تلویزیونی', en: 'Comprehensive TV Programs Archive Report' },
  report_cover_subtitle: { fa: 'بانک رسانه — آرشیو تخصصی برنامه‌های تلویزیونی', en: 'BankRasaneh — Specialized TV Programs Archive' },
  report_program_label: { fa: 'برنامه', en: 'Programs' },
  report_genre_category: { fa: 'دستهٔ ژانری', en: 'Genre categories' },
  report_structure: {
    fa: 'ساختار گزارش (۸ بخش) — هر بخش شامل توضیحات کامل',
    en: 'Report structure (8 sections) — each with full description',
  },
  section_1: { fa: 'خلاصه اجرایی', en: 'Executive Summary' },
  section_1_desc: {
    fa: 'مرور کلی آرشیو، حجم داده‌ها، یافته‌های کلیدی و نکات مهم برای تصمیم‌گیرندگان',
    en: 'Overview of the archive, data volume, key findings and important points for decision makers',
  },
  section_2: { fa: 'روش جمع‌آوری داده', en: 'Data Collection Method' },
  section_2_desc: {
    fa: 'توضیح منابع داده، فرایند طبقه‌بندی ژانری و رویکرد ترکیبی',
    en: 'Explains data sources, the genre classification process and the hybrid approach',
  },
  section_3: { fa: 'نمای آماری کلی', en: 'Statistical Overview' },
  section_3_desc: {
    fa: '۴ کارت آماری + ۵ نمودار میله‌ای: اندازه استودیو، سبک دکور، تماشاگر، نورپردازی، چیدمان',
    en: '4 stat cards + 5 bar charts: studio size, decor style, audience, lighting, layout',
  },
  section_4: { fa: 'تحلیل توزیع ژانرها', en: 'Genre Distribution Analysis' },
  section_4_desc: {
    fa: 'نمودار کامل توزیع + معرفی تفصیلی هر دسته با شمارش، درصد، و برنامه‌های شاخص',
    en: 'Full distribution chart + detailed breakdown of each category with counts, percentages, and notable programs',
  },
  section_5: { fa: 'تحلیل دکور و صحنه', en: 'Decor and Stage Analysis' },
  section_5_desc: {
    fa: '۴ نمودار: عناصر پرتکرار صحنه، مصالح، طیف رنگی، نورپردازی + یافته‌های تحلیلی',
    en: '4 charts: recurring stage elements, materials, color palette, lighting + analytical findings',
  },
  section_6: { fa: 'فهرست تفصیلی برنامه‌ها', en: 'Detailed Program List' },
  section_6_desc: {
    fa: 'کارت کامل برای هر برنامه: تصویر، توضیحات فارسی، تگ‌ها، مشخصات دکور، خلاصه',
    en: 'Full card for each program: image, Farsi description, tags, decor specs, summary',
  },
  section_7: { fa: 'نتیجه‌گیری و پیشنهادها', en: 'Conclusions and Recommendations' },
  section_7_desc: {
    fa: 'جمع‌بندی یافته‌ها + ۵ پیشنهاد اجرایی + بخش امضا و تاریخ',
    en: 'Summary of findings + 5 actionable recommendations + signature and date section',
  },
  section_8: { fa: 'پیوست: نمایهٔ الفبایی', en: 'Appendix: Alphabetical Index' },
  section_8_desc: {
    fa: 'فهرست کامل همهٔ برنامه‌ها به ترتیب الفبایی با شماره و دستهٔ ژانری',
    en: 'Full list of all programs in alphabetical order with number and genre category',
  },
  sample_card_title: { fa: 'نمونه کارت برنامه (از بخش ۶)', en: 'Sample program card (from section 6)' },
  sample_program_name: { fa: 'نمونه برنامه', en: 'Sample program' },
  id_label: { fa: 'شناسه: ۱', en: 'ID: 1' },
  excel_output_title: { fa: 'بانک رسانه — خروجی Excel', en: 'BankRasaneh — Excel Output' },
  th_num: { fa: '#', en: '#' },
  th_name: { fa: 'نام', en: 'Name' },
  th_title: { fa: 'عنوان', en: 'Title' },
  th_category: { fa: 'دسته', en: 'Category' },
  th_type: { fa: 'نوع', en: 'Type' },
  th_count: { fa: 'تعداد', en: 'Count' },
  th_date: { fa: 'تاریخ', en: 'Date' },
  th_action: { fa: 'عملیات', en: 'Action' },
  th_style: { fa: 'سبک', en: 'Style' },
  th_size: { fa: 'اندازه', en: 'Size' },
  download_btn: { fa: '⬇ دانلود فایل {0}', en: '⬇ Download {0} file' },
  generating: { fa: '⏳ در حال تولید...', en: '⏳ Generating...' },
  pdf_help_text: {
    fa: 'گزارش شامل ۸ بخش است: صفحهٔ عنوان، فهرست مطالب، خلاصهٔ اجرایی، روش تحقیق، نمای آماری، تحلیل ژانرها، تحلیل دکور، و معرفی تفصیلی برنامه‌ها. پس از کلیک روی دانلود، پنجره چاپ باز می‌شود — مقاس «A4» و «Save as PDF» را انتخاب کنید.',
    en: 'The report has 8 sections: title page, table of contents, executive summary, methodology, statistical overview, genre analysis, decor analysis, and detailed program introductions. After clicking download, a print dialog opens — choose "A4" paper and "Save as PDF".',
  },
  full_report_note: {
    fa: 'در گزارش کامل، ۸۰ برنامهٔ نخست به‌صورت تفصیلی و همهٔ {0} برنامه در نمایهٔ الفبایی',
    en: 'In the full report, the first 80 programs are detailed and all {0} programs are in the alphabetical index',
  },

  // ---------- Reports view ----------
  reports_title: { fa: 'گزارش‌ها', en: 'Reports' },
  reports_subtitle: { fa: 'آمار و گزارش‌های بانک رسانه', en: 'BankRasaneh statistics and reports' },
  total_programs: { fa: 'کل برنامه‌ها', en: 'Total programs' },
  uploaded_label: { fa: 'آپلود شده', en: 'Uploaded' },
  genres_label: { fa: 'ژانرها', en: 'Genres' },
  with_images_label: { fa: 'با تصویر', en: 'With images' },
  existing_reports: { fa: 'گزارش‌های موجود', en: 'Available reports' },
  download_link: { fa: 'دانلود', en: 'Download' },
  report_1_title: { fa: 'گزارش کامل همهٔ برنامه‌ها', en: 'Full report of all programs' },
  report_2_title: { fa: 'گزارش برنامه‌های آپلود شده در فضای مجازی', en: 'Report of programs uploaded online' },
  no_data_for_report: { fa: 'برنامه‌ای برای این گزارش وجود ندارد', en: 'No programs for this report' },

  // ---------- Settings modal ----------
  settings_modal_title: { fa: '⚙ تنظیمات سیستم', en: '⚙ System Settings' },
  close_settings_aria: { fa: 'بستن تنظیمات', en: 'Close settings' },
  tab_server: { fa: 'سرور', en: 'Server' },
  tab_users: { fa: 'کاربران', en: 'Users' },
  tab_password: { fa: 'رمز عبور', en: 'Password' },

  // Server tab
  server_tab_title: { fa: '🖥 آدرس سرور API', en: '🖥 API Server URL' },
  server_tab_desc: {
    fa: 'آدرس سرویس API که این برنامه به آن متصل می‌شود. پیش‌فرض:',
    en: 'Address of the API service this app connects to. Default:',
  },
  test_connection_btn: { fa: '🔍 تست اتصال', en: '🔍 Test connection' },
  testing_btn: { fa: '⏳ در حال تست...', en: '⏳ Testing...' },
  save_url_btn: { fa: '✓ ذخیره آدرس', en: '✓ Save URL' },
  test_ok_msg: { fa: 'اتصال برقرار شد ✓', en: 'Connection successful ✓' },
  test_invalid_msg: { fa: 'پاسخ نامعتبر: {0}', en: 'Invalid response: {0}' },
  test_error_msg: { fa: 'خطا در اتصال: {0}', en: 'Connection error: {0}' },
  url_saved_msg: {
    fa: 'آدرس سرور ذخیره شد. برای اعمال کامل، صفحه را بارگذاری مجدد کنید.',
    en: 'Server URL saved. Reload the page for full effect.',
  },
  url_saved_ok_msg: { fa: 'ذخیره شد ✓ — آدرس جدید اعمال شد.', en: 'Saved ✓ — new URL applied.' },
  server_help: {
    fa: 'راهنما: آدرس وارد شده باید ریشهٔ سرویس API باشد (بدون مسیرهای /api/...). اگر از گیتوی Caddy استفاده می‌کنید، می‌توانید آدرس نسبی وارد کنید. پس از ذخیره، توکن فعلی شما معتبر می‌ماند.',
    en: 'Help: the URL must be the API service root (without /api/... paths). If you use a Caddy gateway, you can enter a relative URL. Your current token stays valid after saving.',
  },

  // Users tab
  users_tab_title: { fa: '👥 مدیریت کاربران', en: '👥 User Management' },
  users_tab_desc: {
    fa: 'افزودن، حذف یا تغییر نقش کاربران سیستم. نقش‌ها: مدیر (دسترسی کامل)، ویراستار (افزودن/ویرایش برنامه‌ها)، بیننده (فقط مشاهده).',
    en: 'Add, delete or change the role of system users. Roles: admin (full access), editor (add/edit programs), viewer (read-only).',
  },
  add_new_user_title: { fa: '＋ افزودن کاربر جدید', en: '＋ Add New User' },
  username_ph: { fa: 'نام کاربری', en: 'Username' },
  display_name_ph: { fa: 'نام نمایشی (اختیاری)', en: 'Display name (optional)' },
  password_ph: { fa: 'رمز عبور (حداقل ۴ کاراکتر)', en: 'Password (min 4 characters)' },
  create_user_btn: { fa: '＋ ایجاد کاربر', en: '＋ Create user' },
  creating_user: { fa: '⏳ در حال ایجاد...', en: '⏳ Creating...' },
  current_users_label: { fa: 'کاربران فعلی ({0})', en: 'Current users ({0})' },
  loading_msg: { fa: 'در حال بارگذاری...', en: 'Loading...' },
  error_loading_users: { fa: 'خطا در بارگذاری کاربران', en: 'Failed to load users' },
  user_created_msg: { fa: 'کاربر «{0}» ساخته شد', en: 'User "{0}" created' },
  error_creating_user: { fa: 'خطا در ایجاد کاربر', en: 'Failed to create user' },
  cannot_delete_self: { fa: 'نمی‌توانید حساب خودتان را حذف کنید', en: 'You cannot delete your own account' },
  confirm_delete_user: { fa: 'کاربر «{0}» حذف شود؟', en: 'Delete user "{0}"?' },
  user_deleted_msg: { fa: 'کاربر حذف شد', en: 'User deleted' },
  error_deleting_user: { fa: 'خطا در حذف کاربر', en: 'Failed to delete user' },
  role_changed_msg: { fa: 'نقش «{0}» به {1} تغییر کرد', en: 'Role of "{0}" changed to {1}' },
  error_changing_role: { fa: 'خطا در تغییر نقش', en: 'Failed to change role' },
  cannot_change_own_role_title: { fa: 'نمی‌توانید نقش خودتان را تغییر دهید', en: 'You cannot change your own role' },
  change_role_title: { fa: 'تغییر نقش', en: 'Change role' },
  delete_user_title: { fa: 'حذف {0}', en: 'Delete {0}' },
  cannot_delete_self_short: { fa: 'نمی‌توانید خودتان را حذف کنید', en: 'You cannot delete yourself' },
  delete_user_aria: { fa: 'حذف کاربر {0}', en: 'Delete user {0}' },
  enter_user_pass: { fa: 'نام کاربری و رمز را وارد کنید', en: 'Please enter username and password' },
  role_admin_short: { fa: 'مدیر', en: 'Admin' },
  role_editor_short: { fa: 'ویراستار', en: 'Editor' },
  role_viewer_short: { fa: 'بیننده', en: 'Viewer' },
  you_label: { fa: '(شما)', en: '(you)' },

  // Password tab
  password_tab_title: { fa: '🔑 تغییر رمز عبور', en: '🔑 Change Password' },
  password_tab_desc: {
    fa: 'رمز عبور خود را تغییر دهید. پس از تغییر، تمام نشست‌های فعال شما باطل شده و باید دوباره وارد شوید.',
    en: 'Change your password. After changing, all active sessions are invalidated and you must sign in again.',
  },
  current_account_label: { fa: '👤 حساب فعلی:', en: '👤 Current account:' },
  old_password_label: { fa: 'رمز فعلی', en: 'Current password' },
  new_password_label: { fa: 'رمز جدید', en: 'New password' },
  confirm_password_label: { fa: 'تکرار رمز جدید', en: 'Confirm new password' },
  fill_all_fields_msg: { fa: 'هر سه فیلد را پر کنید', en: 'Please fill in all three fields' },
  password_min_msg: { fa: 'رمز جدید باید حداقل ۴ کاراکتر باشد', en: 'New password must be at least 4 characters' },
  password_mismatch_msg: { fa: 'رمز جدید و تأیید آن یکسان نیستند', en: 'New password and confirmation do not match' },
  password_same_as_old_msg: { fa: 'رمز جدید باید با رمز فعلی متفاوت باشد', en: 'New password must differ from current' },
  password_changed_msg: {
    fa: 'رمز با موفقیت تغییر کرد. لطفاً دوباره وارد شوید.',
    en: 'Password changed successfully. Please sign in again.',
  },
  error_changing_password: { fa: 'خطا در تغییر رمز', en: 'Failed to change password' },
  saving_btn: { fa: '⏳ در حال تغییر...', en: '⏳ Changing...' },
  change_password_btn: { fa: '✓ تغییر رمز عبور', en: '✓ Change password' },
  password_mismatch_warning: { fa: '⚠ رمز جدید و تأیید آن یکسان نیستند', en: '⚠ New password and confirmation do not match' },

  // ---------- Access denied (add view, no perm) ----------
  access_denied_title: { fa: 'دسترسی غیرمجاز', en: 'Access Denied' },
  access_denied_body: {
    fa: 'شما اجازهٔ افزودن یا ویرایش برنامه‌ها را ندارید. برای دسترسی کامل با حساب مدیر یا ویراستار وارد شوید.',
    en: 'You do not have permission to add or edit programs. Sign in as admin or editor for full access.',
  },

  // ---------- Toasts ----------
  toast_program_updated: { fa: 'برنامه «{0}» بروزرسانی شد', en: 'Program "{0}" updated' },
  toast_program_added: { fa: 'برنامه «{0}» اضافه شد', en: 'Program "{0}" added' },
  toast_program_deleted: { fa: 'برنامه حذف شد', en: 'Program deleted' },
  toast_n_published: { fa: '{0} برنامه به {1} منتشر شد', en: '{0} programs published to {1}' },
  toast_genre_added: { fa: 'ژانر «{0}» اضافه شد', en: 'Genre "{0}" added' },
  toast_report_downloaded: { fa: 'گزارش {0} دانلود شد', en: '{0} report downloaded' },
};

// ============================================
// CONTEXT
// ============================================
type LangContextValue = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, args?: (string | number)[]) => string;
};

export const LangContext = createContext<LangContextValue>({
  lang: 'fa',
  setLang: () => {},
  t: (key) => STRINGS[key]?.fa || key,
});

export function useLang(): LangContextValue {
  return useContext(LangContext);
}

/**
 * Returns the translated string for `key` in the current language.
 * Placeholders use {0}, {1}, ... — pass them via the `args` array.
 * Example: t('toast_n_published', [3, 'Telegram']) → '۳ برنامه به Telegram منتشر شد'
 */
export function makeT(lang: Lang) {
  return (key: string, args?: (string | number)[]): string => {
    const entry = STRINGS[key];
    if (!entry) return key;
    let s = entry[lang] || entry.fa;
    if (args && args.length > 0) {
      for (let i = 0; i < args.length; i++) {
        s = s.replace(new RegExp(`\\{${i}\\}`, 'g'), String(args[i]));
      }
    }
    return s;
  };
}

// ============================================
// PROVIDER
// ============================================
const LANG_STORAGE_KEY = 'bankresaneh_lang';

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fa');

  // Load persisted language on mount.
  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? window.localStorage.getItem(LANG_STORAGE_KEY) : null;
      if (saved === 'fa' || saved === 'en') {
        setLangState(saved);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  // Keep <html dir> and <html lang> in sync with the current language.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.dir = lang === 'en' ? 'ltr' : 'rtl';
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = (l: Lang) => {
    setLangState(l);
    try {
      window.localStorage.setItem(LANG_STORAGE_KEY, l);
    } catch {
      // ignore storage errors
    }
    // Apply direction immediately (also handled in the effect above).
    if (typeof document !== 'undefined') {
      document.documentElement.dir = l === 'en' ? 'ltr' : 'rtl';
      document.documentElement.lang = l;
    }
  };

  const t = makeT(lang);

  return (
    <LangContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LangContext.Provider>
  );
}
