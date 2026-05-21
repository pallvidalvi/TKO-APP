param(
  [Parameter(Mandatory = $true)]
  [string]$ApkPath,

  [string]$OutputPath = "",

  [string]$Password = ""
)

$ErrorActionPreference = "Stop"

function Convert-SecureStringToPlainText {
  param([securestring]$SecureValue)

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureValue)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  }
}

if (-not (Test-Path -LiteralPath $ApkPath -PathType Leaf)) {
  throw "APK file not found: $ApkPath"
}

$resolvedApk = (Resolve-Path -LiteralPath $ApkPath).Path

if ([IO.Path]::GetExtension($resolvedApk).ToLowerInvariant() -ne ".apk") {
  throw "Input file must be an .apk file: $resolvedApk"
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  $Password = Convert-SecureStringToPlainText (Read-Host "Enter APK archive password" -AsSecureString)
}

if ([string]::IsNullOrWhiteSpace($Password)) {
  throw "Password cannot be empty."
}

$sevenZip = Get-Command 7z -ErrorAction SilentlyContinue
if (-not $sevenZip) {
  $sevenZip = Get-Command 7za -ErrorAction SilentlyContinue
}

if (-not $sevenZip) {
  throw "7-Zip was not found. Install 7-Zip and make sure 7z.exe is available in PATH."
}

if ([string]::IsNullOrWhiteSpace($OutputPath)) {
  $apkDirectory = Split-Path -Parent $resolvedApk
  $apkNameWithoutExtension = [IO.Path]::GetFileNameWithoutExtension($resolvedApk)
  $OutputPath = Join-Path $apkDirectory "$apkNameWithoutExtension.protected.7z"
}

$outputParent = Split-Path -Parent $OutputPath
if ([string]::IsNullOrWhiteSpace($outputParent)) {
  $outputParent = (Get-Location).Path
}

if (-not (Test-Path -LiteralPath $outputParent -PathType Container)) {
  New-Item -ItemType Directory -Path $outputParent | Out-Null
}

$resolvedOutputParent = (Resolve-Path -LiteralPath $outputParent).Path
$resolvedOutput = Join-Path $resolvedOutputParent (Split-Path -Leaf $OutputPath)
$tempDir = Join-Path ([IO.Path]::GetTempPath()) ("tko-apk-protect-" + [guid]::NewGuid().ToString("N"))

New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  $apkFileName = Split-Path -Leaf $resolvedApk
  Copy-Item -LiteralPath $resolvedApk -Destination (Join-Path $tempDir $apkFileName)

  if (Test-Path -LiteralPath $resolvedOutput -PathType Leaf) {
    Remove-Item -LiteralPath $resolvedOutput -Force
  }

  Push-Location $tempDir
  try {
    & $sevenZip.Source a -t7z -mhe=on -mx=9 "-p$Password" $resolvedOutput $apkFileName | Out-Host
  } finally {
    Pop-Location
  }

  if ($LASTEXITCODE -ne 0) {
    throw "7-Zip failed with exit code $LASTEXITCODE."
  }

  Write-Host "Password-protected APK archive created:"
  Write-Host $resolvedOutput
  Write-Host ""
  Write-Host "Share the .7z archive, not the raw .apk. Users must enter the password before they can extract and install the APK."
} finally {
  if (Test-Path -LiteralPath $tempDir -PathType Container) {
    Remove-Item -LiteralPath $tempDir -Recurse -Force
  }
}
