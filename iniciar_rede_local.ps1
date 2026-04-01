$ErrorActionPreference = "Stop"

$projeto = "C:\Users\jusgo\Documents\sistema_clinica"
Set-Location $projeto

Write-Host ""
Write-Host "Iniciando sistema SoulSul na rede local..." -ForegroundColor Cyan
Write-Host "Acesso na rede: http://192.168.15.152:8501" -ForegroundColor Green
Write-Host ""

if (Get-Command py -ErrorAction SilentlyContinue) {
    py -m streamlit run sistema_soul_sul_master_corrigido.py --server.address 0.0.0.0 --server.port 8501
}
elseif (Get-Command python -ErrorAction SilentlyContinue) {
    python -m streamlit run sistema_soul_sul_master_corrigido.py --server.address 0.0.0.0 --server.port 8501
}
else {
    Write-Error "Nao encontrei Python nem py no PATH."
}
