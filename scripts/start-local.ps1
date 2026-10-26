param([string]$MySqlHome, [string]$FrontendHost = '0.0.0.0')

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$localRoot = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force -Path $localRoot | Out-Null
$nodePath = (Get-Command node.exe).Source

function Test-LocalPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $pending = $client.ConnectAsync('127.0.0.1', $Port)
        return $pending.Wait(500) -and $client.Connected
    } catch { return $false } finally { $client.Dispose() }
}

if (-not (Test-LocalPort 3306)) {
    if (-not $MySqlHome) {
        $runtimeFile = Join-Path $localRoot 'mysql-runtime.txt'
        if (Test-Path -LiteralPath $runtimeFile) {
            $MySqlHome = (Get-Content -LiteralPath $runtimeFile -Raw).Trim()
        }
    }
    if (-not $MySqlHome -or -not (Test-Path -LiteralPath (Join-Path $MySqlHome 'bin/mysqld.exe'))) {
        throw 'Pass -MySqlHome with the installed portable MySQL directory.'
    }
    $dataPath = Join-Path $localRoot 'mysql-data'
    if (-not (Test-Path -LiteralPath (Join-Path $dataPath 'mysql'))) {
        throw 'The local database has not been initialized.'
    }
    Start-Process -FilePath (Join-Path $MySqlHome 'bin/mysqld.exe') -ArgumentList @(
        '--no-defaults', "--basedir=`"$MySqlHome`"", "--datadir=`"$dataPath`"",
        '--port=3306', '--bind-address=127.0.0.1', '--mysqlx=OFF'
    ) -WindowStyle Hidden | Out-Null
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    while (-not (Test-LocalPort 3306)) {
        if ([DateTime]::UtcNow -gt $deadline) { throw 'MySQL did not become ready; inspect .local/mysql-data/*.err.' }
        Start-Sleep -Milliseconds 200
    }
}

try { $backendReady = (Invoke-WebRequest 'http://127.0.0.2:5000/health' -TimeoutSec 2).StatusCode -eq 200 }
catch { $backendReady = $false }
if (-not $backendReady) {
    Start-Process -FilePath $nodePath -ArgumentList 'app.js' -WorkingDirectory (Join-Path $projectRoot 'backend') `
        -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'backend.log') `
        -RedirectStandardError (Join-Path $localRoot 'backend-error.log') | Out-Null
    $deadline = [DateTime]::UtcNow.AddSeconds(30)
    do {
        try { $backendReady = (Invoke-WebRequest 'http://127.0.0.2:5000/health' -TimeoutSec 2).StatusCode -eq 200 }
        catch { $backendReady = $false }
        if (-not $backendReady) {
            if ([DateTime]::UtcNow -gt $deadline) { throw 'Backend did not become ready; inspect .local/backend-error.log.' }
            Start-Sleep -Milliseconds 200
        }
    } until ($backendReady)
}

try { $frontendReady = (Invoke-WebRequest 'http://127.0.0.2:3000/login' -TimeoutSec 2).StatusCode -eq 200 }
catch { $frontendReady = $false }
if (-not $frontendReady) {
    if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'frontend/.output/server/index.mjs'))) {
        throw 'Build the frontend first: run npm.cmd run build from frontend.'
    }
    $previousHost = $env:HOST
    $previousPort = $env:PORT
    try {
        $env:HOST = $FrontendHost
        $env:PORT = '3000'
        Start-Process -FilePath $nodePath -ArgumentList '.output/server/index.mjs' -WorkingDirectory (Join-Path $projectRoot 'frontend') `
            -WindowStyle Hidden -RedirectStandardOutput (Join-Path $localRoot 'frontend.log') `
            -RedirectStandardError (Join-Path $localRoot 'frontend-error.log') | Out-Null
    } finally {
        $env:HOST = $previousHost
        $env:PORT = $previousPort
    }
}

Write-Output 'DocClear: http://127.0.0.2:3000/login'
if ($FrontendHost -eq '0.0.0.0') {
    Write-Output 'Network access: http://<this-PC-network-IP>:3000/login (frontend only)'
}
Write-Output 'Local credentials: .local/local-login.txt'
