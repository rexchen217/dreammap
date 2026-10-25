; ══════════════════════════════════════════════════════════
; 梦想地图 · Windows 安装包脚本（NSIS 3）
; 编译：makensis /INPUTCHARSET UTF8 tools\nsis_installer.nsi
; 输入：desktop 打包后的 dist-desktop\win-unpacked
; 说明：卸载器在安装时由 WriteUninstaller 现场生成，
;       不需要预先执行任何临时 exe（本机应用控制策略会拦截）。
; ══════════════════════════════════════════════════════════
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64
Name "梦想地图"
OutFile "C:\Users\rex\DreamMap\dist-desktop\DreamMap-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\DreamMap"
InstallDirRegKey HKCU "Software\DreamMap" "InstallDir"
RequestExecutionLevel user
BrandingText "梦想地图 · 旅行与目标手账"
ShowInstDetails nevershow
ShowUninstDetails nevershow

VIProductVersion "1.0.0.0"
VIAddVersionKey "ProductName" "梦想地图"
VIAddVersionKey "ProductVersion" "1.0.0"
VIAddVersionKey "CompanyName" "DreamMap"
VIAddVersionKey "FileDescription" "梦想地图 安装程序"
VIAddVersionKey "LegalCopyright" "DreamMap"

!define ICON "C:\Users\rex\DreamMap\desktop\build\icon.ico"
!define APPEXE "DreamMap.exe"
!define UNKEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\DreamMap"

!include "MUI2.nsh"
!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APPEXE}"
!define MUI_FINISHPAGE_RUN_TEXT "打开梦想地图"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "SimpChinese"

Section "安装"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "C:\Users\rex\DreamMap\dist-desktop\win-unpacked\*.*"

  WriteUninstaller "$INSTDIR\Uninstall DreamMap.exe"

  CreateDirectory "$SMPROGRAMS\DreamMap"
  CreateShortcut "$SMPROGRAMS\DreamMap\梦想地图.lnk" "$INSTDIR\${APPEXE}"
  CreateShortcut "$SMPROGRAMS\DreamMap\卸载梦想地图.lnk" "$INSTDIR\Uninstall DreamMap.exe"
  CreateShortcut "$DESKTOP\梦想地图.lnk" "$INSTDIR\${APPEXE}"

  WriteRegStr HKCU "Software\DreamMap" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNKEY}" "DisplayName" "梦想地图"
  WriteRegStr HKCU "${UNKEY}" "DisplayVersion" "1.0.0"
  WriteRegStr HKCU "${UNKEY}" "Publisher" "DreamMap"
  WriteRegStr HKCU "${UNKEY}" "DisplayIcon" "$INSTDIR\${APPEXE}"
  WriteRegStr HKCU "${UNKEY}" "UninstallString" '"$INSTDIR\Uninstall DreamMap.exe"'
  WriteRegDWORD HKCU "${UNKEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNKEY}" "NoRepair" 1
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\梦想地图.lnk"
  Delete "$SMPROGRAMS\DreamMap\梦想地图.lnk"
  Delete "$SMPROGRAMS\DreamMap\卸载梦想地图.lnk"
  RMDir "$SMPROGRAMS\DreamMap"
  DeleteRegKey HKCU "${UNKEY}"
  DeleteRegValue HKCU "Software\DreamMap" "InstallDir"
  DeleteRegKey /ifempty HKCU "Software\DreamMap"
  RMDir /r "$INSTDIR"
SectionEnd
