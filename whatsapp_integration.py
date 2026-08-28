from __future__ import annotations

import json
import os
import sqlite3
from datetime import datetime

from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import Response
from pydantic import BaseModel

from database import conectar
from whatsapp_service import WhatsAppAPIError, WhatsAppConfigurationError, WhatsAppService


router = APIRouter()


class MessagePayload(BaseModel):
    conteudo: str


def now() -> str:
    return datetime.now().isoformat(sep=" ", timespec="seconds")


def service() -> WhatsAppService:
    return WhatsAppService()


def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS crm_conversas (
            id INTEGER PRIMARY KEY AUTOINCREMENT, crm_id INTEGER, paciente_id INTEGER, canal TEXT NOT NULL,
            contato_nome TEXT, contato_telefone TEXT, externo_usuario_id TEXT, etapa_funil TEXT DEFAULT 'Novo lead',
            ultima_mensagem TEXT, ultima_mensagem_em TEXT, ultima_mensagem_sentido TEXT,
            nao_lidas INTEGER DEFAULT 0, status TEXT DEFAULT 'aberta', criado_em TEXT, atualizado_em TEXT
        );
        CREATE TABLE IF NOT EXISTS crm_mensagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT, conversa_id INTEGER NOT NULL, crm_id INTEGER, paciente_id INTEGER,
            canal TEXT NOT NULL, mensagem_externa_id TEXT, remetente_externo_id TEXT, direcao TEXT NOT NULL,
            tipo_mensagem TEXT DEFAULT 'text', conteudo TEXT, midia_url TEXT, status_envio TEXT DEFAULT 'received',
            erro_envio TEXT, metadata_json TEXT DEFAULT '{}', criado_em TEXT, atualizado_em TEXT
        );
        CREATE TABLE IF NOT EXISTS crm_webhook_eventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT, canal TEXT NOT NULL, evento_externo_id TEXT NOT NULL,
            tipo_evento TEXT, payload_json TEXT, processado_em TEXT
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_conversa_usuario ON crm_conversas(canal, externo_usuario_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_mensagem_id ON crm_mensagens(canal, mensagem_externa_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_whatsapp_evento_id ON crm_webhook_eventos(canal, evento_externo_id);
    """)


def digits(value: object) -> str:
    return WhatsAppService.normalize_phone(value)


def patient_by_phone(conn: sqlite3.Connection, phone: str):
    target = digits(phone)
    for row in conn.execute("SELECT * FROM pacientes WHERE COALESCE(telefone, '')<>'' ORDER BY id DESC").fetchall():
        saved = digits(row["telefone"])
        if saved == target or (len(saved) >= 8 and len(target) >= 8 and (saved.endswith(target[-8:]) or target.endswith(saved[-8:]))):
            return row
    return None


def ensure_contact(conn: sqlite3.Connection, phone: str, name: str):
    patient = patient_by_phone(conn, phone)
    is_new = patient is None
    if patient is None:
        clean_name = str(name or phone).strip()[:160]
        conn.execute("INSERT INTO pacientes (nome, telefone) VALUES (?, ?)", (clean_name, phone))
        patient_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]
        patient = conn.execute("SELECT * FROM pacientes WHERE id=?", (patient_id,)).fetchone()
    crm = conn.execute("SELECT * FROM crm_pacientes WHERE paciente_id=? LIMIT 1", (patient["id"],)).fetchone()
    if crm is None:
        stamp = now()
        conn.execute("INSERT INTO crm_pacientes (paciente_id, etapa_funil, canal, criado_por, atualizado_por, criado_em, atualizado_em) VALUES (?, 'Novo lead', 'WhatsApp', 'META', 'META', ?, ?)", (patient["id"], stamp, stamp))
        crm = conn.execute("SELECT * FROM crm_pacientes WHERE paciente_id=?", (patient["id"],)).fetchone()
    return patient, crm, is_new


def ensure_conversation(conn: sqlite3.Connection, phone: str, name: str):
    patient, crm, _ = ensure_contact(conn, phone, name)
    conversation = conn.execute("SELECT * FROM crm_conversas WHERE canal='whatsapp' AND externo_usuario_id=?", (phone,)).fetchone()
    stamp = now()
    if conversation is None:
        conn.execute("INSERT INTO crm_conversas (crm_id,paciente_id,canal,contato_nome,contato_telefone,externo_usuario_id,etapa_funil,nao_lidas,status,criado_em,atualizado_em) VALUES (?,?, 'whatsapp',?,?,? ,?,0,'aberta',?,?)", (crm["id"], patient["id"], name, phone, phone, crm["etapa_funil"], stamp, stamp))
    else:
        conn.execute("UPDATE crm_conversas SET crm_id=?,paciente_id=?,contato_nome=?,contato_telefone=?,atualizado_em=? WHERE id=?", (crm["id"], patient["id"], name or conversation["contato_nome"], phone, stamp, conversation["id"]))
    return conn.execute("SELECT * FROM crm_conversas WHERE canal='whatsapp' AND externo_usuario_id=?", (phone,)).fetchone()


def message_content(message: dict) -> tuple[str, str, str]:
    kind = str(message.get("type") or "text").lower()
    block = message.get(kind) if isinstance(message.get(kind), dict) else {}
    if kind == "text":
        content = str(block.get("body") or "")
    else:
        content = str(block.get("caption") or f"[{kind}]")
    media_id = str(block.get("id") or "")
    return kind, content[:10000], f"meta-media://{media_id}" if media_id else ""


def store_message(conn: sqlite3.Connection, conversation, message: dict, direction: str = "entrada", status: str = "received"):
    external_id = str(message.get("id") or "")
    existing = conn.execute("SELECT * FROM crm_mensagens WHERE canal='whatsapp' AND mensagem_externa_id=?", (external_id,)).fetchone() if external_id else None
    if existing is not None:
        return existing, False
    kind, content, media_url = message_content(message)
    try:
        stamp = datetime.fromtimestamp(int(message.get("timestamp"))).isoformat(sep=" ", timespec="seconds")
    except Exception:
        stamp = now()
    conn.execute("INSERT INTO crm_mensagens (conversa_id,crm_id,paciente_id,canal,mensagem_externa_id,remetente_externo_id,direcao,tipo_mensagem,conteudo,midia_url,status_envio,metadata_json,criado_em,atualizado_em) VALUES (?,?,?,'whatsapp',?,?,?,?,?,?,?,?,?,?)", (conversation["id"],conversation["crm_id"],conversation["paciente_id"],external_id,str(message.get("from") or ""),direction,kind,content,media_url,status,json.dumps(message,ensure_ascii=False),stamp,now()))
    unread = 1 if direction == "entrada" else 0
    conn.execute("UPDATE crm_conversas SET ultima_mensagem=?,ultima_mensagem_em=?,ultima_mensagem_sentido=?,nao_lidas=COALESCE(nao_lidas,0)+?,atualizado_em=? WHERE id=?", (content,stamp,direction,unread,now(),conversation["id"]))
    return conn.execute("SELECT * FROM crm_mensagens WHERE id=last_insert_rowid()").fetchone(), True


def process_webhook(payload: dict) -> int:
    processed = 0
    conn = conectar()
    try:
        ensure_schema(conn)
        for entry in payload.get("entry") or []:
            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                profiles = {str(c.get("wa_id") or ""): str((c.get("profile") or {}).get("name") or "") for c in value.get("contacts") or [] if isinstance(c, dict)}
                for message in value.get("messages") or []:
                    message_id = str(message.get("id") or "")
                    try:
                        conn.execute("INSERT INTO crm_webhook_eventos (canal,evento_externo_id,tipo_evento,payload_json,processado_em) VALUES ('whatsapp',?,'message',?,?)", (message_id,json.dumps(message,ensure_ascii=False),now()))
                    except sqlite3.IntegrityError:
                        continue
                    phone = digits(message.get("from"))
                    conversation = ensure_conversation(conn, phone, profiles.get(phone) or phone)
                    _, created = store_message(conn, conversation, message)
                    processed += int(created)
                for item in value.get("statuses") or []:
                    external_id, state = str(item.get("id") or ""), str(item.get("status") or "sent")
                    event_id = f"status:{external_id}:{state}"
                    try:
                        conn.execute("INSERT INTO crm_webhook_eventos (canal,evento_externo_id,tipo_evento,payload_json,processado_em) VALUES ('whatsapp',?,'status',?,?)", (event_id,json.dumps(item,ensure_ascii=False),now()))
                    except sqlite3.IntegrityError:
                        continue
                    errors = item.get("errors") if isinstance(item.get("errors"), list) else []
                    error_text = str((errors[0] or {}).get("title") or "")[:500] if errors else ""
                    conn.execute("UPDATE crm_mensagens SET status_envio=?,erro_envio=?,atualizado_em=? WHERE canal='whatsapp' AND mensagem_externa_id=?", (state,error_text,now(),external_id))
                    processed += 1
        conn.commit()
        return processed
    finally:
        conn.close()


def conversation_dict(row, messages=None):
    result = {"id":row["id"],"crmId":row["crm_id"],"pacienteId":row["paciente_id"],"canal":row["canal"],"contatoNome":row["contato_nome"] or "","contatoTelefone":row["contato_telefone"] or "","etapaFunil":row["etapa_funil"] or "Novo lead","ultimaMensagem":row["ultima_mensagem"] or "","ultimaMensagemEm":row["ultima_mensagem_em"] or "","ultimaMensagemSentido":row["ultima_mensagem_sentido"] or "","naoLidas":row["nao_lidas"] or 0,"status":row["status"] or "aberta"}
    if messages is not None:
        result["mensagens"] = [{"id":m["id"],"conversaId":m["conversa_id"],"direcao":m["direcao"],"tipoMensagem":m["tipo_mensagem"],"conteudo":m["conteudo"] or "","midiaUrl":m["midia_url"] or "","statusEnvio":m["status_envio"] or "","erroEnvio":m["erro_envio"] or "","criadoEm":m["criado_em"] or "","mensagemExternaId":m["mensagem_externa_id"] or ""} for m in messages]
    return result


@router.get("/api/meta/webhook")
def verify_webhook(hub_mode: str=Query("",alias="hub.mode"), hub_token: str=Query("",alias="hub.verify_token"), hub_challenge: str=Query("",alias="hub.challenge")):
    try: return Response(service().verify_challenge(hub_mode,hub_token,hub_challenge),media_type="text/plain")
    except WhatsAppConfigurationError as exc: raise HTTPException(503,str(exc)) from exc
    except PermissionError as exc: raise HTTPException(403,str(exc)) from exc
    except ValueError as exc: raise HTTPException(400,str(exc)) from exc


@router.post("/api/meta/webhook")
async def receive_webhook(request: Request):
    body = await request.body()
    if not service().validate_signature(body,request.headers.get("x-hub-signature-256","")): raise HTTPException(403,"Assinatura inválida.")
    try: payload=json.loads(body.decode() or "{}")
    except json.JSONDecodeError as exc: raise HTTPException(400,"Payload inválido.") from exc
    return {"ok":True,"eventosProcessados":process_webhook(payload)}


@router.get("/api/crm/conversas")
def list_conversations(canal: str="whatsapp", busca: str=""):
    conn=conectar()
    try:
        ensure_schema(conn); rows=conn.execute("SELECT * FROM crm_conversas WHERE canal=? ORDER BY COALESCE(ultima_mensagem_em,atualizado_em,criado_em,'') DESC,id DESC",(canal.lower(),)).fetchall()
        term=busca.strip().lower(); return [conversation_dict(r) for r in rows if not term or term in " ".join([r["contato_nome"] or "",r["contato_telefone"] or "",r["ultima_mensagem"] or ""]).lower()]
    finally: conn.close()


@router.get("/api/crm/conversas/{conversation_id}")
def get_conversation(conversation_id: int):
    conn=conectar()
    try:
        ensure_schema(conn); row=conn.execute("SELECT * FROM crm_conversas WHERE id=?",(conversation_id,)).fetchone()
        if row is None: raise HTTPException(404,"Conversa não encontrada.")
        messages=conn.execute("SELECT * FROM crm_mensagens WHERE conversa_id=? ORDER BY criado_em,id",(conversation_id,)).fetchall(); conn.execute("UPDATE crm_conversas SET nao_lidas=0 WHERE id=?",(conversation_id,)); conn.commit(); return conversation_dict(row,messages)
    finally: conn.close()


@router.post("/api/crm/conversas/{conversation_id}/mensagens")
def send_message(conversation_id: int, payload: MessagePayload, request: Request):
    if not str(request.headers.get("x-usuario") or "").strip(): raise HTTPException(401,"Usuário não autenticado.")
    conn=conectar()
    try:
        ensure_schema(conn); conversation=conn.execute("SELECT * FROM crm_conversas WHERE id=?",(conversation_id,)).fetchone()
        if conversation is None: raise HTTPException(404,"Conversa não encontrada.")
        try: response=service().send_text(conversation["contato_telefone"],payload.conteudo)
        except WhatsAppConfigurationError as exc: raise HTTPException(503,str(exc)) from exc
        except (WhatsAppAPIError,ValueError) as exc: raise HTTPException(502,str(exc)) from exc
        messages=response.get("messages") if isinstance(response,dict) else []; external_id=str((messages[0] or {}).get("id") or "") if messages else ""
        row,_=store_message(conn,conversation,{"id":external_id,"type":"text","text":{"body":payload.conteudo}},"saida","sent"); conn.commit(); return conversation_dict(conversation,[row])["mensagens"][0]
    finally: conn.close()


@router.post("/api/dev/whatsapp/simular")
def simulate(payload: MessagePayload, request: Request, telefone: str="5511999999999", nome: str="Contato WhatsApp Teste"):
    if os.getenv("APP_ENV","development").lower() in {"production","prod","producao"}: raise HTTPException(404,"Rota não encontrada.")
    if not request.headers.get("x-usuario"): raise HTTPException(401,"Usuário não autenticado.")
    message={"from":digits(telefone),"id":f"dev-{int(datetime.now().timestamp()*1000000)}","timestamp":str(int(datetime.now().timestamp())),"type":"text","text":{"body":payload.conteudo}}
    event={"entry":[{"changes":[{"value":{"contacts":[{"profile":{"name":nome},"wa_id":digits(telefone)}],"messages":[message]}}]}]}
    return {"ok":True,"eventosProcessados":process_webhook(event)}


def register_whatsapp_routes(app) -> None:
    app.include_router(router)
