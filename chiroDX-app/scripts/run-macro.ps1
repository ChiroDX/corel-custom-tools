# ChiroDX  --  CorelDraw COM Bridge  v1.0
# ──────────────────────────────────────────
# Triggers a VBA macro in the running CorelDraw instance via COM automation.
# Called by corel-bridge.js (Node.js) when the Electron user clicks "Apply".
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File run-macro.ps1 -MacroName ApplyResult
#
# Parameters:
#   -MacroName    Name of the public Sub to run in ChiroDX VBA modules
#   -GmsName      Optional: GMS project name (default: auto-detect)

param(
  [Parameter(Mandatory=$true)]
  [string]$MacroName,

  [string]$GmsName = ""
)

# ── CorelDraw COM ProgIDs (newest first) ─────────────────────
$progIds = @(
  "CorelDraw.Application.25",   # 2025
  "CorelDraw.Application.24",   # 2024
  "CorelDraw.Application.23",   # 2022
  "CorelDraw.Application.22",   # X8 / 2021
  "CorelDraw.Application.21"    # X7 / 2020
)

# ── Find running CorelDraw instance ──────────────────────────
$corel = $null
$foundId = ""

foreach ($id in $progIds) {
  try {
    $corel = [Runtime.InteropServices.Marshal]::GetActiveObject($id)
    $foundId = $id
    break
  } catch {
    # Not running with this version — try next
    continue
  }
}

if (-not $corel) {
  Write-Error "CorelDraw is not running. Please open CorelDraw first."
  exit 1
}

Write-Host "Found CorelDraw ($foundId)"

# ── Find the GMS project ─────────────────────────────────────
$gmsManager = $null
try {
  $gmsManager = $corel.GMSManager
} catch {
  Write-Error "Could not access CorelDraw GMS Manager: $_"
  exit 1
}

# If GmsName provided, use it; otherwise find the first GMS that has our macro
$targetGms = ""

if ($GmsName -ne "") {
  $targetGms = $GmsName
} else {
  # Common names for the ChiroDX macro storage
  $candidates = @("ChiroDXMacros", "CustomMacroStorage", "GlobalMacroStorage", "GlobalMacros")
  foreach ($name in $candidates) {
    try {
      # Test if this GMS has the macro by trying to get it
      $gmsManager.RunMacro($name, "Ping") 2>$null
      $targetGms = $name
      break
    } catch {
      # This GMS name doesn't exist or doesn't have Ping — try next
      continue
    }
  }

  # Fallback: just try running in any available GMS
  if ($targetGms -eq "") {
    Write-Host "Could not auto-detect GMS name, trying first available..."
    try {
      # GMSManager.GMSFiles is a collection of loaded GMS files
      $count = $gmsManager.GMSFiles.Count
      if ($count -gt 0) {
        $targetGms = $gmsManager.GMSFiles.Item(1).Name
        # Strip .gms extension if present
        $targetGms = [System.IO.Path]::GetFileNameWithoutExtension($targetGms)
      }
    } catch {
      Write-Error "Could not enumerate GMS files: $_"
      exit 1
    }
  }
}

if ($targetGms -eq "") {
  Write-Error "No CorelDraw VBA project (GMS) found. Import ApiClient.bas first."
  exit 1
}

Write-Host "Running $targetGms.$MacroName ..."

# ── Run the macro ─────────────────────────────────────────────
try {
  $gmsManager.RunMacro($targetGms, $MacroName)
  Write-Host "OK"
  exit 0
} catch {
  Write-Error "Failed to run macro ${targetGms}.${MacroName}: $_"
  exit 1
}
