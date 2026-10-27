Unicode true
!include "MUI2.nsh"
!include "LogicLib.nsh"

Name "بانک رسانه"
OutFile "dist\BankResaneh-Setup-2.1.0.exe"
InstallDir "$LOCALAPPDATA\BankResaneh"
RequestExecutionLevel user
ShowInstDetails show

!define MUI_ICON "electron\icon.ico"
!define MUI_UNICON "electron\icon.ico"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "بانک رسانه — نصب اپلیکیشن"
!define MUI_WELCOMEPAGE_TEXT "این ویزارد شما را در نصب بانک رسانه (آرشیو تخصصی برنامه‌های تلویزیونی) راهنمایی می‌کند.$\r$\n$\r$\nبرای ادامه روی «بعدی» کلیک کنید."
!define MUI_FINISHPAGE_TITLE "نصب کامل شد!"
!define MUI_FINISHPAGE_TEXT "بانک رسانه با موفقیت نصب شد.$\r$\n$\r$\nروی «پایان» کلیک کنید تا نصب بسته شود."
!define MUI_FINISHPAGE_RUN "$INSTDIR\BankResaneh.exe"
!define MUI_FINISHPAGE_RUN_TEXT "اجرای بانک رسانه"
!define MUI_FINISHPAGE_SHOWREADME "$INSTDIR\README.txt"
!define MUI_FINISHPAGE_SHOWREADME_TEXT "مشاهده راهنما"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "English"

Section "بانک رسانه" SecMain
  SetOutPath "$INSTDIR"
  
  DetailPrint "در حال استخراج فایل‌های بانک رسانه..."
  
  ; Extract all files from win-unpacked
  File /r "dist\win-unpacked\*.*"
  
  ; Create uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  
  ; Create shortcuts
  CreateDirectory "$SMPROGRAMS\بانک رسانه"
  CreateShortCut "$SMPROGRAMS\بانک رسانه\بانک رسانه.lnk" "$INSTDIR\BankResaneh.exe" "" "$INSTDIR\BankResaneh.exe" 0
  CreateShortCut "$SMPROGRAMS\بانک رسانه\حذف بانک رسانه.lnk" "$INSTDIR\Uninstall.exe" "" "" 0
  CreateShortCut "$DESKTOP\بانک رسانه.lnk" "$INSTDIR\BankResaneh.exe" "" "$INSTDIR\BankResaneh.exe" 0
  
  ; Write registry
  WriteRegStr HKCU "Software\BankResaneh" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BankResaneh" "DisplayName" "بانک رسانه"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BankResaneh" "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BankResaneh" "DisplayVersion" "2.1.0"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BankResaneh" "Publisher" "بانک رسانه"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BankResaneh" "DisplayIcon" "$INSTDIR\BankResaneh.exe"
  
  DetailPrint "نصب کامل شد!"
SectionEnd

Section "Uninstall"
  DetailPrint "در حال حذف بانک رسانه..."
  
  ; Kill the app if running
  ExecWait "taskkill /F /IM BankResaneh.exe /T" 
  
  ; Remove files
  RMDir /r "$INSTDIR"
  
  ; Remove shortcuts
  RMDir /r "$SMPROGRAMS\بانک رسانه"
  Delete "$DESKTOP\بانک رسانه.lnk"
  
  ; Remove registry
  DeleteRegKey HKCU "Software\BankResaneh"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\BankResaneh"
  
  DetailPrint "حذف کامل شد!"
SectionEnd
