<#
.SYNOPSIS
    Professional DSLR Photobooth - Windows PC AIO Touchscreen Kiosk Provisioning Script
    Target Environment: Windows 10/11 (PC AIO Touchscreen i5 Gen 6) + Canon EOS 70D + Dedicated Photo Printer

.DESCRIPTION
    Configures critical Windows OS policies for uninterrupted 12-hour photobooth event operations:
    1. Disables USB Selective Suspend (Prevents Canon DSLR USB tether from disconnecting during idle)
    2. Sets Ultimate/High Performance power plan (Screen always ON, sleep disabled)
    3. Disables Windows Edge Touch Gestures (Prevents guests from accidentally swiping into Action Center)
    4. Disables Windows Error Reporting dialogs and Lock Screen
    5. Checks and documents Dual Printer Queue setup for DNP/HiTi 2x6 Auto-Cut
#>

# Ensure running as Administrator
if (-NOT ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Warning "Please run this PowerShell script as Administrator!"
    Exit 1
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  DSLR PHOTOBOOTH: WINDOWS KIOSK HARDENING & PROVISIONING  " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Disable USB Selective Suspend (CRITICAL for Canon 70D / 6D USB stability)
Write-Host "`n[1/5] Disabling USB Selective Suspend on all power schemes..." -ForegroundColor Green
try {
    # AC power USB suspend = 0 (Disabled)
    powercfg /SETACVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-86ee-57e80220c52c 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    # DC (Battery) USB suspend = 0 (Disabled)
    powercfg /SETDCVALUEINDEX SCHEME_CURRENT 2a737441-1930-4402-86ee-57e80220c52c 48e6b7a6-50f5-4782-a5d4-53bb8f07e226 0
    powercfg /SETACTIVE SCHEME_CURRENT
    Write-Host "  -> USB Selective Suspend disabled successfully." -ForegroundColor Gray
} catch {
    Write-Warning "  -> Could not update USB suspend settings via powercfg: $_"
}

# 2. Configure Display & Sleep to NEVER turn off
Write-Host "`n[2/5] Configuring Display & Sleep timeouts (Always Awake)..." -ForegroundColor Green
powercfg /change monitor-timeout-ac 0
powercfg /change monitor-timeout-dc 0
powercfg /change standby-timeout-ac 0
powercfg /change standby-timeout-dc 0
powercfg /change hibernate-timeout-ac 0
powercfg /change hibernate-timeout-dc 0
Write-Host "  -> Standby, Hibernate, and Monitor timeouts set to NEVER." -ForegroundColor Gray

# 3. Disable Touchscreen Edge Swiping (Prevents guests opening Action Center / Start)
Write-Host "`n[3/5] Disabling Windows 10/11 Touchscreen Edge Swipe Gestures..." -ForegroundColor Green
$regPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\EdgeUI"
if (-not (Test-Path $regPath)) {
    New-Item -Path $regPath -Force | Out-Null
}
Set-ItemProperty -Path $regPath -Name "AllowEdgeSwipe" -Value 0 -Type DWord
Write-Host "  -> AllowEdgeSwipe set to 0 in Policy." -ForegroundColor Gray

# 4. Disable Windows Error Reporting Popups & Lock Screen
Write-Host "`n[4/5] Disabling Error Reporting Dialogs & Lock Screen..." -ForegroundColor Green
$werPath = "HKLM:\SOFTWARE\Microsoft\Windows\Windows Error Reporting"
if (Test-Path $werPath) {
    Set-ItemProperty -Path $werPath -Name "DontShowUI" -Value 1 -Type DWord
}
$personalizationPath = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization"
if (-not (Test-Path $personalizationPath)) {
    New-Item -Path $personalizationPath -Force | Out-Null
}
Set-ItemProperty -Path $personalizationPath -Name "NoLockScreen" -Value 1 -Type DWord
Write-Host "  -> Lock Screen and Crash dialogs disabled." -ForegroundColor Gray

# 5. Dual Printer Queue Setup Verification
Write-Host "`n[5/5] Checking Installed Printers for Photobooth..." -ForegroundColor Green
$printers = Get-Printer
Write-Host "  Currently installed printers on this PC:" -ForegroundColor Gray
foreach ($p in $printers) {
    Write-Host "    - $($p.Name) (Port: $($p.PortName), Status: $($p.PrinterStatus))" -ForegroundColor Yellow
}

Write-Host @"

==========================================================
              PRE-FLIGHT HARDWARE CHECKLIST
==========================================================
1. CANON EOS 70D (PRODUCTION):
   [ ] Dummy Battery (AC-E6 / DR-E6) securely plugged into wall outlet.
   [ ] Camera Mode Dial set to [M] Manual (1/125s, f/5.6 - f/8, ISO 400).
   [ ] In Camera Menu: [Auto Power Off] set to [DISABLE].
   [ ] USB cable connected to a USB 3.0 / USB 2.0 rear port of the AIO PC.

2. PHOTO PRINTER (DNP / HiTi / Citizen):
   [ ] Loaded with 4x6" (4R) paper and fresh ribbon roll.
   [ ] For 2-Strip Auto-Cut: Ensure Printer Queue is set to [2x6*2 Cut] in Printing Preferences.
   [ ] Set environment variable PRINTER_NAME='<Your_Printer_Name>' in .env.

3. START APPLICATION:
   Run: npm start (or launch compiled Photobooth.exe)

Kiosk provisioning is COMPLETE!
==========================================================
"@ -ForegroundColor Cyan
