# Muestreador TEMPORAL de auditoria (no es parte de SOFTX).
# Cada ~2 s escribe una linea JSON por proceso observado: CPU (ms de CPU
# consumidos en el intervalo), memoria, GPU 3D / VideoDecode (%) y VRAM dedicada.
param(
  [int]$NodePid,
  [string]$ProfileMarker,
  [string]$OutFile,
  [string]$StopFile
)
$ErrorActionPreference = 'SilentlyContinue'
$prev = @{}
$prevT = Get-Date
while (-not (Test-Path $StopFile)) {
  $procs = Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -eq $NodePid -or
    ($_.Name -eq 'chrome.exe' -and $_.CommandLine -like "*$ProfileMarker*") -or
    $_.Name -match '^(vMix64|CefSharp\.BrowserSubprocess|CefBrowserInstance)\.exe$'
  }
  $gpu = @{}
  $c = Get-Counter -Counter '\GPU Engine(*)\Utilization Percentage','\GPU Process Memory(*)\Dedicated Usage' -ErrorAction SilentlyContinue
  foreach ($s in $c.CounterSamples) {
    if ($s.InstanceName -match 'pid_(\d+)') {
      $p = [int]$Matches[1]
      if (-not $gpu.ContainsKey($p)) { $gpu[$p] = @{ g3d = 0.0; vdec = 0.0; vram = 0.0 } }
      if ($s.Path -match 'dedicated usage') { $gpu[$p].vram += $s.CookedValue }
      elseif ($s.InstanceName -match 'engtype_3D') { $gpu[$p].g3d += $s.CookedValue }
      elseif ($s.InstanceName -match 'engtype_VideoDecode') { $gpu[$p].vdec += $s.CookedValue }
    }
  }
  $t = Get-Date
  $dt = ($t - $prevT).TotalMilliseconds
  $prevT = $t
  $lines = foreach ($pr in $procs) {
    $gp = Get-Process -Id $pr.ProcessId
    if (-not $gp) { continue }
    $cpuMs = $gp.TotalProcessorTime.TotalMilliseconds
    $delta = if ($prev.ContainsKey($pr.ProcessId)) { $cpuMs - $prev[$pr.ProcessId] } else { $null }
    $prev[$pr.ProcessId] = $cpuMs
    $role = 'other'
    if ($pr.ProcessId -eq $NodePid) { $role = 'node' }
    elseif ($pr.Name -eq 'chrome.exe') {
      if ($pr.CommandLine -match '--type=([a-z\-]+)') { $role = "chrome-$($Matches[1])" } else { $role = 'chrome-browser' }
    } else { $role = $pr.Name -replace '\.exe$', '' }
    $g = $gpu[[int]$pr.ProcessId]
    [pscustomobject]@{
      t = [math]::Round(($t.ToUniversalTime() - [datetime]'1970-01-01').TotalMilliseconds)
      dtMs = [math]::Round($dt)
      pid = $pr.ProcessId
      role = $role
      cpuMs = if ($null -ne $delta) { [math]::Round($delta, 1) } else { $null }
      wsMB = [math]::Round($gp.WorkingSet64 / 1MB, 1)
      privMB = [math]::Round($gp.PrivateMemorySize64 / 1MB, 1)
      gpu3d = if ($g) { [math]::Round($g.g3d, 2) } else { 0 }
      gpuVdec = if ($g) { [math]::Round($g.vdec, 2) } else { 0 }
      vramMB = if ($g) { [math]::Round($g.vram / 1MB, 1) } else { 0 }
    } | ConvertTo-Json -Compress
  }
  if ($lines) { Add-Content -Path $OutFile -Value $lines -Encoding utf8 }
  Start-Sleep -Milliseconds 1500
}
