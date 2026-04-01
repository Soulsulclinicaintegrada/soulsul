# Cloudflare Tunnel

Use estes hostnames:

- `erp.seudominio.com` -> frontend
- `api.seudominio.com` -> API de pacientes
- `agenda-api.seudominio.com` -> API da agenda

## Frontend

Crie o arquivo:

- `C:\Users\jusgo\Documents\sistema_clinica\frontend\.env`

Com o conteúdo:

```env
VITE_API_BASE_URL=https://api.seudominio.com
VITE_AGENDA_API_BASE_URL=https://agenda-api.seudominio.com
```

## Config do tunnel

Use como base:

- `C:\Users\jusgo\Documents\sistema_clinica\cloudflare_tunnel_config.example.yml`

## Comandos principais

```powershell
cloudflared tunnel login
cloudflared tunnel create soulsul-erp
cloudflared tunnel route dns soulsul-erp erp.seudominio.com
cloudflared tunnel route dns soulsul-erp api.seudominio.com
cloudflared tunnel route dns soulsul-erp agenda-api.seudominio.com
cloudflared tunnel run soulsul-erp
```

## Serviços locais usados

- frontend: `http://localhost:5173`
- api pacientes: `http://localhost:8001`
- api agenda: `http://localhost:8002`
