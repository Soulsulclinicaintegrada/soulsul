$ErrorActionPreference = "Stop"

$projeto = "C:\Users\jusgo\Documents\sistema_clinica"
$frontend = Join-Path $projeto "frontend"

function Get-LocalIp {
    try {
        $ips = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object {
                $_.IPAddress -ne "127.0.0.1" -and
                $_.IPAddress -notlike "169.254.*" -and
                $_.PrefixOrigin -ne "WellKnown"
            } |
            Select-Object -ExpandProperty IPAddress

        return ($ips | Select-Object -First 1)
    } catch {
        return $null
    }
}

function Get-PythonCommand {
    $candidatos = @(
        "C:\Users\jusgo\AppData\Local\Python\pythoncore-3.14-64\python.exe",
        "C:\Users\jusgo\AppData\Local\Python\bin\python.exe",
        "C:\Users\jusgo\AppData\Local\Programs\Python\Python313\python.exe",
        "C:\Users\jusgo\AppData\Local\Programs\Python\Python312\python.exe",
        "C:\Python313\python.exe",
        "C:\Python312\python.exe"
    )
    foreach ($caminho in $candidatos) {
        if (Test-Path $caminho) {
            return "& '$caminho'"
        }
    }
    if (Get-Command python -ErrorAction SilentlyContinue) {
        return "python"
    }
    if (Get-Command py -ErrorAction SilentlyContinue) {
        return "py"
    }
    return $null
}

Set-Location $projeto

$localIp = Get-LocalIp
$frontendLocal = "http://localhost:5173"
$frontendRede = if ($localIp) { "http://$localIp`:5173" } else { "http://SEU_IP_LOCAL:5173" }
$apiPacientesRede = if ($localIp) { "http://$localIp`:8001" } else { "http://SEU_IP_LOCAL:8001" }
$apiAgendaRede = if ($localIp) { "http://$localIp`:8002" } else { "http://SEU_IP_LOCAL:8002" }

Write-Host ""
Write-Host "Iniciando SoulSul novo sistema..." -ForegroundColor Cyan
Write-Host "Frontend local: $frontendLocal" -ForegroundColor Green
Write-Host "Frontend rede:  $frontendRede" -ForegroundColor Green
Write-Host "API Pacientes:  $apiPacientesRede" -ForegroundColor Green
Write-Host "API Agenda:     $apiAgendaRede" -ForegroundColor Green
Write-Host ""

$pythonCmd = Get-PythonCommand
if (-not $pythonCmd) {
    Write-Host "Python nao encontrado no PATH." -ForegroundColor Yellow
    Write-Host "O frontend pode ser iniciado, mas as APIs nao vao subir ate corrigir o Python." -ForegroundColor Yellow
}

Start-Process powershell -ArgumentList @(
    "-NoExit",
    "-Command",
    "Set-Location '$frontend'; npm run dev -- --host 0.0.0.0"
)

if ($pythonCmd) {
    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$projeto'; $pythonCmd -m uvicorn api_pacientes:app --host 0.0.0.0 --port 8001 --reload"
    )

    Start-Process powershell -ArgumentList @(
        "-NoExit",
        "-Command",
        "Set-Location '$projeto'; $pythonCmd -m uvicorn api_agenda:app --host 0.0.0.0 --port 8002 --reload"
    )
}

Write-Host "Janelas de inicializacao abertas." -ForegroundColor Cyan
