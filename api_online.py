import os
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_agenda import app as agenda_app
from api_agenda import garantir_colunas_agenda_api
from api_pacientes import app as pacientes_app
from api_pacientes import auditoria_middleware
from api_pacientes import garantir_colunas_pacientes_api
from database import DB_PATH
from database import inicializar_banco


ROTAS_RESERVADAS = {"/openapi.json", "/docs", "/docs/oauth2-redirect", "/redoc"}

app = FastAPI(title="SoulSul Online API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    print(f"[api_online] startup begin {datetime.now().isoformat()} DB_PATH={os.getenv('DB_PATH', 'clinica.db')}", flush=True)
    inicializar_banco()
    garantir_colunas_pacientes_api()
    garantir_colunas_agenda_api()
    print("[api_online] startup ready", flush=True)


@app.middleware("http")
async def auditoria_online(request, call_next):
    return await auditoria_middleware(request, call_next)


def anexar_rotas(origem: FastAPI) -> None:
    for rota in origem.router.routes:
        if getattr(rota, "path", "") in ROTAS_RESERVADAS:
            continue
        app.router.routes.append(rota)


anexar_rotas(pacientes_app)
anexar_rotas(agenda_app)


@app.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "online", "service": "soulsul"}
