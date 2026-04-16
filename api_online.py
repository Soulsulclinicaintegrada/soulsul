import os
from datetime import datetime
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from api_agenda import app as agenda_app
from api_agenda import garantir_colunas_agenda_api
from api_pacientes import app as pacientes_app
from api_pacientes import auditoria_middleware
from api_pacientes import carregar_template_contrato_docx
from api_pacientes import garantir_colunas_pacientes_api
from api_pacientes import TEMPLATE_B64_PATH
from api_pacientes import TEMPLATE_PATH
from api_pacientes import Document as DOCX_DOCUMENT
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
def healthcheck() -> dict[str, object]:
    template_open_ok = False
    template_open_error = ""
    if DOCX_DOCUMENT is not None and (os.path.isfile(TEMPLATE_PATH) or os.path.isfile(TEMPLATE_B64_PATH)):
        try:
            carregar_template_contrato_docx()
            template_open_ok = True
        except Exception as exc:
            template_open_error = str(exc)
    return {
        "status": "ok",
        "template_path": TEMPLATE_PATH,
        "template_exists": os.path.isfile(TEMPLATE_PATH),
        "template_b64_path": TEMPLATE_B64_PATH,
        "template_b64_exists": os.path.isfile(TEMPLATE_B64_PATH),
        "docx_available": DOCX_DOCUMENT is not None,
        "template_open_ok": template_open_ok,
        "template_open_error": template_open_error,
    }


@app.get("/")
def root() -> dict[str, str]:
    return {"status": "online", "service": "soulsul"}


@app.post("/admin/import-db")
async def import_db(request: Request) -> dict[str, object]:
    expected_token = os.getenv("IMPORT_DB_TOKEN", "").strip()
    provided_token = str(request.headers.get("x-import-token") or "").strip()
    if not expected_token or provided_token != expected_token:
        raise HTTPException(status_code=403, detail="Importacao nao autorizada.")

    payload = await request.body()
    if not payload:
        raise HTTPException(status_code=400, detail="Arquivo vazio.")
    if not payload.startswith(b"SQLite format 3"):
        raise HTTPException(status_code=400, detail="Arquivo SQLite invalido.")

    db_path = Path(DB_PATH)
    db_path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = db_path.with_suffix(".incoming")
    temp_path.write_bytes(payload)

    backup_path = None
    if db_path.exists():
        backup_path = db_path.with_name(f"{db_path.stem}_backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}{db_path.suffix}")
        db_path.replace(backup_path)

    temp_path.replace(db_path)

    print(f"[api_online] import-db ok bytes={len(payload)} target={db_path}", flush=True)
    return {
        "status": "ok",
        "bytes": len(payload),
        "db_path": str(db_path),
        "backup_path": str(backup_path) if backup_path else "",
    }
