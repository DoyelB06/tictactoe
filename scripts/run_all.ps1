<#
run_all.ps1

Starts the backend and frontend dev servers in separate PowerShell windows.
Usage (from cmd.exe):
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\run_all.ps1

The script will attempt to start a MySQL service named like "MySQL*" if it exists and is stopped,
but it will not install or configure MySQL for you.
#>

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$projectRoot = (Resolve-Path (Join-Path $scriptDir "..")).ProviderPath
$backendDir = Join-Path $projectRoot 'backend'
$frontendDir = Join-Path $projectRoot 'frontend'

Write-Host "Project root: $projectRoot"

# Check MySQL service (best-effort)
$mysqlService = Get-Service -Name 'MySQL*' -ErrorAction SilentlyContinue
if ($mysqlService) {
    if ($mysqlService.Status -ne 'Running') {
        Write-Host "MySQL service '$($mysqlService.Name)' is not running. Attempting to start..."
        try {
            Start-Service $mysqlService.Name -ErrorAction Stop
            Write-Host "Started MySQL service '$($mysqlService.Name)'."
        } catch {
            Write-Warning "Could not start MySQL service '$($mysqlService.Name)'. Start it manually if needed."
        }
    } else {
        Write-Host "MySQL service '$($mysqlService.Name)' is running."
    }
} else {
    Write-Warning "No MySQL service matching 'MySQL*' found. Ensure your MySQL server is running and accessible."
}

# Start backend in a new PowerShell window
Write-Host "Starting backend in a new window (directory: $backendDir)"
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-Command',"Set-Location -LiteralPath '$backendDir'; npm install; npm start" -WorkingDirectory $backendDir -WindowStyle Normal

# Start frontend in a new PowerShell window
Write-Host "Starting frontend in a new window (directory: $frontendDir)"
Start-Process -FilePath 'powershell' -ArgumentList '-NoExit','-Command',"Set-Location -LiteralPath '$frontendDir'; npm install; npm start" -WorkingDirectory $frontendDir -WindowStyle Normal

Write-Host "Both start commands were issued. Check the new windows for logs and prompts (e.g., CRA asking to use another port)."
