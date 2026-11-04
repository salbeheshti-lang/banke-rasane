/**
 * i18n — Internationalization for بانک رسانه (BankResaneh)
 *
 * Supports two locales: 'fa' (Persian, default RTL) and 'en' (English, LTR).
 *
 * Usage:
 *   import { useLang } from '@/lib/i18n-context';
 *   const { t, lang, dir } = useLang();
 *   <button>{t('login.submit')}</button>
 *
 * All translation keys are typed via the `dict` object below, so adding a
 * new key automatically makes it available via t('newKey').
 */

export type Lang = 'fa' | 'en';

/** Dictionary shape — both languages must define the same keys. */
type Dict = Record<string, { fa: string; en: string }>;

/**
 * Master dictionary. Add new strings here ONLY — never inline a raw Persian
 * string in a component, always add a key here and call t('key').
 */
export const dict: Dict = {
  // ===== App-level =====
  'app.title': { fa: 'بانک رسانه', en: 'BankResaneh' },
  'app.tagline': {
    fa: 'مرجع جامع برنامه‌های تلویزیونی بین‌المللی',
    en: 'Comprehensive archive of international TV programs',
  },
  'app.connected': { fa: 'متصل', en: 'Connected' },

  // ===== TopAppBar =====
  'nav.openMenu': { fa: 'باز کردن منو', en: 'Open menu' },
  'nav.back': { fa: 'بازگشت به صفحهٔ قبل', en: 'Back to previous page' },
  'nav.backShort': { fa: 'بازگشت', en: 'Back' },
  'nav.toggleTheme': { fa: 'تغییر تم', en: 'Toggle theme' },
  'nav.toggleLang': { fa: 'تغییر زبان', en: 'Toggle language' },
  'nav.theme.light': { fa: 'حالت روشن', en: 'Light mode' },
  'nav.theme.dark': { fa: 'حالت تیره', en: 'Dark mode' },

  // ===== Views =====
  'view.dashboard': { fa: 'آرشیو', en: 'Archive' },
  'view.dashboard.desc': { fa: 'صفحهٔ اصلی و ژانرها', en: 'Home and genres' },
  'view.programs': { fa: 'همهٔ برنامه‌ها', en: 'All Programs' },
  'view.programs.desc': { fa: 'لیست کامل', en: 'Full list' },
  'view.reports': { fa: 'گزارش‌ها', en: 'Reports' },
  'view.reports.desc': { fa: 'آمار و خروجی', en: 'Statistics and exports' },
  'view.add': { fa: 'افزودن برنامه', en: 'Add Program' },
  'view.add.desc': { fa: 'افزودن یا ویرایش برنامه', en: 'Add or edit a program' },

  // ===== Drawer =====
  'drawer.genres': { fa: 'ژانرها', en: 'Genres' },
  'drawer.close': { fa: 'بستن منو', en: 'Close menu' },
  'drawer.logout': { fa: 'خروج', en: 'Logout' },
  'drawer.settings': { fa: 'تنظیمات', en: 'Settings' },
  'drawer.profile': { fa: 'پروفایل', en: 'Profile' },

  // ===== Login =====
  'login.username': { fa: 'نام کاربری', en: 'Username' },
  'login.password': { fa: 'رمز عبور', en: 'Password' },
  'login.showPassword': { fa: 'نمایش رمز', en: 'Show password' },
  'login.hidePassword': { fa: 'پنهان کردن رمز', en: 'Hide password' },
  'login.submit': { fa: 'ورود به برنامه', en: 'Sign in' },
  'login.loading': { fa: 'در حال ورود...', en: 'Signing in...' },
  'login.errorEmpty': { fa: 'نام کاربری و رمز عبور را وارد کنید', en: 'Enter username and password' },
  'login.errorFailed': { fa: 'ورود ناموفق بود', en: 'Login failed' },
  'login.errorConnection': { fa: 'خطا در ارتباط با سرور', en: 'Server connection error' },

  // ===== Dashboard =====
  'dashboard.title': { fa: 'نمای آماری کلی', en: 'Statistical Overview' },
  'dashboard.subtitle': { fa: 'توزیع برنامه‌ها در ژانرهای مختلف', en: 'Program distribution across genres' },
  'dashboard.totalShows': { fa: 'کل برنامه‌ها', en: 'Total programs' },
  'dashboard.totalGenres': { fa: 'ژانرها', en: 'Genres' },
  'dashboard.withImages': { fa: 'با تصویر', en: 'With images' },
  'dashboard.topGenres': { fa: 'برترین ژانرها', en: 'Top genres' },
  'dashboard.allGenres': { fa: 'همهٔ ژانرها', en: 'All genres' },
  'dashboard.addGenre': { fa: '+ افزودن ژانر', en: '+ Add genre' },
  'dashboard.manageStrip': { fa: 'مدیریت', en: 'Manage' },
  'dashboard.stripTitle': {
    fa: 'انتخاب ژانرهای نمایش داده‌شده',
    en: 'Select displayed genres',
  },
  'dashboard.stripDesc': {
    fa: 'ژانرهای نمایش داده‌شده در نوار افقی را انتخاب کنید',
    en: 'Choose genres shown in the horizontal strip',
  },
  'dashboard.prev': { fa: 'قبلی', en: 'Previous' },
  'dashboard.next': { fa: 'بعدی', en: 'Next' },
  'dashboard.programs': { fa: 'برنامه', en: 'programs' },
  'dashboard.genreCategories': { fa: 'دستهٔ ژانری', en: 'Genre categories' },

  // ===== ProgramsView =====
  'programs.searchPlaceholder': { fa: 'جستجو در', en: 'Search in' },
  'programs.allPrograms': { fa: 'همهٔ برنامه‌ها', en: 'All programs' },
  'programs.genrePrograms': { fa: 'برنامه‌های ژانر', en: 'Genre programs' },
  'programs.count': { fa: 'برنامه', en: 'programs' },
  'programs.viewGrid': { fa: 'نمای شبکه‌ای', en: 'Grid view' },
  'programs.viewList': { fa: 'نمای لیستی', en: 'List view' },
  'programs.selectMultiple': { fa: 'انتخاب چندتایی', en: 'Multi-select' },
  'programs.cancel': { fa: 'لغو', en: 'Cancel' },
  'programs.exportPDF': { fa: 'خروجی PDF', en: 'Export PDF' },
  'programs.exportExcel': { fa: 'خروجی Excel', en: 'Export Excel' },
  'programs.addProgram': { fa: '+ افزودن برنامه', en: '+ Add program' },
  'programs.noResults': { fa: 'برنامه‌ای یافت نشد', en: 'No programs found' },
  'programs.showing60': {
    fa: 'نمایش ۶۰ برنامه از',
    en: 'Showing 60 of',
  },
  'programs.filterAll': { fa: 'همه', en: 'All' },

  // ===== ReportsView =====
  'reports.title': { fa: 'گزارش‌ها', en: 'Reports' },
  'reports.subtitle': { fa: 'آمار و گزارش‌های بانک رسانه', en: 'BankResaneh statistics and reports' },
  'reports.total': { fa: 'کل برنامه‌ها', en: 'Total programs' },
  'reports.uploaded': { fa: 'آپلود شده', en: 'Uploaded' },
  'reports.genres': { fa: 'ژانرها', en: 'Genres' },
  'reports.withImages': { fa: 'با تصویر', en: 'With images' },
  'reports.available': { fa: 'گزارش‌های موجود', en: 'Available reports' },
  'reports.download': { fa: 'دانلود', en: 'Download' },
  'reports.type': { fa: 'نوع', en: 'Type' },
  'reports.count': { fa: 'تعداد', en: 'Count' },
  'reports.date': { fa: 'تاریخ', en: 'Date' },
  'reports.actions': { fa: 'عملیات', en: 'Actions' },
  'reports.noPrograms': { fa: 'برنامه‌ای برای این گزارش وجود ندارد', en: 'No programs for this report' },
  'reports.reportSettings': { fa: 'تنظیمات گزارش', en: 'Report settings' },
  'reports.reportLogo': { fa: 'لوگوی گزارش', en: 'Report logo' },
  'reports.uploadLogo': { fa: 'آپلود لوگوی جدید', en: 'Upload new logo' },
  'reports.uploading': { fa: 'در حال آپلود...', en: 'Uploading...' },
  'reports.logoHint': {
    fa: 'این لوگو روی کاور گزارش PDF نمایش داده می‌شود',
    en: 'This logo appears on the PDF report cover',
  },
  'reports.reportTitle': { fa: 'عنوان گزارش', en: 'Report title' },
  'reports.reportSubtitle': { fa: 'زیرعنوان', en: 'Subtitle' },
  'reports.organization': { fa: 'تهیه‌کننده / سازمان', en: 'Producer / Organization' },
  'reports.saveSettings': { fa: 'ذخیرهٔ تنظیمات', en: 'Save settings' },
  'reports.saving': { fa: 'در حال ذخیره...', en: 'Saving...' },
  'reports.settingsSaved': { fa: 'تنظیمات گزارش ذخیره شد', en: 'Report settings saved' },
  'reports.logoUpdated': { fa: 'لوگوی گزارش به‌روزرسانی شد', en: 'Report logo updated' },
  'reports.logoUploadError': { fa: 'خطا در آپلود لوگو', en: 'Logo upload failed' },
  'reports.settingsError': { fa: 'خطا در ذخیرهٔ تنظیمات', en: 'Settings save error' },
  'reports.report1Title': {
    fa: 'گزارش کامل همهٔ برنامه‌ها',
    en: 'Complete report of all programs',
  },
  'reports.report2Title': {
    fa: 'گزارش برنامه‌های آپلود شده در فضای مجازی',
    en: 'Report of programs uploaded to social media',
  },

  // ===== ExportPreviewModal =====
  'export.previewPDF': { fa: 'پیش‌نمایش گزارش PDF', en: 'PDF report preview' },
  'export.previewExcel': { fa: 'پیش‌نمایش گزارش Excel', en: 'Excel report preview' },
  'export.downloadPDF': { fa: 'دانلود فایل PDF', en: 'Download PDF file' },
  'export.downloadExcel': { fa: 'دانلود فایل Excel', en: 'Download Excel file' },
  'export.cancel': { fa: 'انصراف', en: 'Cancel' },
  'export.programCount': { fa: 'تعداد برنامه‌ها', en: 'Program count' },
  'export.format': { fa: 'فرمت', en: 'Format' },
  'export.date': { fa: 'تاریخ', en: 'Date' },
  'export.downloaded': { fa: 'گزارش دانلود شد', en: 'Report downloaded' },

  // ===== Settings modal =====
  'settings.title': { fa: 'تنظیمات', en: 'Settings' },
  'settings.server': { fa: 'سرور', en: 'Server' },
  'settings.users': { fa: 'کاربران', en: 'Users' },
  'settings.password': { fa: 'رمز عبور', en: 'Password' },
  'settings.serverUrl': { fa: 'آدرس سرور', en: 'Server URL' },
  'settings.testConnection': { fa: 'تست اتصال', en: 'Test connection' },
  'settings.save': { fa: 'ذخیره', en: 'Save' },
  'settings.addUser': { fa: '+ افزودن کاربر', en: '+ Add user' },
  'settings.username': { fa: 'نام کاربری', en: 'Username' },
  'settings.name': { fa: 'نام', en: 'Name' },
  'settings.role': { fa: 'نقش', en: 'Role' },
  'settings.role.admin': { fa: 'مدیر', en: 'Admin' },
  'settings.role.editor': { fa: 'ویرایشگر', en: 'Editor' },
  'settings.role.viewer': { fa: 'بیننده', en: 'Viewer' },
  'settings.oldPassword': { fa: 'رمز فعلی', en: 'Current password' },
  'settings.newPassword': { fa: 'رمز جدید', en: 'New password' },
  'settings.confirmPassword': { fa: 'تکرار رمز جدید', en: 'Confirm new password' },
  'settings.changePassword': { fa: 'تغییر رمز عبور', en: 'Change password' },
  'settings.passwordChanged': { fa: 'رمز عبور تغییر کرد', en: 'Password changed' },
  'settings.passwordMismatch': { fa: 'رمزها مطابقت ندارند', en: 'Passwords do not match' },
  'settings.connectionOk': { fa: 'اتصال برقرار است', en: 'Connection OK' },
  'settings.connectionFailed': { fa: 'اتصال ناموفق', en: 'Connection failed' },

  // ===== AddEditView =====
  'add.title': { fa: 'افزودن برنامهٔ جدید', en: 'Add new program' },
  'add.editTitle': { fa: 'ویرایش برنامه', en: 'Edit program' },
  'add.name': { fa: 'نام برنامه', en: 'Program name' },
  'add.category': { fa: 'دسته‌بندی', en: 'Category' },
  'add.size': { fa: 'اندازه استودیو', en: 'Studio size' },
  'add.viewers': { fa: 'تماشاگر', en: 'Audience' },
  'add.style': { fa: 'سبک دکور', en: 'Decor style' },
  'add.effects': { fa: 'جلوه‌ها', en: 'Effects' },
  'add.layout': { fa: 'چیدمان', en: 'Layout' },
  'add.elements': { fa: 'عناصر صحنه', en: 'Scene elements' },
  'add.materials': { fa: 'متریال', en: 'Materials' },
  'add.colors': { fa: 'رنگ‌آمیزی', en: 'Color scheme' },
  'add.lighting': { fa: 'نورپردازی', en: 'Lighting' },
  'add.summary': { fa: 'خلاصه', en: 'Summary' },
  'add.descriptionFa': { fa: 'توضیحات فارسی', en: 'Persian description' },
  'add.youtube': { fa: 'لینک یوتیوب', en: 'YouTube link' },
  'add.imdb': { fa: 'لینک IMDb', en: 'IMDb link' },
  'add.wikipedia': { fa: 'لینک ویکی‌پدیا', en: 'Wikipedia link' },
  'add.save': { fa: 'ذخیره برنامه', en: 'Save program' },
  'add.saving': { fa: 'در حال ذخیره...', en: 'Saving...' },
  'add.saved': { fa: 'برنامه ذخیره شد', en: 'Program saved' },
  'add.cancel': { fa: 'انصراف', en: 'Cancel' },
  'add.delete': { fa: 'حذف برنامه', en: 'Delete program' },
  'add.deleted': { fa: 'برنامه حذف شد', en: 'Program deleted' },
  'add.confirmDelete': {
    fa: 'آیا از حذف این برنامه مطمئن هستید؟',
    en: 'Are you sure you want to delete this program?',
  },

  // ===== Toast messages =====
  'toast.saved': { fa: 'ذخیره شد', en: 'Saved' },
  'toast.error': { fa: 'خطا رخ داد', en: 'An error occurred' },
  'toast.profileUpdated': { fa: 'پروفایل بروزرسانی شد', en: 'Profile updated' },
  'toast.genreAdded': { fa: 'ژانر اضافه شد', en: 'Genre added' },
  'toast.genreDeleted': { fa: 'ژانر حذف شد', en: 'Genre deleted' },

  // ===== Profile =====
  'profile.title': { fa: 'پروفایل کاربر', en: 'User profile' },
  'profile.edit': { fa: 'ویرایش پروفایل', en: 'Edit profile' },
  'profile.jobTitle': { fa: 'عنوان شغلی', en: 'Job title' },
  'profile.deputy': { fa: 'معاونت', en: 'Deputy' },
  'profile.phone': { fa: 'تلفن', en: 'Phone' },
  'profile.avatar': { fa: 'تصویر پروفایل', en: 'Profile image' },
  'profile.uploadAvatar': { fa: 'آپلود تصویر', en: 'Upload image' },

  // ===== Genre names (the 17 main + technical genres) =====
  // Note: nameFa is still used internally; we add nameEn here for the EN locale.
  'genre.decor': { fa: 'دکور برنامه‌ها', en: 'Decor analysis' },
  'genre.decor.desc': {
    fa: 'برنامه‌های قابل تحلیل از نظر دکور و صحنه',
    en: 'Programs analyzable for decor and scene',
  },
  'genre.interview': { fa: 'تاک‌شوی مصاحبه‌محور', en: 'Interview-based talk show' },
  'genre.comedy': { fa: 'تاک‌شوی طنز و کمدی', en: 'Comedy talk show' },
  'genre.news': { fa: 'تاک‌شوی سیاسی و خبری', en: 'Political & news talk show' },
  'genre.specialty': { fa: 'تاک‌شوی تخصصی و سبک زندگی', en: 'Specialty & lifestyle talk show' },
  'genre.cultural': { fa: 'تاک‌شوی فرهنگی، هنری', en: 'Cultural & arts talk show' },
  'genre.celebrity': { fa: 'تاک‌شوی گروهی سلبریتی‌ها', en: 'Celebrity panel talk show' },
  'genre.panel': { fa: 'تاک‌شوی پنلی و میزگرد', en: 'Panel & roundtable talk show' },
  'genre.morning': { fa: 'تاک‌شوی روزانه/صبحگاهی', en: 'Daily / morning talk show' },
  'genre.reality': { fa: 'ریلیتی شو / مسابقه', en: 'Reality show / competition' },
  'genre.nighttime': { fa: 'تاک‌شوی شبانه', en: 'Late-night talk show' },
  'genre.entertainment': { fa: 'صنعت سرگرمی / پشت‌صحنه', en: 'Entertainment industry / backstage' },
  'genre.location': { fa: 'موقعیت‌محور / خارج از استودیو', en: 'Location-based / outside studio' },
  'genre.digital': { fa: 'تاک‌شوی دیجیتال', en: 'Digital talk show' },
  'genre.relationships': { fa: 'تاک‌شوی روابط', en: 'Relationships talk show' },
  'genre.radio': { fa: 'برنامهٔ رادیویی', en: 'Radio-style program' },
  'genre.human': { fa: 'برنامهٔ انسانی', en: 'Human-interest program' },

  // ===== Common UI =====
  'common.yes': { fa: 'بله', en: 'Yes' },
  'common.no': { fa: 'خیر', en: 'No' },
  'common.ok': { fa: 'تأیید', en: 'OK' },
  'common.cancel': { fa: 'انصراف', en: 'Cancel' },
  'common.save': { fa: 'ذخیره', en: 'Save' },
  'common.delete': { fa: 'حذف', en: 'Delete' },
  'common.edit': { fa: 'ویرایش', en: 'Edit' },
  'common.add': { fa: 'افزودن', en: 'Add' },
  'common.close': { fa: 'بستن', en: 'Close' },
  'common.loading': { fa: 'در حال بارگذاری...', en: 'Loading...' },
  'common.search': { fa: 'جستجو', en: 'Search' },
  'common.all': { fa: 'همه', en: 'All' },
  'common.none': { fa: 'هیچ', en: 'None' },
  'common.confirm': { fa: 'تأیید', en: 'Confirm' },

  // ===== Errors =====
  'error.server': { fa: 'خطا در ارتباط با سرور', en: 'Server connection error' },
  'error.unauthorized': { fa: 'دسترسی غیرمجاز', en: 'Unauthorized access' },
  'error.notFound': { fa: 'یافت نشد', en: 'Not found' },
  'error.unknown': { fa: 'خطای ناشناخته', en: 'Unknown error' },

  // ===== ProgramCard / ListRow =====
  'program.videos': { fa: 'ویدیوهای برنامه', en: 'Program videos' },
  'program.imdb': { fa: 'صفحهٔ IMDb', en: 'IMDb page' },
  'program.wikipedia': { fa: 'صفحهٔ ویکی‌پدیا', en: 'Wikipedia page' },
  'program.youtube': { fa: 'تماشا در یوتیوب', en: 'Watch on YouTube' },
  'program.similar': { fa: 'برنامه‌های مشابه', en: 'Similar programs' },
  'program.noSimilar': { fa: 'برنامهٔ مشابهی یافت نشد', en: 'No similar programs found' },

  // ===== Settings: Profile tab =====
  'settings.profile.edit': { fa: 'ویرایش پروفایل', en: 'Edit profile' },
  'settings.profile.name': { fa: 'نام نمایشی', en: 'Display name' },
  'settings.profile.jobTitle': { fa: 'عنوان شغلی', en: 'Job title' },
  'settings.profile.deputy': { fa: 'معاونت', en: 'Deputy' },
  'settings.profile.phone': { fa: 'شماره همراه', en: 'Phone' },
  'settings.profile.avatar': { fa: 'تصویر پروفایل', en: 'Profile image' },
  'settings.profile.role': { fa: 'نقش', en: 'Role' },
  'settings.profile.save': { fa: 'ذخیره پروفایل', en: 'Save profile' },
  'settings.profile.saving': { fa: 'در حال ذخیره...', en: 'Saving...' },
  'settings.profile.saved': { fa: 'پروفایل بروزرسانی شد', en: 'Profile updated' },

  // ===== Settings: Users tab =====
  'settings.users.title': { fa: '👥 مدیریت کاربران', en: '👥 User management' },
  'settings.users.desc': {
    fa: 'افزودن، حذف یا تغییر نقش کاربران سیستم.',
    en: 'Add, delete, or change user roles.'
  },
  'settings.users.addNew': { fa: '＋ افزودن کاربر جدید', en: '＋ Add new user' },
  'settings.users.username': { fa: 'نام کاربری', en: 'Username' },
  'settings.users.displayName': { fa: 'نام نمایشی', en: 'Display name' },
  'settings.users.password': { fa: 'رمز عبور (حداقل ۸ کاراکتر)', en: 'Password (min 8 chars)' },
  'settings.users.create': { fa: '＋ ایجاد کاربر', en: '＋ Create user' },
  'settings.users.creating': { fa: '⏳ در حال ایجاد...', en: '⏳ Creating...' },
  'settings.users.created': { fa: 'کاربر ساخته شد', en: 'User created' },
  'settings.users.currentUsers': { fa: 'کاربران فعلی', en: 'Current users' },
  'settings.users.deleteConfirm': { fa: 'حذف شود؟', en: 'Delete this user?' },
  'settings.users.deleted': { fa: 'کاربر حذف شد', en: 'User deleted' },
  'settings.users.cannotDeleteSelf': { fa: 'نمی‌توانید حساب خودتان را حذف کنید', en: 'Cannot delete your own account' },
  'settings.users.cannotDeleteSuper': { fa: 'مدیر اصلی قابل حذف نیست', en: 'Super admin cannot be deleted' },
  'settings.users.cannotChangeSuper': { fa: 'مدیر اصلی قابل تغییر نیست', en: 'Super admin cannot be changed' },
  'settings.users.roleChanged': { fa: 'نقش تغییر کرد', en: 'Role changed' },
  'settings.users.suspended': { fa: 'معلق شد', en: 'Suspended' },
  'settings.users.activated': { fa: 'فعال شد', en: 'Activated' },
  'settings.users.superAdmin': { fa: '👑 مدیر اصلی', en: '👑 Super admin' },
  'settings.users.suspendedBadge': { fa: 'معلق', en: 'Suspended' },
  'settings.users.you': { fa: '(شما)', en: '(you)' },
  'settings.users.permissions': { fa: 'اختیارات', en: 'Permissions' },
  'settings.users.lockedView': { fa: '🔒 فقط مشاهده — برای افزودن یا ویرایش با حساب مدیر وارد شوید', en: '🔒 View only — sign in as admin to edit' },

  // ===== Settings: Activity tab =====
  'settings.activity.title': { fa: '📋 گزارش فعالیت', en: '📋 Activity log' },
  'settings.activity.desc': { fa: 'آخرین تغییرات اعمال‌شده توسط کاربران سیستم.', en: 'Recent changes by system users.' },
  'settings.activity.empty': { fa: 'هیچ فعالیتی ثبت نشده است.', en: 'No activity recorded.' },
  'settings.activity.loading': { fa: 'در حال بارگذاری...', en: 'Loading...' },
  'settings.activity.create_user': { fa: 'ساخت کاربر', en: 'User created' },
  'settings.activity.update_user': { fa: 'ویرایش کاربر', en: 'User updated' },
  'settings.activity.delete_user': { fa: 'حذف کاربر', en: 'User deleted' },
  'settings.activity.suspend_user': { fa: 'تعلیق کاربر', en: 'User suspended' },
  'settings.activity.activate_user': { fa: 'فعال‌سازی کاربر', en: 'User activated' },

  // ===== Settings: Server tab =====
  'settings.server.title': { fa: 'تنظیمات سرور', en: 'Server settings' },
  'settings.server.url': { fa: 'آدرس سرور API', en: 'API server URL' },
  'settings.server.test': { fa: 'تست اتصال', en: 'Test connection' },
  'settings.server.testing': { fa: '⏳ در حال تست...', en: '⏳ Testing...' },
  'settings.server.save': { fa: 'ذخیره آدرس', en: 'Save URL' },
  'settings.server.saved': { fa: 'آدرس سرور ذخیره شد', en: 'Server URL saved' },
  'settings.server.connected': { fa: '✅ اتصال برقرار است', en: '✅ Connection OK' },
  'settings.server.failed': { fa: '❌ اتصال ناموفق', en: '❌ Connection failed' },

  // ===== Settings: Password tab =====
  'settings.password.title': { fa: 'تغییر رمز عبور', en: 'Change password' },
  'settings.password.current': { fa: 'رمز فعلی', en: 'Current password' },
  'settings.password.new': { fa: 'رمز جدید', en: 'New password' },
  'settings.password.confirm': { fa: 'تکرار رمز جدید', en: 'Confirm new password' },
  'settings.password.submit': { fa: 'تغییر رمز', en: 'Change password' },
  'settings.password.changing': { fa: '⏳ در حال تغییر...', en: '⏳ Changing...' },
  'settings.password.changed': { fa: 'رمز عبور تغییر کرد', en: 'Password changed' },
  'settings.password.mismatch': { fa: 'رمزها مطابقت ندارند', en: 'Passwords do not match' },
  'settings.password.tooShort': { fa: 'رمز جدید باید حداقل ۸ کاراکتر باشد', en: 'New password must be at least 8 characters' },
  'settings.password.wrongCurrent': { fa: 'رمز فعلی اشتباه است', en: 'Current password is incorrect' },

  // ===== AddEditView =====
  'add.autoFetchTitle': { fa: '⚡ دریافت خودکار اطلاعات', en: '⚡ Auto-fetch info' },
  'add.autoFetchDesc': {
    fa: 'لینک IMDb یا ویکی‌پدیا برنامه را وارد کنید تا نام، توضیحات، تصویر و سایر اطلاعات خودکار دریافت شود.',
    en: 'Enter an IMDb or Wikipedia link to auto-fetch name, description, image and other info.'
  },
  'add.autoFetchBtn': { fa: '⚡ دریافت', en: '⚡ Fetch' },
  'add.autoFetchFetching': { fa: '⏳ در حال دریافت...', en: '⏳ Fetching...' },
  'add.autoFetchSuccess': { fa: 'اطلاعات با موفقیت دریافت شد', en: 'Info fetched successfully' },
  'add.autoFetchError': { fa: 'خطا در دریافت اطلاعات', en: 'Failed to fetch info' },
  'add.autoFetchNoUrl': { fa: 'لینک IMDb یا ویکی‌پدیا را وارد کنید', en: 'Enter an IMDb or Wikipedia link' },
  'add.field.name': { fa: 'نام برنامه *', en: 'Program name *' },
  'add.field.category': { fa: 'دسته‌بندی', en: 'Category' },
  'add.field.size': { fa: 'اندازه استودیو', en: 'Studio size' },
  'add.field.viewers': { fa: 'تماشاگر', en: 'Audience' },
  'add.added': { fa: 'برنامه اضافه شد', en: 'Program added' },
  'add.updated': { fa: 'برنامه بروزرسانی شد', en: 'Program updated' },
  'add.editTitle': { fa: 'ویرایش برنامه', en: 'Edit program' },
  'add.addTitle': { fa: 'افزودن برنامهٔ جدید', en: 'Add new program' },
  'add.field.required': { fa: 'نام برنامه الزامی است', en: 'Program name is required' },
  'add.delete': { fa: 'حذف برنامه', en: 'Delete program' },
  'add.deleted': { fa: 'برنامه حذف شد', en: 'Program deleted' },
  'add.deleteConfirm': {
    fa: 'آیا از حذف این برنامه مطمئن هستید؟',
    en: 'Are you sure you want to delete this program?'
  },
  'add.save': { fa: '✓ ذخیره برنامه', en: '✓ Save program' },
  'add.saving': { fa: '⏳ در حال ذخیره...', en: '⏳ Saving...' },
  'add.cancel': { fa: 'انصراف', en: 'Cancel' },
  'add.field.description': { fa: 'دربارهٔ برنامه (فارسی)', en: 'About the program (Persian)' },
  'add.field.summary': { fa: 'خلاصهٔ دکور', en: 'Decor summary' },
  'add.field.youtube': { fa: 'لینک یوتیوب', en: 'YouTube link' },
  'add.field.imdb': { fa: 'لینک IMDb', en: 'IMDb link' },
  'add.field.wikipedia': { fa: 'لینک ویکی‌پدیا', en: 'Wikipedia link' },
  'add.field.style': { fa: 'سبک دکور', en: 'Decor style' },
  'add.field.effects': { fa: 'جلوه‌ها', en: 'Effects' },
  'add.field.layout': { fa: 'چیدمان', en: 'Layout' },
  'add.field.elements': { fa: 'عناصر صحنه', en: 'Scene elements' },
  'add.field.materials': { fa: 'متریال', en: 'Materials' },
  'add.field.colors': { fa: 'رنگ‌آمیزی', en: 'Color scheme' },
  'add.field.lighting': { fa: 'نورپردازی', en: 'Lighting' },

  // ===== ShowDetailsModal =====
  'details.edit': { fa: '✏ ویرایش', en: '✏ Edit' },
  'details.delete': { fa: '🗑 حذف', en: '🗑 Delete' },
  'details.publish': { fa: '📤 انتشار', en: '📤 Publish' },
  'details.export': { fa: '📄 PDF', en: '📄 PDF' },
  'details.close': { fa: 'بستن', en: 'Close' },
  'details.related': { fa: 'برنامه‌های مشابه', en: 'Similar programs' },
  'details.noRelated': { fa: 'برنامهٔ مشابهی یافت نشد', en: 'No similar programs found' },
  'details.countries': { fa: '🌍 کشورهای شناسایی‌شده', en: '🌍 Detected countries' },
  'details.videos': { fa: '🎬 ویدیوها', en: '🎬 Videos' },
  'details.tags': { fa: '🏷 برچسب‌ها', en: '🏷 Tags' },

  // ===== PublishModal =====
  'publish.selectPlatform': { fa: 'انتخاب پلتفرم', en: 'Select platform' },
  'publish.preview': { fa: 'پیش‌نمایش پست', en: 'Post preview' },
  'publish.manual': { fa: '📤 انتشار دستی', en: '📤 Manual publish' },
  'publish.direct': { fa: '📡 ارسال مستقیم', en: '📡 Direct send' },
  'publish.botConfig': { fa: '⚙ تنظیمات ربات', en: '⚙ Bot settings' },
  'publish.configureBot': { fa: '＋ پیکربندی ربات', en: '＋ Configure bot' },
  'publish.noPlatform': { fa: 'ابتدا پلتفرم را انتخاب کنید', en: 'Select a platform first' },
  'publish.sending': { fa: '⏳ در حال ارسال...', en: '⏳ Sending...' },
  'publish.sent': { fa: '✅ پست ارسال شد', en: '✅ Post sent' },
  'publish.failed': { fa: '❌ ارسال ناموفق', en: '❌ Send failed' },
  'publish.networkError': { fa: '❌ خطای شبکه', en: '❌ Network error' },
  'publish.needConfig': { fa: 'ابتدا تنظیمات ربات را وارد کنید', en: 'Configure bot settings first' },
  'publish.configTitle': { fa: '⚙ تنظیمات ربات انتشار', en: '⚙ Publish bot settings' },
  'publish.token': { fa: 'توکن ربات (Bot Token)', en: 'Bot Token' },
  'publish.chatId': { fa: 'شناسهٔ مقصد (Chat ID)', en: 'Chat ID' },
  'publish.chatIdHint': {
    fa: 'برای کانال: نام کاربری کانال یا Chat ID عددی. برای چت خصوصی: Chat ID عددی شما.',
    en: 'For channel: channel username or numeric Chat ID. For private chat: your numeric Chat ID.'
  },
  'publish.test': { fa: 'تست ربات', en: 'Test bot' },
  'publish.testing': { fa: '⏳ در حال تست...', en: '⏳ Testing...' },
  'publish.testOk': { fa: '✅ ربات شناسایی شد', en: '✅ Bot identified' },
  'publish.testFail': { fa: '❌ توکن نامعتبر', en: '❌ Invalid token' },
  'publish.save': { fa: 'ذخیره تنظیمات', en: 'Save settings' },
  'publish.saved': { fa: 'تنظیمات ربات ذخیره شد', en: 'Bot settings saved' },
  'publish.clear': { fa: 'پاک‌کردن', en: 'Clear' },
  'publish.showToken': { fa: '👁 نمایش', en: '👁 Show' },
  'publish.hideToken': { fa: '🙈 پنهان', en: '🙈 Hide' },
  'publish.helpTitle': {
    fa: 'راهنمای ساخت ربات',
    en: 'Bot creation guide'
  },
  'publish.helpTelegram': {
    fa: 'تلگرام: ربات @BotFather → /newbot',
    en: 'Telegram: @BotFather → /newbot'
  },
  'publish.helpBale': {
    fa: 'بله: ربات @BotFather@ → ساخت ربات جدید',
    en: 'Bale: @BotFather@ → create new bot'
  },
  'publish.helpAdmin': {
    fa: 'سپس ربات را به کانال/گروه ادمین کنید',
    en: 'Then make the bot admin of your channel/group'
  },

  // ===== AddGenreModal =====
  'genre.add.title': { fa: '+ افزودن ژانر جدید', en: '+ Add new genre' },
  'genre.add.name': { fa: 'نام ژانر *', en: 'Genre name *' },
  'genre.add.desc': { fa: 'توضیح کوتاه دربارهٔ این ژانر', en: 'Short description for this genre' },
  'genre.add.color': { fa: 'رنگ ژانر', en: 'Genre color' },
  'genre.add.save': { fa: '✓ ذخیره ژانر', en: '✓ Save genre' },
  'genre.add.added': { fa: 'ژانر اضافه شد', en: 'Genre added' },

  // ===== Toast messages (general) =====
  'toast.saved': { fa: 'ذخیره شد', en: 'Saved' },
  'toast.error': { fa: 'خطا رخ داد', en: 'An error occurred' },
  'toast.networkError': { fa: 'خطا در ارتباط با سرور', en: 'Server connection error' },
  'toast.loadingError': { fa: 'خطا در بارگذاری', en: 'Loading error' },

  // ===== Misc =====
  'misc.loading': { fa: 'در حال بارگذاری...', en: 'Loading...' },
  'misc.confirm': { fa: 'تأیید', en: 'Confirm' },
  'misc.delete': { fa: 'حذف', en: 'Delete' },
  'misc.edit': { fa: 'ویرایش', en: 'Edit' },
  'misc.save': { fa: 'ذخیره', en: 'Save' },
  'misc.cancel': { fa: 'انصراف', en: 'Cancel' },
  'misc.close': { fa: 'بستن', en: 'Close' },
  'misc.search': { fa: 'جستجو', en: 'Search' },
  'misc.all': { fa: 'همه', en: 'All' },
  'misc.none': { fa: 'هیچ', en: 'None' },
};

/** Look up a translation key in the given language. */
export function translate(key: string, lang: Lang): string {
  const entry = dict[key];
  if (!entry) {
    if (typeof console !== 'undefined') {
      console.warn(`[i18n] missing key: "${key}"`);
    }
    return key;
  }
  return entry[lang] || entry.fa;
}

/** Direction (RTL/LTR) for a language. */
export function dirFor(lang: Lang): 'rtl' | 'ltr' {
  return lang === 'fa' ? 'rtl' : 'ltr';
}

/** HTML lang attribute for a language. */
export function htmlLang(lang: Lang): string {
  return lang === 'fa' ? 'fa' : 'en';
}
