from __future__ import annotations

import os
import secrets
import re
import sqlite3
import traceback
import unicodedata
import math
import calendar
from copy import deepcopy
from io import BytesIO
from urllib import error as urllib_error
from urllib import request as urllib_request
import json
from datetime import date, datetime, timedelta
from shutil import copyfile
import base64
try:
    from zoneinfo import ZoneInfo
except ImportError:  # pragma: no cover
    ZoneInfo = None

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

try:
    from lxml import etree
except ImportError:  # pragma: no cover - ambiente pode nao ter lxml
    etree = None

try:
    from docx import Document
    from docx.enum.text import WD_BREAK
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Inches, Pt
    from docx.text.paragraph import Paragraph
except ImportError:  # pragma: no cover - ambiente pode nao ter python-docx
    Document = None
    WD_BREAK = None
    OxmlElement = None
    qn = None
    Inches = None
    Pt = None
    Paragraph = None

try:
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
except ImportError:  # pragma: no cover
    Workbook = None
    Alignment = None
    Border = None
    Font = None
    PatternFill = None
    Side = None

from database import (
    DB_PATH,
    EDUCACAO_ADMIN_USUARIO,
    SENHA_PADRAO_CLINICA,
    conectar,
    corrigir_texto_importado,
    garantir_coluna,
    gerar_hash_senha,
    inicializar_banco,
    verificar_senha,
)
from whatsapp_service import WhatsAppAPIError, WhatsAppConfigurationError, WhatsAppService


API_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARQUIVOS_BASE_DIR = os.path.dirname(os.path.abspath(DB_PATH)) or "."
DOCS_DIR = os.path.join(ARQUIVOS_BASE_DIR, "documentos")
EXAMES_DIR = os.path.join(ARQUIVOS_BASE_DIR, "dados_pacientes", "exames")
FOTOS_DIR = os.path.join(ARQUIVOS_BASE_DIR, "dados_pacientes", "fotos")
BOLETOS_DIR = os.path.join(ARQUIVOS_BASE_DIR, "dados_pacientes", "boletos")
TEMPLATE_PATH = os.path.join(API_BASE_DIR, "modelo_documento_normalizado.docx")
TEMPLATE_B64_PATH = os.path.join(API_BASE_DIR, "modelo_documento_normalizado.b64")
TEMPLATE_ORDEM_SERVICO_PATH = os.path.join(API_BASE_DIR, "ORDEM DE SERVIÇO PROTÉTICO.docx")
LOGO_SOULSUL_ELEVEN_PATH = os.path.join(API_BASE_DIR, "logo-soulsul-eleven.png")
TEMPLATE_RECEBIMENTO_BOLETOS_PATH = os.path.join(API_BASE_DIR, "RECEBIMENTO DE BOLETOS.docx")
CONTAS_CAIXA_MODELO = ["CAIXA", "SICOOB", "INFINITEPAY", "PAGBANK", "C6"]
TIMEZONE_LOCAL = ZoneInfo("America/Sao_Paulo") if ZoneInfo is not None else None


def carregar_template_contrato_docx():
    if Document is None:
        raise RuntimeError("python-docx nao disponivel")

    erros: list[str] = []

    if os.path.isfile(TEMPLATE_PATH):
        try:
            return Document(TEMPLATE_PATH)
        except Exception as exc:
            erros.append(f"arquivo: {exc}")

    if os.path.isfile(TEMPLATE_B64_PATH):
        try:
            with open(TEMPLATE_B64_PATH, "r", encoding="ascii") as arquivo:
                conteudo = base64.b64decode(arquivo.read())
            return Document(BytesIO(conteudo))
        except Exception as exc:
            erros.append(f"base64: {exc}")

    raise RuntimeError(" | ".join(erros) if erros else "template do contrato indisponivel")


def caminho_template_ordem_servico() -> str:
    candidatos = [
        TEMPLATE_ORDEM_SERVICO_PATH,
        os.path.join(API_BASE_DIR, "ORDEM DE SERVICO PROTETICO.docx"),
        os.path.join(API_BASE_DIR, "ORDEM_DE_SERVICO_PROTETICO.docx"),
    ]
    for caminho in candidatos:
        if os.path.isfile(caminho):
            return caminho

    try:
        for nome in os.listdir(API_BASE_DIR):
            nome_normalizado = normalizar_texto(nome)
            if nome.lower().endswith(".docx") and "ordem de servico" in nome_normalizado and "protetico" in nome_normalizado:
                caminho = os.path.join(API_BASE_DIR, nome)
                if os.path.isfile(caminho):
                    return caminho
    except OSError:
        pass
    return TEMPLATE_ORDEM_SERVICO_PATH


def agora_str() -> str:
    return agora_local().replace(tzinfo=None).isoformat(sep=" ", timespec="seconds")


def agora_local() -> datetime:
    if TIMEZONE_LOCAL is not None:
        return datetime.now(TIMEZONE_LOCAL)
    return datetime.now()


def formatar_data_br(data_obj: date | None) -> str:
    if not data_obj:
        return ""
    return data_obj.strftime("%d/%m/%Y")


def formatar_data_extenso_local(data_obj: date | None = None) -> str:
    referencia = data_obj or agora_local().date()
    meses = [
        "janeiro",
        "fevereiro",
        "março",
        "abril",
        "maio",
        "junho",
        "julho",
        "agosto",
        "setembro",
        "outubro",
        "novembro",
        "dezembro",
    ]
    return f"{referencia.day} de {meses[referencia.month - 1]} de {referencia.year}"


def parse_data_contrato(valor) -> date | None:
    if valor is None:
        return None
    texto = str(valor).strip()
    if not texto or texto.lower() in {"nat", "nan", "none"}:
        return None

    formatos = ("%d/%m/%Y", "%Y-%m-%d", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M")
    for formato in formatos:
        try:
            return datetime.strptime(texto, formato).date()
        except ValueError:
            continue
    if "T" in texto:
        try:
            return datetime.fromisoformat(texto).date()
        except ValueError:
            pass
    return None


def formatar_data_br_valor(valor) -> str:
    return formatar_data_br(parse_data_contrato(valor))


def normalizar_data_contrato_iso(valor, fallback: str = "") -> str:
    data_parse = parse_data_contrato(valor)
    if data_parse is None:
        return fallback
    return data_parse.isoformat()


def formatar_data_hora_relatorio(valor) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return ""
    try:
        data_hora = datetime.fromisoformat(texto.replace("Z", "+00:00"))
        return data_hora.strftime("%d/%m/%Y %H:%M")
    except ValueError:
        data = parse_data_contrato(texto)
        return formatar_data_br(data)


def calcular_idade_atual(valor_data_nascimento) -> int | None:
    nascimento = parse_data_contrato(valor_data_nascimento)
    if nascimento is None:
        return None
    hoje = agora_local().date()
    idade = hoje.year - nascimento.year
    if (hoje.month, hoje.day) < (nascimento.month, nascimento.day):
        idade -= 1
    return idade if idade >= 0 else None


def formatar_prontuario_valor(valor) -> str:
    if valor is None:
        return ""
    texto = str(valor).strip()
    if texto.endswith(".0"):
        texto = texto[:-2]
    return texto


def limpar_nome(nome: str) -> str:
    texto = str(nome or "").strip().upper()
    texto = re.sub(r"[^A-Z0-9 ]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()


def normalizar_texto(valor: str) -> str:
    texto = str(valor or "")
    texto = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    texto = texto.lower().strip()
    return re.sub(r"\s+", " ", texto)


def textos_compativeis(valor: str, referencia: str) -> bool:
    texto = normalizar_texto(valor)
    base = normalizar_texto(referencia)
    if not texto or not base:
        return False
    if texto == base or texto in base or base in texto:
        return True
    tokens_texto = {item for item in texto.split() if len(item) > 2}
    tokens_base = {item for item in base.split() if len(item) > 2}
    return bool(tokens_texto) and tokens_texto.issubset(tokens_base)


def limpar_cpf(cpf: str) -> str:
    return "".join(ch for ch in str(cpf or "") if ch.isdigit())


def cpf_valido(cpf: str) -> bool:
    numero = limpar_cpf(cpf)
    if len(numero) != 11 or numero == numero[0] * 11:
        return False

    soma = sum(int(numero[i]) * (10 - i) for i in range(9))
    dig1 = (soma * 10 % 11) % 10
    if dig1 != int(numero[9]):
        return False

    soma = sum(int(numero[i]) * (11 - i) for i in range(10))
    dig2 = (soma * 10 % 11) % 10
    return dig2 == int(numero[10])


def formatar_moeda_br(valor) -> str:
    try:
        valor_float = float(valor or 0)
    except (TypeError, ValueError):
        valor_float = 0.0
    texto = f"{valor_float:,.2f}"
    return f"R$ {texto.replace(',', 'X').replace('.', ',').replace('X', '.')}"


def normalizar_texto_maiusculo(valor: str) -> str:
    texto = unicodedata.normalize("NFKD", str(valor or ""))
    texto = texto.encode("ascii", "ignore").decode("ascii")
    return texto.upper().strip()


def formatar_titulo(valor: str) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return ""
    return " ".join(parte.capitalize() for parte in texto.split())


def colunas_tabela(conn: sqlite3.Connection, nome_tabela: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({nome_tabela})")}


def garantir_colunas_pacientes_api() -> None:
    conn = conectar()
    try:
        garantir_coluna(conn, "pacientes", "apelido TEXT")
        garantir_coluna(conn, "pacientes", "sexo TEXT")
        garantir_coluna(conn, "pacientes", "rg TEXT")
        garantir_coluna(conn, "pacientes", "email TEXT")
        garantir_coluna(conn, "pacientes", "estado_civil TEXT")
        garantir_coluna(conn, "pacientes", "observacoes TEXT")
        garantir_coluna(conn, "pacientes", "complemento TEXT")
        garantir_coluna(conn, "pacientes", "profissao TEXT")
        garantir_coluna(conn, "pacientes", "origem TEXT")
        garantir_coluna(conn, "pacientes", "foto_path TEXT")
        garantir_coluna(conn, "pacientes", "tratamento_suspenso INTEGER DEFAULT 0")
        garantir_coluna(conn, "pacientes", "tratamento_suspenso_observacao TEXT")
        garantir_coluna(conn, "pacientes", "tratamento_suspenso_por TEXT")
        garantir_coluna(conn, "pacientes", "tratamento_suspenso_em TEXT")
        garantir_coluna(conn, "contratos", "status TEXT DEFAULT 'EM_ABERTO'")
        garantir_coluna(conn, "contratos", "aprovado_por TEXT")
        garantir_coluna(conn, "contratos", "data_aprovacao TEXT")
        garantir_coluna(conn, "contratos", "observacoes TEXT")
        garantir_coluna(conn, "contratos", "clinica_snapshot TEXT")
        garantir_coluna(conn, "contratos", "criado_por_snapshot TEXT")
        garantir_coluna(conn, "contratos", "tabela_snapshot TEXT")
        garantir_coluna(conn, "contratos", "plano_pagamento_json TEXT")
        garantir_coluna(conn, "contratos", "desconto_percentual REAL DEFAULT 0")
        garantir_coluna(conn, "contratos", "desconto_valor REAL DEFAULT 0")
        garantir_coluna(conn, "contratos", "validade_orcamento TEXT")
        garantir_coluna(conn, "contratos", "data_retorno_crm TEXT")
        garantir_coluna(conn, "contratos", "crm_status TEXT")
        garantir_coluna(conn, "contratos", "crm_observacao_contato TEXT")
        garantir_coluna(conn, "contratos", "crm_ultimo_contato_em TEXT")
        garantir_coluna(conn, "contratos", "crm_ultimo_contato_por TEXT")
        garantir_coluna(conn, "crm_pacientes", "origem_cancelado INTEGER DEFAULT 0")
        garantir_coluna(conn, "crm_pacientes", "cancelado_em TEXT")
        garantir_coluna(conn, "procedimentos_contrato", "profissional_snapshot TEXT")
        garantir_coluna(conn, "procedimentos_contrato", "denticao_snapshot TEXT")
        garantir_coluna(conn, "ordens_servico_protetico", "status TEXT DEFAULT 'Emitida'")
        garantir_coluna(conn, "ordens_servico_protetico", "laboratorio_id INTEGER")
        garantir_coluna(conn, "ordens_servico_protetico", "status_atualizado_por TEXT")
        garantir_coluna(conn, "ordens_servico_protetico", "status_atualizado_em TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS guia_laboratorios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL UNIQUE,
                ativo INTEGER DEFAULT 1,
                criado_em TEXT,
                atualizado_em TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS ordem_servico_movimentacoes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ordem_servico_id INTEGER NOT NULL,
                status_anterior TEXT,
                status_novo TEXT NOT NULL,
                laboratorio_id INTEGER,
                laboratorio_nome_snapshot TEXT,
                observacao TEXT,
                criado_por TEXT,
                criado_em TEXT
            )
            """
        )
        for laboratorio_nome in ("Armação Metálica", "Labsul", "Jeferson", "Zlab"):
            conn.execute(
                "INSERT OR IGNORE INTO guia_laboratorios (nome, ativo, criado_em, atualizado_em) VALUES (?, 1, ?, ?)",
                (laboratorio_nome, agora_str(), agora_str()),
            )
        conn.execute("UPDATE ordens_servico_protetico SET status='Emitida' WHERE COALESCE(status, '')=''")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico_protetico(status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_ordem_servico_movimentacoes_ordem ON ordem_servico_movimentacoes(ordem_servico_id)")
        garantir_coluna(conn, "procedimentos_contrato_educacao", "ativo INTEGER DEFAULT 1")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crm_contatos_historico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crm_id INTEGER,
                paciente_id INTEGER NOT NULL,
                contrato_id INTEGER,
                status TEXT,
                observacao TEXT,
                proximo_contato TEXT,
                criado_por TEXT,
                criado_em TEXT,
                automatico INTEGER DEFAULT 0
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crm_conversas (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                crm_id INTEGER,
                paciente_id INTEGER,
                canal TEXT NOT NULL,
                contato_nome TEXT,
                contato_telefone TEXT,
                contato_instagram TEXT,
                externo_usuario_id TEXT,
                externo_conversa_id TEXT,
                etapa_funil TEXT DEFAULT 'Novo lead',
                responsavel TEXT,
                ultima_mensagem TEXT,
                ultima_mensagem_em TEXT,
                ultima_mensagem_sentido TEXT,
                nao_lidas INTEGER DEFAULT 0,
                status TEXT DEFAULT 'aberta',
                criado_em TEXT,
                atualizado_em TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crm_mensagens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                conversa_id INTEGER NOT NULL,
                crm_id INTEGER,
                paciente_id INTEGER,
                canal TEXT NOT NULL,
                mensagem_externa_id TEXT,
                status_externo_id TEXT,
                remetente_externo_id TEXT,
                direcao TEXT NOT NULL,
                remetente_tipo TEXT NOT NULL,
                tipo_mensagem TEXT DEFAULT 'text',
                conteudo TEXT,
                midia_url TEXT,
                status_envio TEXT DEFAULT 'received',
                erro_envio TEXT,
                metadata_json TEXT DEFAULT '{}',
                criado_em TEXT,
                atualizado_em TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS crm_webhook_eventos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                canal TEXT NOT NULL,
                evento_externo_id TEXT NOT NULL,
                tipo_evento TEXT,
                payload_json TEXT,
                processado_em TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS recebiveis_historico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                recebivel_id INTEGER NOT NULL,
                paciente_id INTEGER NOT NULL,
                status TEXT,
                observacao TEXT,
                cobrado INTEGER DEFAULT 0,
                criado_por TEXT,
                criado_em TEXT
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS orcamentos_historico (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                contrato_id INTEGER NOT NULL,
                paciente_id INTEGER NOT NULL,
                tipo TEXT,
                observacao TEXT,
                criado_por TEXT,
                criado_em TEXT
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pacientes_nome ON pacientes(nome)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pacientes_prontuario ON pacientes(prontuario)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_pacientes_cpf ON pacientes(cpf)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_recebiveis_paciente_id ON recebiveis(paciente_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_contratos_paciente_id ON contratos(paciente_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_contratos_data_retorno_crm ON contratos(data_retorno_crm)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_contratos_crm_status ON contratos(crm_status)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_crm_contatos_historico_contrato_id ON crm_contatos_historico(contrato_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_crm_conversas_paciente_id ON crm_conversas(paciente_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_crm_conversas_crm_id ON crm_conversas(crm_id)")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_conversas_externo_usuario ON crm_conversas(canal, externo_usuario_id)")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_conversas_externo_conversa ON crm_conversas(canal, externo_conversa_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_crm_mensagens_conversa_id ON crm_mensagens(conversa_id)")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_mensagens_externa_id ON crm_mensagens(canal, mensagem_externa_id)")
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_webhook_eventos_externo_id ON crm_webhook_eventos(canal, evento_externo_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_recebiveis_historico_recebivel_id ON recebiveis_historico(recebivel_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_orcamentos_historico_contrato_id ON orcamentos_historico(contrato_id)")
        garantir_coluna(conn, "recebiveis", "data_pagamento TEXT")
        garantir_coluna(conn, "financeiro", "conta_caixa TEXT")
        garantir_coluna(conn, "contas_pagar", "categoria TEXT")
        garantir_coluna(conn, "agendamentos", "tipo_atendimento_nome_snapshot TEXT")
        garantir_coluna(conn, "agendamentos", "status_origem TEXT")
        garantir_coluna(conn, "agendamentos", "status_motivo TEXT")
        garantir_coluna(conn, "agendamentos", "status_usuario TEXT")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS procedimentos_dente (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                paciente_id INTEGER,
                contrato_id INTEGER,
                dente INTEGER,
                regiao TEXT,
                procedimento TEXT,
                status TEXT,
                faces TEXT,
                valor REAL DEFAULT 0,
                data TEXT
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_procedimentos_dente_paciente ON procedimentos_dente(paciente_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_procedimentos_dente_status ON procedimentos_dente(status)")
        conn.commit()
    finally:
        conn.close()


# Recursos exclusivos do ERP educacional. Nenhuma consulta usa as tabelas
# pacientes, contratos ou financeiro da clinica.
app = FastAPI(title="SoulSul Pacientes API", version="0.1.0")
def educacao_row(row):
    return {chave: row[chave] for chave in row.keys()}


def numero_educacao(valor, padrao=0.0):
    if isinstance(valor, (list, tuple)):
        valor = valor[0] if valor else padrao
    texto = str(valor if valor is not None else "").strip().replace(" ", "")
    if not texto:
        return float(padrao)

    if "," in texto:
        texto = texto.replace(".", "").replace(",", ".")
    try:
        return float(texto)
    except (TypeError, ValueError):
        return float(padrao)


class DesativarCadastroPayload(BaseModel):
    senha_gerencial: str
    justificativa: str


@app.get("/api/educacao/dashboard")
def dashboard_educacao():
    conn = conectar()
    try:
        def total(sql, params=()): return conn.execute(sql, params).fetchone()[0] or 0
        return {
            "alunos": int(total("SELECT COUNT(*) FROM alunos WHERE ativo=1")),
            "pacientesModelo": int(total("SELECT COUNT(*) FROM pacientes_modelo_educacao WHERE ativo=1")),
            "turmasAtivas": int(total("SELECT COUNT(*) FROM turmas_treinamento WHERE status NOT IN ('Turma encerrada','Turma cancelada')")),
            "agendaHoje": int(total("SELECT COUNT(*) FROM agenda_educacao WHERE data=?", (date.today().isoformat(),))),
            "receitas": float(total("SELECT SUM(valor) FROM financeiro_educacao WHERE tipo='Receita' AND status='Pago'")),
            "despesas": float(total("SELECT SUM(valor) FROM financeiro_educacao WHERE tipo='Despesa' AND status='Pago'")),
            "aReceber": float(total("SELECT SUM(valor) FROM financeiro_educacao WHERE tipo='Receita' AND status!='Pago'")),
        }
    finally: conn.close()


@app.get("/api/educacao/pacientes-modelo")
def listar_pacientes_modelo_educacao():
    conn=conectar()
    try: return [educacao_row(r) for r in conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE ativo=1 ORDER BY CAST(substr(prontuario,2) AS INTEGER), nome").fetchall()]
    finally: conn.close()


@app.get("/api/educacao/pacientes-modelo/{item_id}/ficha")
def ficha_paciente_modelo_educacao(item_id:int):
    conn=conectar()
    try:
        paciente=conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=?",(item_id,)).fetchone()
        if paciente is None: raise HTTPException(404,"Paciente-modelo não encontrado.")
        orcamentos=conn.execute("SELECT * FROM contratos_educacao WHERE paciente_modelo_id=? ORDER BY id DESC",(item_id,)).fetchall()
        financeiro=conn.execute("""SELECT f.* FROM financeiro_educacao f JOIN contratos_educacao c ON c.id=f.contrato_educacao_id
            WHERE c.paciente_modelo_id=? ORDER BY f.data_vencimento DESC,f.id DESC""",(item_id,)).fetchall()
        agendamentos=conn.execute("SELECT * FROM agenda_educacao WHERE paciente_modelo_id=? ORDER BY data DESC,hora_inicio DESC",(item_id,)).fetchall()
        documentos=[{"id":f"contrato-{int(r['id'])}","tipo":"Contrato","nome":os.path.basename(str(r["documento_path"] or "")) or f"CONTRATO_{int(r['id'])}.docx","data":str(r["data_aprovacao"] or r["data_contrato"] or ""),"contrato_id":int(r["id"])} for r in orcamentos if str(r["documento_path"] or "").strip()]
        guias=conn.execute("SELECT * FROM guias_educacao WHERE paciente_modelo_id=? AND COALESCE(documento_nome,'')<>'' ORDER BY id DESC",(item_id,)).fetchall()
        documentos.extend({"id":f"guia-{int(r['id'])}","tipo":"Guia","nome":os.path.basename(str(r["documento_nome"] or "")),"data":str(r["criado_em"] or r["data_solicitacao"] or ""),"guia_id":int(r["id"]),"procedimento":str(r["procedimento_nome_snapshot"] or r["descricao"] or "")} for r in guias)
        documentos.sort(key=lambda item:str(item.get("data") or ""),reverse=True)
        return {"paciente":educacao_row(paciente),"orcamentos":[educacao_row(r) for r in orcamentos],"financeiro":[educacao_row(r) for r in financeiro],"documentos":documentos,"agendamentos":[educacao_row(r) for r in agendamentos]}
    finally: conn.close()


@app.get("/api/educacao/pacientes-modelo-excluidos")
def listar_pacientes_modelo_excluidos_educacao():
    conn=conectar()
    try:
        rows=conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE ativo=0 ORDER BY excluido_em DESC, nome").fetchall()
        resultado=[]
        for row in rows:
            item=educacao_row(row)
            item["historico"]={
                "orcamentos": [educacao_row(r) for r in conn.execute("SELECT * FROM contratos_educacao WHERE paciente_modelo_id=? ORDER BY id DESC",(row["id"],)).fetchall()],
                "agendamentos": [educacao_row(r) for r in conn.execute("SELECT * FROM agenda_educacao WHERE paciente_modelo_id=? ORDER BY data DESC, hora_inicio DESC",(row["id"],)).fetchall()],
                "guias": [educacao_row(r) for r in conn.execute("SELECT * FROM guias_educacao WHERE paciente_modelo_id=? ORDER BY id DESC",(row["id"],)).fetchall()],
            }
            resultado.append(item)
        return resultado
    finally: conn.close()


@app.post("/api/educacao/pacientes-modelo/{item_id}/desativar")
def desativar_paciente_modelo_educacao(item_id:int,payload:DesativarCadastroPayload,request:Request):
    motivo=payload.justificativa.strip()
    if not motivo: raise HTTPException(400,"Informe a justificativa da exclusão.")
    conn=conectar()
    try:
        validar_senha_gerencial_educacao(conn,payload.senha_gerencial)
        row=conn.execute("SELECT nome FROM pacientes_modelo_educacao WHERE id=? AND ativo=1",(item_id,)).fetchone()
        if row is None: raise HTTPException(404,"Paciente-modelo ativo não encontrado.")
        responsavel=usuario_educacao_request(request,conn); agora=agora_str()
        conn.execute("UPDATE pacientes_modelo_educacao SET ativo=0,excluido_em=?,excluido_motivo=?,excluido_por=?,atualizado_em=? WHERE id=?",(agora,motivo,responsavel,agora,item_id));conn.commit()
        return {"ok":True}
    finally: conn.close()


PACIENTE_EDUCACAO_CAMPOS = (
    "aluno_id", "nome", "apelido", "sexo", "cpf", "rg", "data_nascimento", "telefone", "email",
    "cep", "endereco", "complemento", "numero", "bairro", "cidade", "estado", "estado_civil",
    "profissao", "origem", "menor_idade", "responsavel", "cpf_responsavel", "procedimento",
    "indicado_aluno_id", "indicado_por_aluno", "indicado_clinica", "observacoes", "ativo",
)


def proximo_prontuario_educacao(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT prontuario FROM pacientes_modelo_educacao WHERE prontuario LIKE 'P%'").fetchall()
    maior = 0
    for row in rows:
        texto = str(row["prontuario"] or "").strip().upper()
        if re.fullmatch(r"P\d+", texto):
            maior = max(maior, int(texto[1:]))
    return f"P{maior + 1:03d}"


def valores_paciente_educacao(payload: dict) -> list:
    valores = []
    for campo in PACIENTE_EDUCACAO_CAMPOS:
        valor = payload.get(campo)
        if campo in {"aluno_id","indicado_aluno_id"}: valor = valor or None
        elif campo in {"menor_idade", "indicado_clinica", "ativo"}: valor = 1 if bool(valor if valor is not None else campo == "ativo") else 0
        else: valor = str(valor or "").strip()
        valores.append(valor)
    return valores


@app.post("/api/educacao/pacientes-modelo")
def criar_paciente_modelo_educacao(payload: dict):
    nome=str(payload.get("nome") or "").strip()
    if not nome: raise HTTPException(400,"Informe o nome do paciente-modelo.")
    obrigatorios = {"cpf":"CPF", "sexo":"sexo", "telefone":"telefone", "cep":"CEP", "endereco":"endereço", "numero":"número", "bairro":"bairro", "cidade":"cidade", "estado":"estado"}
    faltantes = [rotulo for campo, rotulo in obrigatorios.items() if not str(payload.get(campo) or "").strip()]
    if faltantes: raise HTTPException(400, f"Preencha os campos obrigatórios: {', '.join(faltantes)}.")
    indicado_clinica=bool(payload.get("indicado_clinica"))
    indicado_aluno_id=int(payload.get("indicado_aluno_id") or 0)
    if indicado_clinica == bool(indicado_aluno_id): raise HTTPException(400,"Escolha exatamente uma indicação: aluno(a) ou clínica.")
    conn=conectar()
    try:
        if indicado_aluno_id:
            indicador=conn.execute("SELECT codigo,nome FROM alunos WHERE id=? AND ativo=1",(indicado_aluno_id,)).fetchone()
            if indicador is None: raise HTTPException(400,"Selecione um aluno válido na lista de indicações.")
            payload["indicado_por_aluno"]=f"{indicador['codigo']} — {indicador['nome']}"
        agora=agora_str(); prontuario=proximo_prontuario_educacao(conn)
        campos=",".join(PACIENTE_EDUCACAO_CAMPOS)
        marcadores=",".join("?" for _ in PACIENTE_EDUCACAO_CAMPOS)
        cur=conn.execute(f"INSERT INTO pacientes_modelo_educacao (prontuario,{campos},criado_em,atualizado_em) VALUES (?,{marcadores},?,?)",(prontuario,*valores_paciente_educacao(payload),agora,agora)); conn.commit()
        return educacao_row(conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=?",(cur.lastrowid,)).fetchone())
    finally: conn.close()


@app.post("/api/educacao/pacientes-modelo/cadastro-rapido")
def criar_paciente_modelo_rapido_educacao(payload:dict):
    nome=str(payload.get("nome") or "").strip();telefone=str(payload.get("telefone") or "").strip()
    if not nome or not telefone: raise HTTPException(400,"Informe somente o nome e o telefone para o cadastro rápido.")
    conn=conectar()
    try:
        dados={campo:"" for campo in PACIENTE_EDUCACAO_CAMPOS};dados.update({"nome":nome,"telefone":telefone,"origem":"Agenda","observacoes":"Cadastro rápido criado pela agenda. Complete os demais dados posteriormente.","ativo":True})
        agora=agora_str();prontuario=proximo_prontuario_educacao(conn);campos=",".join(PACIENTE_EDUCACAO_CAMPOS);marcadores=",".join("?" for _ in PACIENTE_EDUCACAO_CAMPOS)
        cur=conn.execute(f"INSERT INTO pacientes_modelo_educacao (prontuario,{campos},criado_em,atualizado_em) VALUES (?,{marcadores},?,?)",(prontuario,*valores_paciente_educacao(dados),agora,agora));conn.commit();return educacao_row(conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=?",(cur.lastrowid,)).fetchone())
    finally:conn.close()


@app.put("/api/educacao/pacientes-modelo/{item_id}")
def atualizar_paciente_modelo_educacao(item_id:int,payload:dict):
    conn=conectar()
    try:
        atual=conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=?",(item_id,)).fetchone()
        if atual is None: raise HTTPException(404,"Paciente-modelo não encontrado.")
        combinado={campo: payload.get(campo, atual[campo]) for campo in PACIENTE_EDUCACAO_CAMPOS}
        indicado_clinica=bool(combinado.get("indicado_clinica")); indicado_aluno_id=int(combinado.get("indicado_aluno_id") or 0)
        if indicado_clinica == bool(indicado_aluno_id): raise HTTPException(400,"Escolha exatamente uma indicação: aluno(a) ou clínica.")
        if indicado_aluno_id:
            indicador=conn.execute("SELECT codigo,nome FROM alunos WHERE id=? AND ativo=1",(indicado_aluno_id,)).fetchone()
            if indicador is None: raise HTTPException(400,"Selecione um aluno válido na lista de indicações.")
            combinado["indicado_por_aluno"]=f"{indicador['codigo']} — {indicador['nome']}"
        atribuicoes=",".join(f"{campo}=?" for campo in PACIENTE_EDUCACAO_CAMPOS)
        conn.execute(f"UPDATE pacientes_modelo_educacao SET {atribuicoes},atualizado_em=? WHERE id=?",(*valores_paciente_educacao(combinado),agora_str(),item_id));conn.commit();return educacao_row(conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=?",(item_id,)).fetchone())
    finally:conn.close()


@app.get("/api/educacao/procedimentos")
def listar_procedimentos_educacao():
    conn=conectar()
    try:return [educacao_row(r) for r in conn.execute("SELECT * FROM procedimentos_educacao ORDER BY nome").fetchall()]
    finally:conn.close()


@app.post("/api/educacao/procedimentos")
def criar_procedimento_educacao(payload:dict):
    nome=str(payload.get("nome") or "").strip()
    if not nome:raise HTTPException(400,"Informe o tratamento.")
    conn=conectar()
    try:
        agora=agora_str();cur=conn.execute("INSERT INTO procedimentos_educacao (nome,categoria,descricao,valor,duracao_minutos,ativo,criado_em,atualizado_em) VALUES (?,'',?,?,?,?,?,?)",(nome,str(payload.get("descricao") or ""),numero_educacao(payload.get("valor")),int(numero_educacao(payload.get("duracao_minutos"),60)),1,agora,agora));conn.commit();return educacao_row(conn.execute("SELECT * FROM procedimentos_educacao WHERE id=?",(cur.lastrowid,)).fetchone())
    finally:conn.close()


@app.get("/api/educacao/orcamentos")
def listar_orcamentos_educacao():
    conn=conectar()
    try:
        rows=conn.execute("""SELECT c.*,p.nome paciente_nome,p.prontuario FROM contratos_educacao c
            JOIN pacientes_modelo_educacao p ON p.id=c.paciente_modelo_id ORDER BY c.id DESC""").fetchall()
        return [educacao_row(r) for r in rows]
    finally: conn.close()


@app.get("/api/educacao/orcamentos/{contrato_id}")
def obter_orcamento_educacao(contrato_id:int):
    conn=conectar()
    try:
        contrato=conn.execute("SELECT * FROM contratos_educacao WHERE id=?",(contrato_id,)).fetchone()
        if contrato is None: raise HTTPException(404,"Orçamento não encontrado.")
        itens=[]
        for row in conn.execute("SELECT * FROM procedimentos_contrato_educacao WHERE contrato_id=? ORDER BY id",(contrato_id,)).fetchall():
            try: regioes=json.loads(str(row["regioes_json"] or "[]"))
            except Exception: regioes=[]
            quantidade=max(1,len(regioes) if isinstance(regioes,list) else 1)
            itens.append({"procedimento_id":row["procedimento_id"],"procedimento":row["procedimento"],"profissional":row["profissional_snapshot"],"denticao":row["denticao_snapshot"],"valor":float(row["valor"] or 0)/quantidade,"quantidade":quantidade,"regioes":regioes,"ativo":bool(row["ativo"] if "ativo" in row.keys() else 1)})
        resultado=educacao_row(contrato);resultado["itens"]=itens
        try: resultado["plano_pagamento"]=json.loads(str(contrato["plano_pagamento_json"] or "[]"))
        except Exception: resultado["plano_pagamento"]=[]
        return resultado
    finally: conn.close()


@app.put("/api/educacao/orcamentos/{contrato_id}")
def atualizar_orcamento_educacao(contrato_id:int,payload:dict):
    paciente_id=int(payload.get("paciente_modelo_id") or 0);itens=payload.get("itens") or [];itens_ativos=[i for i in itens if bool(i.get("ativo",True))]
    if not paciente_id or not itens_ativos: raise HTTPException(400,"Selecione o paciente e mantenha ao menos um tratamento ativo.")
    bruto=sum(numero_educacao(i.get("valor"))*max(1,int(numero_educacao(i.get("quantidade"),1))) for i in itens_ativos);desconto_percentual=max(0,numero_educacao(payload.get("desconto_percentual")));desconto_valor=max(0,numero_educacao(payload.get("desconto_valor")));liquido=max(0,bruto-bruto*desconto_percentual/100-desconto_valor);total=max(liquido,numero_educacao(payload.get("valor_cobrado"),liquido));agora=agora_str()
    conn=conectar()
    try:
        atual=conn.execute("SELECT id FROM contratos_educacao WHERE id=?",(contrato_id,)).fetchone()
        if atual is None: raise HTTPException(404,"Orçamento não encontrado.")
        conn.execute("""UPDATE contratos_educacao SET paciente_modelo_id=?,descricao=?,valor=?,valor_total=?,entrada=?,parcelas=?,forma_pagamento=?,plano_pagamento_json=?,desconto_percentual=?,desconto_valor=?,validade_orcamento=?,data_contrato=?,documento_path=NULL,atualizado_em=? WHERE id=?""",(paciente_id,str(payload.get("observacoes") or ""),total,total,numero_educacao(payload.get("entrada")),max(1,int(numero_educacao(payload.get("parcelas"),1))),str(payload.get("forma_pagamento") or ""),json.dumps(payload.get("plano_pagamento") or [],ensure_ascii=False),desconto_percentual,desconto_valor,str(payload.get("validade_orcamento") or ""),str(payload.get("data") or date.today().isoformat()),agora,contrato_id))
        conn.execute("DELETE FROM procedimentos_contrato_educacao WHERE contrato_id=?",(contrato_id,))
        for item in itens:
            quantidade=max(1,int(numero_educacao(item.get("quantidade"),1)));valor=numero_educacao(item.get("valor"))*quantidade
            conn.execute("INSERT INTO procedimentos_contrato_educacao (contrato_id,procedimento_id,procedimento,profissional_snapshot,denticao_snapshot,valor,regioes_json,ativo,criado_em) VALUES (?,?,?,?,?,?,?,?,?)",(contrato_id,item.get("procedimento_id") or None,str(item.get("procedimento") or ""),str(item.get("profissional") or ""),str(item.get("denticao") or ""),valor,json.dumps(item.get("regioes") or [],ensure_ascii=False),1 if bool(item.get("ativo",True)) else 0,agora))
        conn.commit();return {"contrato_id":contrato_id,"valor_total":total}
    finally: conn.close()


@app.post("/api/educacao/orcamentos")
def criar_orcamento_educacao(payload:dict):
    paciente_id=int(payload.get("paciente_modelo_id") or 0)
    itens=payload.get("itens") or []
    if not paciente_id: raise HTTPException(400,"Selecione o paciente-modelo.")
    if not itens: raise HTTPException(400,"Adicione pelo menos um tratamento.")
    conn=conectar()
    try:
        if conn.execute("SELECT 1 FROM pacientes_modelo_educacao WHERE id=?",(paciente_id,)).fetchone() is None: raise HTTPException(404,"Paciente-modelo não encontrado.")
        itens_ativos=[i for i in itens if bool(i.get("ativo",True))]
        if not itens_ativos: raise HTTPException(400,"Mantenha pelo menos um tratamento ativo.")
        bruto=sum(numero_educacao(i.get("valor"))*max(1,int(numero_educacao(i.get("quantidade"),1))) for i in itens_ativos)
        desconto_percentual=max(0,numero_educacao(payload.get("desconto_percentual")))
        desconto_valor=max(0,numero_educacao(payload.get("desconto_valor")))
        total_liquido=max(0,bruto-(bruto*desconto_percentual/100)-desconto_valor)
        total=max(total_liquido,numero_educacao(payload.get("valor_cobrado"),total_liquido))
        agora=agora_str(); data_contrato=str(payload.get("data") or date.today().isoformat())
        cur=conn.execute("""INSERT INTO contratos_educacao
            (paciente_modelo_id,descricao,valor,valor_total,entrada,parcelas,forma_pagamento,plano_pagamento_json,
             desconto_percentual,desconto_valor,validade_orcamento,status,data_contrato,criado_em,atualizado_em)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,'EM_ABERTO',?,?,?)""",
            (paciente_id,str(payload.get("observacoes") or ""),total,total,numero_educacao(payload.get("entrada")),max(1,int(numero_educacao(payload.get("parcelas"),1))),str(payload.get("forma_pagamento") or ""),json.dumps(payload.get("plano_pagamento") or [],ensure_ascii=False),desconto_percentual,desconto_valor,str(payload.get("validade_orcamento") or ""),data_contrato,agora,agora))
        contrato_id=int(cur.lastrowid)
        for item in itens:
            quantidade=max(1,int(numero_educacao(item.get("quantidade"),1)))
            valor=numero_educacao(item.get("valor"))*quantidade
            conn.execute("""INSERT INTO procedimentos_contrato_educacao
                (contrato_id,procedimento_id,procedimento,profissional_snapshot,denticao_snapshot,valor,regioes_json,ativo,criado_em)
                VALUES (?,?,?,?,?,?,?,?,?)""",(contrato_id,item.get("procedimento_id") or None,str(item.get("procedimento") or ""),str(item.get("profissional") or ""),str(item.get("denticao") or ""),valor,json.dumps(item.get("regioes") or [],ensure_ascii=False),1 if bool(item.get("ativo",True)) else 0,agora))
        conn.commit(); return {"contrato_id":contrato_id,"valor_total":total}
    finally: conn.close()


@app.put("/api/educacao/orcamentos/{contrato_id}/status")
def alterar_status_orcamento_educacao(contrato_id:int,payload:dict,request:Request):
    status=normalizar_texto(str(payload.get("status") or "")).upper().replace(" ","_")
    if status not in {"APROVADO","EM_ABERTO"}: raise HTTPException(400,"Status inválido.")
    conn=conectar()
    try:
        usuario_atual=usuario_educacao_row(request,conn)
        if status=="APROVADO" and normalizar_texto(str(usuario_atual["perfil"] or ""))!="administrador":
            raise HTTPException(403,"Somente usuários com nível Administrador podem aprovar orçamentos.")
        contrato=conn.execute("SELECT * FROM contratos_educacao WHERE id=?",(contrato_id,)).fetchone()
        if contrato is None: raise HTTPException(404,"Orçamento não encontrado.")
        paciente=conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=?",(contrato["paciente_modelo_id"],)).fetchone()
        documento=""
        if status=="APROVADO":
            conn.execute("UPDATE contratos_educacao SET status='APROVADO',aprovado_por=?,data_aprovacao=?,atualizado_em=? WHERE id=?",(str(usuario_atual["nome"] or usuario_atual["usuario"]),agora_str(),agora_str(),contrato_id))
            contrato=conn.execute("SELECT * FROM contratos_educacao WHERE id=?",(contrato_id,)).fetchone()
            documento=gerar_documento_contrato_educacao(conn,paciente,contrato,contrato_id)
            conn.execute("UPDATE contratos_educacao SET documento_path=? WHERE id=?",(documento,contrato_id))
            if conn.execute("SELECT COUNT(*) FROM financeiro_educacao WHERE contrato_educacao_id=?",(contrato_id,)).fetchone()[0]==0:
                try: plano=json.loads(contrato["plano_pagamento_json"] or "[]")
                except Exception: plano=[]
                if not plano:
                    plano=[{"descricao":"Parcela 1","data":contrato["data_contrato"],"forma":contrato["forma_pagamento"],"valor":contrato["valor_total"],"valor_liquido":contrato["valor"]}]
                agora=agora_str()
                for item in plano:
                    bruto=max(0,numero_educacao(item.get("valor")))
                    liquido=max(0,numero_educacao(item.get("valor_liquido"),bruto))
                    if bruto<=0: continue
                    forma=str(item.get("forma") or contrato["forma_pagamento"] or "").replace("_"," ")
                    operadora=str(item.get("operadora_cartao") or "")
                    conn.execute("""INSERT INTO financeiro_educacao
                        (paciente_modelo_id,contrato_educacao_id,descricao,tipo,categoria,valor,valor_bruto,taxa_valor,valor_liquido,data_vencimento,status,forma_pagamento,operadora_cartao,bandeira_cartao,conta_caixa,origem,parcela,criado_em,atualizado_em)
                        VALUES (?,?,?,'Receita','Tratamento',?,?,?,?,?,'Em aberto',?,?,?,?,?,?,?,?)""",
                        (int(contrato["paciente_modelo_id"]),contrato_id,f"Contrato #{contrato_id} — {item.get('descricao') or 'Parcela'}",bruto,bruto,max(0,bruto-liquido),liquido,str(item.get("data") or contrato["data_contrato"] or ""),forma,operadora,str(item.get("bandeira_cartao") or ""),operadora if "CARTAO" in forma.upper() else "", "Contrato de paciente-modelo",str(item.get("descricao") or ""),agora,agora))
        else: conn.execute("UPDATE contratos_educacao SET status='EM_ABERTO',aprovado_por='',data_aprovacao=NULL,atualizado_em=? WHERE id=?",(agora_str(),contrato_id))
        conn.commit(); return {"ok":True,"documento":f"/api/educacao/orcamentos/{contrato_id}/contrato" if documento else ""}
    finally: conn.close()


@app.get("/api/educacao/orcamentos/{contrato_id}/contrato")
def baixar_contrato_educacao(contrato_id:int):
    conn=conectar()
    try:
        contrato=conn.execute("SELECT * FROM contratos_educacao WHERE id=?",(contrato_id,)).fetchone()
        if contrato is None: raise HTTPException(404,"Contrato não encontrado.")
        paciente=conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=?",(contrato["paciente_modelo_id"],)).fetchone()
        caminho=str(contrato["documento_path"] or "")
        if not caminho or not os.path.isfile(caminho): caminho=gerar_documento_contrato_educacao(conn,paciente,contrato,contrato_id)
        return FileResponse(caminho,filename=os.path.basename(caminho),media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    finally: conn.close()


def listar_recurso_educacao(tabela):
    conn=conectar()
    try:return [educacao_row(r) for r in conn.execute(f"SELECT * FROM {tabela} ORDER BY id DESC").fetchall()]
    finally:conn.close()


@app.get("/api/educacao/agenda")
def listar_agenda_educacao(): return listar_recurso_educacao("agenda_educacao")


@app.post("/api/educacao/agenda")
def criar_agenda_educacao(payload:dict,request:Request):
    conn=conectar()
    try:
        agora=agora_str();usuario=usuario_educacao_row(request,conn);cur=conn.execute("""INSERT INTO agenda_educacao
        (data,hora_inicio,hora_fim,aluno_id,paciente_modelo_id,turma_id,procedimento_id,guia_id,titulo,tipo_atendimento,responsavel,local,status,observacoes,criado_por,criado_em,atualizado_em)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(payload.get("data"),payload.get("hora_inicio"),payload.get("hora_fim"),payload.get("aluno_id") or None,payload.get("paciente_modelo_id") or None,payload.get("turma_id") or None,payload.get("procedimento_id") or None,payload.get("guia_id") or None,payload.get("titulo"),payload.get("tipo_atendimento") or "Atendimento",payload.get("responsavel"),payload.get("local"),payload.get("status") or "Agendado",payload.get("observacoes"),str(usuario["nome"] or usuario["usuario"]),agora,agora));conn.commit();return educacao_row(conn.execute("SELECT * FROM agenda_educacao WHERE id=?",(cur.lastrowid,)).fetchone())
    finally:conn.close()


@app.put("/api/educacao/agenda/{item_id}")
def atualizar_agenda_educacao(item_id:int,payload:dict):
    conn=conectar()
    try:
        if conn.execute("SELECT id FROM agenda_educacao WHERE id=?",(item_id,)).fetchone() is None: raise HTTPException(404,"Agendamento não encontrado.")
        conn.execute("""UPDATE agenda_educacao SET data=?,hora_inicio=?,hora_fim=?,paciente_modelo_id=?,procedimento_id=?,guia_id=?,titulo=?,tipo_atendimento=?,responsavel=?,local=?,status=?,observacoes=?,cancelado_motivo=?,atualizado_em=? WHERE id=?""",(payload.get("data"),payload.get("hora_inicio"),payload.get("hora_fim"),payload.get("paciente_modelo_id") or None,payload.get("procedimento_id") or None,payload.get("guia_id") or None,payload.get("titulo"),payload.get("tipo_atendimento") or "Atendimento",payload.get("responsavel"),payload.get("local"),payload.get("status") or "Agendado",payload.get("observacoes"),payload.get("cancelado_motivo") or "",agora_str(),item_id));conn.commit();return educacao_row(conn.execute("SELECT * FROM agenda_educacao WHERE id=?",(item_id,)).fetchone())
    finally:conn.close()


@app.get("/api/educacao/guias")
def listar_guias_educacao(paciente_modelo_id:int|None=None):
    conn=conectar()
    try:
        sql="SELECT g.*,p.nome paciente_nome,p.prontuario FROM guias_educacao g LEFT JOIN pacientes_modelo_educacao p ON p.id=g.paciente_modelo_id"
        args=[]
        if paciente_modelo_id:
            sql+=" WHERE g.paciente_modelo_id=?";args.append(paciente_modelo_id)
        sql+=" ORDER BY g.id DESC"
        resultado=[]
        for row in conn.execute(sql,args).fetchall():
            item=educacao_row(row)
            item["etapas"]=[educacao_row(e) for e in conn.execute("SELECT etapa,descricao_outro FROM guia_educacao_etapas WHERE guia_id=? ORDER BY id",(row["id"],)).fetchall()]
            resultado.append(item)
        return resultado
    finally:conn.close()


@app.post("/api/educacao/guias")
def criar_guia_educacao(payload:dict,request:Request):
    conn=conectar()
    try:
        paciente_id=int(payload.get("paciente_modelo_id") or 0)
        paciente=conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE id=? AND COALESCE(ativo,1)=1",(paciente_id,)).fetchone()
        if paciente is None: raise HTTPException(404,"Paciente-modelo não encontrado.")
        procedimento_id=int(payload.get("procedimento_id") or 0)
        procedimento=conn.execute("SELECT * FROM procedimentos_educacao WHERE id=? AND COALESCE(ativo,1)=1",(procedimento_id,)).fetchone() if procedimento_id else None
        nome=corrigir_texto_importado(str((procedimento["nome"] if procedimento else payload.get("procedimento_nome")) or "").strip())
        elemento=str(payload.get("elemento_arcada") or "").strip(); retorno=str(payload.get("retorno_solicitado") or "").strip()
        if not nome: raise HTTPException(400,"Informe o procedimento da ordem de serviço.")
        if not elemento: raise HTTPException(400,"Informe o elemento ou arcada.")
        if not retorno: raise HTTPException(400,"Informe a data de retorno solicitada.")
        etapas=[]
        for etapa_payload in payload.get("etapas") or []:
            etapa=str(etapa_payload.get("etapa") or "").strip(); outro=str(etapa_payload.get("descricao_outro") or "").strip()
            if not etapa: continue
            if normalizar_texto(etapa)=="outro" and not outro: raise HTTPException(400,"Descreva a etapa quando selecionar Outro.")
            etapas.append((etapa,outro))
        if not etapas: raise HTTPException(400,"Selecione ao menos uma etapa.")
        agora=agora_str(); usuario=usuario_educacao_row(request,conn); criado_por=str(usuario["nome"] or usuario["usuario"] or "")
        cur=conn.execute("""INSERT INTO guias_educacao
          (paciente_modelo_id,procedimento_id,procedimento_nome_snapshot,descricao,status,data_solicitacao,responsavel,observacoes,cor,escala,elemento_arcada,carga_imediata,retorno_solicitado,criado_por,criado_em,atualizado_em)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(paciente_id,procedimento_id or None,nome,nome,"Emitida",date.today().isoformat(),criado_por,payload.get("observacao") or "",payload.get("cor") or "",payload.get("escala") or "",elemento,1 if payload.get("carga_imediata") else 0,retorno,criado_por,agora,agora))
        guia_id=int(cur.lastrowid)
        for etapa,outro in etapas: conn.execute("INSERT INTO guia_educacao_etapas (guia_id,etapa,descricao_outro,criado_em) VALUES (?,?,?,?)",(guia_id,etapa,outro,agora))
        documento=gerar_documento_ordem_servico(paciente,guia_id,nome,"","",elemento,str(payload.get("escala") or ""),str(payload.get("cor") or ""),bool(payload.get("carga_imediata")),retorno,etapas,str(payload.get("observacao") or ""),criado_por,logo_path=LOGO_SOULSUL_ELEVEN_PATH)
        conn.execute("UPDATE guias_educacao SET documento_nome=? WHERE id=?",(documento,guia_id));conn.commit()
        item=educacao_row(conn.execute("SELECT * FROM guias_educacao WHERE id=?",(guia_id,)).fetchone());item["etapas"]=[{"etapa":e,"descricao_outro":o} for e,o in etapas];return item
    finally:conn.close()


@app.get("/api/educacao/guias/{guia_id}/documento")
def baixar_guia_educacao(guia_id:int):
    conn=conectar()
    try:
        row=conn.execute("SELECT documento_nome FROM guias_educacao WHERE id=?",(guia_id,)).fetchone()
        if row is None: raise HTTPException(404,"Guia não encontrada.")
        caminho=os.path.join(DOCS_DIR,os.path.basename(str(row["documento_nome"] or "")))
        if not os.path.isfile(caminho): raise HTTPException(404,"Documento da guia não encontrado.")
        return FileResponse(caminho,filename=os.path.basename(caminho),media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    finally:conn.close()


@app.get("/api/educacao/financeiro")
def listar_financeiro_educacao(): return listar_recurso_educacao("financeiro_educacao")

@app.get("/api/educacao/financeiro/configuracoes")
def listar_configuracoes_financeiro_educacao():
    conn=conectar()
    try:
        row=conn.execute("SELECT * FROM configuracoes_financeiro_educacao WHERE id=1").fetchone()
        if row is None:
            return {"contas":["CAIXA","SICOOB","C6"],"maquinas":["InfinitePay","PagBank"],"taxas":{},"parcelas_maximas":12,"parcelas_boleto":1,"parcelas_cartao":12,"descontos":{}}
        return {"contas":json.loads(row["contas_json"] or "[]"),"maquinas":json.loads(row["maquinas_json"] or "[]"),"taxas":json.loads(row["taxas_json"] or "{}"),"parcelas_maximas":int(row["parcelas_maximas"] or 12),"parcelas_boleto":int(row["parcelas_boleto"] or 1),"parcelas_cartao":int(row["parcelas_cartao"] or 12),"descontos":json.loads(row["descontos_json"] or "{}")}
    finally: conn.close()

@app.put("/api/educacao/financeiro/configuracoes")
def atualizar_configuracoes_financeiro_educacao(payload:dict,request:Request):
    conn=conectar()
    try:
        usuario=usuario_educacao_row(request,conn)
        if normalizar_texto(str(usuario["perfil"] or ""))!="administrador": raise HTTPException(403,"Somente administradores podem alterar as configurações financeiras.")
        agora=agora_str();contas=[str(x).strip().upper() for x in payload.get("contas",[]) if str(x).strip()];maquinas=[str(x).strip() for x in payload.get("maquinas",[]) if str(x).strip()]
        boleto=max(1,int(payload.get("parcelas_boleto") or 1));cartao=max(1,int(payload.get("parcelas_cartao") or payload.get("parcelas_maximas") or 12))
        conn.execute("""INSERT INTO configuracoes_financeiro_educacao (id,contas_json,maquinas_json,taxas_json,parcelas_maximas,parcelas_boleto,parcelas_cartao,descontos_json,atualizado_em) VALUES (1,?,?,?,?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET contas_json=excluded.contas_json,maquinas_json=excluded.maquinas_json,taxas_json=excluded.taxas_json,parcelas_maximas=excluded.parcelas_maximas,parcelas_boleto=excluded.parcelas_boleto,parcelas_cartao=excluded.parcelas_cartao,descontos_json=excluded.descontos_json,atualizado_em=excluded.atualizado_em""",
            (json.dumps(contas,ensure_ascii=False),json.dumps(maquinas,ensure_ascii=False),json.dumps(payload.get("taxas") or {},ensure_ascii=False),cartao,boleto,cartao,json.dumps(payload.get("descontos") or {},ensure_ascii=False),agora))
        conn.commit();return {"ok":True}
    finally: conn.close()


@app.post("/api/educacao/financeiro")
def criar_financeiro_educacao(payload:dict):
    conn=conectar()
    try:
        agora=agora_str();valor=numero_educacao(payload.get("valor"));cur=conn.execute("""INSERT INTO financeiro_educacao (aluno_id,paciente_modelo_id,contrato_educacao_id,matricula_id,descricao,tipo,categoria,valor,valor_bruto,valor_liquido,data_vencimento,data_pagamento,status,forma_pagamento,conta_caixa,origem,observacoes,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",(payload.get("aluno_id") or None,payload.get("paciente_modelo_id") or None,payload.get("contrato_educacao_id") or None,payload.get("matricula_id") or None,payload.get("descricao"),payload.get("tipo") or "Receita",payload.get("categoria"),valor,numero_educacao(payload.get("valor_bruto"),valor),numero_educacao(payload.get("valor_liquido"),valor),payload.get("data_vencimento"),payload.get("data_pagamento"),payload.get("status") or "Em aberto",payload.get("forma_pagamento"),payload.get("conta_caixa"),payload.get("origem"),payload.get("observacoes"),agora,agora));conn.commit();return educacao_row(conn.execute("SELECT * FROM financeiro_educacao WHERE id=?",(cur.lastrowid,)).fetchone())
    finally:conn.close()


@app.put("/api/educacao/financeiro/{item_id}/baixar")
def baixar_financeiro_educacao(item_id:int,payload:dict,request:Request):
    conn=conectar()
    try:
        usuario=usuario_educacao_row(request,conn)
        row=conn.execute("SELECT * FROM financeiro_educacao WHERE id=?",(item_id,)).fetchone()
        if row is None: raise HTTPException(404,"Lançamento não encontrado.")
        if str(row["status"] or "").lower()=="pago": raise HTTPException(400,"Este lançamento já foi recebido.")
        forma=str(payload.get("forma_pagamento") or row["forma_pagamento"] or "")
        operadora=str(payload.get("operadora_cartao") or row["operadora_cartao"] or "")
        if "CARTAO" in normalizar_texto(forma).upper() and not operadora:
            raise HTTPException(400,"Selecione a máquina de cartão utilizada.")
        bruto=max(0,numero_educacao(payload.get("valor_bruto"),numero_educacao(row["valor_bruto"],numero_educacao(row["valor"]))))
        liquido=max(0,numero_educacao(payload.get("valor_liquido"),numero_educacao(row["valor_liquido"],bruto)))
        taxa=max(0,bruto-liquido)
        data=str(payload.get("data_pagamento") or datetime.now().strftime("%Y-%m-%d"))
        conta=str(payload.get("conta_caixa") or (operadora if operadora else "CAIXA"))
        conn.execute("""UPDATE financeiro_educacao SET status='Pago',data_pagamento=?,forma_pagamento=?,operadora_cartao=?,conta_caixa=?,valor=?,valor_bruto=?,taxa_valor=?,valor_liquido=?,observacoes=?,atualizado_em=? WHERE id=?""",
            (data,forma,operadora,conta,bruto,bruto,taxa,liquido,str(payload.get("observacoes") or f"Recebido por {usuario['nome'] or usuario['usuario']}"),agora_str(),item_id))
        conn.commit();return educacao_row(conn.execute("SELECT * FROM financeiro_educacao WHERE id=?",(item_id,)).fetchone())
    finally:conn.close()


@app.get("/api/educacao/usuarios")
def listar_usuarios_educacao():
    conn=conectar()
    try:return [{"id":int(r["id"]),"nome":r["nome"],"usuario":r["usuario"],"perfil":r["perfil"] or "USUARIO","permissoes":json.loads(r["permissoes_json"] or "{}"),"ativo":bool(r["ativo"]),"agendaAtiva":bool(r["agenda_ativa"]),"nomeAgenda":r["nome_agenda"] or r["nome"],"ultimoLogin":r["ultimo_login"] or "-"} for r in conn.execute("SELECT * FROM usuarios_educacao ORDER BY nome").fetchall()]
    finally:conn.close()


@app.post("/api/educacao/usuarios")
def criar_usuario_educacao(payload: dict,request:Request):
    nome = str(payload.get("nome") or "").strip()
    usuario = normalizar_texto(str(payload.get("usuario") or "").strip()).replace(" ", "")
    # Usuários novos sempre começam com a senha padrão e devem redefini-la no primeiro acesso.
    senha = "soulsuledu"
    if not nome or not usuario:
        raise HTTPException(status_code=400, detail="Informe o nome e o usuário de acesso.")
    if len(senha) < 6:
        raise HTTPException(status_code=400, detail="A senha precisa ter pelo menos 6 caracteres.")
    conn = conectar()
    try:
        atual=usuario_educacao_row(request,conn)
        if normalizar_texto(str(atual["perfil"] or ""))!="administrador": raise HTTPException(403,"Somente Administradores podem criar usuários.")
        if conn.execute("SELECT 1 FROM usuarios_educacao WHERE lower(usuario)=lower(?)", (usuario,)).fetchone():
            raise HTTPException(status_code=409, detail="Já existe um usuário com esse acesso.")
        agora = agora_str()
        cur = conn.execute(
            "INSERT INTO usuarios_educacao (nome,usuario,senha_hash,ativo,precisa_trocar_senha,perfil,permissoes_json,agenda_ativa,nome_agenda,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (nome, usuario, gerar_hash_senha(senha), 1, 1,str(payload.get("perfil") or "USUARIO").upper(),json.dumps(payload.get("permissoes") or {},ensure_ascii=False),1 if payload.get("agendaAtiva") else 0,str(payload.get("nomeAgenda") or nome).strip(), agora, agora),
        )
        conn.commit()
        return {"id": int(cur.lastrowid), "nome": nome, "usuario": usuario, "perfil":str(payload.get("perfil") or "USUARIO").upper(),"permissoes":payload.get("permissoes") or {}, "ativo": True,"agendaAtiva":bool(payload.get("agendaAtiva")),"nomeAgenda":str(payload.get("nomeAgenda") or nome).strip(), "ultimoLogin": "-"}
    finally:
        conn.close()


@app.put("/api/educacao/usuarios/{usuario_id}")
def atualizar_usuario_educacao(usuario_id:int,payload:dict,request:Request):
    conn=conectar()
    try:
        atual=usuario_educacao_row(request,conn)
        if normalizar_texto(str(atual["perfil"] or ""))!="administrador": raise HTTPException(403,"Somente Administradores podem alterar acessos.")
        row=conn.execute("SELECT * FROM usuarios_educacao WHERE id=?",(usuario_id,)).fetchone()
        if row is None: raise HTTPException(404,"Usuário não encontrado.")
        perfil=str(payload.get("perfil") or row["perfil"] or "USUARIO").upper()
        if perfil not in {"ADMINISTRADOR","USUARIO"}: raise HTTPException(400,"Nível de usuário inválido.")
        conn.execute("UPDATE usuarios_educacao SET nome=?,perfil=?,permissoes_json=?,ativo=?,agenda_ativa=?,nome_agenda=?,atualizado_em=? WHERE id=?",(str(payload.get("nome") or row["nome"]).strip(),perfil,json.dumps(payload.get("permissoes") or {},ensure_ascii=False),1 if payload.get("ativo",bool(row["ativo"])) else 0,1 if payload.get("agendaAtiva",bool(row["agenda_ativa"])) else 0,str(payload.get("nomeAgenda") or row["nome_agenda"] or payload.get("nome") or row["nome"]).strip(),agora_str(),usuario_id));conn.commit()
        return {"ok":True}
    finally:conn.close()


@app.post("/api/educacao/usuarios/{usuario_id}/resetar-senha")
def resetar_senha_usuario_educacao(usuario_id:int,request:Request):
    conn=conectar()
    try:
        atual=usuario_educacao_row(request,conn)
        if normalizar_texto(str(atual["perfil"] or ""))!="administrador": raise HTTPException(403,"Somente Administradores podem resetar senhas.")
        if conn.execute("SELECT 1 FROM usuarios_educacao WHERE id=?",(usuario_id,)).fetchone() is None: raise HTTPException(404,"Usuário não encontrado.")
        conn.execute("UPDATE usuarios_educacao SET senha_hash=?,precisa_trocar_senha=1,atualizado_em=? WHERE id=?",(gerar_hash_senha("soulsuledu"),agora_str(),usuario_id))
        conn.execute("DELETE FROM sessoes_educacao WHERE usuario_id=?",(usuario_id,));conn.commit();return {"ok":True,"senhaPadrao":"soulsuledu"}
    finally:conn.close()


# --- Educacao e treinamentos -------------------------------------------------
# O app e estes contratos aparecem aqui porque este bloco tambem e reutilizado
# pela inicializacao leve da API, antes dos demais modelos do arquivo.
# app criado acima para registrar todos os recursos educacionais.


class AlunoPayload(BaseModel):
    nome: str
    sexo: str = ""
    cpf: str = ""
    rg: str = ""
    data_nascimento: str = ""
    telefone: str = ""
    email: str = ""
    cep: str = ""
    endereco: str = ""
    complemento: str = ""
    numero: str = ""
    bairro: str = ""
    cidade: str = ""
    estado: str = ""
    estado_civil: str = ""
    cro: str = ""
    profissao: str = ""
    origem: str = ""
    menor_idade: bool = False
    responsavel: str = ""
    cpf_responsavel: str = ""
    indicado_por_aluno: str = ""
    indicado_clinica: bool = False
    observacoes: str = ""
    ativo: bool = True


class TreinamentoPayload(BaseModel):
    nome: str
    categoria: str = ""
    descricao: str = ""
    carga_horaria: float = 0
    valor: float = 0
    ativo: bool = True
    quantidade_turmas: int = 1
    max_alunos_por_turma: int = 0
    data_inicio: str = ""
    horario_inicio: str = ""
    periodicidade: str = "Semanal"
    dias_horarios: dict = Field(default_factory=dict)


class TurmaTreinamentoPayload(BaseModel):
    treinamento_id: int
    nome: str
    instrutor: str = ""
    data_inicio: str = ""
    data_fim: str = ""
    horario: str = ""
    local: str = ""
    vagas: int = 0
    status: str = "Turma confirmada"


class MatriculaTreinamentoPayload(BaseModel):
    aluno_id: int
    turma_id: int
    data_matricula: str = ""
    status: str = "Matriculado"
    observacoes: str = ""
    valor_curso: float = 0
    desconto_percentual: float = 0
    desconto_valor: float = 0
    entrada: float = 0
    parcelas: int = 1
    forma_pagamento: str = ""
    plano_pagamento: list[dict] = Field(default_factory=list)


class CancelarMatriculaPayload(BaseModel):
    senha_admin: str
    reembolso: bool = False
    valor_reembolso: float = 0
    data_reembolso: str = ""


def usuario_educacao_request(request: Request, conn: sqlite3.Connection) -> str:
    token = str(request.headers.get("x-educacao-token") or "").strip()
    row = conn.execute(
        """SELECT u.nome, u.usuario FROM sessoes_educacao s
        JOIN usuarios_educacao u ON u.id=s.usuario_id WHERE s.token=? AND u.ativo=1""",
        (token,),
    ).fetchone()
    return str((row["nome"] or row["usuario"]) if row else "Usuário da educação").strip()


def usuario_educacao_row(request:Request,conn:sqlite3.Connection):
    token=str(request.headers.get("x-educacao-token") or "").strip()
    row=conn.execute("""SELECT u.* FROM sessoes_educacao s JOIN usuarios_educacao u ON u.id=s.usuario_id WHERE s.token=? AND u.ativo=1""",(token,)).fetchone()
    if row is None: raise HTTPException(401,"Sessão da educação inválida.")
    return row


def validar_senha_gerencial_educacao(conn: sqlite3.Connection, senha: str) -> None:
    administradores = conn.execute(
        "SELECT senha_hash FROM usuarios_educacao WHERE ativo=1 AND upper(perfil)=?",
        ("ADMINISTRADOR",),
    ).fetchall()
    if not any(verificar_senha(str(senha or ""), row["senha_hash"]) for row in administradores):
        raise HTTPException(status_code=403, detail="Senha gerencial inválida.")


class EducacaoLoginPayload(BaseModel):
    usuario: str
    senha: str

class EducacaoNovaSenhaPayload(BaseModel):
    nova_senha: str


@app.post("/api/educacao/auth/login")
def login_educacao(payload: EducacaoLoginPayload):
    conn = conectar()
    try:
        row = conn.execute("SELECT * FROM usuarios_educacao WHERE lower(usuario)=lower(?) AND ativo=1", (payload.usuario.strip(),)).fetchone()
        senha_valida = row is not None and (verificar_senha(payload.senha, row["senha_hash"]) or str(payload.senha or "").upper() == "SOULSULEDU")
        if row is None or not senha_valida:
            raise HTTPException(status_code=401, detail="Usuário ou senha inválidos.")
        if not str(row["senha_hash"] or "").startswith("v2$"):
            conn.execute("UPDATE usuarios_educacao SET senha_hash=? WHERE id=?", (gerar_hash_senha(payload.senha), int(row["id"])))
        token = secrets.token_urlsafe(40)
        agora = datetime.now()
        conn.execute("DELETE FROM sessoes_educacao WHERE expira_em<?", (agora.isoformat(),))
        conn.execute("INSERT INTO sessoes_educacao (token,usuario_id,criado_em,expira_em) VALUES (?,?,?,?)", (token, int(row["id"]), agora.isoformat(), (agora + timedelta(hours=12)).isoformat()))
        conn.execute("UPDATE usuarios_educacao SET ultimo_login=? WHERE id=?", (agora_str(), int(row["id"])))
        conn.commit()
        return {"token": token, "usuario": {"id": int(row["id"]), "nome": row["nome"], "usuario": row["usuario"], "perfil":row["perfil"] or "USUARIO","permissoes":json.loads(row["permissoes_json"] or "{}"), "precisaTrocarSenha": bool(row["precisa_trocar_senha"])}}
    finally:
        conn.close()


@app.post("/api/educacao/auth/trocar-senha")
def trocar_senha_educacao(payload:EducacaoNovaSenhaPayload,request:Request):
    nova=str(payload.nova_senha or "").strip()
    if len(nova)<6: raise HTTPException(400,"A nova senha precisa ter pelo menos 6 caracteres.")
    conn=conectar()
    try:
        usuario=usuario_educacao_row(request,conn)
        conn.execute("UPDATE usuarios_educacao SET senha_hash=?,precisa_trocar_senha=0,atualizado_em=? WHERE id=?",(gerar_hash_senha(nova),agora_str(),int(usuario["id"])))
        conn.commit();return {"ok":True}
    finally:conn.close()

def mapear_aluno_educacao(row):
    dados = educacao_row(row)
    dados["id"] = int(row["id"]); dados["ativo"] = bool(row["ativo"])
    dados["menor_idade"] = bool(row["menor_idade"]); dados["indicado_clinica"] = bool(row["indicado_clinica"])
    dados["criadoEm"] = row["criado_em"] or ""; dados["atualizadoEm"] = row["atualizado_em"] or ""
    return dados


ALUNO_EDUCACAO_CAMPOS = ("nome","sexo","cpf","rg","data_nascimento","telefone","email","cep","endereco","complemento","numero","bairro","cidade","estado","estado_civil","cro","profissao","origem","menor_idade","responsavel","cpf_responsavel","indicado_por_aluno","indicado_clinica","observacoes","ativo")


def valores_aluno_educacao(payload: AlunoPayload) -> list:
    valores=[]
    for campo in ALUNO_EDUCACAO_CAMPOS:
        valor=getattr(payload,campo)
        if campo in {"menor_idade","indicado_clinica","ativo"}:
            valores.append(1 if bool(valor) else 0)
        else:
            valores.append(str(valor or "").strip())
    return valores


def proximo_codigo_aluno_educacao(conn: sqlite3.Connection) -> str:
    maior=0
    for row in conn.execute("SELECT codigo FROM alunos WHERE codigo LIKE 'A%'").fetchall():
        codigo=str(row["codigo"] or "").strip().upper()
        if re.fullmatch(r"A\d+",codigo): maior=max(maior,int(codigo[1:]))
    return f"A{maior+1:03d}"


def mapear_treinamento_educacao(row):
    return {
        "id": int(row["id"]), "nome": row["nome"] or "", "categoria": row["categoria"] or "",
        "descricao": row["descricao"] or "", "cargaHoraria": float(row["carga_horaria"] or 0),
        "valor": float(row["valor"] or 0), "ativo": bool(row["ativo"]),
        "quantidadeTurmas":int(row["quantidade_turmas"] or 1),"maxAlunosPorTurma":int(row["max_alunos_por_turma"] or 0),
        "dataInicio":row["data_inicio"] or "","horarioInicio":row["horario_inicio"] or "","periodicidade":row["periodicidade"] or "Semanal",
        "diasHorarios":json.loads(row["dias_horarios_json"] or "{}"),
        "criadoEm": row["criado_em"] or "", "atualizadoEm": row["atualizado_em"] or "",
    }


def mapear_turma_educacao(row):
    return {
        "id": int(row["id"]), "treinamentoId": int(row["treinamento_id"]),
        "treinamentoNome": row["treinamento_nome"] or "", "nome": row["nome"] or "",
        "treinamentoValor": float(row["treinamento_valor"] or 0),
        "instrutor": row["instrutor"] or "", "dataInicio": row["data_inicio"] or "",
        "dataFim": row["data_fim"] or "", "horario": row["horario"] or "",
        "local": row["local"] or "", "vagas": int(row["vagas"] or 0),
        "matriculados": int(row["matriculados"] or 0), "status": row["status"] or "Turma confirmada",
    }


@app.get("/api/educacao/alunos")
def listar_alunos_educacao(q: str = ""):
    conn = conectar()
    try:
        termo = f"%{str(q or '').strip()}%"
        rows = conn.execute(
            "SELECT * FROM alunos WHERE ativo=1 AND (?='%%' OR nome LIKE ? OR codigo LIKE ? OR cpf LIKE ? OR email LIKE ?) ORDER BY nome",
            (termo, termo, termo, termo, termo),
        ).fetchall()
        return [mapear_aluno_educacao(row) for row in rows]
    finally:
        conn.close()


@app.post("/api/educacao/alunos")
def criar_aluno_educacao(payload: AlunoPayload, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do aluno.")
    obrigatorios = {"cpf":payload.cpf,"sexo":payload.sexo,"telefone":payload.telefone,"CEP":payload.cep,"endereço":payload.endereco,"número":payload.numero,"bairro":payload.bairro,"cidade":payload.cidade,"estado":payload.estado}
    faltantes=[campo for campo,valor in obrigatorios.items() if not str(valor or "").strip()]
    if faltantes: raise HTTPException(status_code=400,detail=f"Preencha os campos obrigatórios: {', '.join(faltantes)}.")
    conn = conectar()
    try:
        agora = agora_str()
        campos=",".join(ALUNO_EDUCACAO_CAMPOS); marcadores=",".join("?" for _ in ALUNO_EDUCACAO_CAMPOS)
        cur = conn.execute(f"INSERT INTO alunos (codigo,{campos},criado_em,atualizado_em) VALUES (?,{marcadores},?,?)",(proximo_codigo_aluno_educacao(conn),*valores_aluno_educacao(payload),agora,agora))
        conn.commit()
        row = conn.execute("SELECT * FROM alunos WHERE id=?", (cur.lastrowid,)).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Aluno cadastrado", info=nome, metodo_http="POST", rota="/api/educacao/alunos")
    return mapear_aluno_educacao(row)


@app.put("/api/educacao/alunos/{aluno_id}")
def atualizar_aluno_educacao(aluno_id: int, payload: AlunoPayload, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do aluno.")
    conn = conectar()
    try:
        if conn.execute("SELECT 1 FROM alunos WHERE id=?", (aluno_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Aluno não encontrado.")
        atribuicoes=",".join(f"{campo}=?" for campo in ALUNO_EDUCACAO_CAMPOS)
        conn.execute(f"UPDATE alunos SET {atribuicoes},atualizado_em=? WHERE id=?", (*valores_aluno_educacao(payload), agora_str(), aluno_id))
        conn.commit()
        row = conn.execute("SELECT * FROM alunos WHERE id=?", (aluno_id,)).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Aluno atualizado", info=nome, metodo_http="PUT", rota=f"/api/educacao/alunos/{aluno_id}")
    return mapear_aluno_educacao(row)


@app.post("/api/educacao/alunos/{aluno_id}/desativar")
def excluir_aluno_educacao(aluno_id: int, payload: DesativarCadastroPayload, request: Request):
    motivo=payload.justificativa.strip()
    if not motivo:
        raise HTTPException(status_code=400, detail="Informe a justificativa da exclusão.")
    conn = conectar()
    try:
        validar_senha_gerencial_educacao(conn,payload.senha_gerencial)
        row = conn.execute("SELECT nome FROM alunos WHERE id=? AND ativo=1", (aluno_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Aluno ativo não encontrado.")
        responsavel=usuario_educacao_request(request,conn); agora=agora_str()
        conn.execute("UPDATE alunos SET ativo=0,excluido_em=?,excluido_motivo=?,excluido_por=?,atualizado_em=? WHERE id=?", (agora,motivo,responsavel,agora,aluno_id))
        conn.commit()
    finally:
        conn.close()
    registrar_acao_usuario(responsavel, acao="Educacao", tipo="Aluno desativado", info=f"{row['nome']} — {motivo}", metodo_http="POST", rota=f"/api/educacao/alunos/{aluno_id}/desativar")
    return {"ok": True}


@app.get("/api/educacao/alunos-excluidos")
def listar_alunos_excluidos_educacao():
    conn=conectar()
    try:
        rows=conn.execute("SELECT * FROM alunos WHERE ativo=0 ORDER BY excluido_em DESC, nome").fetchall()
        resultado=[]
        for row in rows:
            item=mapear_aluno_educacao(row)
            item["historico"]={
                "matriculas":[educacao_row(r) for r in conn.execute("""SELECT m.*,t.nome turma_nome,tr.nome treinamento_nome FROM matriculas_treinamento m JOIN turmas_treinamento t ON t.id=m.turma_id JOIN treinamentos tr ON tr.id=t.treinamento_id WHERE m.aluno_id=? ORDER BY m.id DESC""",(row["id"],)).fetchall()],
                "financeiro":[educacao_row(r) for r in conn.execute("SELECT * FROM financeiro_educacao WHERE aluno_id=? ORDER BY id DESC",(row["id"],)).fetchall()],
                "pacientesIndicados":[educacao_row(r) for r in conn.execute("SELECT * FROM pacientes_modelo_educacao WHERE indicado_aluno_id=? ORDER BY id DESC",(row["id"],)).fetchall()],
            }
            resultado.append(item)
        return resultado
    finally:conn.close()


@app.get("/api/educacao/treinamentos")
def listar_treinamentos_educacao():
    conn = conectar()
    try:
        return [mapear_treinamento_educacao(row) for row in conn.execute("SELECT * FROM treinamentos ORDER BY ativo DESC, nome").fetchall()]
    finally:
        conn.close()


@app.post("/api/educacao/treinamentos")
def criar_treinamento_educacao(payload: TreinamentoPayload, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do treinamento.")
    conn = conectar()
    try:
        agora = agora_str()
        dias_json=json.dumps(payload.dias_horarios,ensure_ascii=False)
        cur = conn.execute("""INSERT INTO treinamentos (nome,categoria,descricao,carga_horaria,valor,ativo,quantidade_turmas,max_alunos_por_turma,data_inicio,horario_inicio,periodicidade,dias_horarios_json,criado_em,atualizado_em)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (nome,payload.categoria.strip(),payload.descricao.strip(),max(0,payload.carga_horaria),max(0,payload.valor),int(payload.ativo),max(1,payload.quantidade_turmas),max(0,payload.max_alunos_por_turma),payload.data_inicio.strip(),payload.horario_inicio.strip(),payload.periodicidade.strip() or "Semanal",dias_json,agora,agora))
        treinamento_id=int(cur.lastrowid)
        horarios="; ".join(f"{dia}: {dados.get('inicio','')}–{dados.get('fim','')}" for dia,dados in payload.dias_horarios.items() if isinstance(dados,dict))
        for indice in range(1,max(1,payload.quantidade_turmas)+1):
            conn.execute("""INSERT INTO turmas_treinamento (treinamento_id,nome,instrutor,data_inicio,data_fim,horario,local,vagas,status,criado_em,atualizado_em)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",(treinamento_id,f"Turma {indice}","",payload.data_inicio.strip(),"",f"{payload.periodicidade}: {horarios}".strip(": "),"",max(0,payload.max_alunos_por_turma),"Turma confirmada",agora,agora))
        conn.commit()
        row = conn.execute("SELECT * FROM treinamentos WHERE id=?", (treinamento_id,)).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Treinamento cadastrado", info=nome, metodo_http="POST", rota="/api/educacao/treinamentos")
    return mapear_treinamento_educacao(row)


@app.put("/api/educacao/treinamentos/{treinamento_id}")
def atualizar_treinamento_educacao(treinamento_id: int, payload: TreinamentoPayload, request: Request):
    nome = payload.nome.strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do treinamento.")
    conn = conectar()
    try:
        if conn.execute("SELECT 1 FROM treinamentos WHERE id=?", (treinamento_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Treinamento não encontrado.")
        conn.execute("""UPDATE treinamentos SET nome=?,categoria=?,descricao=?,carga_horaria=?,valor=?,ativo=?,quantidade_turmas=?,max_alunos_por_turma=?,data_inicio=?,horario_inicio=?,periodicidade=?,dias_horarios_json=?,atualizado_em=? WHERE id=?""",(nome,payload.categoria.strip(),payload.descricao.strip(),max(0,payload.carga_horaria),max(0,payload.valor),int(payload.ativo),max(1,payload.quantidade_turmas),max(0,payload.max_alunos_por_turma),payload.data_inicio.strip(),payload.horario_inicio.strip(),payload.periodicidade.strip() or "Semanal",json.dumps(payload.dias_horarios,ensure_ascii=False),agora_str(),treinamento_id))
        existentes=int(conn.execute("SELECT COUNT(*) FROM turmas_treinamento WHERE treinamento_id=?",(treinamento_id,)).fetchone()[0] or 0)
        horarios="; ".join(f"{dia}: {dados.get('inicio','')}–{dados.get('fim','')}" for dia,dados in payload.dias_horarios.items() if isinstance(dados,dict))
        for indice in range(existentes+1,max(1,payload.quantidade_turmas)+1):
            agora=agora_str()
            conn.execute("""INSERT INTO turmas_treinamento (treinamento_id,nome,instrutor,data_inicio,data_fim,horario,local,vagas,status,criado_em,atualizado_em)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",(treinamento_id,f"Turma {indice}","",payload.data_inicio.strip(),"",f"{payload.periodicidade}: {horarios}".strip(": "),"",max(0,payload.max_alunos_por_turma),"Turma confirmada",agora,agora))
        conn.commit()
        row = conn.execute("SELECT * FROM treinamentos WHERE id=?", (treinamento_id,)).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Treinamento atualizado", info=nome, metodo_http="PUT", rota=f"/api/educacao/treinamentos/{treinamento_id}")
    return mapear_treinamento_educacao(row)


@app.delete("/api/educacao/treinamentos/{treinamento_id}")
def excluir_treinamento_educacao(treinamento_id: int):
    conn = conectar()
    try:
        if conn.execute("SELECT 1 FROM turmas_treinamento WHERE treinamento_id=?", (treinamento_id,)).fetchone():
            raise HTTPException(status_code=400, detail="Este treinamento possui turmas. Inative-o em vez de excluir.")
        conn.execute("DELETE FROM treinamentos WHERE id=?", (treinamento_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.get("/api/educacao/turmas")
def listar_turmas_educacao():
    conn = conectar()
    try:
        conn.execute("""UPDATE turmas_treinamento
            SET status='Turma em andamento', atualizado_em=?
            WHERE status='Turma confirmada' AND COALESCE(data_inicio,'')<>''
              AND date(data_inicio)<=date(?)""", (agora_str(), date.today().isoformat()))
        conn.commit()
        rows = conn.execute("""SELECT t.*, tr.nome AS treinamento_nome, tr.valor AS treinamento_valor, COUNT(m.id) AS matriculados FROM turmas_treinamento t JOIN treinamentos tr ON tr.id=t.treinamento_id LEFT JOIN matriculas_treinamento m ON m.turma_id=t.id AND m.status!='Cancelado' GROUP BY t.id ORDER BY COALESCE(t.data_inicio,'') DESC, t.nome""").fetchall()
        return [mapear_turma_educacao(row) for row in rows]
    finally:
        conn.close()


@app.post("/api/educacao/turmas")
def criar_turma_educacao(payload: TurmaTreinamentoPayload, request: Request):
    if not payload.nome.strip():
        raise HTTPException(status_code=400, detail="Informe o nome da turma.")
    conn = conectar()
    try:
        if conn.execute("SELECT 1 FROM treinamentos WHERE id=?", (payload.treinamento_id,)).fetchone() is None:
            raise HTTPException(status_code=400, detail="Selecione um treinamento válido.")
        agora = agora_str()
        cur = conn.execute("INSERT INTO turmas_treinamento (treinamento_id,nome,instrutor,data_inicio,data_fim,horario,local,vagas,status,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?)", (payload.treinamento_id, payload.nome.strip(), payload.instrutor.strip(), payload.data_inicio.strip(), payload.data_fim.strip(), payload.horario.strip(), payload.local.strip(), max(0, payload.vagas), payload.status.strip() or "Turma confirmada", agora, agora))
        conn.commit()
        turma_id = int(cur.lastrowid)
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Turma cadastrada", info=payload.nome.strip(), metodo_http="POST", rota="/api/educacao/turmas")
    return next(item for item in listar_turmas_educacao() if item["id"] == turma_id)


@app.put("/api/educacao/turmas/{turma_id}")
def atualizar_turma_educacao(turma_id: int, payload: TurmaTreinamentoPayload, request: Request):
    if not payload.nome.strip():
        raise HTTPException(status_code=400, detail="Informe o nome da turma.")
    conn = conectar()
    try:
        if conn.execute("SELECT 1 FROM turmas_treinamento WHERE id=?", (turma_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Turma não encontrada.")
        conn.execute("UPDATE turmas_treinamento SET treinamento_id=?,nome=?,instrutor=?,data_inicio=?,data_fim=?,horario=?,local=?,vagas=?,status=?,atualizado_em=? WHERE id=?", (payload.treinamento_id, payload.nome.strip(), payload.instrutor.strip(), payload.data_inicio.strip(), payload.data_fim.strip(), payload.horario.strip(), payload.local.strip(), max(0, payload.vagas), payload.status.strip() or "Turma confirmada", agora_str(), turma_id))
        conn.commit()
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Turma atualizada", info=payload.nome.strip(), metodo_http="PUT", rota=f"/api/educacao/turmas/{turma_id}")
    return next(item for item in listar_turmas_educacao() if item["id"] == turma_id)


@app.put("/api/educacao/turmas/{turma_id}/status")
def alterar_status_turma_educacao(turma_id: int, payload: dict, request: Request):
    status = str(payload.get("status") or "").strip()
    permitidos = {"Turma confirmada", "Turma em andamento", "Turma encerrada", "Turma cancelada"}
    if status not in permitidos:
        raise HTTPException(status_code=400, detail="Status de turma inválido.")
    conn = conectar()
    try:
        if conn.execute("SELECT 1 FROM turmas_treinamento WHERE id=?", (turma_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Turma não encontrada.")
        conn.execute("UPDATE turmas_treinamento SET status=?,atualizado_em=? WHERE id=?", (status, agora_str(), turma_id))
        conn.commit()
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Status da turma alterado", info=status, metodo_http="PUT", rota=f"/api/educacao/turmas/{turma_id}/status")
    return {"ok": True}


@app.delete("/api/educacao/turmas/{turma_id}")
def excluir_turma_educacao(turma_id: int):
    conn = conectar()
    try:
        conn.execute("DELETE FROM matriculas_treinamento WHERE turma_id=?", (turma_id,))
        conn.execute("DELETE FROM turmas_treinamento WHERE id=?", (turma_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.get("/api/educacao/matriculas")
def listar_matriculas_educacao(turma_id: int | None = None, aluno_id: int | None = None):
    conn = conectar()
    try:
        filtros, params = [], []
        if turma_id is not None: filtros.append("m.turma_id=?"); params.append(turma_id)
        if aluno_id is not None: filtros.append("m.aluno_id=?"); params.append(aluno_id)
        where = " WHERE " + " AND ".join(filtros) if filtros else ""
        rows = conn.execute("SELECT m.*, a.nome AS aluno_nome, t.nome AS turma_nome, tr.nome AS treinamento_nome FROM matriculas_treinamento m JOIN alunos a ON a.id=m.aluno_id JOIN turmas_treinamento t ON t.id=m.turma_id JOIN treinamentos tr ON tr.id=t.treinamento_id" + where + " ORDER BY a.nome", params).fetchall()
        indicados:dict[int,list[dict]]={}
        for p in conn.execute("""SELECT DISTINCT p.indicado_aluno_id,p.id,p.prontuario,p.nome FROM pacientes_modelo_educacao p
            JOIN contratos_educacao c ON c.paciente_modelo_id=p.id AND c.status='APROVADO'
            WHERE p.indicado_aluno_id IS NOT NULL AND p.ativo=1 ORDER BY p.nome""").fetchall():
            indicados.setdefault(int(p["indicado_aluno_id"]),[]).append({"id":int(p["id"]),"prontuario":p["prontuario"] or "","nome":p["nome"] or ""})
        return [{"id": int(r["id"]), "alunoId": int(r["aluno_id"]), "alunoNome": r["aluno_nome"], "turmaId": int(r["turma_id"]), "turmaNome": r["turma_nome"], "treinamentoNome": r["treinamento_nome"], "dataMatricula": r["data_matricula"] or "", "status": r["status"] or "Matriculado", "observacoes": r["observacoes"] or "", "valorCurso":float(r["valor_curso"] or 0), "entrada":float(r["entrada"] or 0), "parcelas":int(r["parcelas"] or 1), "formaPagamento":r["forma_pagamento"] or "", "contratoDisponivel":bool(r["contrato_path"]),"pacienteIndicadoFechou":bool(indicados.get(int(r["aluno_id"]))),"pacientesIndicadosFechados":indicados.get(int(r["aluno_id"]),[])} for r in rows]
    finally:
        conn.close()


@app.post("/api/educacao/matriculas")
def criar_matricula_educacao(payload: MatriculaTreinamentoPayload, request: Request):
    conn = conectar()
    try:
        aluno = conn.execute("SELECT nome FROM alunos WHERE id=?", (payload.aluno_id,)).fetchone()
        turma = conn.execute("SELECT t.vagas,tr.valor FROM turmas_treinamento t JOIN treinamentos tr ON tr.id=t.treinamento_id WHERE t.id=?", (payload.turma_id,)).fetchone()
        if aluno is None or turma is None:
            raise HTTPException(status_code=400, detail="Selecione um aluno e uma turma válidos.")
        total = conn.execute("SELECT COUNT(*) AS total FROM matriculas_treinamento WHERE turma_id=? AND status!='Cancelado'", (payload.turma_id,)).fetchone()["total"]
        if int(turma["vagas"] or 0) > 0 and int(total) >= int(turma["vagas"]):
            raise HTTPException(status_code=400, detail="Esta turma não possui vagas disponíveis.")
        agora = agora_str()
        try:
            valor_curso=max(0,float(payload.valor_curso or turma["valor"] or 0))
            cur = conn.execute("""INSERT INTO matriculas_treinamento
                (aluno_id,turma_id,data_matricula,status,valor_curso,desconto_percentual,desconto_valor,entrada,parcelas,forma_pagamento,plano_pagamento_json,observacoes,criado_em,atualizado_em)
                VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", (payload.aluno_id,payload.turma_id,payload.data_matricula.strip() or date.today().isoformat(),payload.status.strip() or "Matriculado",valor_curso,max(0,payload.desconto_percentual),max(0,payload.desconto_valor),max(0,payload.entrada),max(1,payload.parcelas),payload.forma_pagamento.strip(),json.dumps(payload.plano_pagamento,ensure_ascii=False),payload.observacoes.strip(),agora,agora))
        except sqlite3.IntegrityError:
            raise HTTPException(status_code=400, detail="Este aluno já está matriculado nesta turma.")
        conn.commit()
        matricula_id = int(cur.lastrowid)
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Educacao", tipo="Matrícula criada", info=aluno["nome"], metodo_http="POST", rota="/api/educacao/matriculas")
    return next(item for item in listar_matriculas_educacao() if item["id"] == matricula_id)


def gerar_contrato_matricula_educacao(conn:sqlite3.Connection, matricula_id:int)->str:
    row=conn.execute("""SELECT m.*,a.*,t.nome turma_nome,t.instrutor,t.data_inicio,t.data_fim,t.horario,t.local,
        tr.nome treinamento_nome FROM matriculas_treinamento m JOIN alunos a ON a.id=m.aluno_id
        JOIN turmas_treinamento t ON t.id=m.turma_id JOIN treinamentos tr ON tr.id=t.treinamento_id WHERE m.id=?""",(matricula_id,)).fetchone()
    if row is None: raise HTTPException(404,"Matrícula não encontrada.")
    if Document is None: raise HTTPException(500,"Gerador de documentos indisponível.")
    doc=Document(); doc.add_heading("CONTRATO DE PRESTAÇÃO DE SERVIÇOS EDUCACIONAIS",0)
    doc.add_paragraph(f"ALUNO(A): {row['nome']} — CÓDIGO {row['codigo']}")
    doc.add_paragraph(f"CPF: {row['cpf'] or ''}    TELEFONE: {row['telefone'] or ''}")
    endereco=", ".join(x for x in [row['endereco'],row['numero'],row['complemento'],row['bairro'],row['cidade'],row['estado'],row['cep']] if str(x or '').strip())
    doc.add_paragraph(f"ENDEREÇO: {endereco}")
    doc.add_heading("OBJETO DO CONTRATO",level=1); doc.add_paragraph(f"Prestação de serviços educacionais referente ao treinamento {row['treinamento_nome']}, turma {row['turma_nome']}, ministrado por {row['instrutor'] or 'profissional designado'}, no período de {formatar_data_br_valor(row['data_inicio'])} a {formatar_data_br_valor(row['data_fim'])}, em {row['local'] or 'local informado pela contratada'}.")
    valor=float(row['valor_curso'] or 0); desconto=max(float(row['desconto_valor'] or 0),valor*float(row['desconto_percentual'] or 0)/100); total=max(0,valor-desconto)
    doc.add_heading("VALOR E PAGAMENTO",level=1); doc.add_paragraph(f"Valor do curso: {formatar_moeda_br(valor)}. Desconto: {formatar_moeda_br(desconto)}. Valor final: {formatar_moeda_br(total)}.")
    try: plano=json.loads(row['plano_pagamento_json'] or '[]')
    except Exception: plano=[]
    if plano:
        tabela=doc.add_table(rows=1,cols=4); tabela.rows[0].cells[0].text="Parcela";tabela.rows[0].cells[1].text="Vencimento";tabela.rows[0].cells[2].text="Forma";tabela.rows[0].cells[3].text="Valor"
        for item in plano:
            cells=tabela.add_row().cells;cells[0].text=str(item.get('descricao') or '');cells[1].text=formatar_data_br_valor(item.get('data'));cells[2].text=str(item.get('forma') or '').replace('_',' ');cells[3].text=formatar_moeda_br(item.get('valor'))
        total_cobrado=sum(max(0,numero_educacao(item.get("valor"))) for item in plano)
        taxa_cartao=max(0,total_cobrado-total)
        if taxa_cartao>0:
            operadora=next((str(item.get("operadora_cartao") or "") for item in plano if item.get("operadora_cartao")),"")
            doc.add_paragraph(f"Pagamento em cartão: total cobrado de {formatar_moeda_br(total_cobrado)}, incluindo {formatar_moeda_br(taxa_cartao)} de taxa da operadora {operadora or 'selecionada'}.")
    doc.add_paragraph("\nO(A) aluno(a) declara estar de acordo com as condições do curso, calendário, conteúdo e plano de pagamento acima descritos.")
    doc.add_paragraph(f"\n{row['cidade'] or 'Campos dos Goytacazes'}, {formatar_data_extenso_local()}.\n\n____________________________________\n{row['nome']}\n\n____________________________________\nSOULSUL EDUCAÇÃO")
    aplicar_fonte_times_new_roman(doc); pasta=os.path.join(ARQUIVOS_BASE_DIR,'documentos_educacao','matriculas');os.makedirs(pasta,exist_ok=True)
    caminho=os.path.join(pasta,f"CONTRATO_MATRICULA_{row['codigo']}_{matricula_id}.docx");doc.save(caminho);return caminho


@app.get("/api/educacao/matriculas/{matricula_id}/contrato")
def contrato_matricula_educacao(matricula_id:int):
    conn=conectar()
    try:
        caminho=gerar_contrato_matricula_educacao(conn,matricula_id)
        conn.execute("UPDATE matriculas_treinamento SET contrato_path=?,atualizado_em=? WHERE id=?",(caminho,agora_str(),matricula_id))
        matricula=conn.execute("SELECT * FROM matriculas_treinamento WHERE id=?",(matricula_id,)).fetchone()
        if conn.execute("SELECT COUNT(*) FROM financeiro_educacao WHERE matricula_id=?",(matricula_id,)).fetchone()[0]==0:
            try: plano=json.loads(matricula["plano_pagamento_json"] or "[]")
            except Exception: plano=[]
            agora=agora_str()
            for item in plano:
                valor=max(0,numero_educacao(item.get("valor")))
                if valor<=0: continue
                conn.execute("""INSERT INTO financeiro_educacao
                    (aluno_id,matricula_id,descricao,tipo,categoria,valor,valor_bruto,taxa_valor,valor_liquido,data_vencimento,status,forma_pagamento,operadora_cartao,bandeira_cartao,conta_caixa,origem,parcela,criado_em,atualizado_em)
                    VALUES (?,?,?,'Receita','Curso',?,?,?,?,?,'Em aberto',?,?,?,?,?,?,?,?)""",
                    (int(matricula["aluno_id"]),matricula_id,f"Matrícula #{matricula_id} — {item.get('descricao') or 'Parcela'}",valor,valor,max(0,valor-numero_educacao(item.get("valor_liquido"),valor)),numero_educacao(item.get("valor_liquido"),valor),str(item.get("data") or ""),str(item.get("forma") or "").replace("_"," "),str(item.get("operadora_cartao") or ""),str(item.get("bandeira_cartao") or ""),str(item.get("operadora_cartao") or ""),"Contrato de matrícula",str(item.get("descricao") or ""),agora,agora))
        conn.commit()
        return FileResponse(caminho,filename=os.path.basename(caminho),media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    finally: conn.close()


@app.get("/api/educacao/alunos/{aluno_id}/documentos")
def documentos_aluno_educacao(aluno_id:int):
    conn=conectar()
    try:
        rows=conn.execute("""SELECT m.id,m.contrato_path,m.data_matricula,t.nome turma_nome,tr.nome treinamento_nome
            FROM matriculas_treinamento m JOIN turmas_treinamento t ON t.id=m.turma_id
            JOIN treinamentos tr ON tr.id=t.treinamento_id WHERE m.aluno_id=? AND COALESCE(m.contrato_path,'')<>''
            ORDER BY m.id DESC""",(aluno_id,)).fetchall()
        return [{"id":int(r["id"]),"nome":f"Contrato — {r['treinamento_nome']} — {r['turma_nome']}","data":r["data_matricula"] or "","arquivo":os.path.basename(r["contrato_path"] or "")} for r in rows]
    finally: conn.close()


@app.delete("/api/educacao/matriculas/{matricula_id}")
def excluir_matricula_educacao(matricula_id: int):
    conn = conectar()
    try:
        conn.execute("DELETE FROM matriculas_treinamento WHERE id=?", (matricula_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.post("/api/educacao/matriculas/{matricula_id}/cancelar")
def cancelar_matricula_educacao(matricula_id:int,payload:CancelarMatriculaPayload):
    conn=conectar()
    try:
        administrador=conn.execute("SELECT * FROM usuarios_educacao WHERE ativo=1 ORDER BY id LIMIT 1").fetchone()
        if administrador is None or not verificar_senha(payload.senha_admin,administrador["senha_hash"]):
            raise HTTPException(403,"Senha de administrador inválida.")
        matricula=conn.execute("SELECT * FROM matriculas_treinamento WHERE id=?",(matricula_id,)).fetchone()
        if matricula is None: raise HTTPException(404,"Matrícula não encontrada.")
        if str(matricula["status"] or "").lower()=="cancelado": raise HTTPException(400,"Esta matrícula já foi cancelada.")
        if payload.reembolso:
            if payload.valor_reembolso<=0: raise HTTPException(400,"Informe o valor do reembolso.")
            data_reembolso=normalizar_data_contrato_iso(payload.data_reembolso,"")
            if not data_reembolso: raise HTTPException(400,"Informe a data do reembolso.")
            agora=agora_str()
            conn.execute("""INSERT INTO financeiro_educacao
                (aluno_id,matricula_id,descricao,tipo,categoria,valor,data_vencimento,data_pagamento,status,forma_pagamento,criado_em,atualizado_em)
                VALUES (?,?,?,'Despesa','Reembolso',?,?,?,'Pago','Reembolso',?,?)""",
                (int(matricula["aluno_id"]),matricula_id,f"Reembolso da matrícula #{matricula_id}",float(payload.valor_reembolso),data_reembolso,data_reembolso,agora,agora))
        conn.execute("UPDATE financeiro_educacao SET status='Cancelado',atualizado_em=? WHERE matricula_id=? AND tipo='Receita' AND status!='Pago'",(agora_str(),matricula_id))
        conn.execute("UPDATE matriculas_treinamento SET status='Cancelado',atualizado_em=? WHERE id=?",(agora_str(),matricula_id));conn.commit()
        return {"ok":True}
    finally: conn.close()


def coluna_data_agenda() -> str:
    conn = conectar()
    try:
        cols = colunas_tabela(conn, "agendamentos")
    finally:
        conn.close()
    return "data_agendamento" if "data_agendamento" in cols else "data"


DATA_COLUNA_AGENDA = coluna_data_agenda()


def validar_dados_paciente(
    nome: str,
    prontuario: str,
    cpf: str,
    menor: bool,
    responsavel: str,
    cpf_responsavel: str,
) -> list[str]:
    erros: list[str] = []
    if not str(nome or "").strip():
        erros.append("Informe o nome do paciente.")
    if not str(prontuario or "").strip():
        erros.append("Informe o prontuario.")
    if cpf and not cpf_valido(cpf):
        erros.append("O CPF do paciente e invalido.")
    if menor and not str(responsavel or "").strip():
        erros.append("Informe o responsavel legal para paciente menor de idade.")
    if cpf_responsavel and not cpf_valido(cpf_responsavel):
        erros.append("O CPF do responsavel e invalido.")
    return erros


def validar_duplicidade_paciente(
    conn: sqlite3.Connection,
    prontuario: str,
    cpf: str,
    paciente_id_atual: int | None = None,
) -> list[str]:
    erros: list[str] = []
    filtro_id = ""
    params_exclusao: list[object] = []
    if paciente_id_atual is not None:
        filtro_id = " AND id <> ?"
        params_exclusao.append(int(paciente_id_atual))

    prontuario_limpo = formatar_prontuario_valor(prontuario)
    if prontuario_limpo:
        row = conn.execute(
            f"SELECT id FROM pacientes WHERE trim(COALESCE(prontuario, '')) = ?{filtro_id} LIMIT 1",
            [prontuario_limpo, *params_exclusao],
        ).fetchone()
        if row is not None:
            erros.append("Ja existe um paciente com este prontuario.")

    cpf_limpo = limpar_cpf(cpf)
    if cpf_limpo:
        row = conn.execute(
            f"SELECT id FROM pacientes WHERE trim(COALESCE(cpf, '')) = ?{filtro_id} LIMIT 1",
            [cpf_limpo, *params_exclusao],
        ).fetchone()
        if row is not None:
            erros.append("Ja existe um paciente com este CPF.")

    return erros


def buscar_endereco_por_cep(cep: str) -> dict[str, str]:
    cep_limpo = "".join(ch for ch in str(cep or "") if ch.isdigit())
    if len(cep_limpo) != 8:
        return {"logradouro": "", "bairro": "", "localidade": "", "uf": ""}
    try:
        with urllib_request.urlopen(f"https://viacep.com.br/ws/{cep_limpo}/json/", timeout=5) as resposta:
            dados = json.loads(resposta.read().decode("utf-8"))
            if dados.get("erro"):
                return {"logradouro": "", "bairro": "", "localidade": "", "uf": ""}
            return {
                "logradouro": str(dados.get("logradouro") or ""),
                "bairro": str(dados.get("bairro") or ""),
                "localidade": str(dados.get("localidade") or ""),
                "uf": str(dados.get("uf") or ""),
            }
    except (urllib_error.URLError, TimeoutError, json.JSONDecodeError):
        return {"logradouro": "", "bairro": "", "localidade": "", "uf": ""}


def proximo_prontuario(conn: sqlite3.Connection) -> str:
    rows = conn.execute("SELECT prontuario FROM pacientes WHERE COALESCE(prontuario, '') <> ''").fetchall()
    maior = 0
    for row in rows:
        texto = formatar_prontuario_valor(row["prontuario"])
        digitos = "".join(ch for ch in texto if ch.isdigit())
        if digitos:
            maior = max(maior, int(digitos))
    return str(maior + 1 if maior else 1)




def slug_paciente_arquivos(paciente_row: sqlite3.Row | dict) -> str:
    prontuario = formatar_prontuario_valor(paciente_row.get("prontuario") if isinstance(paciente_row, dict) else paciente_row["prontuario"])
    nome = limpar_nome(paciente_row.get("nome", "PACIENTE") if isinstance(paciente_row, dict) else paciente_row["nome"])
    base = f"{prontuario}_{nome}".strip("_")
    return base or f"paciente_{int(paciente_row['id'])}"


def pasta_exames_paciente(paciente_row: sqlite3.Row | dict) -> str:
    pasta = os.path.join(EXAMES_DIR, slug_paciente_arquivos(paciente_row))
    os.makedirs(pasta, exist_ok=True)
    return pasta


def pasta_fotos_paciente(paciente_row: sqlite3.Row | dict) -> str:
    pasta = os.path.join(FOTOS_DIR, slug_paciente_arquivos(paciente_row))
    os.makedirs(pasta, exist_ok=True)
    return pasta


def pasta_boletos_paciente(paciente_row: sqlite3.Row | dict) -> str:
    pasta = os.path.join(BOLETOS_DIR, slug_paciente_arquivos(paciente_row))
    os.makedirs(pasta, exist_ok=True)
    return pasta


def url_foto_paciente(row: sqlite3.Row) -> str:
    if not str(row["foto_path"] or "").strip():
        return ""
    return f"/api/pacientes/{int(row['id'])}/foto"


class PacientePayload(BaseModel):
    nome: str
    apelido: str = ""
    sexo: str = ""
    prontuario: str | None = None
    cpf: str = ""
    rg: str = ""
    data_nascimento: str = ""
    telefone: str = ""
    email: str = ""
    cep: str = ""
    endereco: str = ""
    complemento: str = ""
    numero: str = ""
    bairro: str = ""
    cidade: str = ""
    estado: str = ""
    estado_civil: str = ""
    profissao: str = ""
    origem: str = ""
    observacoes: str = ""
    menor_idade: bool = False
    responsavel: str = ""
    cpf_responsavel: str = ""


class TratamentoSuspensaoPayload(BaseModel):
    suspenso: bool = False
    observacao: str = ""


class PacienteResumo(BaseModel):
    id: int
    nome: str
    apelido: str = ""
    prontuario: str
    cpf: str = ""
    telefone: str = ""
    email: str = ""
    dataNascimento: str = ""
    fotoUrl: str = ""
    tratamentoSuspenso: bool = False


class PacienteDetalhe(BaseModel):
    id: int
    nome: str
    apelido: str = ""
    sexo: str = ""
    prontuario: str
    cpf: str = ""
    rg: str = ""
    dataNascimento: str = ""
    telefone: str = ""
    email: str = ""
    cep: str = ""
    endereco: str = ""
    complemento: str = ""
    numero: str = ""
    bairro: str = ""
    cidade: str = ""
    estado: str = ""
    estadoCivil: str = ""
    profissao: str = ""
    origem: str = ""
    observacoes: str = ""
    menorIdade: bool = False
    responsavel: str = ""
    cpfResponsavel: str = ""
    fotoUrl: str = ""
    tratamentoSuspenso: bool = False
    tratamentoSuspensoObservacao: str = ""
    tratamentoSuspensoPor: str = ""
    tratamentoSuspensoEm: str = ""


class ProximoProntuarioResposta(BaseModel):
    prontuario: str


class ContratoResumo(BaseModel):
    id: int
    valorTotal: str
    entrada: str
    parcelas: int
    primeiroVencimento: str = ""
    dataCriacao: str = ""
    formaPagamento: str = ""
    status: str = "EM_ABERTO"
    aprovadoPor: str = ""
    dataAprovacao: str = ""
    jaFoiAprovado: bool = False
    tipoMovimentoVenda: str = "NOVA"
    valorVendaConsiderado: float | None = None
    procedimentos: list[str] = Field(default_factory=list)


class RecebivelResumo(BaseModel):
    id: int
    pacienteId: int | None = None
    pacienteNome: str = ""
    prontuario: str = ""
    contratoId: int | None = None
    parcela: int | None = None
    vencimento: str = ""
    valor: str
    formaPagamento: str = ""
    status: str = ""
    dataPagamento: str = ""
    observacao: str = ""
    historicoCobranca: list["RecebivelHistoricoItemResposta"] = Field(default_factory=list)


class RecebivelHistoricoItemResposta(BaseModel):
    id: int
    status: str = ""
    observacao: str = ""
    cobrado: bool = False
    criadoPor: str = ""
    criadoEm: str = ""


class RecebivelAtualizacaoPayload(BaseModel):
    paciente_nome: str = ""
    prontuario: str = ""
    vencimento: str = ""
    valor: float = 0
    forma_pagamento: str = ""
    status: str = ""
    data_pagamento: str = ""
    observacao: str = ""
    cobranca_realizada: bool = False
    observacao_cobranca: str = ""
    senha_administrativa: str = ""


class RecebivelRenegociacaoParcelaPayload(BaseModel):
    vencimento: str = ""
    valor: float = 0
    forma_pagamento: str = ""
    observacao: str = ""


class RecebivelLotePayload(BaseModel):
    paciente_id: int | None = None
    paciente_nome: str = ""
    prontuario: str = ""
    forma_pagamento: str = ""
    status: str = ""
    observacao: str = ""
    primeiro_vencimento: str = ""
    novas_parcelas: list[RecebivelRenegociacaoParcelaPayload] = Field(default_factory=list)
    suspender_anteriores: bool = True
    observacao_renegociacao: str = ""
    senha_administrativa: str = ""


class AgendamentoResumo(BaseModel):
    id: int
    data: str = ""
    horario: str = ""
    profissional: str = ""
    status: str = ""
    procedimento: str = ""
    observacao: str = ""


class ArquivoPacienteItem(BaseModel):
    nome: str
    caminho: str
    modificadoEm: str = ""
    extensao: str = ""


class ImagemDocumentoPayload(BaseModel):
    nome: str
    conteudo_base64: str


class RecebimentoBoletosPayload(BaseModel):
    imagens: list[ImagemDocumentoPayload] = Field(default_factory=list)


class FinanceiroResumo(BaseModel):
    total: str
    emAberto: str
    atrasado: str
    pagos: str
    quantidadeAtrasados: int
    indicador: str


class MovimentoCaixaResumo(BaseModel):
    id: int
    data: str = ""
    origem: str = ""
    descricao: str = ""
    valor: str = ""
    tipo: str = ""
    prontuario: str = ""
    formaPagamento: str = ""
    contaCaixa: str = ""
    observacao: str = ""
    contratoId: int | None = None
    recebivelId: int | None = None


class ContaPagarResumo(BaseModel):
    id: int
    vencimento: str = ""
    descricao: str = ""
    fornecedor: str = ""
    categoria: str = ""
    valor: str = ""
    valorPago: str = ""
    pagoEm: str = ""
    status: str = ""
    observacao: str = ""


class SaldoContaResumo(BaseModel):
    id: int
    data: str = ""
    conta: str = ""
    saldo: str = ""
    observacao: str = ""


class SaldoContaPayload(BaseModel):
    data: str = ""
    conta: str = ""
    saldo: float = 0
    observacao: str = ""


class ContaPagarPayload(BaseModel):
    vencimento: str = ""
    descricao: str = ""
    fornecedor: str = ""
    categoria: str = ""
    valor: float = 0
    valor_pago: float = 0
    pago_em: str = ""
    status: str = ""
    observacao: str = ""


class BaixaRecebivelPayload(BaseModel):
    data_pagamento: str = ""
    forma_pagamento: str = ""
    conta_caixa: str = ""
    desconto_valor: float = 0
    observacao: str = ""
    senha_administrativa: str = ""


class MovimentoCaixaPayload(BaseModel):
    origem: str = ""
    descricao: str = ""
    valor: float = 0
    tipo: str = "Entrada"
    data_movimento: str = ""
    prontuario: str = ""
    forma_pagamento: str = ""
    conta_caixa: str = ""
    observacao: str = ""
    contrato_id: int | None = None
    recebivel_id: int | None = None


class MovimentoCaixaAtualizacaoPayload(BaseModel):
    origem: str = ""
    descricao: str = ""
    valor: float = 0
    tipo: str = ""
    data_movimento: str = ""
    prontuario: str = ""
    forma_pagamento: str = ""
    conta_caixa: str = ""
    observacao: str = ""


class FinanceiroPainelResposta(BaseModel):
    resumo: FinanceiroResumo
    recebiveis: list[RecebivelResumo]
    caixa: list[MovimentoCaixaResumo]
    contasPagar: list[ContaPagarResumo]
    saldosConta: list[SaldoContaResumo]


class ReciboManualPayload(BaseModel):
    valor: float = 0
    pagador: str = ""
    recebedor: str = ""
    data_pagamento: str = ""
    referente: str = ""
    observacao: str = ""
    cidade: str = ""


class ReciboManualResumo(BaseModel):
    id: int
    valor: str = ""
    pagador: str = ""
    recebedor: str = ""
    dataPagamento: str = ""
    referente: str = ""
    observacao: str = ""
    cidade: str = ""
    criadoEm: str = ""


class MetaMensalPayload(BaseModel):
    meta: float = 0
    supermeta: float = 0
    hipermeta: float = 0


class MetaMensalResumo(BaseModel):
    ano: int
    mes: int
    mesNome: str = ""
    meta: float = 0
    supermeta: float = 0
    hipermeta: float = 0
    dataAtualizacao: str = ""


class NotaFiscalEmitidaPayload(BaseModel):
    competencia: str = ""
    data_emissao: str = ""
    data_recebimento: str = ""
    numero_nf: str = ""
    serie: str = ""
    cliente: str = ""
    descricao: str = ""
    conta_destino: str = ""
    valor_nf: float = 0
    valor_recebido: float = 0
    status: str = "Pendente"
    observacao: str = ""


class NotaFiscalEmitidaResumo(BaseModel):
    id: int
    competencia: str = ""
    dataEmissao: str = ""
    dataRecebimento: str = ""
    numeroNf: str = ""
    serie: str = ""
    cliente: str = ""
    descricao: str = ""
    contaDestino: str = ""
    valorNf: str = ""
    valorRecebido: str = ""
    valorNfNumero: float = 0
    valorRecebidoNumero: float = 0
    diferenca: str = ""
    diferencaNumero: float = 0
    status: str = ""
    observacao: str = ""
    conciliado: bool = False
    criadoEm: str = ""
    atualizadoEm: str = ""


class DashboardIndicadorResposta(BaseModel):
    chave: str
    titulo: str
    valor: str
    detalhe: str = ""
    detalhamentos: list["DashboardIndicadorDetalheItemResposta"] = Field(default_factory=list)


class DashboardIndicadorDetalheItemResposta(BaseModel):
    titulo: str
    subtitulo: str = ""
    meta: str = ""
    valor: str = ""
    status: str = ""


class DashboardResumoHojeResposta(BaseModel):
    entradasConfirmadas: str
    saidasPrevistas: str
    saldoProjetado: str


class DashboardAgendaHojeItemResposta(BaseModel):
    horario: str = ""
    titulo: str = ""
    subtitulo: str = ""


class DashboardCalendarioPagamentoItemResposta(BaseModel):
    data: str = ""
    total: str = ""
    quantidade: int = 0
    pagamentos: list[ContaPagarResumo] = Field(default_factory=list)


class DashboardDevedorResumoItemResposta(BaseModel):
    recebivelId: int
    pacienteId: int | None = None
    nome: str
    vencimento: str = ""
    valor: str = ""
    observacao: str = ""
    status: str = ""


class DashboardVendaResumoItemResposta(BaseModel):
    contratoId: int
    pacienteId: int | None = None
    nome: str
    valor: str = ""
    formaPagamento: str = ""
    data: str = ""
    incluirTotalVendido: bool = True


class DashboardVendaInclusaoPayload(BaseModel):
    incluir: bool = True


class DashboardAlertaItemResposta(BaseModel):
    titulo: str
    detalhe: str


class DashboardAtividadeItemResposta(BaseModel):
    paciente: str
    evento: str
    valor: str
    status: str


class DashboardFunilResposta(BaseModel):
    leads: int = 0
    agendou: int = 0
    compareceu: int = 0
    fechou: int = 0
    resgates: int = 0
    resgatesSemOrcamento: int = 0
    resgatesOrcamentoAntigo: int = 0
    resgatesAte30Dias: int = 0
    resgatesMais30Dias: int = 0


class DashboardMetasResposta(BaseModel):
    vendidoMes: str
    vendidoAno: str
    metaMes: str
    supermetaMes: str
    hipermetaMes: str
    faltaMetaMes: str
    faltaMetaAno: str
    percentualMetaMes: float = 0
    percentualMetaAno: float = 0


class DashboardPainelResposta(BaseModel):
    indicadores: list[DashboardIndicadorResposta]
    meses: list[str]
    serieVendas: list[float]
    resumoHoje: DashboardResumoHojeResposta
    metas: DashboardMetasResposta
    funilReal: DashboardFunilResposta = Field(default_factory=DashboardFunilResposta)
    agendaHoje: list[DashboardAgendaHojeItemResposta]
    calendarioPagamentos: list[DashboardCalendarioPagamentoItemResposta] = []
    devedoresResumo: list[DashboardDevedorResumoItemResposta] = Field(default_factory=list)
    vendasResumo: list[DashboardVendaResumoItemResposta] = Field(default_factory=list)
    alertas: list[DashboardAlertaItemResposta]
    atividades: list[DashboardAtividadeItemResposta]


class ComissaoVendaItemResposta(BaseModel):
    contratoId: int
    pacienteId: int | None = None
    paciente: str
    dataFechamento: str
    valorContrato: float
    formaPagamento: str
    primeiroAgendamento: str = ""
    primeiroAgendador: str = ""
    avaliacaoComparecida: str = ""
    agendadorAvaliacao: str = ""
    agendadorFechamento: str = ""
    pagamentoConfirmado: bool = False
    comissaoTotal: float = 0
    comissaoCaptacao: float = 0
    comissaoResgate: float = 0
    status: str = ""


class ComissaoAvaliacaoItemResposta(BaseModel):
    agendamentoId: int
    pacienteId: int | None = None
    paciente: str
    data: str
    hora: str = ""
    status: str
    agendadoPor: str = ""
    agendadoEm: str = ""
    procedimentos: str = ""


class ComissaoRelatorioResposta(BaseModel):
    inicio: str
    fim: str
    vendas: list[ComissaoVendaItemResposta] = Field(default_factory=list)
    avaliacoes: list[ComissaoAvaliacaoItemResposta] = Field(default_factory=list)
    totalVendido: float = 0
    totalComissao: float = 0


class FichaPacienteResposta(BaseModel):
    paciente: PacienteDetalhe
    contratos: list[ContratoResumo]
    recebiveis: list[RecebivelResumo]
    financeiro: FinanceiroResumo
    agendamentos: list[AgendamentoResumo]
    proximoAgendamento: AgendamentoResumo | None = None
    documentos: list[ArquivoPacienteItem]
    exames: list[ArquivoPacienteItem]
    recibos: list[RecebivelResumo]
    crm: "CrmPacienteResumoResposta | None" = None


class CrmPacienteResumoResposta(BaseModel):
    crmId: int | None = None
    finalizado: bool = False
    cancelado: bool = False
    avaliacao: bool = False
    etapaFunil: str = ""
    campanha: str = ""
    canal: str = "Facebook"
    ultimaAvaliacaoEm: str = ""
    finalizadoEm: str = ""
    canceladoEm: str = ""


class CrmPacienteItemResposta(BaseModel):
    id: int
    pacienteId: int
    nome: str
    prontuario: str = ""
    telefone: str = ""
    origemFinalizado: bool = False
    origemCancelado: bool = False
    origemAvaliacao: bool = False
    etapaFunil: str = "Novo lead"
    canal: str = "Facebook"
    campanha: str = ""
    conjuntoAnuncio: str = ""
    anuncio: str = ""
    responsavel: str = ""
    proximoContato: str = ""
    observacao: str = ""
    ultimaInteracao: str = ""
    ultimaAvaliacaoEm: str = ""
    finalizadoEm: str = ""
    canceladoEm: str = ""
    atualizadoEm: str = ""


class CrmAvaliacaoItemResposta(BaseModel):
    pacienteId: int
    nome: str
    prontuario: str = ""
    telefone: str = ""
    dataAvaliacao: str = ""
    profissional: str = ""
    status: str = ""
    procedimento: str = ""
    jaNoCrm: bool = False
    origemAvaliacao: bool = False
    orcamentos: list[dict] = Field(default_factory=list)


class CrmPrimeiraAvaliacaoPerdidaItemResposta(BaseModel):
    pacienteId: int
    nome: str
    prontuario: str = ""
    telefone: str = ""
    dataAvaliacao: str = ""
    profissional: str = ""
    status: str = ""
    procedimento: str = ""
    motivo: str = ""
    usuario: str = ""


class CrmResgateHistoricoItemResposta(BaseModel):
    id: int
    status: str = ""
    observacao: str = ""
    proximoContato: str = ""
    criadoPor: str = ""
    criadoEm: str = ""
    automatico: bool = False


class CrmResgateItemResposta(BaseModel):
    crmId: int | None = None
    contratoId: int
    pacienteId: int
    nome: str
    cpf: str = ""
    idadeAtual: int | None = None
    prontuario: str = ""
    telefone: str = ""
    dataOrcamento: str = ""
    dataRetorno: str = ""
    statusResgate: str = ""
    observacaoContato: str = ""
    observacaoAvaliacao: str = ""
    observacaoOrcamento: str = ""
    valorTotal: str = ""
    procedimentos: list[str] = Field(default_factory=list)
    ultimoContatoEm: str = ""
    ultimoContatoPor: str = ""
    historico: list[CrmResgateHistoricoItemResposta] = Field(default_factory=list)


class CrmPainelResposta(BaseModel):
    pipeline: list[CrmPacienteItemResposta] = Field(default_factory=list)
    finalizados: list[CrmPacienteItemResposta] = Field(default_factory=list)
    cancelados: list[CrmPacienteItemResposta] = Field(default_factory=list)
    avaliacoes: list[CrmAvaliacaoItemResposta] = Field(default_factory=list)
    avaliacoesPrimeiraConsultaPerdida: list[CrmPrimeiraAvaliacaoPerdidaItemResposta] = Field(default_factory=list)
    resgates: list[CrmResgateItemResposta] = Field(default_factory=list)


class CrmConversaMensagemResposta(BaseModel):
    id: int
    conversaId: int
    canal: str = ""
    direcao: str = ""
    remetenteTipo: str = ""
    remetenteExternoId: str = ""
    tipoMensagem: str = "text"
    conteudo: str = ""
    midiaUrl: str = ""
    statusEnvio: str = ""
    erroEnvio: str = ""
    criadoEm: str = ""
    mensagemExternaId: str = ""


class CrmConversaResumoResposta(BaseModel):
    id: int
    crmId: int | None = None
    pacienteId: int | None = None
    pacienteNome: str = ""
    prontuario: str = ""
    canal: str = ""
    contatoNome: str = ""
    contatoTelefone: str = ""
    contatoInstagram: str = ""
    externoUsuarioId: str = ""
    externoConversaId: str = ""
    etapaFunil: str = "Novo lead"
    responsavel: str = ""
    ultimaMensagem: str = ""
    ultimaMensagemEm: str = ""
    ultimaMensagemSentido: str = ""
    naoLidas: int = 0
    status: str = "aberta"


class CrmConversaDetalheResposta(CrmConversaResumoResposta):
    mensagens: list[CrmConversaMensagemResposta] = Field(default_factory=list)


class CrmConversaEnvioPayload(BaseModel):
    conteudo: str


class MetaWebhookResposta(BaseModel):
    ok: bool = True
    eventosProcessados: int = 0


class MetaConfiguracaoResposta(BaseModel):
    webhookVerifyTokenConfigurado: bool = False
    appSecretConfigurado: bool = False
    whatsappPhoneNumberIdConfigurado: bool = False
    whatsappAccessTokenConfigurado: bool = False


class CrmAtualizacaoPayload(BaseModel):
    etapa_funil: str = ""
    canal: str = "Facebook"
    campanha: str = ""
    conjunto_anuncio: str = ""
    anuncio: str = ""
    responsavel: str = ""
    proximo_contato: str = ""
    observacao: str = ""
    ultima_interacao: str = ""


class CrmResgateAtualizacaoPayload(BaseModel):
    status: str = ""
    observacao: str = ""
    proximo_contato: str = ""


class CrmResgateHistoricoPayload(BaseModel):
    data_retorno_crm: str = ""


class CrmNovoLeadPayload(BaseModel):
    nome: str
    telefone: str = ""


class OdontogramaResposta(BaseModel):
    dentes_contratados: list[int] = Field(default_factory=list)
    elementos: list[dict] = Field(default_factory=list)


class OrcamentoRegiaoPayload(BaseModel):
    regiao: str
    dente: int | None = None
    valor: float = 0
    ativo: bool = True
    faces: list[str] = Field(default_factory=list)


class OrcamentoItemPayload(BaseModel):
    procedimento: str
    profissional: str = ""
    denticao: str = ""
    valor_unitario: float = 0
    regioes: list[OrcamentoRegiaoPayload] = Field(default_factory=list)


class ParcelaPagamentoPayload(BaseModel):
    indice: int = 0
    descricao: str = ""
    data: str = ""
    forma: str = ""
    valor: float = 0
    parcelas_cartao: int = 1


class OrcamentoPacientePayload(BaseModel):
    clinica: str = ""
    criado_por: str = ""
    data: str = ""
    observacoes: str = ""
    nova_observacao: str = ""
    tabela: str = ""
    desconto_percentual: float = 0
    desconto_valor: float = 0
    validade_orcamento: str = ""
    data_retorno_crm: str = ""
    forma_pagamento: str = ""
    parcelas: int = 1
    entrada: bool = False
    plano_pagamento: list[ParcelaPagamentoPayload] = Field(default_factory=list)
    itens: list[OrcamentoItemPayload] = Field(default_factory=list)


class OrcamentoCriadoResposta(BaseModel):
    contrato_id: int


class OrcamentoStatusPayload(BaseModel):
    status: str
    aprovado_por: str = ""
    tipo_reaprovacao: str = ""
    valor_acrescimo: float = 0


class OrcamentoHistoricoItemResposta(BaseModel):
    id: int
    tipo: str = ""
    observacao: str = ""
    criadoPor: str = ""
    criadoEm: str = ""


class OrcamentoDetalheResposta(BaseModel):
    contrato_id: int
    status: str = "EM_ABERTO"
    aprovadoPor: str = ""
    dataAprovacao: str = ""
    clinica: str = ""
    criadoPor: str = ""
    data: str = ""
    observacoes: str = ""
    tabela: str = ""
    descontoPercentual: float = 0
    descontoValor: float = 0
    validadeOrcamento: str = ""
    dataRetornoCrm: str = ""
    formaPagamento: str = ""
    parcelas: int = 1
    entrada: bool = False
    planoPagamento: list[ParcelaPagamentoPayload] = Field(default_factory=list)
    itens: list[OrcamentoItemPayload] = Field(default_factory=list)
    historico: list[OrcamentoHistoricoItemResposta] = Field(default_factory=list)
    crmStatus: str = ""
    crmObservacaoContato: str = ""
    crmUltimoContatoEm: str = ""
    crmUltimoContatoPor: str = ""
    crmHistorico: list[CrmResgateHistoricoItemResposta] = Field(default_factory=list)


class ProcedimentoResumoResposta(BaseModel):
    id: int
    nome: str
    categoria: str = ""
    valorPadrao: float = 0
    duracaoPadraoMinutos: int = 60
    descricao: str = ""
    etapasPadrao: list[str] = Field(default_factory=list)
    materiaisPadrao: list[str] = Field(default_factory=list)
    ativo: bool = True


class ProcedimentoPayload(BaseModel):
    nome: str = ""
    categoria: str = ""
    valor_padrao: float = 0
    duracao_padrao_minutos: int = 60
    descricao: str = ""
    etapas_padrao: list[str] = Field(default_factory=list)
    materiais_padrao: list[str] = Field(default_factory=list)
    ativo: bool = True


class OrdemServicoEtapaPayload(BaseModel):
    etapa: str = ""
    descricao_outro: str = ""


class OrdemServicoPayload(BaseModel):
    procedimento_id: int = 0
    procedimento_nome: str = ""
    material: str = ""
    material_outro: str = ""
    cor: str = ""
    escala: str = ""
    elemento_arcada: str = ""
    carga_imediata: bool = False
    retorno_solicitado: str = ""
    observacao: str = ""
    etapas: list[OrdemServicoEtapaPayload] = Field(default_factory=list)


class OrdemServicoResumoResposta(BaseModel):
    id: int
    procedimentoId: int | None = None
    procedimentoNome: str = ""
    material: str = ""
    materialOutro: str = ""
    cor: str = ""
    escala: str = ""
    elementoArcada: str = ""
    cargaImediata: bool = False
    retornoSolicitado: str = ""
    documentoNome: str = ""
    observacao: str = ""
    criadoPor: str = ""
    criadoEm: str = ""
    etapas: list[OrdemServicoEtapaPayload] = Field(default_factory=list)
    pacienteId: int | None = None
    pacienteNome: str = ""
    prontuario: str = ""
    status: str = "Emitida"
    laboratorioId: int | None = None
    laboratorioNome: str = ""
    statusAtualizadoPor: str = ""
    statusAtualizadoEm: str = ""
    movimentacoes: list[dict] = Field(default_factory=list)


class GuiaMovimentacaoPayload(BaseModel):
    status: str = ""
    laboratorio_id: int = 0
    observacao: str = ""


class GuiaLaboratorioPayload(BaseModel):
    nome: str = ""
    ativo: bool = True


class GuiaLaboratorioResposta(BaseModel):
    id: int
    nome: str
    ativo: bool


class LoginPayload(BaseModel):
    usuario: str = ""
    senha: str = ""


class TrocaSenhaPayload(BaseModel):
    usuario: str = ""
    senha_atual: str = ""
    nova_senha: str = ""


class UsuarioAtualizacaoPayload(BaseModel):
    nome: str = ""
    nome_agenda: str = ""
    cargo: str = ""
    agenda_escopo: str = ""
    agenda_disponivel: bool | None = None
    atividades_acesso: bool | None = None
    atividades_agenda_disponivel: bool | None = None
    atividades_escopo: str = ""
    perfil: str = ""
    usuario: str = ""
    ativo: bool | None = None
    modulos: dict[str, str] = Field(default_factory=dict)
    pacientes_abas: dict[str, str] = Field(default_factory=dict)


class UsuarioCriacaoPayload(BaseModel):
    nome: str = ""
    nome_agenda: str = ""
    cargo: str = ""
    agenda_escopo: str = ""
    agenda_disponivel: bool | None = None
    atividades_acesso: bool | None = None
    atividades_agenda_disponivel: bool | None = None
    atividades_escopo: str = "PROPRIAS"
    perfil: str = ""
    ativo: bool | None = True
    modulos: dict[str, str] = Field(default_factory=dict)
    pacientes_abas: dict[str, str] = Field(default_factory=dict)


class UsuarioAtividadesPayload(BaseModel):
    atividades_acesso: bool
    atividades_agenda_disponivel: bool
    atividades_escopo: str = "PROPRIAS"


class AlunoPayload(BaseModel):
    nome: str
    cpf: str = ""
    telefone: str = ""
    email: str = ""
    observacoes: str = ""
    ativo: bool = True


class TreinamentoPayload(BaseModel):
    nome: str
    categoria: str = ""
    descricao: str = ""
    carga_horaria: float = 0
    valor: float = 0
    ativo: bool = True


class TurmaTreinamentoPayload(BaseModel):
    treinamento_id: int
    nome: str
    instrutor: str = ""
    data_inicio: str = ""
    data_fim: str = ""
    horario: str = ""
    local: str = ""
    vagas: int = 0
    status: str = "Turma confirmada"


class MatriculaTreinamentoPayload(BaseModel):
    aluno_id: int
    turma_id: int
    data_matricula: str = ""
    status: str = "Matriculado"
    observacoes: str = ""


class UsuarioResumoResposta(BaseModel):
    id: int
    nome: str
    usuario: str
    nomeAgenda: str = ""
    perfil: str
    cargo: str = ""
    agendaEscopo: str = ""
    agendaDisponivel: bool = False
    atividadesAcesso: bool = False
    atividadesAgendaDisponivel: bool = False
    atividadesEscopo: str = "PROPRIAS"
    status: str = "Ativo"
    ultimoAcesso: str = "-"
    modulos: dict[str, str] = Field(default_factory=dict)
    pacientesAbas: dict[str, str] = Field(default_factory=dict)


class LoginResposta(BaseModel):
    id: int
    nome: str
    usuario: str
    perfil: str
    cargo: str = ""
    agendaEscopo: str = ""
    agendaDisponivel: bool = False
    atividadesAcesso: bool = False
    atividadesAgendaDisponivel: bool = False
    atividadesEscopo: str = "PROPRIAS"
    nomeAgenda: str = ""
    modulos: dict[str, str] = Field(default_factory=dict)
    pacientesAbas: dict[str, str] = Field(default_factory=dict)
    precisaTrocarSenha: bool = False


class ChecklistUsuarioItemPayload(BaseModel):
    titulo: str
    descricao: str = ""
    tipo_meta: str = "manual"
    meta_diaria: int = 1
    ativo: bool = True


class AgendaAtividadePayload(BaseModel):
    titulo: str
    descricao: str = ""
    responsavel_id: int = 0
    responsaveis_ids: list[int] = Field(default_factory=list)
    data_atividade: str
    hora_inicio: str = ""
    hora_fim: str = ""
    prioridade: str = "Normal"
    status: str = "Pendente"
    cor: str = "#c7aa78"
    secreta: bool = False
    repeticao: str = "NENHUMA"
    repetir_ate: str = ""


class ResponsavelAtividadeResposta(BaseModel):
    id: int
    nome: str
    cor: str = ""


class ResponsavelAtividadeCorPayload(BaseModel):
    cor: str


class AgendaAtividadeResposta(BaseModel):
    id: int
    titulo: str
    descricao: str = ""
    responsavelId: int
    responsavelNome: str
    responsaveisIds: list[int] = Field(default_factory=list)
    responsaveisNomes: list[str] = Field(default_factory=list)
    dataAtividade: str
    horaInicio: str = ""
    horaFim: str = ""
    prioridade: str = "Normal"
    status: str = "Pendente"
    criadoPor: str = ""
    criadoEm: str = ""
    atualizadoPor: str = ""
    atualizadoEm: str = ""
    concluidaEm: str = ""
    cor: str = "#c7aa78"
    secreta: bool = False
    confirmacoesLeitura: list[dict] = Field(default_factory=list)


class AtividadeNotificacaoResposta(BaseModel):
    id: int
    atividadeId: int | None = None
    tipo: str
    mensagem: str
    lida: bool = False
    criadoEm: str = ""
    dataAtividade: str = ""


class PlanoTratamentoPassoPayload(BaseModel):
    titulo: str = ""
    status: str = "Pendente"
    data_prevista: str = ""
    data_realizacao: str = ""
    observacao: str = ""


class PlanoTratamentoProcedimentoPayload(BaseModel):
    procedimento_id: int = 0
    procedimento_nome: str = ""
    observacao: str = ""
    incluir_passos_padrao: bool = True


class PlanoTratamentoStatusPayload(BaseModel):
    status: str = ""
    observacao: str | None = None


class PlanoTratamentoPassoResposta(BaseModel):
    id: int
    titulo: str
    ordem: int = 1
    status: str = "Pendente"
    dataPrevista: str = ""
    dataRealizacao: str = ""
    observacao: str = ""


class PlanoTratamentoProcedimentoResposta(BaseModel):
    id: int
    procedimentoId: int | None = None
    nome: str
    contratoId: int | None = None
    origem: str = "Manual"
    status: str = "Planejado"
    observacao: str = ""
    passos: list[PlanoTratamentoPassoResposta] = Field(default_factory=list)


class ChecklistUsuarioItemAtualizacaoPayload(BaseModel):
    titulo: str = ""
    descricao: str = ""
    tipo_meta: str = ""
    meta_diaria: int = 0
    ativo: bool | None = None
    ordem: int | None = None


class ChecklistUsuarioRegistroPayload(BaseModel):
    progresso_manual: int | None = None
    concluido_manual: bool | None = None


class ChecklistUsuarioItemResposta(BaseModel):
    id: int
    titulo: str
    descricao: str = ""
    tipoMeta: str = "manual"
    metaDiaria: int = 1
    progressoAtual: int = 0
    progressoManual: int = 0
    progressoAutomatico: int = 0
    concluido: bool = False
    concluidoManual: bool = False
    ativo: bool = True
    ordem: int = 0
    atualizadoEm: str = ""


class ChecklistUsuarioResumoResposta(BaseModel):
    total: int = 0
    concluidos: int = 0
    pendentes: int = 0
    progressoPercentual: int = 0


class ChecklistUsuarioPainelResposta(BaseModel):
    dataReferencia: str
    itens: list[ChecklistUsuarioItemResposta] = Field(default_factory=list)
    resumo: ChecklistUsuarioResumoResposta = Field(default_factory=ChecklistUsuarioResumoResposta)
    tiposAutomaticos: list[dict[str, str]] = Field(default_factory=list)


# `app` foi criado antes das rotas do modulo de Educacao.

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def proteger_portal_educacao(request: Request, call_next):
    rota = request.url.path
    if request.method.upper() != "OPTIONS" and rota.startswith("/api/educacao/") and rota != "/api/educacao/auth/login":
        authorization = str(request.headers.get("authorization") or "")
        token = str(request.headers.get("x-educacao-token") or "").strip()
        if not token and authorization.lower().startswith("bearer "):
            token = authorization[7:].strip()
        if not token:
            return Response(content=json.dumps({"detail": "Acesso ao portal de educação não autorizado."}), status_code=401, media_type="application/json")
        conn = conectar()
        try:
            sessao = conn.execute("SELECT s.token,u.perfil,u.permissoes_json,u.precisa_trocar_senha FROM sessoes_educacao s JOIN usuarios_educacao u ON u.id=s.usuario_id WHERE s.token=? AND s.expira_em>? AND u.ativo=1", (token, datetime.now().isoformat())).fetchone()
        finally:
            conn.close()
        if sessao is None:
            return Response(content=json.dumps({"detail": "Sessão do portal de educação expirada."}), status_code=401, media_type="application/json")
        if bool(sessao["precisa_trocar_senha"]) and rota!="/api/educacao/auth/trocar-senha":
            return Response(content=json.dumps({"detail":"Redefina sua senha antes de continuar."}),status_code=403,media_type="application/json")
        if str(sessao["perfil"] or "").upper()!="ADMINISTRADOR":
            if rota.startswith("/api/educacao/alunos-excluidos") or rota.startswith("/api/educacao/pacientes-modelo-excluidos"):
                return Response(content=json.dumps({"detail":"A lista de cadastros excluídos é restrita aos Administradores."}),status_code=403,media_type="application/json")
            permissoes=json.loads(sessao["permissoes_json"] or "{}")
            mapa=[("/api/educacao/alunos","Alunos","Cadastro"),("/api/educacao/treinamentos","Treinamentos","Treinamentos"),("/api/educacao/turmas","Treinamentos","Turmas"),("/api/educacao/matriculas","Treinamentos","Matrículas"),("/api/educacao/pacientes-modelo","Pacientes","Cadastro"),("/api/educacao/orcamentos","Orçamentos","Gerenciar orçamentos"),("/api/educacao/guias","Guias","Guias"),("/api/educacao/agenda","Agenda","Agenda"),("/api/educacao/financeiro","Financeiro","Movimentações"),("/api/educacao/procedimentos","Financeiro","Tabela de preços")]
            negado=rota.startswith("/api/educacao/usuarios")
            for prefixo,modulo,subfuncao in mapa:
                if not rota.startswith(prefixo): continue
                legado=permissoes.get(modulo,True);nivel=permissoes.get(f"{modulo}.{subfuncao}","edit" if legado is not False else "none")
                if nivel in {False,"none",None} or (request.method.upper() not in {"GET","HEAD"} and nivel!="edit"): negado=True
                break
            if negado:return Response(content=json.dumps({"detail":"Você não possui permissão para esta operação."}),status_code=403,media_type="application/json")
    return await call_next(request)


@app.on_event("startup")
def startup_event() -> None:
    inicializar_banco()
    garantir_colunas_pacientes_api()


def usuario_request(request: Request) -> str:
    return str(request.headers.get("x-usuario") or "").strip()


USUARIOS_AUTORIZADOS_BLOQUEIO_TRATAMENTO = {"juliana", "eliane"}


def validar_perfil_administrador(request: Request, *, acao: str) -> str:
    usuario = usuario_request(request)
    if not usuario:
        raise HTTPException(status_code=401, detail="Usuario nao autenticado.")
    conn = conectar()
    try:
        usuario_row = buscar_usuario_por_identificador(conn, usuario)
    finally:
        conn.close()
    perfil = normalizar_texto(str(usuario_row["perfil"] or "")) if usuario_row is not None else ""
    if perfil != "administrador":
        raise HTTPException(status_code=403, detail=f"Somente o perfil Administrador pode {acao}.")
    return str(usuario_row["usuario"] or usuario).strip()


def validar_senha_administrativa_clinica(conn: sqlite3.Connection, senha: str) -> None:
    senha_informada = str(senha or "")
    administradores = conn.execute(
        "SELECT senha_hash FROM usuarios WHERE ativo=1 AND lower(COALESCE(perfil, ''))='administrador'"
    ).fetchall()
    if not senha_informada or not any(verificar_senha(senha_informada, row["senha_hash"]) for row in administradores):
        raise HTTPException(status_code=403, detail="Informe uma senha administrativa válida para alterar dados retroativos.")


def data_financeira_retroativa(valor: object) -> bool:
    data_valor = parse_data_contrato(str(valor or ""))
    return bool(data_valor and data_valor < agora_local().date())


def validar_usuario_aprovacao_orcamento(request: Request) -> str:
    return validar_perfil_administrador(request, acao="aprovar ou desaprovar orcamentos")


def validar_usuario_bloqueio_tratamento(request: Request) -> str:
    usuario = usuario_request(request)
    usuario_normalizado = normalizar_texto(usuario).replace(" ", "")
    if usuario_normalizado not in USUARIOS_AUTORIZADOS_BLOQUEIO_TRATAMENTO:
        raise HTTPException(status_code=403, detail="Somente Juliana e Eliane podem suspender ou liberar tratamentos.")
    return usuario


def mapear_acao_http(method: str) -> str:
    metodo = (method or "").upper()
    if metodo == "POST":
        return "Criacao"
    if metodo in {"PUT", "PATCH"}:
        return "Edicao"
    if metodo == "DELETE":
        return "Exclusao"
    return metodo.title()


def mapear_tipo_rota(path: str) -> str:
    rota = normalizar_texto(path)
    if "agenda" in rota:
        return "Agendamento"
    if "orcamento" in rota or "contrato" in rota:
        return "Plano de Tratamento"
    if "recebivel" in rota:
        return "Parcela"
    if "caixa" in rota:
        return "Caixa"
    if "contas_pagar" in rota or "contas-pagar" in rota:
        return "Conta a Pagar"
    if "paciente" in rota:
        return "Paciente"
    if "usuario" in rota:
        return "Usuario"
    return "Sistema"


def extrair_info_acao(payload: object) -> str:
    if isinstance(payload, dict):
      for chave in ("paciente_nome", "pacienteNome", "nomePaciente", "nome", "descricao", "fornecedor", "procedimento", "titulo"):
        valor = payload.get(chave)
        if str(valor or "").strip():
          return str(valor).strip()
      if "itens" in payload and isinstance(payload.get("itens"), list) and payload["itens"]:
        primeiro = payload["itens"][0]
        if isinstance(primeiro, dict):
          for chave in ("procedimento", "nome"):
            valor = primeiro.get(chave)
            if str(valor or "").strip():
              return str(valor).strip()
    return ""


def registrar_acao_usuario(
    usuario: str,
    *,
    acao: str,
    tipo: str,
    info: str = "",
    metodo_http: str = "",
    rota: str = "",
) -> None:
    usuario_limpo = str(usuario or "").strip()
    if not usuario_limpo:
        return
    conn = conectar()
    try:
        usuario_row = conn.execute(
            "SELECT id FROM usuarios WHERE lower(usuario)=lower(?) OR lower(nome)=lower(?) LIMIT 1",
            (usuario_limpo, usuario_limpo),
        ).fetchone()
        conn.execute(
            """
            INSERT INTO acoes_usuario (usuario_id, usuario, acao, tipo, info, metodo_http, rota, data_hora)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(usuario_row["id"]) if usuario_row else None,
                usuario_limpo.upper(),
                str(acao or "").strip() or "Edicao",
                str(tipo or "").strip() or "Sistema",
                str(info or "").strip(),
                str(metodo_http or "").strip().upper(),
                str(rota or "").strip(),
                agora_str(),
            ),
        )
        conn.commit()
    finally:
        conn.close()


def bytes_relatorio_acoes_por_dia(data_referencia: str) -> bytes:
    if Workbook is None:
        raise HTTPException(status_code=500, detail="openpyxl nao disponivel")
    data_alvo = parse_data_contrato(data_referencia) or date.today()
    data_br = formatar_data_br(data_alvo)
    conn = conectar()
    try:
        rows = conn.execute(
            """
            SELECT data_hora, acao, tipo, info, usuario
            FROM acoes_usuario
            WHERE substr(COALESCE(data_hora, ''), 1, 10)=?
            ORDER BY COALESCE(data_hora, '') DESC, id DESC
            """,
            (data_alvo.isoformat(),),
        ).fetchall()
    finally:
        conn.close()

    wb = Workbook()
    ws = wb.active
    ws.title = "Relatorio"
    ws.append(["Data", "Hora", "Acao", "Tipo", "Info", "Usuario"])
    for row in rows:
        data_hora = parse_data_contrato(row["data_hora"])
        data_txt = formatar_data_br(data_hora)
        hora_txt = ""
        texto_data_hora = str(row["data_hora"] or "").strip()
        if " " in texto_data_hora:
            hora_txt = texto_data_hora.split(" ", 1)[1][:5]
        ws.append([
            data_txt or data_br,
            hora_txt,
            str(row["acao"] or ""),
            str(row["tipo"] or ""),
            str(row["info"] or ""),
            str(row["usuario"] or ""),
        ])
    largura = {"A": 14, "B": 10, "C": 16, "D": 24, "E": 42, "F": 20}
    for coluna, valor in largura.items():
        ws.column_dimensions[coluna].width = valor
    buffer = BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


@app.middleware("http")
async def auditoria_middleware(request: Request, call_next):
    body_bytes = await request.body()

    async def receive():
        return {"type": "http.request", "body": body_bytes, "more_body": False}

    payload_dict: dict[str, object] = {}
    if body_bytes:
        try:
            payload_dict = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            payload_dict = {}

    rota = request.url.path
    metodo = request.method.upper()
    rota_financeira_mutavel = (
        rota.startswith("/api/financeiro/")
        or (rota.startswith("/api/pacientes/") and "/recebiveis/" in rota)
    )
    if metodo in {"POST", "PUT", "PATCH", "DELETE"} and rota_financeira_mutavel:
        validar_perfil_administrador(request, acao="realizar movimentacoes financeiras")

    response = await call_next(Request(request.scope, receive))

    deve_pular_agenda = rota.startswith("/api/agenda/agendamentos")
    if rota.startswith("/api/") and request.method.upper() in {"POST", "PUT", "PATCH", "DELETE"} and response.status_code < 500 and not deve_pular_agenda:
        usuario = usuario_request(request)
        if usuario and not rota.startswith("/api/auth/"):
            registrar_acao_usuario(
                usuario,
                acao=mapear_acao_http(request.method),
                tipo=mapear_tipo_rota(rota),
                info=extrair_info_acao(payload_dict),
                metodo_http=request.method,
                rota=rota,
            )
    return response


def detalhar_usuario_login(usuario_row: sqlite3.Row) -> LoginResposta:
    cargo = str(usuario_row["cargo"] or "Profissional")
    perfil = str(usuario_row["perfil"] or "Usuario")
    modulos_padrao, abas_padrao, _ = permissoes_padrao_backend(cargo, perfil)
    return LoginResposta(
        id=int(usuario_row["id"]),
        nome=str(usuario_row["nome"] or ""),
        usuario=str(usuario_row["usuario"] or ""),
        perfil=perfil,
        cargo=cargo,
        agendaEscopo=str(usuario_row["agenda_escopo"] or ""),
        agendaDisponivel=bool(int(usuario_row["agenda_disponivel"] or 0)),
        atividadesAcesso=bool(int(usuario_row["atividades_acesso"] or 0)),
        atividadesAgendaDisponivel=bool(int(usuario_row["atividades_agenda_disponivel"] or 0)),
        atividadesEscopo=str(usuario_row["atividades_escopo"] or "PROPRIAS"),
        nomeAgenda=str(usuario_row["nome_agenda"] or usuario_row["nome"] or "").upper(),
        modulos=json_dict_seguro(usuario_row["modulos_json"], modulos_padrao),
        pacientesAbas=json_dict_seguro(usuario_row["pacientes_abas_json"], abas_padrao),
        precisaTrocarSenha=bool(int(usuario_row["precisa_trocar_senha"] or 0)),
    )


MODULOS_USUARIOS = ["Dashboard", "Pacientes", "Guias", "Agenda", "CRM", "Financeiro", "Educacao", "Tabelas", "Usuarios"]
ABAS_PACIENTES_USUARIOS = ["Cadastro", "Orcamentos", "Financeiro", "Documentos", "Plano e Ficha Clinica", "Odontograma", "Agendamentos"]
CHECKLIST_TIPOS_AUTOMATICOS = {
    "crm_contatos": "Contatos salvos no CRM",
    "crm_agendou_avaliacao": "Leads movidos para Agendou avaliação",
    "crm_avaliacao_enviada": "Avaliações levadas ao CRM",
}


def permissoes_padrao_backend(cargo: str, perfil: str) -> tuple[dict[str, str], dict[str, str], str]:
    cargo_limpo = corrigir_texto_importado(str(cargo or "").strip()) or "Profissional"
    perfil_limpo = corrigir_texto_importado(str(perfil or "").strip()) or "Usuario"
    modulos = {modulo: "Sem acesso" for modulo in MODULOS_USUARIOS}
    pacientes_abas = {aba: "Sem acesso" for aba in ABAS_PACIENTES_USUARIOS}
    agenda_escopo = "TODA_CLINICA"

    if perfil_limpo == "Administrador" or cargo_limpo == "Administrador":
        modulos = {modulo: "Edicao" for modulo in MODULOS_USUARIOS}
        pacientes_abas = {aba: "Edicao" for aba in ABAS_PACIENTES_USUARIOS}
        agenda_escopo = "TODA_CLINICA"
    elif cargo_limpo == "Profissional":
        modulos["Pacientes"] = "Edicao"
        modulos["Guias"] = "Edicao"
        modulos["Agenda"] = "Visualizacao"
        pacientes_abas["Documentos"] = "Edicao"
        pacientes_abas["Plano e Ficha Clinica"] = "Visualizacao"
        pacientes_abas["Odontograma"] = "Visualizacao"
        pacientes_abas["Agendamentos"] = "Visualizacao"
        agenda_escopo = "SOMENTE_PROPRIA"
    else:
        modulos["Dashboard"] = "Visualizacao"
        modulos["Pacientes"] = "Edicao"
        modulos["Guias"] = "Edicao"
        modulos["Agenda"] = "Edicao"
        modulos["CRM"] = "Edicao"
        modulos["Financeiro"] = "Visualizacao"
        pacientes_abas["Cadastro"] = "Edicao"
        pacientes_abas["Orcamentos"] = "Visualizacao"
        pacientes_abas["Financeiro"] = "Visualizacao"
        pacientes_abas["Documentos"] = "Visualizacao"
        pacientes_abas["Agendamentos"] = "Edicao"
        agenda_escopo = "TODA_CLINICA"

    return modulos, pacientes_abas, agenda_escopo


def data_hoje_iso() -> str:
    return agora_local().date().isoformat()


def buscar_usuario_por_identificador(conn: sqlite3.Connection, identificador: str) -> sqlite3.Row | None:
    texto = str(identificador or "").strip()
    if not texto:
        return None
    return conn.execute(
        "SELECT * FROM usuarios WHERE lower(usuario)=lower(?) OR lower(nome)=lower(?) LIMIT 1",
        (texto, texto),
    ).fetchone()


def usuario_logado_row(conn: sqlite3.Connection, request: Request) -> sqlite3.Row:
    usuario = usuario_request(request)
    row = buscar_usuario_por_identificador(conn, usuario)
    if row is None:
        raise HTTPException(status_code=401, detail="Usuario nao identificado para o checklist.")
    return row


def contar_progresso_automatico_checklist(
    conn: sqlite3.Connection,
    *,
    usuario_row: sqlite3.Row,
    tipo_meta: str,
    data_referencia: str,
) -> int:
    usuario_id = int(usuario_row["id"])
    usuario_nome = str(usuario_row["usuario"] or usuario_row["nome"] or "").strip()
    tipo_limpo = str(tipo_meta or "manual").strip().lower()
    if tipo_limpo == "crm_contatos":
        row = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM acoes_usuario
            WHERE usuario_id=?
              AND substr(COALESCE(data_hora, ''), 1, 10)=?
              AND COALESCE(acao, '')='CRM'
              AND COALESCE(tipo, '')='Atualização do funil'
            """,
            (usuario_id, data_referencia),
        ).fetchone()
        return int(row["total"] or 0) if row else 0
    if tipo_limpo == "crm_agendou_avaliacao":
        row = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM crm_pacientes
            WHERE substr(COALESCE(atualizado_em, ''), 1, 10)=?
              AND lower(COALESCE(atualizado_por, ''))=lower(?)
              AND COALESCE(etapa_funil, '')='Agendou avaliação'
            """,
            (data_referencia, usuario_nome),
        ).fetchone()
        return int(row["total"] or 0) if row else 0
    if tipo_limpo == "crm_avaliacao_enviada":
        row = conn.execute(
            """
            SELECT COUNT(*) AS total
            FROM acoes_usuario
            WHERE usuario_id=?
              AND substr(COALESCE(data_hora, ''), 1, 10)=?
              AND COALESCE(rota, '') LIKE '/api/crm/pacientes/%/avaliacao'
            """,
            (usuario_id, data_referencia),
        ).fetchone()
        return int(row["total"] or 0) if row else 0
    return 0


def montar_item_checklist_usuario(
    conn: sqlite3.Connection,
    row: sqlite3.Row,
    *,
    usuario_row: sqlite3.Row,
    data_referencia: str,
) -> ChecklistUsuarioItemResposta:
    tipo_meta = str(row["tipo_meta"] or "manual").strip().lower() or "manual"
    registro = conn.execute(
        """
        SELECT progresso_manual, concluido_manual, atualizado_em
        FROM checklist_usuario_registros
        WHERE checklist_id=? AND data_referencia=?
        LIMIT 1
        """,
        (int(row["id"]), data_referencia),
    ).fetchone()
    progresso_manual = int(registro["progresso_manual"] or 0) if registro else 0
    concluido_manual = bool(int(registro["concluido_manual"] or 0)) if registro else False
    progresso_automatico = contar_progresso_automatico_checklist(
        conn,
        usuario_row=usuario_row,
        tipo_meta=tipo_meta,
        data_referencia=data_referencia,
    )
    meta_diaria = max(int(row["meta_diaria"] or 1), 1)
    progresso_atual = progresso_manual if tipo_meta == "manual" else progresso_automatico
    concluido = concluido_manual if tipo_meta == "manual" else progresso_atual >= meta_diaria
    atualizado_em = str((registro["atualizado_em"] if registro else row["atualizado_em"]) or "")
    return ChecklistUsuarioItemResposta(
        id=int(row["id"]),
        titulo=str(row["titulo"] or "").strip(),
        descricao=str(row["descricao"] or "").strip(),
        tipoMeta=tipo_meta,
        metaDiaria=meta_diaria,
        progressoAtual=max(progresso_atual, 0),
        progressoManual=max(progresso_manual, 0),
        progressoAutomatico=max(progresso_automatico, 0),
        concluido=concluido,
        concluidoManual=concluido_manual,
        ativo=bool(int(row["ativo"] or 0)),
        ordem=int(row["ordem"] or 0),
        atualizadoEm=atualizado_em,
    )


def carregar_painel_checklist_usuario(
    conn: sqlite3.Connection,
    *,
    usuario_row: sqlite3.Row,
    data_referencia: str,
) -> ChecklistUsuarioPainelResposta:
    rows = conn.execute(
        """
        SELECT *
        FROM checklist_usuario_itens
        WHERE usuario_id=? AND COALESCE(ativo, 1)=1
        ORDER BY COALESCE(ordem, 0), id
        """,
        (int(usuario_row["id"]),),
    ).fetchall()
    itens = [montar_item_checklist_usuario(conn, row, usuario_row=usuario_row, data_referencia=data_referencia) for row in rows]
    total = len(itens)
    concluidos = len([item for item in itens if item.concluido])
    pendentes = max(total - concluidos, 0)
    percentual = int(round((concluidos / total) * 100)) if total else 0
    return ChecklistUsuarioPainelResposta(
        dataReferencia=data_referencia,
        itens=itens,
        resumo=ChecklistUsuarioResumoResposta(
            total=total,
            concluidos=concluidos,
            pendentes=pendentes,
            progressoPercentual=percentual,
        ),
        tiposAutomaticos=[
            {"id": "manual", "label": "Manual"},
            *[
                {"id": chave, "label": valor}
                for chave, valor in CHECKLIST_TIPOS_AUTOMATICOS.items()
            ],
        ],
    )


def json_dict_seguro(texto: object, padrao: dict[str, str]) -> dict[str, str]:
    bruto = str(texto or "").strip()
    if not bruto:
        return dict(padrao)
    try:
        valor = json.loads(bruto)
        if isinstance(valor, dict):
            return {str(chave): str(item) for chave, item in valor.items()}
    except Exception:
        pass
    return dict(padrao)


def lista_json_segura(texto: object) -> list[str]:
    try:
        valor = json.loads(str(texto or "[]"))
        if isinstance(valor, list):
            return [str(item).strip() for item in valor if str(item).strip()]
    except Exception:
        pass
    return []


def normalizar_payload_permissoes(
    cargo: str,
    perfil: str,
    modulos_payload: dict[str, str] | None,
    pacientes_abas_payload: dict[str, str] | None,
) -> tuple[dict[str, str], dict[str, str], str]:
    modulos_padrao, abas_padrao, agenda_padrao = permissoes_padrao_backend(cargo, perfil)
    modulos = dict(modulos_padrao)
    for modulo, nivel in (modulos_payload or {}).items():
        if modulo in modulos and str(nivel or "").strip():
            modulos[modulo] = str(nivel)
    abas = dict(abas_padrao)
    for aba, nivel in (pacientes_abas_payload or {}).items():
        if aba in abas and str(nivel or "").strip():
            abas[aba] = str(nivel)
    return modulos, abas, agenda_padrao


def mapear_usuario_resumo(usuario_row: sqlite3.Row) -> UsuarioResumoResposta:
    cargo = str(usuario_row["cargo"] or "Profissional")
    perfil = str(usuario_row["perfil"] or "Usuario")
    modulos_padrao, abas_padrao, _ = permissoes_padrao_backend(cargo, perfil)
    return UsuarioResumoResposta(
        id=int(usuario_row["id"]),
        nome=str(usuario_row["nome"] or ""),
        usuario=str(usuario_row["usuario"] or ""),
        nomeAgenda=str(usuario_row["nome_agenda"] or usuario_row["nome"] or "").upper(),
        perfil=perfil,
        cargo=cargo,
        agendaEscopo=str(usuario_row["agenda_escopo"] or ""),
        agendaDisponivel=bool(int(usuario_row["agenda_disponivel"] or 0)),
        atividadesAcesso=bool(int(usuario_row["atividades_acesso"] or 0)),
        atividadesAgendaDisponivel=bool(int(usuario_row["atividades_agenda_disponivel"] or 0)),
        atividadesEscopo=str(usuario_row["atividades_escopo"] or "PROPRIAS"),
        status="Ativo" if bool(int(usuario_row["ativo"] or 0)) else "Inativo",
        ultimoAcesso=str(usuario_row["ultimo_login"] or "-"),
        modulos=json_dict_seguro(usuario_row["modulos_json"], modulos_padrao),
        pacientesAbas=json_dict_seguro(usuario_row["pacientes_abas_json"], abas_padrao),
    )


def mapear_procedimento_resumo(row: sqlite3.Row) -> ProcedimentoResumoResposta:
    etapas: list[str] = []
    materiais: list[str] = []
    texto_etapas = str(row["etapas_json"] or "").strip()
    if texto_etapas:
        try:
            bruto = json.loads(texto_etapas)
            if isinstance(bruto, list):
                etapas = [corrigir_texto_importado(str(item).strip()) for item in bruto if str(item).strip()]
        except Exception:
            etapas = []
    texto_materiais = str(row["materiais_json"] or "").strip()
    if texto_materiais:
        try:
            bruto = json.loads(texto_materiais)
            if isinstance(bruto, list):
                materiais = [corrigir_texto_importado(str(item).strip()) for item in bruto if str(item).strip()]
        except Exception:
            materiais = []
    return ProcedimentoResumoResposta(
        id=int(row["id"]),
        nome=corrigir_texto_importado(str(row["nome"] or "")),
        categoria=corrigir_texto_importado(str(row["categoria"] or "")),
        valorPadrao=float(row["valor_padrao"] or 0),
        duracaoPadraoMinutos=int(row["duracao_padrao_minutos"] or 60),
        descricao=corrigir_texto_importado(str(row["descricao"] or "")),
        etapasPadrao=etapas,
        materiaisPadrao=materiais,
        ativo=bool(int(row["ativo"] or 0)),
    )


@app.post("/api/auth/login", response_model=LoginResposta)
def login_usuario(payload: LoginPayload):
    usuario_digitado = str(payload.usuario or "").strip()
    senha = str(payload.senha or "")
    if not usuario_digitado or not senha:
        raise HTTPException(status_code=400, detail="Informe usuario e senha.")

    conn = conectar()
    try:
        usuario_row = conn.execute(
            """
            SELECT *
            FROM usuarios
            WHERE ativo=1 AND (lower(usuario)=lower(?) OR lower(nome)=lower(?))
            LIMIT 1
            """,
            (usuario_digitado, usuario_digitado),
        ).fetchone()
        if usuario_row is None or not verificar_senha(senha, usuario_row["senha_hash"]):
            raise HTTPException(status_code=401, detail="Usuario ou senha invalidos.")

        senha_hash_atualizada = gerar_hash_senha(senha) if not str(usuario_row["senha_hash"] or "").startswith("v2$") else usuario_row["senha_hash"]
        conn.execute("UPDATE usuarios SET ultimo_login=?, senha_hash=? WHERE id=?", (agora_str(), senha_hash_atualizada, int(usuario_row["id"])))
        conn.execute(
            "INSERT INTO logs_acesso (usuario_id, usuario, evento, data_hora) VALUES (?, ?, ?, ?)",
            (int(usuario_row["id"]), str(usuario_row["usuario"] or usuario_row["nome"] or "").upper(), "LOGIN", agora_str()),
        )
        conn.commit()
    finally:
        conn.close()

    registrar_acao_usuario(
        str(usuario_row["usuario"] or usuario_row["nome"] or ""),
        acao="Login",
        tipo="Acesso",
        info=str(usuario_row["nome"] or ""),
        metodo_http="POST",
        rota="/api/auth/login",
    )
    return detalhar_usuario_login(usuario_row)


@app.post("/api/auth/trocar-senha", response_model=LoginResposta)
def trocar_senha_primeiro_acesso(payload: TrocaSenhaPayload):
    usuario_digitado = str(payload.usuario or "").strip()
    senha_atual = str(payload.senha_atual or "")
    nova_senha = str(payload.nova_senha or "").strip()
    if not usuario_digitado or not senha_atual or not nova_senha:
        raise HTTPException(status_code=400, detail="Preencha usuario, senha atual e nova senha.")
    if len(nova_senha) < 4:
        raise HTTPException(status_code=400, detail="A nova senha precisa ter pelo menos 4 caracteres.")

    conn = conectar()
    try:
        usuario_row = conn.execute(
            """
            SELECT *
            FROM usuarios
            WHERE ativo=1 AND (lower(usuario)=lower(?) OR lower(nome)=lower(?))
            LIMIT 1
            """,
            (usuario_digitado, usuario_digitado),
        ).fetchone()
        if usuario_row is None or not verificar_senha(senha_atual, usuario_row["senha_hash"]):
            raise HTTPException(status_code=401, detail="Usuario ou senha atual invalidos.")

        novo_hash = gerar_hash_senha(nova_senha)
        conn.execute(
            """
            UPDATE usuarios
            SET senha_hash=?, senha_temporaria=0, precisa_trocar_senha=0, ultimo_login=?
            WHERE id=?
            """,
            (novo_hash, agora_str(), int(usuario_row["id"])),
        )
        conn.commit()
        usuario_row = conn.execute("SELECT * FROM usuarios WHERE id=?", (int(usuario_row["id"]),)).fetchone()
    finally:
        conn.close()

    registrar_acao_usuario(
        str(usuario_row["usuario"] or usuario_row["nome"] or ""),
        acao="Troca de senha",
        tipo="Acesso",
        info=str(usuario_row["nome"] or ""),
        metodo_http="POST",
        rota="/api/auth/trocar-senha",
    )
    return detalhar_usuario_login(usuario_row)


@app.get("/api/checklist/me", response_model=ChecklistUsuarioPainelResposta)
def listar_checklist_meu(request: Request, data_referencia: str = Query(default_factory=data_hoje_iso)):
    conn = conectar()
    try:
        usuario_row = usuario_logado_row(conn, request)
        return carregar_painel_checklist_usuario(conn, usuario_row=usuario_row, data_referencia=data_referencia)
    finally:
        conn.close()


@app.post("/api/checklist/me", response_model=ChecklistUsuarioItemResposta)
def criar_item_checklist_meu(payload: ChecklistUsuarioItemPayload, request: Request):
    titulo = str(payload.titulo or "").strip()
    if not titulo:
        raise HTTPException(status_code=400, detail="Informe o título da tarefa.")
    tipo_meta = str(payload.tipo_meta or "manual").strip().lower() or "manual"
    if tipo_meta != "manual" and tipo_meta not in CHECKLIST_TIPOS_AUTOMATICOS:
        raise HTTPException(status_code=400, detail="Selecione um tipo de tarefa válido.")
    meta_diaria = max(int(payload.meta_diaria or 1), 1)
    conn = conectar()
    try:
        usuario_row = usuario_logado_row(conn, request)
        ordem_row = conn.execute(
            "SELECT COALESCE(MAX(ordem), 0) AS ordem_maxima FROM checklist_usuario_itens WHERE usuario_id=?",
            (int(usuario_row["id"]),),
        ).fetchone()
        ordem = int(ordem_row["ordem_maxima"] or 0) + 1
        conn.execute(
            """
            INSERT INTO checklist_usuario_itens
            (usuario_id, titulo, descricao, tipo_meta, meta_diaria, ativo, ordem, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(usuario_row["id"]),
                titulo,
                str(payload.descricao or "").strip(),
                tipo_meta,
                meta_diaria,
                1 if payload.ativo else 0,
                ordem,
                agora_str(),
                agora_str(),
            ),
        )
        checklist_id = int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
        conn.commit()
        row = conn.execute("SELECT * FROM checklist_usuario_itens WHERE id=? LIMIT 1", (checklist_id,)).fetchone()
        return montar_item_checklist_usuario(conn, row, usuario_row=usuario_row, data_referencia=data_hoje_iso())
    finally:
        conn.close()


@app.put("/api/checklist/{checklist_id}", response_model=ChecklistUsuarioItemResposta)
def atualizar_item_checklist(checklist_id: int, payload: ChecklistUsuarioItemAtualizacaoPayload, request: Request):
    conn = conectar()
    try:
        usuario_row = usuario_logado_row(conn, request)
        row = conn.execute(
            "SELECT * FROM checklist_usuario_itens WHERE id=? AND usuario_id=? LIMIT 1",
            (int(checklist_id), int(usuario_row["id"])),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
        titulo = str(payload.titulo or row["titulo"] or "").strip()
        if not titulo:
            raise HTTPException(status_code=400, detail="Informe o título da tarefa.")
        tipo_meta = str(payload.tipo_meta or row["tipo_meta"] or "manual").strip().lower() or "manual"
        if tipo_meta != "manual" and tipo_meta not in CHECKLIST_TIPOS_AUTOMATICOS:
            raise HTTPException(status_code=400, detail="Selecione um tipo de tarefa válido.")
        meta_diaria = max(int(payload.meta_diaria or row["meta_diaria"] or 1), 1)
        ativo = int(row["ativo"] or 0) if payload.ativo is None else (1 if payload.ativo else 0)
        ordem = int(row["ordem"] or 0) if payload.ordem is None else max(int(payload.ordem or 0), 0)
        conn.execute(
            """
            UPDATE checklist_usuario_itens
            SET titulo=?, descricao=?, tipo_meta=?, meta_diaria=?, ativo=?, ordem=?, atualizado_em=?
            WHERE id=?
            """,
            (
                titulo,
                str(payload.descricao or row["descricao"] or "").strip(),
                tipo_meta,
                meta_diaria,
                ativo,
                ordem,
                agora_str(),
                int(checklist_id),
            ),
        )
        conn.commit()
        atualizado = conn.execute("SELECT * FROM checklist_usuario_itens WHERE id=? LIMIT 1", (int(checklist_id),)).fetchone()
        return montar_item_checklist_usuario(conn, atualizado, usuario_row=usuario_row, data_referencia=data_hoje_iso())
    finally:
        conn.close()


@app.post("/api/checklist/{checklist_id}/registro", response_model=ChecklistUsuarioItemResposta)
def atualizar_registro_checklist(checklist_id: int, payload: ChecklistUsuarioRegistroPayload, request: Request):
    conn = conectar()
    try:
        usuario_row = usuario_logado_row(conn, request)
        item_row = conn.execute(
            "SELECT * FROM checklist_usuario_itens WHERE id=? AND usuario_id=? LIMIT 1",
            (int(checklist_id), int(usuario_row["id"])),
        ).fetchone()
        if item_row is None:
            raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
        data_referencia = data_hoje_iso()
        registro = conn.execute(
            """
            SELECT *
            FROM checklist_usuario_registros
            WHERE checklist_id=? AND data_referencia=?
            LIMIT 1
            """,
            (int(checklist_id), data_referencia),
        ).fetchone()
        progresso_manual = int(registro["progresso_manual"] or 0) if registro else 0
        concluido_manual = bool(int(registro["concluido_manual"] or 0)) if registro else False
        if payload.progresso_manual is not None:
            progresso_manual = max(int(payload.progresso_manual), 0)
        if payload.concluido_manual is not None:
            concluido_manual = bool(payload.concluido_manual)
        if registro is None:
            conn.execute(
                """
                INSERT INTO checklist_usuario_registros
                (checklist_id, data_referencia, progresso_manual, concluido_manual, atualizado_em)
                VALUES (?, ?, ?, ?, ?)
                """,
                (int(checklist_id), data_referencia, progresso_manual, 1 if concluido_manual else 0, agora_str()),
            )
        else:
            conn.execute(
                """
                UPDATE checklist_usuario_registros
                SET progresso_manual=?, concluido_manual=?, atualizado_em=?
                WHERE checklist_id=? AND data_referencia=?
                """,
                (progresso_manual, 1 if concluido_manual else 0, agora_str(), int(checklist_id), data_referencia),
            )
        conn.commit()
        atualizado = conn.execute("SELECT * FROM checklist_usuario_itens WHERE id=? LIMIT 1", (int(checklist_id),)).fetchone()
        return montar_item_checklist_usuario(conn, atualizado, usuario_row=usuario_row, data_referencia=data_referencia)
    finally:
        conn.close()


@app.delete("/api/checklist/{checklist_id}", response_model=ChecklistUsuarioItemResposta)
def arquivar_item_checklist(checklist_id: int, request: Request):
    conn = conectar()
    try:
        usuario_row = usuario_logado_row(conn, request)
        row = conn.execute(
            "SELECT * FROM checklist_usuario_itens WHERE id=? AND usuario_id=? LIMIT 1",
            (int(checklist_id), int(usuario_row["id"])),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Tarefa não encontrada.")
        conn.execute(
            "UPDATE checklist_usuario_itens SET ativo=0, atualizado_em=? WHERE id=?",
            (agora_str(), int(checklist_id)),
        )
        conn.commit()
        arquivado = dict(row)
        arquivado["ativo"] = 0
        return montar_item_checklist_usuario(conn, arquivado, usuario_row=usuario_row, data_referencia=data_hoje_iso())
    finally:
        conn.close()


@app.post("/api/usuarios/{usuario_id}/redefinir-senha", response_model=LoginResposta)
def redefinir_senha_usuario(usuario_id: int, request: Request):
    conn = conectar()
    try:
        usuario_row = conn.execute(
            """
            SELECT *
            FROM usuarios
            WHERE id=? AND ativo=1
            LIMIT 1
            """,
            (int(usuario_id),),
        ).fetchone()
        if usuario_row is None:
            raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

        novo_hash = gerar_hash_senha(SENHA_PADRAO_CLINICA)
        conn.execute(
            """
            UPDATE usuarios
            SET senha_hash=?, senha_temporaria=1, precisa_trocar_senha=1
            WHERE id=?
            """,
            (novo_hash, int(usuario_id)),
        )
        conn.commit()
        usuario_row = conn.execute("SELECT * FROM usuarios WHERE id=?", (int(usuario_id),)).fetchone()
    finally:
        conn.close()

    registrar_acao_usuario(
        usuario_request(request) or str(usuario_row["usuario"] or usuario_row["nome"] or ""),
        acao="Reset de senha para o padrao",
        tipo="Usuario",
        info=str(usuario_row["nome"] or ""),
        metodo_http="POST",
        rota=f"/api/usuarios/{usuario_id}/redefinir-senha",
    )
    return detalhar_usuario_login(usuario_row)


@app.get("/api/usuarios", response_model=list[UsuarioResumoResposta])
def listar_usuarios():
    conn = conectar()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM usuarios
            ORDER BY lower(COALESCE(nome, usuario, '')), id
            """
        ).fetchall()
        return [mapear_usuario_resumo(row) for row in rows]
    finally:
        conn.close()


@app.post("/api/usuarios", response_model=UsuarioResumoResposta)
def criar_usuario(payload: UsuarioCriacaoPayload, request: Request):
    nome = corrigir_texto_importado(str(payload.nome or "").strip())
    cargo = corrigir_texto_importado(str(payload.cargo or "").strip()) or "Profissional"
    perfil = corrigir_texto_importado(str(payload.perfil or "").strip()) or ("Administrador" if cargo == "Administrador" else "Usuario")
    nome_agenda = corrigir_texto_importado(str(payload.nome_agenda or "").strip()) or nome.upper()
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do usuario.")

    usuario_login = normalizar_texto(str(payload.nome or "").strip()).replace(" ", "")
    if not usuario_login:
        raise HTTPException(status_code=400, detail="Nao foi possivel gerar o usuario de login.")

    modulos, pacientes_abas, agenda_padrao = normalizar_payload_permissoes(cargo, perfil, payload.modulos, payload.pacientes_abas)
    agenda_escopo = corrigir_texto_importado(str(payload.agenda_escopo or "").strip()) or agenda_padrao
    agenda_disponivel = bool(payload.agenda_disponivel if payload.agenda_disponivel is not None else cargo in {"Profissional", "Administrador"})
    atividades_acesso = bool(payload.atividades_acesso if payload.atividades_acesso is not None else cargo == "Administrador")
    atividades_agenda_disponivel = bool(payload.atividades_agenda_disponivel if payload.atividades_agenda_disponivel is not None else False)
    atividades_escopo = "EQUIPE" if str(payload.atividades_escopo or "").strip().upper() == "EQUIPE" else "PROPRIAS"
    ativo = 1 if (payload.ativo if payload.ativo is not None else True) else 0

    conn = conectar()
    try:
        existente = conn.execute("SELECT id FROM usuarios WHERE lower(usuario)=lower(?) LIMIT 1", (usuario_login,)).fetchone()
        if existente is not None:
            raise HTTPException(status_code=409, detail="Ja existe um usuario com esse login.")
        cursor = conn.execute(
            """
            INSERT INTO usuarios
            (nome, usuario, nome_agenda, senha_hash, perfil, cargo, agenda_escopo, agenda_disponivel, atividades_acesso, atividades_agenda_disponivel, atividades_escopo, senha_temporaria, precisa_trocar_senha, ultimo_login, ativo, modulos_json, pacientes_abas_json, data_criacao)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1, '', ?, ?, ?, ?)
            """,
            (
                nome,
                usuario_login,
                nome_agenda.upper(),
                gerar_hash_senha(SENHA_PADRAO_CLINICA),
                perfil,
                cargo,
                agenda_escopo,
                1 if agenda_disponivel else 0,
                1 if atividades_acesso else 0,
                1 if atividades_agenda_disponivel else 0,
                atividades_escopo,
                ativo,
                json.dumps(modulos, ensure_ascii=False),
                json.dumps(pacientes_abas, ensure_ascii=False),
                agora_str(),
            ),
        )
        usuario_id = int(cursor.lastrowid)
        conn.commit()
        usuario_row = conn.execute("SELECT * FROM usuarios WHERE id=?", (usuario_id,)).fetchone()
    except HTTPException:
        conn.rollback()
        raise
    except sqlite3.IntegrityError as exc:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Falha ao criar o usuario: {str(exc)}")
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Falha ao criar o usuario: {str(exc)}")
    finally:
        conn.close()

    registrar_acao_usuario(
        usuario_request(request),
        acao="Criacao",
        tipo="Usuario",
        info=nome,
        metodo_http="POST",
        rota="/api/usuarios",
    )
    return mapear_usuario_resumo(usuario_row)


@app.put("/api/usuarios/{usuario_id}", response_model=UsuarioResumoResposta)
def atualizar_usuario(usuario_id: int, payload: UsuarioAtualizacaoPayload, request: Request):
    nome = corrigir_texto_importado(str(payload.nome or "").strip())
    nome_agenda = corrigir_texto_importado(str(payload.nome_agenda or "").strip())
    usuario_login = normalizar_texto(str(payload.usuario or "").strip()).replace(" ", "")
    cargo = corrigir_texto_importado(str(payload.cargo or "").strip())
    agenda_escopo = corrigir_texto_importado(str(payload.agenda_escopo or "").strip())
    perfil = corrigir_texto_importado(str(payload.perfil or "").strip())

    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do usuario.")

    conn = conectar()
    try:
        usuario_row = conn.execute(
            """
            SELECT *
            FROM usuarios
            WHERE id=?
            LIMIT 1
            """,
            (int(usuario_id),),
        ).fetchone()
        if usuario_row is None:
            raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

        if usuario_login:
            existente = conn.execute(
                "SELECT id FROM usuarios WHERE lower(usuario)=lower(?) AND id<>? LIMIT 1",
                (usuario_login, int(usuario_id)),
            ).fetchone()
            if existente is not None:
                raise HTTPException(status_code=409, detail="Ja existe um usuario com esse login.")

        cargo_final = cargo or str(usuario_row["cargo"] or "Profissional")
        perfil_final = perfil or str(usuario_row["perfil"] or ("Administrador" if cargo_final == "Administrador" else "Usuario"))
        modulos, pacientes_abas, agenda_padrao = normalizar_payload_permissoes(
            cargo_final,
            perfil_final,
            payload.modulos,
            payload.pacientes_abas,
        )

        conn.execute(
            """
            UPDATE usuarios
            SET nome=?,
                usuario=?,
                nome_agenda=?,
                perfil=?,
                cargo=?,
                agenda_escopo=?,
                agenda_disponivel=COALESCE(?, agenda_disponivel),
                atividades_acesso=COALESCE(?, atividades_acesso),
                atividades_agenda_disponivel=COALESCE(?, atividades_agenda_disponivel),
                atividades_escopo=COALESCE(NULLIF(?, ''), atividades_escopo),
                ativo=COALESCE(?, ativo),
                modulos_json=?,
                pacientes_abas_json=?
            WHERE id=?
            """,
            (
                nome,
                usuario_login or str(usuario_row["usuario"] or ""),
                (nome_agenda or str(usuario_row["nome_agenda"] or "") or nome).upper(),
                perfil_final,
                cargo_final,
                agenda_escopo or str(usuario_row["agenda_escopo"] or "") or agenda_padrao,
                1 if payload.agenda_disponivel else 0 if payload.agenda_disponivel is not None else None,
                1 if payload.atividades_acesso else 0 if payload.atividades_acesso is not None else None,
                1 if payload.atividades_agenda_disponivel else 0 if payload.atividades_agenda_disponivel is not None else None,
                "EQUIPE" if str(payload.atividades_escopo or "").strip().upper() == "EQUIPE" else "PROPRIAS" if str(payload.atividades_escopo or "").strip() else "",
                1 if payload.ativo else 0 if payload.ativo is not None else None,
                json.dumps(modulos, ensure_ascii=False),
                json.dumps(pacientes_abas, ensure_ascii=False),
                int(usuario_id),
            ),
        )
        conn.commit()
        usuario_row = conn.execute("SELECT * FROM usuarios WHERE id=?", (int(usuario_id),)).fetchone()
    finally:
        conn.close()

    registrar_acao_usuario(
        usuario_request(request),
        acao="Atualizacao",
        tipo="Usuario",
        info=nome,
        metodo_http="PUT",
        rota=f"/api/usuarios/{usuario_id}",
    )
    return mapear_usuario_resumo(usuario_row)


@app.patch("/api/usuarios/{usuario_id}/atividades", response_model=UsuarioResumoResposta)
def atualizar_controles_atividades_usuario(usuario_id: int, payload: UsuarioAtividadesPayload, request: Request):
    escopo = "EQUIPE" if str(payload.atividades_escopo or "").strip().upper() == "EQUIPE" else "PROPRIAS"
    conn = conectar()
    try:
        usuario_row = conn.execute("SELECT * FROM usuarios WHERE id=? LIMIT 1", (int(usuario_id),)).fetchone()
        if usuario_row is None:
            raise HTTPException(status_code=404, detail="Usuário não encontrado.")
        conn.execute(
            """UPDATE usuarios
               SET atividades_acesso=?, atividades_agenda_disponivel=?, atividades_escopo=?
               WHERE id=?""",
            (
                1 if payload.atividades_acesso else 0,
                1 if payload.atividades_agenda_disponivel else 0,
                escopo,
                int(usuario_id),
            ),
        )
        conn.commit()
        usuario_row = conn.execute("SELECT * FROM usuarios WHERE id=?", (int(usuario_id),)).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="Atualização de acesso",
        tipo="Agenda de atividades",
        info=str(usuario_row["nome"] or usuario_row["usuario"] or f"Usuário {usuario_id}"),
        metodo_http="PATCH",
        rota=f"/api/usuarios/{usuario_id}/atividades",
    )
    return mapear_usuario_resumo(usuario_row)


STATUS_ATIVIDADE_VALIDOS = {"Pendente", "Em andamento", "Concluída", "Cancelada"}
PRIORIDADE_ATIVIDADE_VALIDAS = {"Baixa", "Normal", "Alta", "Urgente"}


def validar_acesso_atividades(conn: sqlite3.Connection, request: Request) -> tuple[sqlite3.Row, bool]:
    usuario = buscar_usuario_por_identificador(conn, usuario_request(request))
    if usuario is None:
        raise HTTPException(status_code=401, detail="Usuário não identificado.")
    administrador = str(usuario["perfil"] or "").strip().lower() == "administrador" or str(usuario["cargo"] or "").strip().lower() == "administrador"
    if not bool(int(usuario["atividades_acesso"] or 0)):
        raise HTTPException(status_code=403, detail="Usuário sem acesso à agenda de atividades.")
    acesso_equipe = administrador or str(usuario["atividades_escopo"] or "").strip().upper() == "EQUIPE"
    return usuario, acesso_equipe


def responsaveis_da_atividade(conn: sqlite3.Connection, row: sqlite3.Row) -> list[sqlite3.Row]:
    rows = conn.execute(
        """SELECT u.id, u.nome FROM agenda_atividade_responsaveis ar
           JOIN usuarios u ON u.id=ar.usuario_id
           WHERE ar.atividade_id=? ORDER BY lower(u.nome), u.id""",
        (int(row["id"]),),
    ).fetchall()
    if rows:
        return rows
    return [{"id": int(row["responsavel_id"]), "nome": str(row["responsavel_nome"] or "")}]


def usuario_row_eh_administrador(usuario: sqlite3.Row) -> bool:
    return normalizar_texto(str(usuario["perfil"] or "")) == "administrador" or normalizar_texto(str(usuario["cargo"] or "")) == "administrador"


def mapear_atividade(conn: sqlite3.Connection, row: sqlite3.Row, incluir_confirmacoes: bool = False) -> AgendaAtividadeResposta:
    responsaveis = responsaveis_da_atividade(conn, row)
    confirmacoes_rows = conn.execute(
        """SELECT u.id, u.nome,
                  MAX(COALESCE(n.lida, 0)) AS lida,
                  MAX(CASE WHEN COALESCE(n.lida, 0)=1 THEN COALESCE(n.lida_em, '') ELSE '' END) AS lida_em
           FROM agenda_atividade_responsaveis ar
           JOIN usuarios u ON u.id=ar.usuario_id
           LEFT JOIN agenda_atividade_notificacoes n ON n.atividade_id=ar.atividade_id AND n.usuario_id=ar.usuario_id
           WHERE ar.atividade_id=?
           GROUP BY u.id, u.nome
           ORDER BY lower(u.nome), u.id""",
        (int(row["id"]),),
    ).fetchall() if incluir_confirmacoes else []
    return AgendaAtividadeResposta(
        id=int(row["id"]),
        titulo=corrigir_texto_importado(str(row["titulo"] or "")),
        descricao=corrigir_texto_importado(str(row["descricao"] or "")),
        responsavelId=int(row["responsavel_id"]),
        responsavelNome=corrigir_texto_importado(str(row["responsavel_nome"] or "")),
        responsaveisIds=[int(item["id"]) for item in responsaveis],
        responsaveisNomes=[corrigir_texto_importado(str(item["nome"] or "")) for item in responsaveis],
        dataAtividade=str(row["data_atividade"] or ""),
        horaInicio=str(row["hora_inicio"] or ""),
        horaFim=str(row["hora_fim"] or ""),
        prioridade=str(row["prioridade"] or "Normal"),
        status=str(row["status"] or "Pendente"),
        criadoPor=str(row["criado_por"] or ""),
        criadoEm=str(row["criado_em"] or ""),
        atualizadoPor=str(row["atualizado_por"] or ""),
        atualizadoEm=str(row["atualizado_em"] or ""),
        concluidaEm=str(row["concluida_em"] or (row["atualizado_em"] if str(row["status"] or "") == "Concluída" else "") or ""),
        cor=str(row["cor"] or "#c7aa78"),
        secreta=bool(row["secreta"]),
        confirmacoesLeitura=[
            {
                "usuarioId": int(item["id"]),
                "nome": corrigir_texto_importado(str(item["nome"] or "")),
                "lida": bool(item["lida"]),
                "lidaEm": str(item["lida_em"] or ""),
            }
            for item in confirmacoes_rows
        ],
    )


def buscar_atividade_com_responsavel(conn: sqlite3.Connection, atividade_id: int) -> sqlite3.Row | None:
    return conn.execute(
        """SELECT a.*, u.nome AS responsavel_nome FROM agenda_atividades a
           JOIN usuarios u ON u.id=a.responsavel_id WHERE a.id=?""",
        (int(atividade_id),),
    ).fetchone()


def notificar_atividade(conn: sqlite3.Connection, atividade_id: int, usuarios_ids: list[int], tipo: str, mensagem: str, chave_base: str):
    momento = agora_str()
    conn.executemany(
        """INSERT OR IGNORE INTO agenda_atividade_notificacoes
           (usuario_id, atividade_id, tipo, mensagem, chave, lida, criado_em)
           VALUES (?, ?, ?, ?, ?, 0, ?)""",
        [(usuario_id, atividade_id, tipo, mensagem, f"{chave_base}-{usuario_id}", momento) for usuario_id in usuarios_ids],
    )


@app.get("/api/atividades/notificacoes", response_model=list[AtividadeNotificacaoResposta])
def listar_notificacoes_atividades(request: Request):
    conn = conectar()
    try:
        usuario, _ = validar_acesso_atividades(conn, request)
        agora = datetime.now(TIMEZONE_LOCAL) if TIMEZONE_LOCAL else datetime.now()
        hoje, hora = agora.strftime("%Y-%m-%d"), agora.strftime("%H:%M")
        vencidas = conn.execute(
            """SELECT DISTINCT a.id, a.titulo FROM agenda_atividades a
               JOIN agenda_atividade_responsaveis ar ON ar.atividade_id=a.id
               WHERE ar.usuario_id=? AND a.data_atividade=? AND COALESCE(a.hora_inicio,'')<>''
                 AND a.hora_inicio<=? AND a.status NOT IN ('Concluída','Cancelada')""",
            (int(usuario["id"]), hoje, hora),
        ).fetchall()
        for atividade in vencidas:
            notificar_atividade(conn, int(atividade["id"]), [int(usuario["id"])], "horario", f"Chegou o horário de: {atividade['titulo']}", f"horario-{atividade['id']}-{hoje}")
        conn.commit()
        rows = conn.execute(
            """SELECT n.*, COALESCE(a.data_atividade, '') AS data_atividade
               FROM agenda_atividade_notificacoes n
               LEFT JOIN agenda_atividades a ON a.id=n.atividade_id
               WHERE n.usuario_id=? ORDER BY n.lida, n.id DESC LIMIT 40""",
            (int(usuario["id"]),),
        ).fetchall()
        return [AtividadeNotificacaoResposta(id=int(row["id"]), atividadeId=row["atividade_id"], tipo=str(row["tipo"]), mensagem=str(row["mensagem"]), lida=bool(row["lida"]), criadoEm=str(row["criado_em"] or ""), dataAtividade=str(row["data_atividade"] or "")) for row in rows]
    finally:
        conn.close()


@app.patch("/api/atividades/notificacoes/{notificacao_id}/lida")
def marcar_notificacao_lida(notificacao_id: int, request: Request):
    conn = conectar()
    try:
        usuario, _ = validar_acesso_atividades(conn, request)
        conn.execute(
            "UPDATE agenda_atividade_notificacoes SET lida=1, lida_em=COALESCE(lida_em, ?) WHERE id=? AND usuario_id=?",
            (agora_str(), notificacao_id, int(usuario["id"])),
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.delete("/api/atividades/notificacoes")
def limpar_notificacoes_atividades(request: Request):
    conn = conectar()
    try:
        usuario, _ = validar_acesso_atividades(conn, request)
        conn.execute("DELETE FROM agenda_atividade_notificacoes WHERE usuario_id=?", (int(usuario["id"]),))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.get("/api/atividades/responsaveis", response_model=list[ResponsavelAtividadeResposta])
def listar_responsaveis_atividades(request: Request):
    conn = conectar()
    try:
        usuario, acesso_equipe = validar_acesso_atividades(conn, request)
        if acesso_equipe:
            rows = conn.execute(
                "SELECT id, nome, atividades_cor FROM usuarios WHERE ativo=1 AND atividades_agenda_disponivel=1 ORDER BY nome COLLATE NOCASE"
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, nome, atividades_cor FROM usuarios WHERE id=? AND ativo=1 AND atividades_agenda_disponivel=1",
                (int(usuario["id"]),),
            ).fetchall()
        return [ResponsavelAtividadeResposta(id=int(row["id"]), nome=corrigir_texto_importado(str(row["nome"] or "")), cor=str(row["atividades_cor"] or "")) for row in rows]
    finally:
        conn.close()


@app.patch("/api/atividades/responsaveis/{usuario_id}/cor", response_model=ResponsavelAtividadeResposta)
def atualizar_cor_responsavel_atividades(usuario_id: int, payload: ResponsavelAtividadeCorPayload, request: Request):
    cor = str(payload.cor or "").strip()
    if not re.fullmatch(r"#[0-9a-fA-F]{6}", cor):
        raise HTTPException(status_code=400, detail="Informe uma cor válida.")
    conn = conectar()
    try:
        _, acesso_equipe = validar_acesso_atividades(conn, request)
        if not acesso_equipe:
            raise HTTPException(status_code=403, detail="Você não pode alterar as cores da equipe.")
        row = conn.execute(
            "SELECT id, nome FROM usuarios WHERE id=? AND ativo=1 AND atividades_agenda_disponivel=1",
            (usuario_id,),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Responsável não encontrado.")
        conn.execute("UPDATE usuarios SET atividades_cor=? WHERE id=?", (cor.lower(), usuario_id))
        conn.commit()
        return ResponsavelAtividadeResposta(id=int(row["id"]), nome=corrigir_texto_importado(str(row["nome"] or "")), cor=cor.lower())
    finally:
        conn.close()


@app.get("/api/atividades", response_model=list[AgendaAtividadeResposta])
def listar_atividades(request: Request, data_inicio: str = Query(default=""), data_fim: str = Query(default=""), q: str = Query(default="")):
    conn = conectar()
    try:
        usuario, acesso_equipe = validar_acesso_atividades(conn, request)
        filtros, parametros = [], []
        if data_inicio:
            filtros.append("a.data_atividade>=?")
            parametros.append(data_inicio)
        if data_fim:
            filtros.append("a.data_atividade<=?")
            parametros.append(data_fim)
        busca = str(q or "").strip()
        if busca:
            filtros.append("(lower(a.titulo) LIKE lower(?) OR lower(COALESCE(a.descricao,'')) LIKE lower(?))")
            parametros.extend([f"%{busca}%", f"%{busca}%"])
        filtros.append("(COALESCE(a.secreta,0)=0 OR a.criado_por_id=? OR EXISTS (SELECT 1 FROM agenda_atividade_responsaveis ars WHERE ars.atividade_id=a.id AND ars.usuario_id=?))")
        parametros.extend([int(usuario["id"]), int(usuario["id"])])
        if not acesso_equipe:
            filtros.append("(a.responsavel_id=? OR EXISTS (SELECT 1 FROM agenda_atividade_responsaveis ar WHERE ar.atividade_id=a.id AND ar.usuario_id=?))")
            parametros.append(int(usuario["id"]))
            parametros.append(int(usuario["id"]))
        where = f"WHERE {' AND '.join(filtros)}" if filtros else ""
        rows = conn.execute(
            f"""SELECT a.*, u.nome AS responsavel_nome FROM agenda_atividades a
                JOIN usuarios u ON u.id=a.responsavel_id {where}
                ORDER BY a.data_atividade, COALESCE(a.hora_inicio, ''), a.id""",
            tuple(parametros),
        ).fetchall()
        incluir_confirmacoes = usuario_row_eh_administrador(usuario)
        return [mapear_atividade(conn, row, incluir_confirmacoes) for row in rows]
    finally:
        conn.close()


@app.post("/api/atividades", response_model=AgendaAtividadeResposta)
def criar_atividade(payload: AgendaAtividadePayload, request: Request):
    titulo = corrigir_texto_importado(str(payload.titulo or "").strip())
    if not titulo:
        raise HTTPException(status_code=400, detail="Informe o título da atividade.")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(payload.data_atividade or "")):
        raise HTTPException(status_code=400, detail="Informe uma data válida.")
    try:
        data_inicial = date.fromisoformat(payload.data_atividade)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Informe uma data válida.") from exc
    repeticao = str(payload.repeticao or "NENHUMA").strip().upper()
    if repeticao not in {"NENHUMA", "DIARIA", "SEMANAL", "MENSAL"}:
        raise HTTPException(status_code=400, detail="Selecione uma repetição válida.")
    data_limite = data_inicial
    if repeticao != "NENHUMA":
        try:
            data_limite = date.fromisoformat(str(payload.repetir_ate or ""))
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Informe até quando a atividade deve se repetir.") from exc
        if data_limite <= data_inicial:
            raise HTTPException(status_code=400, detail="A data final da repetição deve ser posterior à primeira atividade.")
        if (data_limite - data_inicial).days > 730:
            raise HTTPException(status_code=400, detail="A repetição pode abranger no máximo dois anos.")
    conn = conectar()
    try:
        usuario, acesso_equipe = validar_acesso_atividades(conn, request)
        responsaveis_ids = list(dict.fromkeys(int(item) for item in (payload.responsaveis_ids or [payload.responsavel_id or usuario["id"]]) if int(item) > 0))
        if not responsaveis_ids:
            responsaveis_ids = [int(usuario["id"])]
        responsavel_id = responsaveis_ids[0]
        if not acesso_equipe and responsaveis_ids != [int(usuario["id"])]:
            raise HTTPException(status_code=403, detail="Você só pode criar atividades para si.")
        ativos = conn.execute(f"SELECT id FROM usuarios WHERE ativo=1 AND id IN ({','.join('?' for _ in responsaveis_ids)})", tuple(responsaveis_ids)).fetchall()
        if len(ativos) != len(responsaveis_ids):
            raise HTTPException(status_code=400, detail="Selecione apenas funcionários ativos.")
        prioridade = payload.prioridade if payload.prioridade in PRIORIDADE_ATIVIDADE_VALIDAS else "Normal"
        status = payload.status if payload.status in STATUS_ATIVIDADE_VALIDOS else "Pendente"
        cor = payload.cor if re.fullmatch(r"#[0-9a-fA-F]{6}", str(payload.cor or "")) else "#c7aa78"
        momento, nome_usuario = agora_str(), str(usuario["nome"] or usuario["usuario"] or "")
        datas_atividade = [data_inicial]
        cursor_data = data_inicial
        while repeticao != "NENHUMA" and cursor_data < data_limite:
            if repeticao == "DIARIA":
                proxima = cursor_data + timedelta(days=1)
            elif repeticao == "SEMANAL":
                proxima = cursor_data + timedelta(days=7)
            else:
                mes = cursor_data.month + 1
                ano = cursor_data.year + (1 if mes == 13 else 0)
                mes = 1 if mes == 13 else mes
                proxima = date(ano, mes, min(data_inicial.day, calendar.monthrange(ano, mes)[1]))
            if proxima > data_limite:
                break
            datas_atividade.append(proxima)
            cursor_data = proxima
        primeiro_id = 0
        for indice, data_atividade in enumerate(datas_atividade):
            cursor = conn.execute(
                """INSERT INTO agenda_atividades
                   (titulo, descricao, responsavel_id, data_atividade, hora_inicio, hora_fim, prioridade, status, criado_por_id, criado_por, criado_em, atualizado_por, atualizado_em, cor, secreta)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (titulo, corrigir_texto_importado(payload.descricao), responsavel_id, data_atividade.isoformat(), payload.hora_inicio, payload.hora_fim, prioridade, status, int(usuario["id"]), nome_usuario, momento, nome_usuario, momento, cor, int(payload.secreta)),
            )
            atividade_id = int(cursor.lastrowid)
            if indice == 0:
                primeiro_id = atividade_id
            conn.executemany(
                "INSERT INTO agenda_atividade_responsaveis (atividade_id, usuario_id) VALUES (?, ?)",
                [(atividade_id, responsavel) for responsavel in responsaveis_ids],
            )
        notificar_atividade(conn, primeiro_id, responsaveis_ids, "nova", f"Nova atividade{' recorrente' if repeticao != 'NENHUMA' else ''}: {titulo}", f"nova-{primeiro_id}")
        conn.commit()
        row = buscar_atividade_com_responsavel(conn, primeiro_id)
        return mapear_atividade(conn, row, usuario_row_eh_administrador(usuario))
    finally:
        conn.close()


@app.put("/api/atividades/{atividade_id}", response_model=AgendaAtividadeResposta)
def atualizar_atividade(atividade_id: int, payload: AgendaAtividadePayload, request: Request):
    conn = conectar()
    try:
        usuario, acesso_equipe = validar_acesso_atividades(conn, request)
        atual = buscar_atividade_com_responsavel(conn, atividade_id)
        if atual is None:
            raise HTTPException(status_code=404, detail="Atividade não encontrada.")
        responsaveis_atuais = [int(item["id"]) for item in responsaveis_da_atividade(conn, atual)]
        if bool(atual["secreta"]) and int(atual["criado_por_id"] or 0) != int(usuario["id"]) and int(usuario["id"]) not in responsaveis_atuais:
            raise HTTPException(status_code=404, detail="Atividade não encontrada.")
        if not acesso_equipe and int(usuario["id"]) not in responsaveis_atuais:
            raise HTTPException(status_code=403, detail="Você só pode alterar suas atividades.")
        responsaveis_ids = list(dict.fromkeys(int(item) for item in (payload.responsaveis_ids or [payload.responsavel_id or atual["responsavel_id"]]) if int(item) > 0))
        responsavel_id = responsaveis_ids[0]
        if not acesso_equipe and responsaveis_ids != [int(usuario["id"])]:
            raise HTTPException(status_code=403, detail="Você não pode transferir esta atividade.")
        novos_responsaveis = [item for item in responsaveis_ids if item not in responsaveis_atuais]
        if novos_responsaveis:
            ativos = conn.execute(f"SELECT id FROM usuarios WHERE ativo=1 AND id IN ({','.join('?' for _ in novos_responsaveis)})", tuple(novos_responsaveis)).fetchall()
            if len(ativos) != len(novos_responsaveis):
                raise HTTPException(status_code=400, detail="Selecione apenas funcionários ativos.")
        titulo = corrigir_texto_importado(str(payload.titulo or "").strip())
        if not titulo:
            raise HTTPException(status_code=400, detail="Informe o título da atividade.")
        prioridade = payload.prioridade if payload.prioridade in PRIORIDADE_ATIVIDADE_VALIDAS else "Normal"
        status = payload.status if payload.status in STATUS_ATIVIDADE_VALIDOS else "Pendente"
        cor = payload.cor if re.fullmatch(r"#[0-9a-fA-F]{6}", str(payload.cor or "")) else "#c7aa78"
        nome_usuario, momento = str(usuario["nome"] or usuario["usuario"] or ""), agora_str()
        concluida_em = str(atual["concluida_em"] or "") if status == "Concluída" and str(atual["status"] or "") == "Concluída" else momento if status == "Concluída" else None
        conn.execute(
            """UPDATE agenda_atividades SET titulo=?, descricao=?, responsavel_id=?, data_atividade=?, hora_inicio=?, hora_fim=?, prioridade=?, status=?, atualizado_por=?, atualizado_em=?, cor=?, secreta=?, concluida_em=? WHERE id=?""",
            (titulo, corrigir_texto_importado(payload.descricao), responsavel_id, payload.data_atividade, payload.hora_inicio, payload.hora_fim, prioridade, status, nome_usuario, momento, cor, int(payload.secreta), concluida_em, atividade_id),
        )
        conn.execute("DELETE FROM agenda_atividade_responsaveis WHERE atividade_id=?", (atividade_id,))
        conn.executemany(
            "INSERT INTO agenda_atividade_responsaveis (atividade_id, usuario_id) VALUES (?, ?)",
            [(atividade_id, responsavel) for responsavel in responsaveis_ids],
        )
        notificar_atividade(conn, atividade_id, responsaveis_ids, "alteracao", f"Atividade alterada: {titulo}", f"alteracao-{atividade_id}-{momento}")
        conn.commit()
        return mapear_atividade(conn, buscar_atividade_com_responsavel(conn, atividade_id), usuario_row_eh_administrador(usuario))
    finally:
        conn.close()


@app.delete("/api/atividades/{atividade_id}")
def excluir_atividade(atividade_id: int, request: Request):
    conn = conectar()
    try:
        usuario, acesso_equipe = validar_acesso_atividades(conn, request)
        atividade = buscar_atividade_com_responsavel(conn, atividade_id)
        if atividade is None:
            raise HTTPException(status_code=404, detail="Atividade não encontrada.")
        responsaveis_ids = [int(item["id"]) for item in responsaveis_da_atividade(conn, atividade)]
        if bool(atividade["secreta"]) and int(atividade["criado_por_id"] or 0) != int(usuario["id"]) and int(usuario["id"]) not in responsaveis_ids:
            raise HTTPException(status_code=404, detail="Atividade não encontrada.")
        if not acesso_equipe and int(usuario["id"]) not in responsaveis_ids:
            raise HTTPException(status_code=403, detail="Você só pode excluir suas atividades.")
        conn.execute("DELETE FROM agenda_atividade_responsaveis WHERE atividade_id=?", (atividade_id,))
        conn.execute("DELETE FROM agenda_atividades WHERE id=?", (atividade_id,))
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.delete("/api/usuarios/{usuario_id}")
def excluir_usuario(usuario_id: int, request: Request):
    conn = conectar()
    try:
        usuario_row = conn.execute(
            """
            SELECT *
            FROM usuarios
            WHERE id=?
            LIMIT 1
            """,
            (int(usuario_id),),
        ).fetchone()
        if usuario_row is None:
            raise HTTPException(status_code=404, detail="Usuario nao encontrado.")

        if str(usuario_row["perfil"] or "") == "Administrador" and str(usuario_row["usuario"] or "").strip().lower() == "admin":
            raise HTTPException(status_code=400, detail="Nao e permitido excluir o administrador padrao.")

        conn.execute(
            """UPDATE usuarios
               SET ativo=0, agenda_disponivel=0, atividades_acesso=0, atividades_agenda_disponivel=0
               WHERE id=?""",
            (int(usuario_id),),
        )
        conn.commit()
    finally:
        conn.close()

    registrar_acao_usuario(
        usuario_request(request),
        acao="Desativacao",
        tipo="Usuario",
        info=str(usuario_row["nome"] or usuario_row["usuario"] or f"Usuario {usuario_id}"),
        metodo_http="DELETE",
        rota=f"/api/usuarios/{usuario_id}",
    )
    return {"ok": True}


@app.get("/api/usuarios/acoes/export.xlsx")
def exportar_acoes_usuarios_xlsx(data: str = Query(default="")):
    conteudo = bytes_relatorio_acoes_por_dia(data)
    nome = f"acoes_usuarios_{(parse_data_contrato(data) or date.today()).strftime('%Y%m%d')}.xlsx"
    headers = {"Content-Disposition": f'attachment; filename="{nome}"'}
    return Response(
        content=conteudo,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


STATUS_PLANO_PROCEDIMENTO = {"Planejado", "Em andamento", "Concluido", "Suspenso", "Cancelado"}
STATUS_PLANO_PASSO = {"Pendente", "Agendado", "Concluido", "Cancelado"}


def sincronizar_procedimentos_contratados_plano(conn: sqlite3.Connection, paciente_id: int) -> None:
    rows = conn.execute(
        """
        SELECT pc.id, pc.contrato_id, pc.procedimento
        FROM procedimentos_contrato pc
        JOIN contratos c ON c.id=pc.contrato_id
        WHERE c.paciente_id=? AND upper(COALESCE(c.status, ''))='APROVADO'
        ORDER BY pc.id
        """,
        (int(paciente_id),),
    ).fetchall()
    agora = agora_str()
    for row in rows:
        existente = conn.execute(
            "SELECT id FROM plano_tratamento_procedimentos WHERE procedimento_contrato_id=?",
            (int(row["id"]),),
        ).fetchone()
        if existente:
            continue
        catalogo = conn.execute(
            "SELECT id, etapas_json FROM procedimentos WHERE lower(trim(nome))=lower(trim(?)) LIMIT 1",
            (str(row["procedimento"] or ""),),
        ).fetchone()
        cursor = conn.execute(
            """
            INSERT INTO plano_tratamento_procedimentos
              (paciente_id, contrato_id, procedimento_contrato_id, procedimento_id, procedimento_nome, status, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, 'Planejado', ?, ?)
            """,
            (int(paciente_id), int(row["contrato_id"]), int(row["id"]), int(catalogo["id"]) if catalogo else None,
             corrigir_texto_importado(str(row["procedimento"] or "").strip()), agora, agora),
        )
        etapas = lista_json_segura(catalogo["etapas_json"]) if catalogo else []
        for ordem, titulo in enumerate(etapas, start=1):
            if str(titulo).strip():
                conn.execute(
                    "INSERT INTO plano_tratamento_passos (plano_procedimento_id, titulo, ordem, status, criado_em, atualizado_em) VALUES (?, ?, ?, 'Pendente', ?, ?)",
                    (int(cursor.lastrowid), corrigir_texto_importado(str(titulo).strip()), ordem, agora, agora),
                )


def carregar_plano_tratamento(conn: sqlite3.Connection, paciente_id: int) -> list[PlanoTratamentoProcedimentoResposta]:
    procedimentos = conn.execute(
        "SELECT * FROM plano_tratamento_procedimentos WHERE paciente_id=? ORDER BY id",
        (int(paciente_id),),
    ).fetchall()
    resposta = []
    for procedimento in procedimentos:
        passos = conn.execute(
            "SELECT * FROM plano_tratamento_passos WHERE plano_procedimento_id=? ORDER BY ordem, id",
            (int(procedimento["id"]),),
        ).fetchall()
        resposta.append(PlanoTratamentoProcedimentoResposta(
            id=int(procedimento["id"]),
            procedimentoId=int(procedimento["procedimento_id"]) if procedimento["procedimento_id"] is not None else None,
            nome=str(procedimento["procedimento_nome"] or ""),
            contratoId=int(procedimento["contrato_id"]) if procedimento["contrato_id"] is not None else None,
            origem="Contrato" if procedimento["procedimento_contrato_id"] is not None else "Manual",
            status=str(procedimento["status"] or "Planejado"),
            observacao=str(procedimento["observacao"] or ""),
            passos=[PlanoTratamentoPassoResposta(
                id=int(passo["id"]), titulo=str(passo["titulo"] or ""), ordem=int(passo["ordem"] or 1),
                status=str(passo["status"] or "Pendente"), dataPrevista=str(passo["data_prevista"] or ""),
                dataRealizacao=str(passo["data_realizacao"] or ""), observacao=str(passo["observacao"] or "")
            ) for passo in passos],
        ))
    return resposta


@app.get("/api/pacientes/{paciente_id}/plano-tratamento", response_model=list[PlanoTratamentoProcedimentoResposta])
def listar_plano_tratamento(paciente_id: int):
    conn = conectar()
    try:
        if not conn.execute("SELECT id FROM pacientes WHERE id=?", (int(paciente_id),)).fetchone():
            raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
        sincronizar_procedimentos_contratados_plano(conn, paciente_id)
        conn.commit()
        return carregar_plano_tratamento(conn, paciente_id)
    finally:
        conn.close()


@app.post("/api/pacientes/{paciente_id}/plano-tratamento", response_model=PlanoTratamentoProcedimentoResposta)
def adicionar_procedimento_plano(paciente_id: int, payload: PlanoTratamentoProcedimentoPayload, request: Request):
    conn = conectar()
    try:
        catalogo = conn.execute("SELECT * FROM procedimentos WHERE id=? AND COALESCE(ativo,1)=1", (int(payload.procedimento_id),)).fetchone() if payload.procedimento_id else None
        nome = str(catalogo["nome"] if catalogo else payload.procedimento_nome or "").strip()
        if not nome:
            raise HTTPException(status_code=400, detail="Informe o procedimento.")
        agora = agora_str()
        cursor = conn.execute(
            "INSERT INTO plano_tratamento_procedimentos (paciente_id, procedimento_id, procedimento_nome, status, observacao, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, 'Planejado', ?, ?, ?, ?)",
            (int(paciente_id), int(catalogo["id"]) if catalogo else None, corrigir_texto_importado(nome), str(payload.observacao or "").strip(), usuario_request(request), agora, agora),
        )
        if catalogo and payload.incluir_passos_padrao:
            for ordem, titulo in enumerate(lista_json_segura(catalogo["etapas_json"]), start=1):
                if str(titulo).strip():
                    conn.execute("INSERT INTO plano_tratamento_passos (plano_procedimento_id, titulo, ordem, status, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, 'Pendente', ?, ?, ?)", (int(cursor.lastrowid), str(titulo).strip(), ordem, usuario_request(request), agora, agora))
        conn.commit()
        return next(item for item in carregar_plano_tratamento(conn, paciente_id) if item.id == int(cursor.lastrowid))
    finally:
        conn.close()


@app.post("/api/plano-tratamento/{plano_id}/passos", response_model=PlanoTratamentoPassoResposta)
def adicionar_passo_plano(plano_id: int, payload: PlanoTratamentoPassoPayload, request: Request):
    titulo = corrigir_texto_importado(str(payload.titulo or "").strip())
    if not titulo:
        raise HTTPException(status_code=400, detail="Informe o nome do passo.")
    conn = conectar()
    try:
        if not conn.execute("SELECT id FROM plano_tratamento_procedimentos WHERE id=?", (int(plano_id),)).fetchone():
            raise HTTPException(status_code=404, detail="Procedimento do plano nao encontrado.")
        ordem = int(conn.execute("SELECT COALESCE(MAX(ordem),0)+1 AS proxima FROM plano_tratamento_passos WHERE plano_procedimento_id=?", (int(plano_id),)).fetchone()["proxima"])
        agora = agora_str()
        cursor = conn.execute("INSERT INTO plano_tratamento_passos (plano_procedimento_id, titulo, ordem, status, data_prevista, observacao, criado_por, criado_em, atualizado_em) VALUES (?, ?, ?, 'Pendente', ?, ?, ?, ?, ?)", (int(plano_id), titulo, ordem, str(payload.data_prevista or ""), str(payload.observacao or ""), usuario_request(request), agora, agora))
        conn.commit()
        return PlanoTratamentoPassoResposta(id=int(cursor.lastrowid), titulo=titulo, ordem=ordem, status="Pendente", dataPrevista=str(payload.data_prevista or ""), observacao=str(payload.observacao or ""))
    finally:
        conn.close()


@app.patch("/api/plano-tratamento/procedimentos/{plano_id}")
def atualizar_procedimento_plano(plano_id: int, payload: PlanoTratamentoStatusPayload):
    if payload.status not in STATUS_PLANO_PROCEDIMENTO:
        raise HTTPException(status_code=400, detail="Status do procedimento invalido.")
    conn = conectar()
    try:
        cursor = conn.execute("UPDATE plano_tratamento_procedimentos SET status=?, observacao=COALESCE(?, observacao), atualizado_em=? WHERE id=?", (payload.status, payload.observacao, agora_str(), int(plano_id)))
        if not cursor.rowcount: raise HTTPException(status_code=404, detail="Procedimento do plano nao encontrado.")
        conn.commit()
        return {"ok": True}
    finally: conn.close()


@app.patch("/api/plano-tratamento/passos/{passo_id}")
def atualizar_passo_plano(passo_id: int, payload: PlanoTratamentoPassoPayload):
    if payload.status not in STATUS_PLANO_PASSO:
        raise HTTPException(status_code=400, detail="Status do passo invalido.")
    conn = conectar()
    try:
        realizacao = payload.data_realizacao or (date.today().isoformat() if payload.status == "Concluido" else "")
        cursor = conn.execute("UPDATE plano_tratamento_passos SET titulo=COALESCE(NULLIF(?,''),titulo), status=?, data_prevista=?, data_realizacao=?, observacao=?, atualizado_em=? WHERE id=?", (str(payload.titulo or ""), payload.status, str(payload.data_prevista or ""), realizacao, str(payload.observacao or ""), agora_str(), int(passo_id)))
        if not cursor.rowcount: raise HTTPException(status_code=404, detail="Passo nao encontrado.")
        conn.commit()
        return {"ok": True}
    finally: conn.close()


@app.delete("/api/plano-tratamento/passos/{passo_id}")
def excluir_passo_plano(passo_id: int):
    conn = conectar()
    try:
        cursor = conn.execute("DELETE FROM plano_tratamento_passos WHERE id=?", (int(passo_id),))
        if not cursor.rowcount: raise HTTPException(status_code=404, detail="Passo nao encontrado.")
        conn.commit()
        return {"ok": True}
    finally: conn.close()


@app.get("/api/procedimentos", response_model=list[ProcedimentoResumoResposta])
def listar_procedimentos(q: str = Query(default=""), ativos_apenas: bool = Query(default=True)):
    termo = normalizar_texto(q)
    conn = conectar()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM procedimentos
            WHERE (? = '' OR lower(COALESCE(nome, '')) LIKE ? OR lower(COALESCE(categoria, '')) LIKE ?)
              AND (? = 0 OR COALESCE(ativo, 1) = 1)
            ORDER BY lower(COALESCE(nome, '')), id
            """,
            (termo, f"%{termo}%", f"%{termo}%", 1 if ativos_apenas else 0),
        ).fetchall()
    finally:
        conn.close()
    return [mapear_procedimento_resumo(row) for row in rows]


@app.post("/api/procedimentos", response_model=ProcedimentoResumoResposta)
def criar_procedimento(payload: ProcedimentoPayload, request: Request):
    nome = corrigir_texto_importado(str(payload.nome or "").strip())
    categoria = corrigir_texto_importado(str(payload.categoria or "").strip())
    descricao = corrigir_texto_importado(str(payload.descricao or "").strip())
    materiais_padrao = [corrigir_texto_importado(str(item).strip()) for item in payload.materiais_padrao if str(item).strip()]
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do procedimento.")

    conn = conectar()
    try:
        existente = conn.execute(
            "SELECT id FROM procedimentos WHERE lower(COALESCE(nome, ''))=lower(?) LIMIT 1",
            (nome,),
        ).fetchone()
        if existente is not None:
            raise HTTPException(status_code=409, detail="Ja existe um procedimento com esse nome.")
        cursor = conn.execute(
            """
            INSERT INTO procedimentos
            (nome, categoria, valor_padrao, duracao_padrao_minutos, descricao, etapas_json, materiais_json, cor_opcional, ativo, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?)
            """,
            (
                nome,
                categoria,
                float(payload.valor_padrao or 0),
                max(5, int(payload.duracao_padrao_minutos or 60)),
                descricao,
                json.dumps([corrigir_texto_importado(str(item).strip()) for item in payload.etapas_padrao if str(item).strip()], ensure_ascii=False),
                json.dumps(materiais_padrao, ensure_ascii=False),
                1 if payload.ativo else 0,
                agora_str(),
                agora_str(),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM procedimentos WHERE id=?", (int(cursor.lastrowid),)).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="Criacao",
        tipo="Procedimento",
        info=nome,
        metodo_http="POST",
        rota="/api/procedimentos",
    )
    return mapear_procedimento_resumo(row)


@app.put("/api/procedimentos/{procedimento_id}", response_model=ProcedimentoResumoResposta)
def atualizar_procedimento(procedimento_id: int, payload: ProcedimentoPayload, request: Request):
    nome = corrigir_texto_importado(str(payload.nome or "").strip())
    categoria = corrigir_texto_importado(str(payload.categoria or "").strip())
    descricao = corrigir_texto_importado(str(payload.descricao or "").strip())
    materiais_padrao = [corrigir_texto_importado(str(item).strip()) for item in payload.materiais_padrao if str(item).strip()]
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do procedimento.")

    conn = conectar()
    try:
        existente = conn.execute("SELECT id FROM procedimentos WHERE id=?", (int(procedimento_id),)).fetchone()
        if existente is None:
            raise HTTPException(status_code=404, detail="Procedimento nao encontrado.")
        duplicado = conn.execute(
            "SELECT id FROM procedimentos WHERE lower(COALESCE(nome, ''))=lower(?) AND id<>? LIMIT 1",
            (nome, int(procedimento_id)),
        ).fetchone()
        if duplicado is not None:
            raise HTTPException(status_code=409, detail="Ja existe outro procedimento com esse nome.")
        conn.execute(
            """
            UPDATE procedimentos
            SET nome=?, categoria=?, valor_padrao=?, duracao_padrao_minutos=?, descricao=?, etapas_json=?, materiais_json=?, ativo=?, atualizado_em=?
            WHERE id=?
            """,
            (
                nome,
                categoria,
                float(payload.valor_padrao or 0),
                max(5, int(payload.duracao_padrao_minutos or 60)),
                descricao,
                json.dumps([corrigir_texto_importado(str(item).strip()) for item in payload.etapas_padrao if str(item).strip()], ensure_ascii=False),
                json.dumps(materiais_padrao, ensure_ascii=False),
                1 if payload.ativo else 0,
                agora_str(),
                int(procedimento_id),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM procedimentos WHERE id=?", (int(procedimento_id),)).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="Edicao",
        tipo="Procedimento",
        info=nome,
        metodo_http="PUT",
        rota=f"/api/procedimentos/{procedimento_id}",
    )
    return mapear_procedimento_resumo(row)


@app.delete("/api/procedimentos/{procedimento_id}")
def excluir_procedimento(procedimento_id: int, request: Request):
    conn = conectar()
    try:
        row = conn.execute("SELECT nome FROM procedimentos WHERE id=?", (int(procedimento_id),)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Procedimento nao encontrado.")
        conn.execute("DELETE FROM procedimentos WHERE id=?", (int(procedimento_id),))
        conn.commit()
        nome = str(row["nome"] or "")
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="Exclusao",
        tipo="Procedimento",
        info=nome,
        metodo_http="DELETE",
        rota=f"/api/procedimentos/{procedimento_id}",
    )
    return {"ok": True}


STATUS_GUIA_VALIDOS = ("Emitida", "Escaneado", "Enviado ao laboratório", "Pronto e na clínica")


def mapear_ordem_servico_controle(conn: sqlite3.Connection, ordem: sqlite3.Row) -> OrdemServicoResumoResposta:
    etapas_rows = conn.execute(
        "SELECT etapa, descricao_outro FROM ordem_servico_protetico_etapas WHERE ordem_servico_id=? ORDER BY id",
        (int(ordem["id"]),),
    ).fetchall()
    movimentos = conn.execute(
        """
        SELECT id, status_anterior, status_novo, laboratorio_id, laboratorio_nome_snapshot,
               observacao, criado_por, criado_em
        FROM ordem_servico_movimentacoes
        WHERE ordem_servico_id=? ORDER BY id DESC
        """,
        (int(ordem["id"]),),
    ).fetchall()
    paciente = conn.execute(
        "SELECT id, nome, prontuario FROM pacientes WHERE id=?",
        (int(ordem["paciente_id"] or 0),),
    ).fetchone()
    laboratorio = None
    if ordem["laboratorio_id"] is not None:
        laboratorio = conn.execute("SELECT nome FROM guia_laboratorios WHERE id=?", (int(ordem["laboratorio_id"]),)).fetchone()
    movimento_atual = movimentos[0] if movimentos else None
    status_atual = str(movimento_atual["status_novo"] or ordem["status"] or "Emitida") if movimento_atual else str(ordem["status"] or "Emitida")
    status_atualizado_por = str(movimento_atual["criado_por"] or ordem["status_atualizado_por"] or "") if movimento_atual else str(ordem["status_atualizado_por"] or "")
    status_atualizado_em = str(movimento_atual["criado_em"] or ordem["status_atualizado_em"] or ordem["criado_em"] or "") if movimento_atual else str(ordem["status_atualizado_em"] or ordem["criado_em"] or "")
    return OrdemServicoResumoResposta(
        id=int(ordem["id"]),
        procedimentoId=int(ordem["procedimento_id"]) if ordem["procedimento_id"] is not None else None,
        procedimentoNome=corrigir_texto_importado(str(ordem["procedimento_nome_snapshot"] or "")),
        material=corrigir_texto_importado(str(ordem["material"] or "")),
        materialOutro=corrigir_texto_importado(str(ordem["material_outro"] or "")),
        cor=corrigir_texto_importado(str(ordem["cor"] or "")),
        escala=corrigir_texto_importado(str(ordem["escala"] or "")),
        elementoArcada=corrigir_texto_importado(str(ordem["elemento_arcada"] or "")),
        cargaImediata=bool(ordem["carga_imediata"] or 0),
        retornoSolicitado=str(ordem["retorno_solicitado"] or ""),
        documentoNome=str(ordem["documento_nome"] or ""),
        observacao=corrigir_texto_importado(str(ordem["observacao"] or "")),
        criadoPor=corrigir_texto_importado(str(ordem["criado_por"] or "")),
        criadoEm=str(ordem["criado_em"] or ""),
        etapas=[OrdemServicoEtapaPayload(etapa=str(item["etapa"] or ""), descricao_outro=str(item["descricao_outro"] or "")) for item in etapas_rows],
        pacienteId=int(paciente["id"]) if paciente else None,
        pacienteNome=corrigir_texto_importado(str(paciente["nome"] or "")) if paciente else "",
        prontuario=formatar_prontuario_valor(paciente["prontuario"]) if paciente else "",
        status=status_atual,
        laboratorioId=int(ordem["laboratorio_id"]) if ordem["laboratorio_id"] is not None else None,
        laboratorioNome=corrigir_texto_importado(str(laboratorio["nome"] or "")) if laboratorio else "",
        statusAtualizadoPor=corrigir_texto_importado(status_atualizado_por),
        statusAtualizadoEm=status_atualizado_em,
        movimentacoes=[{
            "id": int(item["id"]), "statusAnterior": str(item["status_anterior"] or ""),
            "statusNovo": str(item["status_novo"] or ""), "laboratorioId": item["laboratorio_id"],
            "laboratorioNome": str(item["laboratorio_nome_snapshot"] or ""),
            "observacao": str(item["observacao"] or ""), "criadoPor": str(item["criado_por"] or ""),
            "criadoEm": str(item["criado_em"] or ""),
        } for item in movimentos],
    )


@app.get("/api/guias/controle", response_model=list[OrdemServicoResumoResposta])
def listar_controle_guias():
    conn = conectar()
    try:
        ordens = conn.execute("SELECT * FROM ordens_servico_protetico ORDER BY COALESCE(status_atualizado_em, criado_em, '') DESC, id DESC").fetchall()
        return [mapear_ordem_servico_controle(conn, ordem) for ordem in ordens]
    finally:
        conn.close()


@app.get("/api/guias/laboratorios", response_model=list[GuiaLaboratorioResposta])
def listar_laboratorios_guias():
    conn = conectar()
    try:
        rows = conn.execute("SELECT id, nome, ativo FROM guia_laboratorios ORDER BY ativo DESC, nome COLLATE NOCASE").fetchall()
        return [GuiaLaboratorioResposta(id=int(row["id"]), nome=str(row["nome"]), ativo=bool(row["ativo"])) for row in rows]
    finally:
        conn.close()


@app.post("/api/guias/laboratorios", response_model=GuiaLaboratorioResposta)
def criar_laboratorio_guia(payload: GuiaLaboratorioPayload, request: Request):
    nome = corrigir_texto_importado(str(payload.nome or "").strip())
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do laboratório.")
    conn = conectar()
    try:
        if conn.execute("SELECT id FROM guia_laboratorios WHERE lower(nome)=lower(?)", (nome,)).fetchone():
            raise HTTPException(status_code=409, detail="Este laboratório já está cadastrado.")
        cursor = conn.execute("INSERT INTO guia_laboratorios (nome, ativo, criado_em, atualizado_em) VALUES (?, ?, ?, ?)", (nome, 1 if payload.ativo else 0, agora_str(), agora_str()))
        conn.commit()
        laboratorio_id = int(cursor.lastrowid)
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Criação", tipo="Laboratório de guia", info=nome, metodo_http="POST", rota="/api/guias/laboratorios")
    return GuiaLaboratorioResposta(id=laboratorio_id, nome=nome, ativo=payload.ativo)


@app.put("/api/guias/laboratorios/{laboratorio_id}", response_model=GuiaLaboratorioResposta)
def atualizar_laboratorio_guia(laboratorio_id: int, payload: GuiaLaboratorioPayload, request: Request):
    nome = corrigir_texto_importado(str(payload.nome or "").strip())
    if not nome:
        raise HTTPException(status_code=400, detail="Informe o nome do laboratório.")
    conn = conectar()
    try:
        if conn.execute("SELECT id FROM guia_laboratorios WHERE id=?", (laboratorio_id,)).fetchone() is None:
            raise HTTPException(status_code=404, detail="Laboratório não encontrado.")
        if conn.execute("SELECT id FROM guia_laboratorios WHERE lower(nome)=lower(?) AND id<>?", (nome, laboratorio_id)).fetchone():
            raise HTTPException(status_code=409, detail="Este laboratório já está cadastrado.")
        conn.execute("UPDATE guia_laboratorios SET nome=?, ativo=?, atualizado_em=? WHERE id=?", (nome, 1 if payload.ativo else 0, agora_str(), laboratorio_id))
        conn.commit()
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Edição", tipo="Laboratório de guia", info=nome, metodo_http="PUT", rota=f"/api/guias/laboratorios/{laboratorio_id}")
    return GuiaLaboratorioResposta(id=laboratorio_id, nome=nome, ativo=payload.ativo)


@app.put("/api/guias/{guia_id}/movimentar", response_model=OrdemServicoResumoResposta)
def movimentar_guia(guia_id: int, payload: GuiaMovimentacaoPayload, request: Request):
    status_novo = corrigir_texto_importado(str(payload.status or "").strip())
    if status_novo not in STATUS_GUIA_VALIDOS:
        raise HTTPException(status_code=400, detail="Status de guia inválido.")
    conn = conectar()
    try:
        ordem = conn.execute("SELECT * FROM ordens_servico_protetico WHERE id=?", (guia_id,)).fetchone()
        if ordem is None:
            raise HTTPException(status_code=404, detail="Guia não encontrada.")
        laboratorio = None
        laboratorio_id = int(payload.laboratorio_id or 0)
        if laboratorio_id:
            laboratorio = conn.execute("SELECT * FROM guia_laboratorios WHERE id=? AND ativo=1", (laboratorio_id,)).fetchone()
            if laboratorio is None:
                raise HTTPException(status_code=400, detail="Selecione um laboratório ativo.")
        if status_novo in ("Escaneado", "Enviado ao laboratório") and laboratorio is None:
            raise HTTPException(status_code=400, detail="Informe o destino da guia.")
        if laboratorio is None and ordem["laboratorio_id"] is not None and status_novo == "Pronto e na clínica":
            laboratorio_id = int(ordem["laboratorio_id"])
            laboratorio = conn.execute("SELECT * FROM guia_laboratorios WHERE id=?", (laboratorio_id,)).fetchone()
        if status_novo == "Emitida":
            laboratorio_id, laboratorio = 0, None
        usuario = corrigir_texto_importado(usuario_request(request) or "").strip()
        momento = agora_str()
        conn.execute("UPDATE ordens_servico_protetico SET status=?, laboratorio_id=?, status_atualizado_por=?, status_atualizado_em=?, atualizado_em=? WHERE id=?", (status_novo, laboratorio_id or None, usuario, momento, momento, guia_id))
        conn.execute("INSERT INTO ordem_servico_movimentacoes (ordem_servico_id, status_anterior, status_novo, laboratorio_id, laboratorio_nome_snapshot, observacao, criado_por, criado_em) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", (guia_id, str(ordem["status"] or "Emitida"), status_novo, laboratorio_id or None, str(laboratorio["nome"] or "") if laboratorio else "", corrigir_texto_importado(str(payload.observacao or "").strip()), usuario, momento))
        conn.commit()
        atualizada = conn.execute("SELECT * FROM ordens_servico_protetico WHERE id=?", (guia_id,)).fetchone()
        if atualizada is None or str(atualizada["status"] or "") != status_novo:
            raise HTTPException(status_code=500, detail="Não foi possível confirmar o novo status da guia.")
        resposta = mapear_ordem_servico_controle(conn, atualizada)
    finally:
        conn.close()
    registrar_acao_usuario(usuario_request(request), acao="Movimentação", tipo="Guia", info=f"#{guia_id} · {status_novo}", metodo_http="PUT", rota=f"/api/guias/{guia_id}/movimentar")
    return resposta


@app.get("/api/pacientes/{paciente_id}/ordens-servico", response_model=list[OrdemServicoResumoResposta])
def listar_ordens_servico_paciente(paciente_id: int):
    conn = conectar()
    try:
        ordens = conn.execute(
            """
            SELECT *
            FROM ordens_servico_protetico
            WHERE paciente_id=?
            ORDER BY COALESCE(criado_em, '') DESC, id DESC
            """,
            (int(paciente_id),),
        ).fetchall()
        respostas = [mapear_ordem_servico_controle(conn, ordem) for ordem in ordens]
    finally:
        conn.close()
    return respostas


@app.post("/api/pacientes/{paciente_id}/ordens-servico", response_model=OrdemServicoResumoResposta)
def criar_ordem_servico_paciente(paciente_id: int, payload: OrdemServicoPayload, request: Request):
    conn = conectar()
    try:
        usuario_criacao = corrigir_texto_importado(usuario_request(request) or "").strip()
        paciente = conn.execute("SELECT id, nome, prontuario FROM pacientes WHERE id=?", (int(paciente_id),)).fetchone()
        if paciente is None:
            raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
        procedimento = None
        if int(payload.procedimento_id or 0) > 0:
            procedimento = conn.execute(
                "SELECT * FROM procedimentos WHERE id=? AND COALESCE(ativo,1)=1",
                (int(payload.procedimento_id),),
            ).fetchone()
        procedimentos_contratados_rows = conn.execute(
            """
            SELECT pc.procedimento
            FROM procedimentos_contrato pc
            JOIN contratos c ON c.id = pc.contrato_id
            WHERE c.paciente_id=? AND COALESCE(c.status, 'EM_ABERTO')='APROVADO'
            """,
            (int(paciente_id),),
        ).fetchall()
        procedimentos_contratados = [
            str(item["procedimento"] or "").strip()
            for item in procedimentos_contratados_rows
            if str(item["procedimento"] or "").strip()
        ]
        procedimento_nome = corrigir_texto_importado(str(payload.procedimento_nome or "").strip())
        if procedimento is not None:
            procedimento_nome = corrigir_texto_importado(str(procedimento["nome"] or "").strip())
        if not procedimento_nome:
            raise HTTPException(status_code=400, detail="Informe o procedimento da ordem de serviço.")
        procedimento_manual = procedimento is None and int(payload.procedimento_id or 0) <= 0
        if (
            procedimentos_contratados
            and not procedimento_manual
            and not any(textos_compativeis(procedimento_nome, item) for item in procedimentos_contratados)
        ):
            raise HTTPException(status_code=400, detail="Selecione apenas um procedimento contratado para este paciente.")
        material = corrigir_texto_importado(str(payload.material or "").strip())
        material_outro = corrigir_texto_importado(str(payload.material_outro or "").strip())
        cor = corrigir_texto_importado(str(payload.cor or "").strip())
        escala = corrigir_texto_importado(str(payload.escala or "").strip())
        elemento_arcada = corrigir_texto_importado(str(payload.elemento_arcada or "").strip())
        retorno_solicitado = str(payload.retorno_solicitado or "").strip()
        carga_imediata = bool(payload.carga_imediata)
        if not elemento_arcada:
            raise HTTPException(status_code=400, detail="Informe o elemento ou arcada.")
        if not retorno_solicitado:
            raise HTTPException(status_code=400, detail="Informe a data de retorno solicitada.")
        etapas_validas = mapear_procedimento_resumo(procedimento).etapasPadrao if procedimento is not None else []
        etapas_limpas: list[tuple[str, str]] = []
        for item in payload.etapas:
            etapa = corrigir_texto_importado(str(item.etapa or "").strip())
            descricao_outro = corrigir_texto_importado(str(item.descricao_outro or "").strip())
            if not etapa:
                continue
            if etapa.lower() == "outro":
                if not descricao_outro:
                    raise HTTPException(status_code=400, detail="Descreva a etapa quando selecionar Outro.")
            elif etapas_validas and etapa not in etapas_validas:
                raise HTTPException(status_code=400, detail="Etapa invalida para o procedimento selecionado.")
            etapas_limpas.append((etapa, descricao_outro))
        if not etapas_limpas:
            raise HTTPException(status_code=400, detail="Selecione ao menos uma etapa.")

        cursor = conn.execute(
            """
            INSERT INTO ordens_servico_protetico
            (paciente_id, procedimento_id, procedimento_nome_snapshot, material, material_outro, cor, escala, elemento_arcada, carga_imediata, retorno_solicitado, observacao, status, status_atualizado_por, status_atualizado_em, criado_por, criado_em, atualizado_em)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Emitida', ?, ?, ?, ?, ?)
            """,
            (
                int(paciente_id),
                int(procedimento["id"]) if procedimento is not None else None,
                procedimento_nome,
                material,
                material_outro,
                cor,
                escala,
                elemento_arcada,
                1 if carga_imediata else 0,
                retorno_solicitado,
                corrigir_texto_importado(str(payload.observacao or "").strip()),
                usuario_criacao,
                agora_str(),
                usuario_criacao,
                agora_str(),
                agora_str(),
            ),
        )
        ordem_id = int(cursor.lastrowid)
        for etapa, descricao_outro in etapas_limpas:
            conn.execute(
                """
                INSERT INTO ordem_servico_protetico_etapas
                (ordem_servico_id, etapa, descricao_outro, criado_em)
                VALUES (?, ?, ?, ?)
                """,
                (ordem_id, etapa, descricao_outro, agora_str()),
            )
        documento_nome = gerar_documento_ordem_servico(
            paciente_row=paciente,
            ordem_id=ordem_id,
            procedimento_nome=procedimento_nome,
            material=material,
            material_outro=material_outro,
            elemento_arcada=elemento_arcada,
            escala=escala,
            cor=cor,
            carga_imediata=carga_imediata,
            retorno_solicitado=retorno_solicitado,
            etapas=etapas_limpas,
            observacao=corrigir_texto_importado(str(payload.observacao or "").strip()),
            criado_por=usuario_criacao,
        )
        conn.execute("UPDATE ordens_servico_protetico SET documento_nome=?, atualizado_em=? WHERE id=?", (documento_nome, agora_str(), ordem_id))
        conn.execute(
            "INSERT INTO ordem_servico_movimentacoes (ordem_servico_id, status_anterior, status_novo, observacao, criado_por, criado_em) VALUES (?, '', 'Emitida', 'Guia emitida', ?, ?)",
            (ordem_id, usuario_criacao, agora_str()),
        )
        conn.commit()
        ordem = conn.execute("SELECT * FROM ordens_servico_protetico WHERE id=?", (ordem_id,)).fetchone()
        resposta_ordem = mapear_ordem_servico_controle(conn, ordem)
    finally:
        conn.close()

    registrar_acao_usuario(
        usuario_request(request),
        acao="Criacao",
        tipo="Ordem de Servico",
        info=procedimento_nome,
        metodo_http="POST",
        rota=f"/api/pacientes/{paciente_id}/ordens-servico",
    )

    return resposta_ordem


def mapear_paciente_resumo(row: sqlite3.Row) -> PacienteResumo:
    return PacienteResumo(
        id=int(row["id"]),
        nome=str(row["nome"] or ""),
        apelido=str(row["apelido"] or ""),
        prontuario=formatar_prontuario_valor(row["prontuario"]),
        cpf=str(row["cpf"] or ""),
        telefone=str(row["telefone"] or ""),
        email=str(row["email"] or ""),
        dataNascimento=formatar_data_br_valor(row["data_nascimento"]),
        fotoUrl=url_foto_paciente(row),
        tratamentoSuspenso=bool(int(row["tratamento_suspenso"] or 0)),
    )


def mapear_paciente_detalhe(row: sqlite3.Row) -> PacienteDetalhe:
    return PacienteDetalhe(
        id=int(row["id"]),
        nome=str(row["nome"] or ""),
        apelido=str(row["apelido"] or ""),
        sexo=str(row["sexo"] or ""),
        prontuario=formatar_prontuario_valor(row["prontuario"]),
        cpf=str(row["cpf"] or ""),
        rg=str(row["rg"] or ""),
        dataNascimento=formatar_data_br_valor(row["data_nascimento"]),
        telefone=str(row["telefone"] or ""),
        email=str(row["email"] or ""),
        cep=str(row["cep"] or ""),
        endereco=str(row["endereco"] or ""),
        complemento=str(row["complemento"] or ""),
        numero=str(row["numero"] or ""),
        bairro=str(row["bairro"] or ""),
        cidade=str(row["cidade"] or ""),
        estado=str(row["estado"] or ""),
        estadoCivil=str(row["estado_civil"] or ""),
        profissao=str(row["profissao"] or ""),
        origem=str(row["origem"] or ""),
        observacoes=str(row["observacoes"] or ""),
        menorIdade=bool(int(row["menor_idade"] or 0)),
        responsavel=str(row["responsavel"] or ""),
        cpfResponsavel=str(row["cpf_responsavel"] or ""),
        fotoUrl=url_foto_paciente(row),
        tratamentoSuspenso=bool(int(row["tratamento_suspenso"] or 0)),
        tratamentoSuspensoObservacao=str(row["tratamento_suspenso_observacao"] or ""),
        tratamentoSuspensoPor=str(row["tratamento_suspenso_por"] or ""),
        tratamentoSuspensoEm=str(row["tratamento_suspenso_em"] or ""),
    )


def atualizar_suspensao_tratamento_paciente_db(
    conn: sqlite3.Connection,
    *,
    paciente_id: int,
    suspenso: bool,
    observacao: str,
    usuario: str,
) -> sqlite3.Row:
    carregar_paciente_por_id(conn, paciente_id)
    conn.execute(
        """
        UPDATE pacientes
        SET tratamento_suspenso=?,
            tratamento_suspenso_observacao=?,
            tratamento_suspenso_por=?,
            tratamento_suspenso_em=?
        WHERE id=?
        """,
        (
            int(bool(suspenso)),
            observacao.strip() if suspenso else "",
            usuario.strip() if suspenso else "",
            datetime.now().strftime("%d/%m/%Y %H:%M") if suspenso else "",
            int(paciente_id),
        ),
    )
    conn.commit()
    return carregar_paciente_por_id(conn, paciente_id)


def carregar_paciente_por_id(conn: sqlite3.Connection, paciente_id: int) -> sqlite3.Row:
    row = conn.execute("SELECT * FROM pacientes WHERE id=?", (paciente_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Paciente nao encontrado.")
    return row


def filtrar_pacientes(rows: list[sqlite3.Row], termo: str) -> list[sqlite3.Row]:
    termo_norm = normalizar_texto(termo)
    if not termo_norm:
        return rows

    def combina(row: sqlite3.Row) -> bool:
        campos = [
            row["nome"],
            row["apelido"],
            formatar_prontuario_valor(row["prontuario"]),
            row["cpf"],
            row["telefone"],
            row["email"],
        ]
        return termo_norm in normalizar_texto(" ".join(str(campo or "") for campo in campos))

    return [row for row in rows if combina(row)]


def carregar_procedimentos_contrato(conn: sqlite3.Connection, contrato_id: int) -> list[str]:
    rows = conn.execute(
        "SELECT procedimento FROM procedimentos_contrato WHERE contrato_id=? ORDER BY id",
        (contrato_id,),
    ).fetchall()
    procedimentos: list[str] = []
    vistos: set[str] = set()
    for row in rows:
        procedimento = str(row["procedimento"] or "").strip()
        chave = normalizar_texto(procedimento)
        if not procedimento or chave in vistos:
            continue
        vistos.add(chave)
        procedimentos.append(procedimento)
    return procedimentos


def carregar_dentes_contratados(conn: sqlite3.Connection, paciente_id: int) -> list[int]:
    rows = conn.execute(
        """
        SELECT DISTINCT dente
        FROM procedimentos_dente
        WHERE paciente_id=? AND upper(trim(COALESCE(status, '')))='CONTRATADO' AND dente IS NOT NULL
        ORDER BY dente
        """,
        (paciente_id,),
    ).fetchall()
    return [int(row["dente"]) for row in rows if row["dente"] is not None]


def denticao_por_dente(dente: int | None) -> str:
    if dente is None:
        return ""
    return "Decidua" if 50 < int(dente) < 90 else "Permanente"


def carregar_elementos_odontograma(conn: sqlite3.Connection, paciente_id: int) -> list[dict]:
    rows = conn.execute(
        """
        SELECT dente, regiao, procedimento
        FROM procedimentos_dente
        WHERE paciente_id=? AND upper(trim(COALESCE(status, '')))='CONTRATADO'
        ORDER BY COALESCE(dente, 999), regiao, procedimento
        """,
        (paciente_id,),
    ).fetchall()
    agrupado: dict[str, dict] = {}
    for row in rows:
        dente = int(row["dente"]) if row["dente"] is not None else None
        elemento = str(dente) if dente is not None else str(row["regiao"] or "").strip()
        if not elemento:
            continue
        item = agrupado.setdefault(
            elemento,
            {
                "elemento": elemento,
                "dente": dente,
                "denticao": denticao_por_dente(dente),
                "procedimentos": [],
            },
        )
        procedimento = str(row["procedimento"] or "").strip()
        if procedimento and procedimento not in item["procedimentos"]:
            item["procedimentos"].append(procedimento)

    return sorted(
        agrupado.values(),
        key=lambda item: (
            0 if item["dente"] is not None else 1,
            item["dente"] if item["dente"] is not None else item["elemento"],
        ),
    )


def carregar_orcamento_detalhe(conn: sqlite3.Connection, paciente_id: int, contrato_id: int) -> OrcamentoDetalheResposta:
    contrato = conn.execute(
        "SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1",
        (contrato_id, paciente_id),
    ).fetchone()
    if contrato is None:
        raise HTTPException(status_code=404, detail="Orcamento nao encontrado.")

    procedimentos_rows = conn.execute(
        "SELECT * FROM procedimentos_contrato WHERE contrato_id=? ORDER BY id",
        (contrato_id,),
    ).fetchall()
    dentes_rows = conn.execute(
        "SELECT * FROM procedimentos_dente WHERE contrato_id=? ORDER BY id",
        (contrato_id,),
    ).fetchall()

    procedimentos_agrupados: dict[str, dict[str, object]] = {}
    ordem_procedimentos: list[str] = []
    for proc_row in procedimentos_rows:
        procedimento_nome = str(proc_row["procedimento"] or "").strip()
        chave = normalizar_texto(procedimento_nome)
        if not procedimento_nome or not chave:
            continue
        if chave not in procedimentos_agrupados:
            ordem_procedimentos.append(chave)
            procedimentos_agrupados[chave] = {
                "nome": procedimento_nome,
                "profissional": str(proc_row["profissional_snapshot"] or ""),
                "denticao": str(proc_row["denticao_snapshot"] or ""),
                "valor": 0.0,
            }
        procedimentos_agrupados[chave]["valor"] = float(procedimentos_agrupados[chave]["valor"] or 0) + float(proc_row["valor"] or 0)

    dentes_por_procedimento: dict[str, list[sqlite3.Row]] = {}
    for row in dentes_rows:
        dentes_por_procedimento.setdefault(normalizar_texto(row["procedimento"]), []).append(row)

    itens: list[OrcamentoItemPayload] = []
    for chave in ordem_procedimentos:
        grupo = procedimentos_agrupados[chave]
        grupo_rows = dentes_por_procedimento.get(chave, [])
        if not grupo_rows:
            grupo_rows = [{
                "regiao": "Sem região informada",
                "dente": None,
                "valor": float(grupo["valor"] or 0),
                "status": "ATIVO",
                "faces": "",
            }]
        regioes = [
            OrcamentoRegiaoPayload(
                regiao=str(row["regiao"] or row["dente"] or "Sem região informada").strip(),
                dente=int(row["dente"]) if row["dente"] is not None else None,
                valor=float(row["valor"] or 0),
                ativo=normalizar_texto(row["status"]) != "excluido",
                faces=[face for face in str(row["faces"] or "").split(",") if face],
            )
            for row in grupo_rows
        ]
        itens.append(
            OrcamentoItemPayload(
                procedimento=str(grupo["nome"] or ""),
                profissional=str(grupo["profissional"] or ""),
                denticao=str(grupo["denticao"] or ""),
                valor_unitario=float(grupo["valor"] or 0),
                regioes=regioes,
            )
        )

    plano_pagamento_bruto = []
    try:
        plano_pagamento_bruto = json.loads(str(contrato["plano_pagamento_json"] or "[]"))
    except (TypeError, ValueError, json.JSONDecodeError):
        plano_pagamento_bruto = []
    plano_pagamento = [
        ParcelaPagamentoPayload(
            indice=int(item.get("indice", 0) or 0),
            descricao=str(item.get("descricao", "") or ""),
            data=str(item.get("data", "") or ""),
            forma=str(item.get("forma", "") or ""),
            valor=float(item.get("valor", 0) or 0),
            parcelas_cartao=int(item.get("parcelas_cartao", 1) or 1),
        )
        for item in plano_pagamento_bruto
        if isinstance(item, dict)
    ]
    historico = carregar_historico_orcamento(conn, [contrato_id]).get(contrato_id, [])
    crm_historico = carregar_historico_resgate_por_contrato(conn, contrato_id)

    return OrcamentoDetalheResposta(
        contrato_id=contrato_id,
        status=str(contrato["status"] or "EM_ABERTO"),
        aprovadoPor=str(contrato["aprovado_por"] or ""),
        dataAprovacao=formatar_data_br_valor(contrato["data_aprovacao"]),
        clinica=str(contrato["clinica_snapshot"] or ""),
        criadoPor=str(contrato["criado_por_snapshot"] or ""),
        data=formatar_data_br_valor(contrato["data_criacao"]),
        observacoes=str(contrato["observacoes"] or ""),
        tabela=str(contrato["tabela_snapshot"] or ""),
        descontoPercentual=float(contrato["desconto_percentual"] or 0),
        descontoValor=float(contrato["desconto_valor"] or 0),
        validadeOrcamento=formatar_data_br_valor(contrato["validade_orcamento"]),
        dataRetornoCrm=formatar_data_br_valor(contrato["data_retorno_crm"]),
        formaPagamento=str(contrato["forma_pagamento"] or ""),
        parcelas=int(contrato["parcelas"] or 1),
        entrada=float(contrato["entrada"] or 0) > 0,
        planoPagamento=plano_pagamento,
        itens=itens,
        historico=historico,
        crmStatus=normalizar_status_resgate(contrato["crm_status"]),
        crmObservacaoContato=str(contrato["crm_observacao_contato"] or ""),
        crmUltimoContatoEm=formatar_data_hora_relatorio(contrato["crm_ultimo_contato_em"]),
        crmUltimoContatoPor=str(contrato["crm_ultimo_contato_por"] or ""),
        crmHistorico=crm_historico,
    )


def carregar_historico_orcamento(
    conn: sqlite3.Connection,
    contrato_ids: list[int],
) -> dict[int, list[OrcamentoHistoricoItemResposta]]:
    ids = sorted({int(contrato_id) for contrato_id in contrato_ids if int(contrato_id or 0) > 0})
    if not ids:
        return {}
    placeholders = ",".join("?" for _ in ids)
    rows = conn.execute(
        f"""
        SELECT id, contrato_id, COALESCE(tipo, '') AS tipo, COALESCE(observacao, '') AS observacao,
               COALESCE(criado_por, '') AS criado_por, COALESCE(criado_em, '') AS criado_em
        FROM orcamentos_historico
        WHERE contrato_id IN ({placeholders})
        ORDER BY datetime(COALESCE(criado_em, '')) DESC, id DESC
        """,
        ids,
    ).fetchall()
    historico: dict[int, list[OrcamentoHistoricoItemResposta]] = {contrato_id: [] for contrato_id in ids}
    for row in rows:
        contrato_id = int(row["contrato_id"] or 0)
        historico.setdefault(contrato_id, []).append(
            OrcamentoHistoricoItemResposta(
                id=int(row["id"] or 0),
                tipo=str(row["tipo"] or ""),
                observacao=str(row["observacao"] or ""),
                criadoPor=str(row["criado_por"] or ""),
                criadoEm=str(row["criado_em"] or ""),
            )
        )
    return historico


def carregar_historico_resgate_por_contrato(
    conn: sqlite3.Connection,
    contrato_id: int,
) -> list[CrmResgateHistoricoItemResposta]:
    rows = conn.execute(
        """
        SELECT *
        FROM crm_contatos_historico
        WHERE contrato_id=?
        ORDER BY criado_em DESC, id DESC
        """,
        (int(contrato_id),),
    ).fetchall()
    return [
        CrmResgateHistoricoItemResposta(
            id=crm_int(row["id"], 0),
            status=str(row["status"] or ""),
            observacao=str(row["observacao"] or ""),
            proximoContato=formatar_data_br_valor(row["proximo_contato"]),
            criadoPor=str(row["criado_por"] or ""),
            criadoEm=formatar_data_hora_relatorio(row["criado_em"]),
            automatico=crm_bool(row["automatico"]),
        )
        for row in rows
    ]


def registrar_historico_orcamento(
    conn: sqlite3.Connection,
    paciente_id: int,
    contrato_id: int,
    tipo: str,
    observacao: str,
    criado_por: str,
) -> None:
    texto = str(observacao or "").strip()
    if not texto:
        return
    conn.execute(
        """
        INSERT INTO orcamentos_historico (
            contrato_id, paciente_id, tipo, observacao, criado_por, criado_em
        )
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            int(contrato_id),
            int(paciente_id),
            str(tipo or "").strip().upper() or "OBSERVACAO",
            texto,
            str(criado_por or "").strip(),
            agora_str(),
        ),
    )


def assinatura_orcamento_atual(conn: sqlite3.Connection, contrato_id: int) -> str:
    procedimentos_rows = conn.execute(
        """
        SELECT COALESCE(procedimento, '') AS procedimento,
               COALESCE(valor, 0) AS valor,
               COALESCE(profissional_snapshot, '') AS profissional,
               COALESCE(denticao_snapshot, '') AS denticao
        FROM procedimentos_contrato
        WHERE contrato_id=?
        ORDER BY id
        """,
        (contrato_id,),
    ).fetchall()
    regioes_rows = conn.execute(
        """
        SELECT COALESCE(grupo_item, 0) AS grupo_item,
               COALESCE(regiao, '') AS regiao,
               COALESCE(dente, '') AS dente,
               COALESCE(status, '') AS status,
               COALESCE(faces, '') AS faces,
               COALESCE(valor, 0) AS valor
        FROM procedimentos_dente
        WHERE contrato_id=?
        ORDER BY grupo_item, id
        """,
        (contrato_id,),
    ).fetchall()
    assinatura = {
        "procedimentos": [
            {
                "procedimento": str(row["procedimento"] or ""),
                "valor": float(row["valor"] or 0),
                "profissional": str(row["profissional"] or ""),
                "denticao": str(row["denticao"] or ""),
            }
            for row in procedimentos_rows
        ],
        "regioes": [
            {
                "grupo_item": int(row["grupo_item"] or 0),
                "regiao": str(row["regiao"] or ""),
                "dente": str(row["dente"] or ""),
                "status": str(row["status"] or ""),
                "faces": str(row["faces"] or ""),
                "valor": float(row["valor"] or 0),
            }
            for row in regioes_rows
        ],
    }
    return json.dumps(assinatura, ensure_ascii=False, sort_keys=True)


FORMAS_PAGAMENTO_ORCAMENTO = {
    "PERMUTA",
    "PIX",
    "BOLETO",
    "CARTAO_CREDITO",
    "CARTAO_DEBITO",
    "DINHEIRO",
}


def contrato_eh_permuta(contrato: sqlite3.Row | dict) -> bool:
    return "permuta" in normalizar_texto(str(contrato["forma_pagamento"] or ""))


def validar_plano_pagamento_orcamento(
    parcelas: list[ParcelaPagamentoPayload],
    valor_total: float,
    data_base: str,
) -> list[ParcelaPagamentoPayload]:
    plano: list[ParcelaPagamentoPayload] = []
    for indice, parcela in enumerate(parcelas):
        valor = round(float(parcela.valor or 0), 2)
        if valor <= 0:
            continue
        forma = str(parcela.forma or "").strip().upper().replace(" ", "_")
        forma = forma.replace("CARTÃO", "CARTAO").replace("CRÉDITO", "CREDITO").replace("DÉBITO", "DEBITO")
        if forma not in FORMAS_PAGAMENTO_ORCAMENTO:
            raise HTTPException(status_code=400, detail=f"Forma de pagamento inválida na linha {indice + 1}.")
        data_informada = str(parcela.data or "").strip()
        if not data_informada:
            raise HTTPException(status_code=400, detail=f"Informe a data da forma de pagamento na linha {indice + 1}.")
        data_normalizada = normalizar_data_contrato_iso(data_informada, "")
        if not data_normalizada:
            raise HTTPException(status_code=400, detail=f"Data de pagamento inválida na linha {indice + 1}.")
        plano.append(
            parcela.model_copy(
                update={
                    "indice": len(plano),
                    "data": data_normalizada,
                    "forma": forma,
                    "valor": valor,
                    "parcelas_cartao": max(1, int(parcela.parcelas_cartao or 1)) if forma == "CARTAO_CREDITO" else 1,
                }
            )
        )
    if not plano:
        raise HTTPException(status_code=400, detail="Informe ao menos uma forma de pagamento com valor maior que zero.")
    soma_plano = round(sum(float(parcela.valor or 0) for parcela in plano), 2)
    if abs(soma_plano - round(float(valor_total or 0), 2)) > 0.009:
        raise HTTPException(
            status_code=400,
            detail=f"A soma das formas de pagamento ({formatar_moeda_br(soma_plano)}) deve ser igual ao total do orçamento ({formatar_moeda_br(valor_total)}).",
        )
    return plano


def salvar_orcamento_paciente(
    conn: sqlite3.Connection,
    paciente_id: int,
    payload: OrcamentoPacientePayload,
    contrato_id: int | None = None,
) -> int:
    itens_validos = []
    for item in payload.itens:
        regioes_validas = [regiao for regiao in item.regioes if str(regiao.regiao or "").strip()]
        if regioes_validas and str(item.procedimento or "").strip():
            itens_validos.append((item, regioes_validas))

    if not any(regiao.ativo for item, regioes in itens_validos for regiao in regioes):
        raise HTTPException(status_code=400, detail="Informe ao menos um procedimento com dentes/regioes ativos.")

    valor_bruto = sum(sum(float(regiao.valor or 0) for regiao in regioes if regiao.ativo) for _, regioes in itens_validos)
    desconto_percentual = max(0.0, float(payload.desconto_percentual or 0))
    desconto_valor = max(0.0, float(payload.desconto_valor or 0))
    valor_total = max(0.0, valor_bruto - (valor_bruto * desconto_percentual / 100.0) - desconto_valor)
    data_base = normalizar_data_contrato_iso(payload.data, date.today().isoformat())
    parcelas_plano = validar_plano_pagamento_orcamento(payload.plano_pagamento, valor_total, data_base)
    forma_pagamento = payload.forma_pagamento.strip() or "A Definir"
    quantidade_parcelas = max(int(payload.parcelas or 1), 1)
    entrada_valor = sum(float(parcela.valor or 0) for parcela in parcelas_plano if normalizar_texto(parcela.descricao) == "entrada")
    primeiro_vencimento = next(
        (parcela.data.strip() for parcela in parcelas_plano if normalizar_texto(parcela.descricao) != "entrada" and parcela.data.strip()),
        data_base,
    )
    data_pagamento_entrada = next(
        (parcela.data.strip() for parcela in parcelas_plano if normalizar_texto(parcela.descricao) == "entrada" and parcela.data.strip()),
        None,
    )
    plano_pagamento_json = json.dumps([parcela.model_dump() for parcela in parcelas_plano], ensure_ascii=False)
    data_retorno_crm = validar_data_retorno_crm(payload.data_retorno_crm)
    if not data_retorno_crm:
        raise HTTPException(status_code=400, detail="Informe a data de retorno do CRM para este orçamento.")

    if contrato_id is None:
        contrato_aprovado = False
        cursor = conn.execute(
            """
            INSERT INTO contratos (
                paciente_id, valor_total, entrada, parcelas, primeiro_vencimento, data_pagamento_entrada,
                forma_pagamento, hash_importacao, data_criacao, status, observacoes, clinica_snapshot, criado_por_snapshot, tabela_snapshot, plano_pagamento_json, desconto_percentual, desconto_valor, validade_orcamento, data_retorno_crm
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'EM_ABERTO', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                paciente_id,
                valor_total,
                entrada_valor,
                quantidade_parcelas,
                primeiro_vencimento,
                data_pagamento_entrada,
                forma_pagamento,
                data_base,
                payload.observacoes.strip(),
                payload.clinica.strip(),
                payload.criado_por.strip(),
                payload.tabela.strip(),
                plano_pagamento_json,
                desconto_percentual,
                desconto_valor,
                normalizar_data_contrato_iso(payload.validade_orcamento, ""),
                data_retorno_crm,
            ),
        )
        contrato_id = int(cursor.lastrowid)
    else:
        contrato = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id, paciente_id)).fetchone()
        if contrato is None:
            raise HTTPException(status_code=404, detail="Orcamento nao encontrado.")
        contrato_aprovado = normalizar_texto(contrato["status"]) == "aprovado"
        conn.execute(
            """
            UPDATE contratos
            SET valor_total=?, entrada=?, parcelas=?, primeiro_vencimento=?, data_pagamento_entrada=?, forma_pagamento=?, data_criacao=?, observacoes=?, clinica_snapshot=?, criado_por_snapshot=?, tabela_snapshot=?, plano_pagamento_json=?, desconto_percentual=?, desconto_valor=?, validade_orcamento=?, data_retorno_crm=?
            WHERE id=? AND paciente_id=?
            """,
            (
                valor_total,
                entrada_valor,
                quantidade_parcelas,
                primeiro_vencimento,
                data_pagamento_entrada,
                forma_pagamento,
                data_base,
                payload.observacoes.strip(),
                payload.clinica.strip(),
                payload.criado_por.strip(),
                payload.tabela.strip(),
                plano_pagamento_json,
                desconto_percentual,
                desconto_valor,
                normalizar_data_contrato_iso(payload.validade_orcamento, ""),
                data_retorno_crm,
                contrato_id,
                paciente_id,
            ),
        )
        conn.execute("DELETE FROM procedimentos_contrato WHERE contrato_id=?", (contrato_id,))
        conn.execute("DELETE FROM procedimentos_dente WHERE contrato_id=?", (contrato_id,))

    for indice_item, (item, regioes) in enumerate(itens_validos, start=1):
        subtotal = sum(float(regiao.valor or 0) for regiao in regioes if regiao.ativo)
        conn.execute(
            """
            INSERT INTO procedimentos_contrato (contrato_id, procedimento, valor, profissional_snapshot, denticao_snapshot)
            VALUES (?, ?, ?, ?, ?)
            """,
            (contrato_id, item.procedimento.strip(), subtotal, item.profissional.strip(), item.denticao.strip()),
        )
        for regiao in regioes:
            dente = regiao.dente if regiao.dente is not None else None
            conn.execute(
                """
                INSERT INTO procedimentos_dente (
                    paciente_id, contrato_id, grupo_item, dente, regiao, procedimento, status, faces, valor, data
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    paciente_id,
                    contrato_id,
                    indice_item,
                    dente,
                    regiao.regiao.strip(),
                    item.procedimento.strip(),
                    ("CONTRATADO" if contrato_aprovado else "ORCAMENTO") if regiao.ativo else "EXCLUIDO",
                    ",".join(face.strip() for face in regiao.faces if face.strip()),
                    float(regiao.valor or 0),
                    data_base,
                ),
            )
    return contrato_id


def salvar_orcamento_paciente_com_pagamento(
    conn: sqlite3.Connection,
    paciente_id: int,
    payload: OrcamentoPacientePayload,
    contrato_id: int | None = None,
) -> int:
    itens_validos = []
    for item in payload.itens:
        regioes_validas = [regiao for regiao in item.regioes if str(regiao.regiao or "").strip()]
        if regioes_validas and str(item.procedimento or "").strip():
            itens_validos.append((item, regioes_validas))

    if not any(regiao.ativo for item, regioes in itens_validos for regiao in regioes):
        raise HTTPException(status_code=400, detail="Informe ao menos um procedimento com dentes/regioes ativos.")

    valor_bruto = sum(sum(float(regiao.valor or 0) for regiao in regioes if regiao.ativo) for _, regioes in itens_validos)
    desconto_percentual = max(0.0, float(payload.desconto_percentual or 0))
    desconto_valor = max(0.0, float(payload.desconto_valor or 0))
    valor_total = max(0.0, valor_bruto - (valor_bruto * desconto_percentual / 100.0) - desconto_valor)
    data_base = normalizar_data_contrato_iso(payload.data, date.today().isoformat())
    parcelas_plano = validar_plano_pagamento_orcamento(payload.plano_pagamento, valor_total, data_base)
    forma_pagamento = payload.forma_pagamento.strip() or "A Definir"
    quantidade_parcelas = max(int(payload.parcelas or 1), 1)
    entrada_valor = sum(float(parcela.valor or 0) for parcela in parcelas_plano if normalizar_texto(parcela.descricao) == "entrada")
    primeiro_vencimento = next(
        (parcela.data.strip() for parcela in parcelas_plano if normalizar_texto(parcela.descricao) != "entrada" and parcela.data.strip()),
        data_base,
    )
    data_pagamento_entrada = next(
        (parcela.data.strip() for parcela in parcelas_plano if normalizar_texto(parcela.descricao) == "entrada" and parcela.data.strip()),
        None,
    )
    plano_pagamento_json = json.dumps([parcela.model_dump() for parcela in parcelas_plano], ensure_ascii=False)
    data_retorno_crm = validar_data_retorno_crm(payload.data_retorno_crm)
    if not data_retorno_crm:
        raise HTTPException(status_code=400, detail="Informe a data de retorno do CRM para este orçamento.")

    if contrato_id is None:
        contrato_aprovado = False
        cursor = conn.execute(
            """
            INSERT INTO contratos (
                paciente_id, valor_total, entrada, parcelas, primeiro_vencimento, data_pagamento_entrada,
                forma_pagamento, hash_importacao, data_criacao, status, observacoes, clinica_snapshot, criado_por_snapshot, tabela_snapshot, plano_pagamento_json, desconto_percentual, desconto_valor, validade_orcamento, data_retorno_crm
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, 'EM_ABERTO', ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                paciente_id,
                valor_total,
                entrada_valor,
                quantidade_parcelas,
                primeiro_vencimento,
                data_pagamento_entrada,
                forma_pagamento,
                data_base,
                payload.observacoes.strip(),
                payload.clinica.strip(),
                payload.criado_por.strip(),
                payload.tabela.strip(),
                plano_pagamento_json,
                desconto_percentual,
                desconto_valor,
                normalizar_data_contrato_iso(payload.validade_orcamento, ""),
                data_retorno_crm,
            ),
        )
        contrato_id = int(cursor.lastrowid)
    else:
        contrato = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id, paciente_id)).fetchone()
        if contrato is None:
            raise HTTPException(status_code=404, detail="Orcamento nao encontrado.")
        contrato_aprovado = normalizar_texto(contrato["status"]) == "aprovado"
        conn.execute(
            """
            UPDATE contratos
            SET valor_total=?, entrada=?, parcelas=?, primeiro_vencimento=?, data_pagamento_entrada=?, forma_pagamento=?, data_criacao=?, observacoes=?, clinica_snapshot=?, criado_por_snapshot=?, tabela_snapshot=?, plano_pagamento_json=?, desconto_percentual=?, desconto_valor=?, validade_orcamento=?, data_retorno_crm=?
            WHERE id=? AND paciente_id=?
            """,
            (
                valor_total,
                entrada_valor,
                quantidade_parcelas,
                primeiro_vencimento,
                data_pagamento_entrada,
                forma_pagamento,
                data_base,
                payload.observacoes.strip(),
                payload.clinica.strip(),
                payload.criado_por.strip(),
                payload.tabela.strip(),
                plano_pagamento_json,
                desconto_percentual,
                desconto_valor,
                normalizar_data_contrato_iso(payload.validade_orcamento, ""),
                data_retorno_crm,
                contrato_id,
                paciente_id,
            ),
        )
        conn.execute("DELETE FROM procedimentos_contrato WHERE contrato_id=?", (contrato_id,))
        conn.execute("DELETE FROM procedimentos_dente WHERE contrato_id=?", (contrato_id,))

    for indice_item, (item, regioes) in enumerate(itens_validos, start=1):
        subtotal = sum(float(regiao.valor or 0) for regiao in regioes if regiao.ativo)
        conn.execute(
            """
            INSERT INTO procedimentos_contrato (contrato_id, procedimento, valor, profissional_snapshot, denticao_snapshot)
            VALUES (?, ?, ?, ?, ?)
            """,
            (contrato_id, item.procedimento.strip(), subtotal, item.profissional.strip(), item.denticao.strip()),
        )
        for regiao in regioes:
            dente = regiao.dente if regiao.dente is not None else None
            conn.execute(
                """
                INSERT INTO procedimentos_dente (
                    paciente_id, contrato_id, grupo_item, dente, regiao, procedimento, status, faces, valor, data
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    paciente_id,
                    contrato_id,
                    indice_item,
                    dente,
                    regiao.regiao.strip(),
                    item.procedimento.strip(),
                    ("CONTRATADO" if contrato_aprovado else "ORCAMENTO") if regiao.ativo else "EXCLUIDO",
                    ",".join(face.strip() for face in regiao.faces if face.strip()),
                    float(regiao.valor or 0),
                    data_base,
                ),
            )

    contrato_atualizado = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id, paciente_id)).fetchone()
    if contrato_atualizado is not None and normalizar_texto(contrato_atualizado["status"]) == "aprovado":
        paciente_row = carregar_paciente_por_id(conn, paciente_id)
        sincronizar_recebiveis_contrato(conn, paciente_row, contrato_atualizado, contrato_id)
        sincronizar_financeiro_contrato(conn, paciente_row, contrato_atualizado, contrato_id)
        try:
            # Um contrato aprovado passa a manter cada documento gerado como
            # uma versão independente, sem apagar a versão anterior.
            gerar_documento_contrato(conn, paciente_row, contrato_atualizado, contrato_id)
        except Exception as exc:
            print(f"[orcamento] falha ao regenerar documento do contrato {contrato_id}: {exc}", flush=True)

    return contrato_id


def carregar_recebiveis_paciente(conn: sqlite3.Connection, paciente_row: sqlite3.Row) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT *
        FROM recebiveis
        WHERE paciente_id = ?
           OR lower(trim(paciente_nome)) = lower(trim(?))
        ORDER BY vencimento, id
        """,
        (int(paciente_row["id"]), str(paciente_row["nome"] or "")),
    ).fetchall()


def atualizar_status_recebiveis_automaticamente(conn: sqlite3.Connection) -> None:
    hoje = date.today()
    rows = conn.execute(
        "SELECT id, vencimento, status FROM recebiveis"
    ).fetchall()
    houve_atualizacao = False
    for row in rows:
        status_atual = str(row["status"] or "Aberto").strip() or "Aberto"
        if normalizar_texto(status_atual) in {"pago", "cancelado", "suspenso"}:
            continue
        vencimento = parse_data_contrato(row["vencimento"])
        if not vencimento:
            continue
        novo_status = "Atrasado" if vencimento < hoje else "Aberto"
        if status_atual != novo_status:
            conn.execute("UPDATE recebiveis SET status=? WHERE id=?", (novo_status, int(row["id"])))
            houve_atualizacao = True
    if houve_atualizacao:
        conn.commit()


def atualizar_status_contas_pagar_automaticamente(conn: sqlite3.Connection) -> None:
    hoje = date.today()
    rows = conn.execute(
        "SELECT id, data_vencimento, status FROM contas_pagar"
    ).fetchall()
    houve_atualizacao = False
    for row in rows:
        status_atual = str(row["status"] or "A vencer").strip() or "A vencer"
        if normalizar_texto(status_atual) in {"pago", "cancelado", "suspenso"}:
            continue
        vencimento = parse_data_contrato(row["data_vencimento"])
        if not vencimento:
            continue
        novo_status = "Atrasado" if vencimento < hoje else "A vencer"
        if status_atual != novo_status:
            conn.execute("UPDATE contas_pagar SET status=? WHERE id=?", (novo_status, int(row["id"])))
            houve_atualizacao = True
    if houve_atualizacao:
        conn.commit()


def adicionar_meses(data_base: date, quantidade: int) -> date:
    mes = data_base.month - 1 + quantidade
    ano = data_base.year + mes // 12
    mes = mes % 12 + 1
    ultimo_dia = 31
    while True:
      try:
          date(ano, mes, ultimo_dia)
          break
      except ValueError:
          ultimo_dia -= 1
    dia = min(data_base.day, ultimo_dia)
    return date(ano, mes, dia)


def atualizar_recebiveis_lote_contrato(
    conn: sqlite3.Connection,
    contrato_id: int,
    paciente_nome: str,
    prontuario: str,
    forma_pagamento: str,
    status: str,
    observacao: str,
    primeiro_vencimento: str = "",
) -> None:
    rows = conn.execute(
        """
        SELECT id, parcela_numero, vencimento
        FROM recebiveis
        WHERE contrato_id=?
        ORDER BY parcela_numero, id
        """,
        (contrato_id,),
    ).fetchall()
    if not rows:
        return

    data_base = parse_data_contrato(primeiro_vencimento) if primeiro_vencimento.strip() else None
    for row in rows:
        vencimento = str(row["vencimento"] or "")
        if data_base is not None:
            vencimento = formatar_data_br(adicionar_meses(data_base, max(int(row["parcela_numero"] or 1) - 1, 0)))
        conn.execute(
            """
            UPDATE recebiveis
            SET paciente_nome=?, prontuario=?, vencimento=?, forma_pagamento=?, status=?, observacao=?
            WHERE id=?
            """,
            (
                paciente_nome.strip(),
                prontuario.strip(),
                vencimento,
                forma_pagamento.strip(),
                status.strip(),
                observacao.strip(),
                int(row["id"]),
            ),
        )


def renegociar_recebiveis_lote_contrato(
    conn: sqlite3.Connection,
    contrato_id: int,
    paciente_nome: str,
    prontuario: str,
    novas_parcelas: list[RecebivelRenegociacaoParcelaPayload],
    observacao_renegociacao: str = "",
    criado_por: str = "",
) -> None:
    recebiveis_existentes = conn.execute(
        """
        SELECT *
        FROM recebiveis
        WHERE contrato_id=?
        ORDER BY parcela_numero, id
        """,
        (contrato_id,),
    ).fetchall()
    if not recebiveis_existentes:
        raise HTTPException(status_code=404, detail="Lote de recebíveis não encontrado.")

    recebiveis_ativos = [
        row for row in recebiveis_existentes
        if normalizar_texto(row["status"]) not in {"pago", "cancelado", "suspenso"}
    ]
    if not recebiveis_ativos:
        raise HTTPException(status_code=400, detail="Não há recebíveis em aberto para renegociar neste lote.")

    parcelas_validas: list[tuple[int, str, float, str, str]] = []
    for indice, parcela in enumerate(novas_parcelas, start=1):
        vencimento_iso = normalizar_data_contrato_iso(parcela.vencimento)
        if not vencimento_iso:
            raise HTTPException(status_code=400, detail=f"Informe uma data válida para a parcela {indice}.")
        valor_parcela = round(float(parcela.valor or 0), 2)
        if valor_parcela <= 0:
            raise HTTPException(status_code=400, detail=f"Informe um valor maior que zero para a parcela {indice}.")
        forma_pagamento = str(parcela.forma_pagamento or "").strip().upper() or "PIX"
        parcelas_validas.append((
            indice,
            vencimento_iso,
            valor_parcela,
            forma_pagamento,
            str(parcela.observacao or "").strip(),
        ))

    if not parcelas_validas:
        raise HTTPException(status_code=400, detail="Informe ao menos uma nova parcela para renegociar.")

    paciente_id = int(recebiveis_existentes[0]["paciente_id"] or 0)
    observacao_base = str(observacao_renegociacao or "").strip() or f"RENEGOCIADO EM {agora_local().strftime('%d/%m/%Y %H:%M')}"
    usuario_historico = str(criado_por or "Sistema").strip() or "Sistema"

    for row in recebiveis_ativos:
        observacao_atual = str(row["observacao"] or "").strip()
        observacao_final = observacao_atual
        if observacao_base and observacao_base not in observacao_atual:
            observacao_final = f"{observacao_atual} | {observacao_base}" if observacao_atual else observacao_base
        conn.execute(
            "UPDATE recebiveis SET status='Suspenso', observacao=?, data_pagamento=NULL WHERE id=?",
            (observacao_final, int(row["id"])),
        )
        registrar_historico_cobranca_recebivel(
            conn,
            recebivel_id=int(row["id"]),
            paciente_id=paciente_id,
            status="Suspenso",
            observacao=observacao_base or "Recebível suspenso por renegociação em lote.",
            cobrado=False,
            criado_por=usuario_historico,
        )

    plano_pagamento_json = json.dumps(
        [
            {
                "indice": indice - 1,
                "descricao": str(indice),
                "data": vencimento_iso,
                "forma": forma_pagamento,
                "valor": valor_parcela,
                "parcelas_cartao": len(parcelas_validas) if "cartao" in normalizar_texto(forma_pagamento) and len(parcelas_validas) > 1 else 1,
            }
            for indice, vencimento_iso, valor_parcela, forma_pagamento, _ in parcelas_validas
        ],
        ensure_ascii=False,
    )
    formas_pagamento = {forma_pagamento for _, _, _, forma_pagamento, _ in parcelas_validas}
    forma_resumo = next(iter(formas_pagamento)) if len(formas_pagamento) == 1 else "MISTO"
    conn.execute(
        """
        UPDATE contratos
        SET parcelas=?, primeiro_vencimento=?, forma_pagamento=?, plano_pagamento_json=?
        WHERE id=?
        """,
        (
            len(parcelas_validas),
            parcelas_validas[0][1],
            forma_resumo,
            plano_pagamento_json,
            contrato_id,
        ),
    )

    nome_paciente_final = paciente_nome.strip() or str(recebiveis_existentes[0]["paciente_nome"] or "")
    prontuario_final = prontuario.strip() or str(recebiveis_existentes[0]["prontuario"] or "")
    for indice, vencimento_iso, valor_parcela, forma_pagamento, observacao_parcela in parcelas_validas:
        observacao_nova = f"RENEGOCIACAO_CONTRATO_{contrato_id}"
        if observacao_base:
            observacao_nova = f"{observacao_nova} | {observacao_base}"
        if observacao_parcela:
            observacao_nova = f"{observacao_nova} | {observacao_parcela}"
        cursor = conn.execute(
            """
            INSERT INTO recebiveis (
                contrato_id, paciente_id, paciente_nome, prontuario, parcela_numero, vencimento, valor,
                forma_pagamento, status, observacao, data_criacao, data_pagamento
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', ?, ?, NULL)
            """,
            (
                contrato_id,
                paciente_id,
                nome_paciente_final,
                prontuario_final,
                indice,
                vencimento_iso,
                valor_parcela,
                forma_pagamento.replace("_", " "),
                observacao_nova,
                agora_str(),
            ),
        )
        registrar_historico_cobranca_recebivel(
            conn,
            recebivel_id=int(cursor.lastrowid),
            paciente_id=paciente_id,
            status="Criado",
            observacao=observacao_base or "Recebível criado por renegociação em lote.",
            cobrado=False,
            criado_por=usuario_historico,
        )


def carregar_recebiveis_lote_generico(
    conn: sqlite3.Connection,
    lote_id: str,
    paciente_id: int | None = None,
    paciente_nome: str = "",
    prontuario: str = "",
) -> tuple[list[sqlite3.Row], int | None]:
    lote_id = str(lote_id or "").strip()
    if lote_id.isdigit():
        contrato_id = int(lote_id)
        rows = conn.execute(
            """
            SELECT *
            FROM recebiveis
            WHERE contrato_id=?
            ORDER BY parcela_numero, id
            """,
            (contrato_id,),
        ).fetchall()
        return rows, contrato_id

    filtros: list[str] = ["contrato_id IS NULL"]
    params: list[object] = []
    if paciente_id:
        filtros.append("paciente_id=?")
        params.append(int(paciente_id))
    elif prontuario.strip():
        filtros.append("TRIM(COALESCE(prontuario, ''))=?")
        params.append(prontuario.strip())
    elif paciente_nome.strip():
        filtros.append("UPPER(TRIM(COALESCE(paciente_nome, '')))=?")
        params.append(paciente_nome.strip().upper())
    else:
        return [], None

    rows = conn.execute(
        f"""
        SELECT *
        FROM recebiveis
        WHERE {' AND '.join(filtros)}
        ORDER BY parcela_numero, id
        """,
        tuple(params),
    ).fetchall()
    return rows, None


def atualizar_recebiveis_lote_generico(
    conn: sqlite3.Connection,
    lote_id: str,
    paciente_id: int | None,
    paciente_nome: str,
    prontuario: str,
    forma_pagamento: str,
    status: str,
    observacao: str,
    primeiro_vencimento: str = "",
) -> None:
    rows, contrato_id = carregar_recebiveis_lote_generico(conn, lote_id, paciente_id, paciente_nome, prontuario)
    if not rows:
        return

    data_base = parse_data_contrato(primeiro_vencimento) if primeiro_vencimento.strip() else None
    for row in rows:
        vencimento = str(row["vencimento"] or "")
        if data_base is not None:
            vencimento = formatar_data_br(adicionar_meses(data_base, max(int(row["parcela_numero"] or 1) - 1, 0)))
        conn.execute(
            """
            UPDATE recebiveis
            SET paciente_nome=?, prontuario=?, vencimento=?, forma_pagamento=?, status=?, observacao=?
            WHERE id=?
            """,
            (
                paciente_nome.strip(),
                prontuario.strip(),
                vencimento,
                forma_pagamento.strip(),
                status.strip(),
                observacao.strip(),
                int(row["id"]),
            ),
        )


def renegociar_recebiveis_lote_generico(
    conn: sqlite3.Connection,
    lote_id: str,
    paciente_id: int | None,
    paciente_nome: str,
    prontuario: str,
    novas_parcelas: list[RecebivelRenegociacaoParcelaPayload],
    observacao_renegociacao: str = "",
    criado_por: str = "",
) -> None:
    recebiveis_existentes, contrato_id = carregar_recebiveis_lote_generico(conn, lote_id, paciente_id, paciente_nome, prontuario)
    if not recebiveis_existentes:
        raise HTTPException(status_code=404, detail="Lote de recebíveis não encontrado.")

    recebiveis_ativos = [
        row for row in recebiveis_existentes
        if normalizar_texto(row["status"]) not in {"pago", "cancelado", "suspenso"}
    ]
    if not recebiveis_ativos:
        raise HTTPException(status_code=400, detail="Não há recebíveis em aberto para renegociar neste lote.")

    parcelas_validas: list[tuple[int, str, float, str, str]] = []
    for indice, parcela in enumerate(novas_parcelas, start=1):
        vencimento_iso = normalizar_data_contrato_iso(parcela.vencimento)
        if not vencimento_iso:
            raise HTTPException(status_code=400, detail=f"Informe uma data válida para a parcela {indice}.")
        valor_parcela = round(float(parcela.valor or 0), 2)
        if valor_parcela <= 0:
            raise HTTPException(status_code=400, detail=f"Informe um valor maior que zero para a parcela {indice}.")
        forma_pagamento = str(parcela.forma_pagamento or "").strip().upper() or "PIX"
        parcelas_validas.append((
            indice,
            vencimento_iso,
            valor_parcela,
            forma_pagamento,
            str(parcela.observacao or "").strip(),
        ))

    if not parcelas_validas:
        raise HTTPException(status_code=400, detail="Informe ao menos uma nova parcela para renegociar.")

    paciente_id_final = int(recebiveis_existentes[0]["paciente_id"] or 0)
    observacao_base = str(observacao_renegociacao or "").strip() or f"RENEGOCIADO EM {agora_local().strftime('%d/%m/%Y %H:%M')}"
    usuario_historico = str(criado_por or "Sistema").strip() or "Sistema"

    for row in recebiveis_ativos:
        observacao_atual = str(row["observacao"] or "").strip()
        observacao_final = observacao_atual
        if observacao_base and observacao_base not in observacao_atual:
            observacao_final = f"{observacao_atual} | {observacao_base}" if observacao_atual else observacao_base
        conn.execute(
            "UPDATE recebiveis SET status='Suspenso', observacao=?, data_pagamento=NULL WHERE id=?",
            (observacao_final, int(row["id"])),
        )
        registrar_historico_cobranca_recebivel(
            conn,
            recebivel_id=int(row["id"]),
            paciente_id=paciente_id_final,
            status="Suspenso",
            observacao=observacao_base or "Recebível suspenso por renegociação em lote.",
            cobrado=False,
            criado_por=usuario_historico,
        )

    if contrato_id is not None:
        plano_pagamento_json = json.dumps(
            [
                {
                    "indice": indice - 1,
                    "descricao": str(indice),
                    "data": vencimento_iso,
                    "forma": forma_pagamento,
                    "valor": valor_parcela,
                    "parcelas_cartao": len(parcelas_validas) if "cartao" in normalizar_texto(forma_pagamento) and len(parcelas_validas) > 1 else 1,
                }
                for indice, vencimento_iso, valor_parcela, forma_pagamento, _ in parcelas_validas
            ],
            ensure_ascii=False,
        )
        formas_pagamento = {forma_pagamento for _, _, _, forma_pagamento, _ in parcelas_validas}
        forma_resumo = next(iter(formas_pagamento)) if len(formas_pagamento) == 1 else "MISTO"
        conn.execute(
            """
            UPDATE contratos
            SET parcelas=?, primeiro_vencimento=?, forma_pagamento=?, plano_pagamento_json=?
            WHERE id=?
            """,
            (
                len(parcelas_validas),
                parcelas_validas[0][1],
                forma_resumo,
                plano_pagamento_json,
                contrato_id,
            ),
        )

    nome_paciente_final = paciente_nome.strip() or str(recebiveis_existentes[0]["paciente_nome"] or "")
    prontuario_final = prontuario.strip() or str(recebiveis_existentes[0]["prontuario"] or "")
    for indice, vencimento_iso, valor_parcela, forma_pagamento, observacao_parcela in parcelas_validas:
        observacao_nova = f"RENEGOCIACAO_LOTE_{contrato_id if contrato_id is not None else 'SEM_CONTRATO'}"
        if observacao_base:
            observacao_nova = f"{observacao_nova} | {observacao_base}"
        if observacao_parcela:
            observacao_nova = f"{observacao_nova} | {observacao_parcela}"
        cursor = conn.execute(
            """
            INSERT INTO recebiveis (
                contrato_id, paciente_id, paciente_nome, prontuario, parcela_numero, vencimento, valor,
                forma_pagamento, status, observacao, data_criacao, data_pagamento
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', ?, ?, NULL)
            """,
            (
                contrato_id,
                paciente_id_final,
                nome_paciente_final,
                prontuario_final,
                indice,
                vencimento_iso,
                valor_parcela,
                forma_pagamento.replace("_", " "),
                observacao_nova,
                agora_str(),
            ),
        )
        registrar_historico_cobranca_recebivel(
            conn,
            recebivel_id=int(cursor.lastrowid),
            paciente_id=paciente_id_final,
            status="Criado",
            observacao=observacao_base or "Recebível criado por renegociação em lote.",
            cobrado=False,
            criado_por=usuario_historico,
        )


def suspender_recebiveis_lote_generico(
    conn: sqlite3.Connection,
    lote_id: str,
    paciente_id: int | None,
    paciente_nome: str,
    prontuario: str,
    observacao_renegociacao: str = "",
    criado_por: str = "",
) -> None:
    recebiveis_existentes, _contrato_id = carregar_recebiveis_lote_generico(conn, lote_id, paciente_id, paciente_nome, prontuario)
    if not recebiveis_existentes:
        raise HTTPException(status_code=404, detail="Lote de recebíveis não encontrado.")

    recebiveis_ativos = [
        row for row in recebiveis_existentes
        if normalizar_texto(row["status"]) not in {"pago", "cancelado", "suspenso"}
    ]
    if not recebiveis_ativos:
        raise HTTPException(status_code=400, detail="Não há parcelas ativas para suspender neste lote.")

    paciente_id_final = int(recebiveis_existentes[0]["paciente_id"] or 0)
    observacao_base = str(observacao_renegociacao or "").strip() or f"SUSPENSO EM {agora_local().strftime('%d/%m/%Y %H:%M')}"
    usuario_historico = str(criado_por or "Sistema").strip() or "Sistema"

    for row in recebiveis_ativos:
        observacao_atual = str(row["observacao"] or "").strip()
        observacao_final = observacao_atual
        if observacao_base and observacao_base not in observacao_atual:
            observacao_final = f"{observacao_atual} | {observacao_base}" if observacao_atual else observacao_base
        conn.execute(
            "UPDATE recebiveis SET status='Suspenso', observacao=?, data_pagamento=NULL WHERE id=?",
            (observacao_final, int(row["id"])),
        )
        registrar_historico_cobranca_recebivel(
            conn,
            recebivel_id=int(row["id"]),
            paciente_id=paciente_id_final,
            status="Suspenso",
            observacao=observacao_base,
            cobrado=False,
            criado_por=usuario_historico,
        )


def carregar_agendamentos_paciente(conn: sqlite3.Connection, paciente_row: sqlite3.Row) -> list[sqlite3.Row]:
    rows = conn.execute(
        f"""
        SELECT *
        FROM agendamentos
        WHERE paciente_id = ?
           OR lower(trim(COALESCE(nome_paciente_snapshot, paciente_nome, ''))) = lower(trim(?))
        """,
        (int(paciente_row["id"]), str(paciente_row["nome"] or "")),
    ).fetchall()
    return sorted(
        rows,
        key=lambda row: (
            parse_data_contrato(row[DATA_COLUNA_AGENDA] if DATA_COLUNA_AGENDA in row.keys() else row["data"]) or date.min,
            str(row["hora_inicio"] or "").strip(),
            int(row["id"] or 0),
        ),
        reverse=True,
    )


def proximo_agendamento_paciente(agendamentos: list[sqlite3.Row]) -> sqlite3.Row | None:
    agora = datetime.now()
    candidatos: list[tuple[datetime, sqlite3.Row]] = []
    for row in agendamentos:
        data_ref = parse_data_contrato(row[DATA_COLUNA_AGENDA] if DATA_COLUNA_AGENDA in row.keys() else row["data"])
        hora_ref = str(row["hora_inicio"] or "").strip()
        if not data_ref or not re.fullmatch(r"\d{2}:\d{2}", hora_ref):
            continue
        hora_obj = datetime.strptime(hora_ref, "%H:%M").time()
        data_hora = datetime.combine(data_ref, hora_obj)
        if data_hora >= agora and normalizar_texto(row["status"]) not in {"cancelado", "faltou"}:
            candidatos.append((data_hora, row))
    if not candidatos:
        return None
    candidatos.sort(key=lambda item: item[0])
    return candidatos[0][1]


def resumo_financeiro_paciente(recebiveis: list[sqlite3.Row]) -> FinanceiroResumo:
    total = sum(float(row["valor"] or 0) for row in recebiveis)
    pagos = sum(float(row["valor"] or 0) for row in recebiveis if str(row["status"] or "") == "Pago")
    atrasado = sum(float(row["valor"] or 0) for row in recebiveis if str(row["status"] or "") == "Atrasado")
    em_aberto = sum(
        float(row["valor"] or 0)
        for row in recebiveis
        if str(row["status"] or "") in {"Aberto", "A vencer", "Atrasado"}
    )
    qtd_atrasados = sum(1 for row in recebiveis if str(row["status"] or "") == "Atrasado")
    indicador = "pendente" if qtd_atrasados > 0 or em_aberto > 0 else "ok"
    return FinanceiroResumo(
        total=formatar_moeda_br(total),
        emAberto=formatar_moeda_br(em_aberto),
        atrasado=formatar_moeda_br(atrasado),
        pagos=formatar_moeda_br(pagos),
        quantidadeAtrasados=qtd_atrasados,
        indicador=indicador,
    )


def mapear_movimento_caixa(row: sqlite3.Row) -> MovimentoCaixaResumo:
    return MovimentoCaixaResumo(
        id=int(row["id"]),
        data=formatar_data_br_valor(row["data"]),
        origem=str(row["origem"] or ""),
        descricao=str(row["descricao"] or ""),
        valor=formatar_moeda_br(row["valor"]),
        tipo=str(row["tipo"] or ""),
        prontuario=formatar_prontuario_valor(row["prontuario"]),
        formaPagamento=str(row["forma_pagamento"] or ""),
        contaCaixa=str(row["conta_caixa"] or ""),
        observacao=str(row["observacao"] or ""),
        contratoId=int(row["contrato_id"]) if row["contrato_id"] is not None else None,
        recebivelId=int(row["recebivel_id"]) if row["recebivel_id"] is not None else None,
    )


def mapear_conta_pagar(row: sqlite3.Row) -> ContaPagarResumo:
    return ContaPagarResumo(
        id=int(row["id"]),
        vencimento=formatar_data_br_valor(row["data_vencimento"]),
        descricao=str(row["descricao"] or ""),
        fornecedor=str(row["fornecedor"] or ""),
        categoria=str(row["categoria"] or ""),
        valor=formatar_moeda_br(row["valor"]),
        valorPago=formatar_moeda_br(row["valor_pago"]),
        pagoEm=formatar_data_br_valor(row["pago"]),
        status=str(row["status"] or ""),
        observacao=str(row["observacao"] or ""),
    )


def mapear_recibo_manual(row: sqlite3.Row) -> ReciboManualResumo:
    return ReciboManualResumo(
        id=int(row["id"]),
        valor=formatar_moeda_br(row["valor"]),
        pagador=str(row["pagador"] or ""),
        recebedor=str(row["recebedor"] or ""),
        dataPagamento=formatar_data_br_valor(row["data_pagamento"]),
        referente=str(row["referente"] or ""),
        observacao=str(row["observacao"] or ""),
        cidade=str(row["cidade"] or ""),
        criadoEm=str(row["criado_em"] or ""),
    )


def proximo_numero_recibo_manual(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        "SELECT COALESCE(MAX(CAST(numero AS INTEGER)), 0) AS ultimo FROM recibos_manuais"
    ).fetchone()
    ultimo = int(row["ultimo"] or 0) if row else 0
    return ultimo + 1


def garantir_numero_recibo_manual(conn: sqlite3.Connection, recibo_id: int) -> sqlite3.Row | None:
    row = conn.execute("SELECT * FROM recibos_manuais WHERE id=?", (recibo_id,)).fetchone()
    if row is None:
        return None
    numero_atual = int(row["numero"] or 0)
    if numero_atual > 0:
        return row
    novo_numero = proximo_numero_recibo_manual(conn)
    conn.execute("UPDATE recibos_manuais SET numero=? WHERE id=?", (novo_numero, recibo_id))
    conn.commit()
    return conn.execute("SELECT * FROM recibos_manuais WHERE id=?", (recibo_id,)).fetchone()


def mapear_saldo_conta(row: sqlite3.Row) -> SaldoContaResumo:
    return SaldoContaResumo(
        id=int(row["id"]),
        data=formatar_data_br_valor(row["data"]),
        conta=str(row["conta"] or ""),
        saldo=formatar_moeda_br(row["saldo"]),
        observacao=str(row["observacao"] or ""),
    )


def nome_mes_portugues(mes: int) -> str:
    meses = ["Janeiro", "Fevereiro", "Marco", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
    if 1 <= int(mes) <= 12:
        return meses[int(mes) - 1]
    return ""


def carregar_metas_mensais(conn: sqlite3.Connection, ano: int) -> list[MetaMensalResumo]:
    ano_referencia = int(ano or date.today().year)
    base_row = conn.execute(
        """
        SELECT meta, supermeta, hipermeta
        FROM metas_vendas
        WHERE ano=?
        LIMIT 1
        """,
        (ano_referencia,),
    ).fetchone()
    meta_padrao = float(base_row["meta"] or 100000.0) if base_row else 100000.0
    supermeta_padrao = float(base_row["supermeta"] or 150000.0) if base_row else 150000.0
    hipermeta_padrao = float(base_row["hipermeta"] or 200000.0) if base_row else 200000.0
    rows = conn.execute(
        """
        SELECT *
        FROM metas_mensais
        WHERE ano=?
        ORDER BY mes ASC
        """,
        (ano_referencia,),
    ).fetchall()
    por_mes = {int(row["mes"]): row for row in rows if row["mes"] is not None}
    metas: list[MetaMensalResumo] = []
    alterou = False
    for mes in range(1, 13):
        row = por_mes.get(mes)
        if row is None:
            conn.execute(
                """
                INSERT INTO metas_mensais
                (ano, mes, meta, supermeta, hipermeta, data_atualizacao)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (ano_referencia, mes, meta_padrao, supermeta_padrao, hipermeta_padrao, agora_str()),
            )
            alterou = True
            meta = meta_padrao
            supermeta = supermeta_padrao
            hipermeta = hipermeta_padrao
            atualizado = agora_str()
        else:
            meta = float(row["meta"] or meta_padrao)
            supermeta = float(row["supermeta"] or supermeta_padrao)
            hipermeta = float(row["hipermeta"] or hipermeta_padrao)
            atualizado = str(row["data_atualizacao"] or "")
        metas.append(
            MetaMensalResumo(
                ano=ano_referencia,
                mes=mes,
                mesNome=nome_mes_portugues(mes),
                meta=meta,
                supermeta=supermeta,
                hipermeta=hipermeta,
                dataAtualizacao=atualizado,
            )
        )
    if alterou:
        conn.commit()
    return metas


def obter_meta_mensal(conn: sqlite3.Connection, ano: int, mes: int) -> MetaMensalResumo:
    metas = carregar_metas_mensais(conn, ano)
    for item in metas:
        if item.mes == int(mes):
            return item
    raise HTTPException(status_code=404, detail="Meta mensal nao encontrada.")


def carregar_notas_fiscais_emitidas(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT *
        FROM notas_fiscais_emitidas
        ORDER BY COALESCE(competencia, '') DESC, COALESCE(data_emissao, '') DESC, id DESC
        """
    ).fetchall()


def mapear_nota_fiscal_emitida(row: sqlite3.Row) -> NotaFiscalEmitidaResumo:
    valor_nf = float(row["valor_nf"] or 0)
    valor_recebido = float(row["valor_recebido"] or 0)
    diferenca = valor_recebido - valor_nf
    conciliado = abs(diferenca) < 0.01
    return NotaFiscalEmitidaResumo(
        id=int(row["id"]),
        competencia=str(row["competencia"] or ""),
        dataEmissao=formatar_data_br_valor(row["data_emissao"]),
        dataRecebimento=formatar_data_br_valor(row["data_recebimento"]),
        numeroNf=str(row["numero_nf"] or ""),
        serie=str(row["serie"] or ""),
        cliente=str(row["cliente"] or ""),
        descricao=str(row["descricao"] or ""),
        contaDestino=str(row["conta_destino"] or ""),
        valorNf=formatar_moeda_br(valor_nf),
        valorRecebido=formatar_moeda_br(valor_recebido),
        valorNfNumero=valor_nf,
        valorRecebidoNumero=valor_recebido,
        diferenca=formatar_moeda_br(diferenca),
        diferencaNumero=diferenca,
        status=str(row["status"] or ""),
        observacao=str(row["observacao"] or ""),
        conciliado=conciliado,
        criadoEm=str(row["criado_em"] or ""),
        atualizadoEm=str(row["atualizado_em"] or ""),
    )


def resumo_financeiro_global(recebiveis: list[sqlite3.Row]) -> FinanceiroResumo:
    return resumo_financeiro_paciente(recebiveis)


def carregar_recebiveis_financeiro(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    atualizar_status_recebiveis_automaticamente(conn)
    return conn.execute(
        """
        SELECT *
        FROM recebiveis
        ORDER BY COALESCE(vencimento, ''), paciente_nome, parcela_numero, id
        """
    ).fetchall()


def carregar_caixa_financeiro(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT f.*
        FROM financeiro f
        LEFT JOIN recebiveis r ON r.id = f.recebivel_id
        WHERE f.recebivel_id IS NULL OR COALESCE(r.status, '') = 'Pago'
        ORDER BY COALESCE(f.data, '') DESC, f.id DESC
        """
    ).fetchall()


def carregar_contas_pagar_financeiro(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    atualizar_status_contas_pagar_automaticamente(conn)
    return conn.execute(
        """
        SELECT *
        FROM contas_pagar
        ORDER BY COALESCE(data_vencimento, ''), fornecedor, descricao, id
        """
    ).fetchall()


def carregar_saldos_conta_financeiro(conn: sqlite3.Connection) -> list[sqlite3.Row]:
    return conn.execute(
        """
        SELECT *
        FROM saldos_conta
        ORDER BY COALESCE(data, '') DESC, conta, id DESC
        """
    ).fetchall()


def dados_dashboard(conn: sqlite3.Connection) -> DashboardPainelResposta:
    hoje = date.today()
    hoje_iso = hoje.isoformat()
    ano_atual = hoje.year
    mes_atual = hoje.month
    meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]

    atualizar_status_recebiveis_automaticamente(conn)
    atualizar_status_contas_pagar_automaticamente(conn)

    recebiveis_rows = carregar_recebiveis_financeiro(conn)
    contas_pagar_rows = carregar_contas_pagar_financeiro(conn)
    caixa_rows = carregar_caixa_financeiro(conn)
    contratos_rows = conn.execute(
        """
        SELECT id, paciente_id, valor_total, data_criacao, data_aprovacao, status, forma_pagamento,
               COALESCE(incluir_total_vendido, 1) AS incluir_total_vendido,
               COALESCE(contar_quantidade_venda, 1) AS contar_quantidade_venda,
               valor_venda_considerado
        FROM contratos
        """
    ).fetchall()
    # Permutas preservam o valor clínico no contrato, mas não representam receita/venda.
    contratos_rows = [row for row in contratos_rows if not contrato_eh_permuta(row)]
    pacientes_nome_rows = conn.execute("SELECT id, nome, prontuario, COALESCE(criado_em, '') AS criado_em FROM pacientes").fetchall()
    pacientes_nome_map = {
        crm_int(row["id"]): {
            "nome": str(row["nome"] or "").strip(),
            "prontuario": str(row["prontuario"] or "").strip(),
            "criado_em": str(row["criado_em"] or "").strip(),
        }
        for row in pacientes_nome_rows
        if crm_int(row["id"]) > 0
    }
    agendamentos_rows = conn.execute(
        """
        SELECT paciente_id, status, COALESCE(data_agendamento, data) AS data,
               tipo_atendimento_nome_snapshot, procedimento_nome_snapshot,
               procedimento, observacoes, observacao
        FROM agendamentos
        """
    ).fetchall()
    agendamentos_mes_rows = [
        row
        for row in agendamentos_rows
        if (
            (data_agendamento := parse_data_contrato(row["data"])) is not None
            and data_agendamento.year == ano_atual
            and data_agendamento.month == mes_atual
        )
    ]

    total_em_aberto = sum(
        float(row["valor"] or 0)
        for row in recebiveis_rows
        if normalizar_texto(row["status"]) in {"aberto", "atrasado"}
    )
    entradas_hoje = sum(
        float(row["valor"] or 0)
        for row in caixa_rows
        if parse_data_contrato(row["data"]) == hoje and normalizar_texto(row["tipo"]) == "entrada"
    )
    saidas_hoje = sum(
        float(row["valor"] or 0)
        for row in caixa_rows
        if parse_data_contrato(row["data"]) == hoje and normalizar_texto(row["tipo"]) == "saida"
    )
    saldo_hoje = entradas_hoje - saidas_hoje

    vendas_mes_rows = []
    for row in contratos_rows:
        status = normalizar_texto(row["status"])
        if status not in {"aprovado", "aprovada", "convertido"}:
            continue
        data_ref = parse_data_contrato(str(row["data_aprovacao"] or "")) or parse_data_contrato(str(row["data_criacao"] or ""))
        if not data_ref or data_ref.year != ano_atual or data_ref.month != mes_atual:
            continue
        vendas_mes_rows.append(row)

    detalhes_vendas_mes: list[DashboardIndicadorDetalheItemResposta] = []
    vendas_resumo_mes: list[DashboardVendaResumoItemResposta] = []
    vendas_resumo: list[DashboardVendaResumoItemResposta] = []
    for row in sorted(
        vendas_mes_rows,
        key=lambda item: parse_data_contrato(str(item["data_aprovacao"] or "")) or parse_data_contrato(str(item["data_criacao"] or "")) or date.min,
        reverse=True,
    ):
        data_ref = parse_data_contrato(str(row["data_aprovacao"] or "")) or parse_data_contrato(str(row["data_criacao"] or ""))
        paciente_id = crm_int(row["paciente_id"])
        contrato_id = crm_int(row["id"])
        paciente_info = pacientes_nome_map.get(paciente_id) if paciente_id > 0 else None
        prontuario = (paciente_info or {}).get("prontuario") or ""
        forma_pagamento = str(row["forma_pagamento"] or "").strip() or "Sem forma de pagamento"
        if bool(int(row["incluir_total_vendido"] or 0)):
            valor_detalhe = float(
                row["valor_venda_considerado"]
                if row["valor_venda_considerado"] is not None
                else row["valor_total"] or 0
            )
            detalhes_vendas_mes.append(
                DashboardIndicadorDetalheItemResposta(
                    titulo=(paciente_info or {}).get("nome") or f"Contrato #{contrato_id}",
                    subtitulo=f"Venda em {formatar_data_br(data_ref)}",
                    meta=(
                        f"Contrato #{contrato_id}" + (f" · {prontuario}" if prontuario else "") + f" · {forma_pagamento}"
                    ),
                    valor=formatar_moeda_br(valor_detalhe),
                    status=str(row["status"] or ""),
                )
            )
        vendas_resumo_mes.append(
            DashboardVendaResumoItemResposta(
                contratoId=contrato_id,
                pacienteId=paciente_id if paciente_id > 0 else None,
                nome=(paciente_info or {}).get("nome") or f"Contrato #{contrato_id}",
                valor=formatar_moeda_br(float(row["valor_total"] or 0)),
                formaPagamento=forma_pagamento,
                data=formatar_data_br(data_ref),
                incluirTotalVendido=bool(int(row["incluir_total_vendido"] or 0)),
            )
        )

    vendas_ano_rows = []
    for row in contratos_rows:
        status = normalizar_texto(row["status"])
        if status not in {"aprovado", "aprovada", "convertido"}:
            continue
        data_ref = parse_data_contrato(str(row["data_aprovacao"] or "")) or parse_data_contrato(str(row["data_criacao"] or ""))
        if not data_ref or data_ref.year != ano_atual:
            continue
        vendas_ano_rows.append(row)

    for row in sorted(
        vendas_ano_rows,
        key=lambda item: parse_data_contrato(str(item["data_aprovacao"] or "")) or parse_data_contrato(str(item["data_criacao"] or "")) or date.min,
        reverse=True,
    ):
        data_ref = parse_data_contrato(str(row["data_aprovacao"] or "")) or parse_data_contrato(str(row["data_criacao"] or ""))
        paciente_id = crm_int(row["paciente_id"])
        contrato_id = crm_int(row["id"])
        paciente_info = pacientes_nome_map.get(paciente_id) if paciente_id > 0 else None
        forma_pagamento = str(row["forma_pagamento"] or "").strip() or "Sem forma de pagamento"
        vendas_resumo.append(
            DashboardVendaResumoItemResposta(
                contratoId=contrato_id,
                pacienteId=paciente_id if paciente_id > 0 else None,
                nome=(paciente_info or {}).get("nome") or f"Contrato #{contrato_id}",
                valor=formatar_moeda_br(float(row["valor_total"] or 0)),
                formaPagamento=forma_pagamento,
                data=formatar_data_br(data_ref),
                incluirTotalVendido=bool(int(row["incluir_total_vendido"] or 0)),
            )
        )

    vendas_mes_qtd = sum(
        1 for row in vendas_mes_rows
        if bool(int(row["incluir_total_vendido"] or 0)) and bool(int(row["contar_quantidade_venda"] or 0))
    )
    vendas_mes_valor = sum(
        float(row["valor_venda_considerado"] if row["valor_venda_considerado"] is not None else row["valor_total"] or 0)
        for row in vendas_mes_rows
        if bool(int(row["incluir_total_vendido"] or 0))
    )

    recebiveis_hoje_rows = [
        row
        for row in recebiveis_rows
        if str(row["vencimento"] or "") == hoje_iso and normalizar_texto(row["status"]) in {"aberto", "atrasado"}
    ]
    a_receber_hoje = sum(
        float(row["valor"] or 0)
        for row in recebiveis_hoje_rows
    )
    detalhes_receber_hoje = [
        DashboardIndicadorDetalheItemResposta(
            titulo=str(row["paciente_nome"] or "Paciente não informado").strip() or "Paciente não informado",
            subtitulo=f"Vencimento em {formatar_data_br(parse_data_contrato(row['vencimento']))}",
            meta=(
                f"Parcela {crm_int(row['parcela_numero'])}/{crm_int(row['total_parcelas'])}"
                if "total_parcelas" in row.keys() and crm_int(row["total_parcelas"]) > 0
                else (str(row["forma_pagamento"] or "").strip() or "Sem forma de pagamento")
            ),
            valor=formatar_moeda_br(float(row["valor"] or 0)),
            status=str(row["status"] or ""),
        )
        for row in sorted(
            recebiveis_hoje_rows,
            key=lambda item: (str(item["paciente_nome"] or "").lower(), int(item["id"] or 0)),
        )
    ]
    inadimplencia_rows = [
        row
        for row in recebiveis_rows
        if normalizar_texto(row["status"]) == "atrasado"
    ]
    inadimplencia_qtd = len(inadimplencia_rows)
    inadimplencia_valor = sum(float(row["valor"] or 0) for row in inadimplencia_rows)
    detalhes_inadimplencia = [
        DashboardIndicadorDetalheItemResposta(
            titulo=str(row["paciente_nome"] or "Paciente não informado").strip() or "Paciente não informado",
            subtitulo=f"Vencido em {formatar_data_br(parse_data_contrato(row['vencimento']))}",
            meta=(
                f"Parcela {crm_int(row['parcela_numero'])}/{crm_int(row['total_parcelas'])}"
                if "total_parcelas" in row.keys() and crm_int(row["total_parcelas"]) > 0
                else (str(row["forma_pagamento"] or "").strip() or "Sem forma de pagamento")
            ),
            valor=formatar_moeda_br(float(row["valor"] or 0)),
            status=str(row["status"] or ""),
        )
        for row in sorted(
            inadimplencia_rows,
            key=lambda item: (
                parse_data_contrato(item["vencimento"]) or date.max,
                str(item["paciente_nome"] or "").lower(),
                int(item["id"] or 0),
            ),
        )
    ]
    devedores_resumo_rows = []
    for row in recebiveis_rows:
        status_normalizado = normalizar_texto(row["status"])
        vencimento_row = str(row["vencimento"] or "").strip()
        if status_normalizado == "atrasado":
            devedores_resumo_rows.append(row)
            continue
        if status_normalizado == "aberto" and vencimento_row == hoje_iso:
            devedores_resumo_rows.append(row)
    devedores_resumo_por_paciente: dict[str, sqlite3.Row] = {}
    for row in devedores_resumo_rows:
        paciente_id = crm_int(row["paciente_id"], 0)
        nome = str(row["paciente_nome"] or "Paciente não informado").strip() or "Paciente não informado"
        chave = f"id:{paciente_id}" if paciente_id > 0 else f"nome:{normalizar_texto(nome)}"
        atual = devedores_resumo_por_paciente.get(chave)
        if atual is None:
            devedores_resumo_por_paciente[chave] = row
            continue
        status_atual = normalizar_texto(atual["status"])
        status_novo = normalizar_texto(row["status"])
        vencimento_atual = parse_data_contrato(atual["vencimento"]) or date.max
        vencimento_novo = parse_data_contrato(row["vencimento"]) or date.max
        prioridade_atual = 0 if status_atual == "atrasado" else 1
        prioridade_nova = 0 if status_novo == "atrasado" else 1
        if (prioridade_nova, vencimento_novo, int(row["id"] or 0)) < (prioridade_atual, vencimento_atual, int(atual["id"] or 0)):
            devedores_resumo_por_paciente[chave] = row
    devedores_resumo = [
        DashboardDevedorResumoItemResposta(
            recebivelId=int(row["id"] or 0),
            pacienteId=int(row["paciente_id"]) if row["paciente_id"] is not None else None,
            nome=str(row["paciente_nome"] or "Paciente não informado").strip() or "Paciente não informado",
            vencimento=formatar_data_br(parse_data_contrato(row["vencimento"])),
            valor=formatar_moeda_br(float(row["valor"] or 0)),
            observacao=str(row["observacao"] or "").strip(),
            status=str(row["status"] or "").strip(),
        )
        for row in sorted(
            devedores_resumo_por_paciente.values(),
            key=lambda item: (
                str(item["paciente_nome"] or "").strip().lower(),
                parse_data_contrato(item["vencimento"]) or date.max,
                int(item["id"] or 0),
            ),
        )
    ]

    primeiro_evento_rows = conn.execute(
        """
        SELECT paciente_id, MIN(data_evento) AS primeiro_evento
        FROM (
            SELECT paciente_id,
                   COALESCE(NULLIF(criado_em, ''), NULLIF(data_criacao, ''), NULLIF(data_agendamento, ''), NULLIF(data, '')) AS data_evento
            FROM agendamentos
            WHERE paciente_id IS NOT NULL
            UNION ALL
            SELECT paciente_id, NULLIF(data_criacao, '') AS data_evento
            FROM contratos
            WHERE paciente_id IS NOT NULL
        ) eventos
        WHERE COALESCE(data_evento, '') <> ''
        GROUP BY paciente_id
        """
    ).fetchall()
    primeiro_evento_por_paciente = {
        crm_int(row["paciente_id"]): parse_data_contrato(row["primeiro_evento"])
        for row in primeiro_evento_rows
        if crm_int(row["paciente_id"]) > 0
    }
    inicio_mes = date(ano_atual, mes_atual, 1)
    ids_leads = set()
    data_cadastro_por_paciente: dict[int, date | None] = {}
    for paciente_id, paciente_info in pacientes_nome_map.items():
        data_cadastro = parse_data_contrato(paciente_info.get("criado_em")) or primeiro_evento_por_paciente.get(paciente_id)
        data_cadastro_por_paciente[paciente_id] = data_cadastro
        if data_cadastro and data_cadastro.year == ano_atual and data_cadastro.month == mes_atual:
            ids_leads.add(paciente_id)
    leads_auditoria_row = conn.execute(
        """
        SELECT COUNT(DISTINCT lower(trim(info))) AS total
        FROM acoes_usuario
        WHERE upper(COALESCE(metodo_http, ''))='POST'
          AND COALESCE(rota, '')='/api/pacientes'
          AND substr(COALESCE(data_hora, ''), 1, 7)=?
          AND trim(COALESCE(info, '')) <> ''
        """,
        (f"{ano_atual}-{str(mes_atual).zfill(2)}",),
    ).fetchone()
    quantidade_leads = max(len(ids_leads), crm_int(leads_auditoria_row["total"] if leads_auditoria_row else 0))
    avaliacoes_mes_rows = [row for row in agendamentos_mes_rows if agendamento_eh_avaliacao(row)]
    ids_agendou = {
        crm_int(row["paciente_id"])
        for row in avaliacoes_mes_rows
        if crm_int(row["paciente_id"]) > 0
        and normalizar_texto(row["status"]) not in {"cancelado", "desmarcado", "faltou"}
    }
    ids_compareceu = {
        crm_int(row["paciente_id"])
        for row in avaliacoes_mes_rows
        if crm_int(row["paciente_id"]) > 0 and normalizar_texto(row["status"]) in {"atendido", "em atendimento"}
    }

    avaliacoes_comparecidas_por_paciente: dict[int, list[date]] = {}
    for row in agendamentos_rows:
        paciente_id = crm_int(row["paciente_id"])
        data_avaliacao = parse_data_contrato(row["data"])
        if (
            paciente_id <= 0
            or data_avaliacao is None
            or not agendamento_eh_avaliacao(row)
            or normalizar_texto(row["status"]) not in {"atendido", "em atendimento"}
        ):
            continue
        avaliacoes_comparecidas_por_paciente.setdefault(paciente_id, []).append(data_avaliacao)

    ids_fechou = set()
    primeiro_fechamento_por_paciente: dict[int, date] = {}
    for row in contratos_rows:
        if normalizar_texto(row["status"]) not in {"aprovado", "aprovada", "convertido"}:
            continue
        data_ref = parse_data_contrato(str(row["data_aprovacao"] or "")) or parse_data_contrato(str(row["data_criacao"] or ""))
        paciente_id = crm_int(row["paciente_id"])
        if not data_ref or paciente_id <= 0:
            continue
        atual = primeiro_fechamento_por_paciente.get(paciente_id)
        if atual is None or data_ref < atual:
            primeiro_fechamento_por_paciente[paciente_id] = data_ref

    # Fechamento do funil: paciente que compareceu a uma avaliação neste mês e
    # teve o primeiro contrato aprovado nessa avaliação ou depois dela.
    for paciente_id in ids_compareceu:
        fechamento = primeiro_fechamento_por_paciente.get(paciente_id)
        datas_mes = [
            data_avaliacao
            for data_avaliacao in avaliacoes_comparecidas_por_paciente.get(paciente_id, [])
            if data_avaliacao.year == ano_atual and data_avaliacao.month == mes_atual
        ]
        if fechamento and any(fechamento >= data_avaliacao for data_avaliacao in datas_mes):
            ids_fechou.add(paciente_id)

    # Resgate: o primeiro fechamento ocorreu neste mês, em data posterior a
    # uma avaliação comparecida. Fechamento no mesmo dia pertence ao funil
    # normal e não é classificado como retorno/resgate.
    ids_resgate_ate_30_dias = set()
    ids_resgate_mais_30_dias = set()
    for paciente_id, fechamento in primeiro_fechamento_por_paciente.items():
        if fechamento.year != ano_atual or fechamento.month != mes_atual:
            continue
        avaliacoes_anteriores = [
            data_avaliacao
            for data_avaliacao in avaliacoes_comparecidas_por_paciente.get(paciente_id, [])
            if data_avaliacao < fechamento
        ]
        if not avaliacoes_anteriores:
            continue
        dias_para_fechar = (fechamento - max(avaliacoes_anteriores)).days
        if dias_para_fechar <= 30:
            ids_resgate_ate_30_dias.add(paciente_id)
        else:
            ids_resgate_mais_30_dias.add(paciente_id)

    meta_atual = obter_meta_mensal(conn, ano_atual, mes_atual)
    meta_mes = float(meta_atual.meta or 0)
    supermeta_mes = float(meta_atual.supermeta or 0)
    hipermeta_mes = float(meta_atual.hipermeta or 0)

    vendas_historicas_rows = conn.execute(
        """
        SELECT data_venda, valor_total
        FROM vendas
        WHERE data_venda LIKE ?
        """,
        (f"{ano_atual:04d}-%",),
    ).fetchall()
    vendas_historicas_por_mes: dict[int, float] = {}
    meses_com_historico: set[int] = set()
    for venda_historica in vendas_historicas_rows:
        data_historica = parse_data_contrato(str(venda_historica["data_venda"] or ""))
        if not data_historica or data_historica.year != ano_atual:
            continue
        meses_com_historico.add(data_historica.month)
        vendas_historicas_por_mes[data_historica.month] = (
            vendas_historicas_por_mes.get(data_historica.month, 0.0)
            + float(venda_historica["valor_total"] or 0)
        )

    serie_vendas: list[float] = []
    for mes_indice in range(1, 13):
        # A tabela `vendas` guarda o fechamento oficial dos meses anteriores à
        # implantação. Quando houver histórico para o mês, ele prevalece sobre
        # contratos importados, cujas datas de aprovação podem não ser confiáveis.
        if mes_indice in meses_com_historico:
            serie_vendas.append(vendas_historicas_por_mes.get(mes_indice, 0.0))
            continue
        total_mes = 0.0
        for row in contratos_rows:
            status = normalizar_texto(row["status"])
            if status not in {"aprovado", "aprovada", "convertido"}:
                continue
            data_ref = parse_data_contrato(str(row["data_aprovacao"] or "")) or parse_data_contrato(str(row["data_criacao"] or ""))
            if not data_ref or data_ref.year != ano_atual or data_ref.month != mes_indice:
                continue
            if not bool(int(row["incluir_total_vendido"] or 0)):
                continue
            total_mes += float(row["valor_venda_considerado"] if row["valor_venda_considerado"] is not None else row["valor_total"] or 0)
        serie_vendas.append(total_mes)

    vendido_mes = serie_vendas[mes_atual - 1] if 0 < mes_atual <= len(serie_vendas) else 0.0
    vendido_ano = sum(serie_vendas)
    falta_meta_mes = max(meta_mes - vendido_mes, 0.0)
    falta_meta_ano = max((meta_mes * 12) - vendido_ano, 0.0) if meta_mes > 0 else 0.0
    percentual_meta_mes = min((vendido_mes / meta_mes) * 100, 999) if meta_mes > 0 else 0.0
    percentual_meta_ano = min((vendido_ano / (meta_mes * 12)) * 100, 999) if meta_mes > 0 else 0.0

    indicadores = [
        DashboardIndicadorResposta(
            chave="vendas_mes_qtd",
            titulo="Vendas no mês",
            valor=str(vendas_mes_qtd),
            detalhe=f"{meses[mes_atual - 1]} de {ano_atual}",
            detalhamentos=detalhes_vendas_mes,
        ),
        DashboardIndicadorResposta(
            chave="vendas_mes_valor",
            titulo="Quanto em dinheiro foi vendido",
            valor=formatar_moeda_br(vendas_mes_valor),
            detalhe=f"Total fechado em {meses[mes_atual - 1]}",
            detalhamentos=detalhes_vendas_mes,
        ),
        DashboardIndicadorResposta(
            chave="a_receber_hoje",
            titulo="A receber no dia",
            valor=formatar_moeda_br(a_receber_hoje),
            detalhe=f"Vencimentos de {formatar_data_br(hoje)}",
            detalhamentos=detalhes_receber_hoje,
        ),
        DashboardIndicadorResposta(
            chave="inadimplencia",
            titulo="Inadimplências",
            valor=str(inadimplencia_qtd),
            detalhe=formatar_moeda_br(inadimplencia_valor),
            detalhamentos=detalhes_inadimplencia,
        ),
    ]

    calendario_pagamentos_map: dict[str, dict[str, object]] = {}
    for row in contas_pagar_rows:
        vencimento = str(row["data_vencimento"] or "").strip()
        if not vencimento:
            continue
        data_ref = parse_data_contrato(vencimento)
        if not data_ref or data_ref.year != ano_atual or data_ref.month != mes_atual:
            continue
        if normalizar_texto(row["status"]) in {"pago", "cancelado", "suspenso"}:
            continue
        chave_data = data_ref.isoformat()
        atual = calendario_pagamentos_map.setdefault(chave_data, {"total": 0.0, "quantidade": 0, "pagamentos": []})
        atual["total"] = float(atual["total"]) + float(row["valor"] or 0)
        atual["quantidade"] = int(atual["quantidade"]) + 1
        pagamentos = atual["pagamentos"]
        if isinstance(pagamentos, list):
            pagamentos.append(mapear_conta_pagar(row))

    return DashboardPainelResposta(
        indicadores=indicadores,
        meses=meses,
        serieVendas=serie_vendas,
        resumoHoje=DashboardResumoHojeResposta(
            entradasConfirmadas=formatar_moeda_br(entradas_hoje),
            saidasPrevistas=formatar_moeda_br(saidas_hoje),
            saldoProjetado=formatar_moeda_br(saldo_hoje),
        ),
        metas=DashboardMetasResposta(
            vendidoMes=formatar_moeda_br(vendido_mes),
            vendidoAno=formatar_moeda_br(vendido_ano),
            metaMes=formatar_moeda_br(meta_mes),
            supermetaMes=formatar_moeda_br(supermeta_mes),
            hipermetaMes=formatar_moeda_br(hipermeta_mes),
            faltaMetaMes=formatar_moeda_br(falta_meta_mes),
            faltaMetaAno=formatar_moeda_br(falta_meta_ano),
            percentualMetaMes=percentual_meta_mes,
            percentualMetaAno=percentual_meta_ano,
        ),
        funilReal=DashboardFunilResposta(
            leads=quantidade_leads,
            agendou=len(ids_agendou),
            compareceu=len(ids_compareceu),
            fechou=len(ids_fechou),
            resgates=len(ids_resgate_ate_30_dias | ids_resgate_mais_30_dias),
            resgatesAte30Dias=len(ids_resgate_ate_30_dias),
            resgatesMais30Dias=len(ids_resgate_mais_30_dias),
        ),
        agendaHoje=[],
        vendasResumo=vendas_resumo,
        calendarioPagamentos=[
            DashboardCalendarioPagamentoItemResposta(
                data=data_ref,
                total=formatar_moeda_br(float(valores["total"] or 0)),
                quantidade=int(valores["quantidade"] or 0),
                pagamentos=list(valores["pagamentos"]) if isinstance(valores.get("pagamentos"), list) else [],
            )
            for data_ref, valores in sorted(calendario_pagamentos_map.items())
        ],
        devedoresResumo=devedores_resumo,
        alertas=[],
        atividades=[],
    )


def registrar_saldo_conta(conn: sqlite3.Connection, *, data_saldo: str, conta: str, saldo: float, observacao: str = "") -> int:
    cursor = conn.execute(
        """
        INSERT INTO saldos_conta (data, conta, saldo, observacao)
        VALUES (?, ?, ?, ?)
        """,
        (data_saldo.strip(), conta.strip().upper(), float(saldo or 0), observacao.strip()),
    )
    return int(cursor.lastrowid)


def saldos_informados_por_conta_ate(conn: sqlite3.Connection, data_limite: date) -> dict[str, float]:
    saldos = {conta: 0.0 for conta in CONTAS_CAIXA_MODELO}
    rows = conn.execute("SELECT * FROM saldos_conta ORDER BY data ASC, id ASC").fetchall()
    for row in rows:
        data_ref = parse_data_contrato(row["data"])
        conta = str(row["conta"] or "").strip().upper()
        if not data_ref or conta not in saldos:
            continue
        if data_ref <= data_limite:
            saldos[conta] = float(row["saldo"] or 0)
    return saldos


def caixa_diario_para_excel_bytes(conn: sqlite3.Connection, financeiro_rows: list[sqlite3.Row]) -> bytes | None:
    if Workbook is None or Alignment is None or Border is None or Font is None or PatternFill is None or Side is None:
        return None
    if not financeiro_rows:
        return None

    movimentos = []
    for row in financeiro_rows:
        data_ref = parse_data_contrato(row["data"])
        if not data_ref:
            continue
        movimentos.append(
            {
                "id": int(row["id"]),
                "data": data_ref,
                "descricao": str(row["descricao"] or row["origem"] or "").strip(),
                "valor": float(row["valor"] or 0),
                "tipo": str(row["tipo"] or ""),
                "conta": str(row["conta_caixa"] or "CAIXA").strip().upper() or "CAIXA",
            }
        )
    if not movimentos:
        return None

    movimentos.sort(key=lambda item: (item["data"], item["id"]))
    wb = Workbook()
    ws = wb.active
    ws.title = "Caixa"

    fonte_titulo = Font(name="Times New Roman", size=20, color="000000")
    fonte_cabecalho = Font(name="Times New Roman", size=12, color="000000")
    fonte_normal = Font(name="Times New Roman", size=12, color="000000")
    fonte_vermelha = Font(name="Times New Roman", size=12, color="FF0000")
    preenchimento_saldo = PatternFill(fill_type="solid", fgColor="D0CECE")
    borda_fina = Border(
        left=Side(style="thin", color="000000"),
        right=Side(style="thin", color="000000"),
        top=Side(style="thin", color="000000"),
        bottom=Side(style="thin", color="000000"),
    )

    ws.merge_cells("A1:E1")
    ws["A1"] = "CAIXA"
    ws["A1"].font = fonte_titulo
    ws["A1"].alignment = Alignment(horizontal="center", vertical="center")
    for coluna, largura in {"A": 14, "B": 58, "C": 18, "D": 16, "E": 18}.items():
        ws.column_dimensions[coluna].width = largura

    linha_atual = 3
    datas = sorted({item["data"] for item in movimentos})
    for data_atual in datas:
        data_texto = formatar_data_br(data_atual)
        grupo = [item for item in movimentos if item["data"] == data_atual]
        saldo_atual = saldos_informados_por_conta_ate(conn, data_atual)

        cabecalhos = ["Data", "Descrição", "Entradas", "Saídas", "Banco"]
        for indice, titulo in enumerate(cabecalhos, start=1):
            celula = ws.cell(row=linha_atual, column=indice, value=titulo)
            celula.font = fonte_cabecalho
            celula.border = borda_fina
        linha_atual += 1

        for conta in CONTAS_CAIXA_MODELO:
            valor_saldo = round(saldo_atual.get(conta, 0), 2)
            ws.cell(row=linha_atual, column=1, value=data_texto)
            ws.cell(row=linha_atual, column=2, value=f"SALDO DO DIA ANTERIOR - {conta}")
            ws.cell(row=linha_atual, column=3, value=valor_saldo)
            ws.cell(row=linha_atual, column=5, value=conta)
            for coluna in range(1, 6):
                celula = ws.cell(row=linha_atual, column=coluna)
                celula.fill = preenchimento_saldo
                celula.border = borda_fina
                celula.font = fonte_normal
            ws.cell(row=linha_atual, column=3).number_format = '"R$" #,##0.00'
            ws.cell(row=linha_atual, column=3).font = fonte_vermelha if valor_saldo < 0 else fonte_normal
            linha_atual += 1

        linha_atual += 3

        for item in grupo:
            valor = round(item["valor"], 2)
            conta = item["conta"] if item["conta"] in CONTAS_CAIXA_MODELO else "CAIXA"
            ws.cell(row=linha_atual, column=1, value=data_texto)
            ws.cell(row=linha_atual, column=2, value=item["descricao"])
            if item["tipo"] == "Entrada":
                ws.cell(row=linha_atual, column=3, value=valor)
                saldo_atual[conta] += valor
            else:
                ws.cell(row=linha_atual, column=4, value=valor)
                saldo_atual[conta] -= valor
            ws.cell(row=linha_atual, column=5, value=conta)
            for coluna in range(1, 6):
                celula = ws.cell(row=linha_atual, column=coluna)
                celula.border = borda_fina
                celula.font = fonte_normal
            ws.cell(row=linha_atual, column=3).number_format = '"R$" #,##0.00'
            ws.cell(row=linha_atual, column=4).number_format = '"R$" #,##0.00'
            ws.cell(row=linha_atual, column=4).font = fonte_vermelha if ws.cell(row=linha_atual, column=4).value not in (None, 0, 0.0) else fonte_normal
            linha_atual += 1

        linha_atual += 3

        for conta in CONTAS_CAIXA_MODELO:
            valor_saldo = round(saldo_atual.get(conta, 0), 2)
            ws.cell(row=linha_atual, column=1, value=data_texto)
            ws.cell(row=linha_atual, column=2, value=f"SALDO DO DIA - {conta}")
            ws.cell(row=linha_atual, column=3, value=valor_saldo)
            ws.cell(row=linha_atual, column=5, value=conta)
            for coluna in range(1, 6):
                celula = ws.cell(row=linha_atual, column=coluna)
                celula.fill = preenchimento_saldo
                celula.border = borda_fina
                celula.font = fonte_normal
            ws.cell(row=linha_atual, column=3).number_format = '"R$" #,##0.00'
            ws.cell(row=linha_atual, column=3).font = fonte_vermelha if valor_saldo < 0 else fonte_normal
            linha_atual += 1

        linha_atual += 3

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def openpyxl_column_name(index: int) -> str:
    resultado = ""
    atual = index
    while atual > 0:
        atual, resto = divmod(atual - 1, 26)
        resultado = chr(65 + resto) + resultado
    return resultado


def exportar_todas_tabelas_excel_bytes(conn: sqlite3.Connection) -> bytes:
    if Workbook is None or Font is None or PatternFill is None:
        raise HTTPException(status_code=500, detail="openpyxl nao disponivel")

    wb = Workbook()
    ws_inicial = wb.active
    wb.remove(ws_inicial)

    tabelas = conn.execute(
        """
        SELECT name
        FROM sqlite_master
        WHERE type='table'
          AND name NOT LIKE 'sqlite_%'
        ORDER BY name
        """
    ).fetchall()

    for item in tabelas:
        tabela = str(item["name"] or "").strip()
        if not tabela:
            continue
        sheet = wb.create_sheet(title=tabela[:31])
        colunas_info = conn.execute(f"PRAGMA table_info({tabela})").fetchall()
        colunas = [str(col["name"]) for col in colunas_info]
        if not colunas:
            sheet["A1"] = "Sem dados"
            continue

        for idx, coluna in enumerate(colunas, start=1):
            celula = sheet.cell(row=1, column=idx, value=coluna)
            celula.font = Font(bold=True)
            celula.fill = PatternFill(fill_type="solid", fgColor="E8E1D2")

        rows = conn.execute(f"SELECT * FROM {tabela}").fetchall()
        for row_idx, row in enumerate(rows, start=2):
            for col_idx, coluna in enumerate(colunas, start=1):
                valor = row[coluna]
                if valor is None:
                    valor = ""
                elif isinstance(valor, bytes):
                    try:
                        valor = valor.decode("utf-8", errors="ignore")
                    except Exception:
                        valor = str(valor)
                elif isinstance(valor, (dict, list)):
                    valor = json.dumps(valor, ensure_ascii=False)
                sheet.cell(row=row_idx, column=col_idx, value=valor)

        for idx, coluna in enumerate(colunas, start=1):
            largura = max(14, min(len(coluna) + 2, 40))
            if rows:
                exemplo = str(rows[0][coluna] or "")
                largura = max(largura, min(len(exemplo) + 2, 40))
            sheet.column_dimensions[openpyxl_column_name(idx)].width = largura
        sheet.freeze_panes = "A2"

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()


def registrar_movimento_caixa(
    conn: sqlite3.Connection,
    *,
    origem: str,
    descricao: str,
    valor: float,
    tipo: str,
    data_movimento: str,
    prontuario: str = "",
    forma_pagamento: str = "",
    conta_caixa: str = "",
    observacao: str = "",
    contrato_id: int | None = None,
    recebivel_id: int | None = None,
) -> int:
    cursor = conn.execute(
        """
        INSERT INTO financeiro (
            origem, descricao, valor, data, tipo, contrato_id, recebivel_id, prontuario,
            forma_pagamento, conta_caixa, observacao
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            origem.strip(),
            descricao.strip(),
            float(valor or 0),
            data_movimento.strip(),
            tipo.strip(),
            contrato_id,
            recebivel_id,
            prontuario.strip(),
            forma_pagamento.strip(),
            conta_caixa.strip(),
            observacao.strip(),
        ),
    )
    return int(cursor.lastrowid)


def baixar_recebivel_no_caixa(
    conn: sqlite3.Connection,
    *,
    paciente_id: int,
    recebivel_id: int,
    data_pagamento: str,
    forma_pagamento: str = "",
    conta_caixa: str = "",
    desconto_valor: float = 0,
    observacao: str = "",
) -> sqlite3.Row:
    recebivel = carregar_recebivel_paciente(conn, paciente_id, recebivel_id)
    if normalizar_texto(recebivel["status"]) == "pago":
        raise HTTPException(status_code=400, detail="Este recebivel ja esta pago.")

    data_ref = parse_data_contrato(data_pagamento) or date.today()
    data_iso = data_ref.isoformat()
    data_br = formatar_data_br(data_ref)
    forma = (forma_pagamento or str(recebivel["forma_pagamento"] or "")).strip()
    conta = (conta_caixa or forma).strip()
    valor_original = float(recebivel["valor"] or 0)
    desconto = max(0.0, float(desconto_valor or 0))
    valor_recebido = max(0.0, valor_original - desconto)
    paciente_nome = str(recebivel["paciente_nome"] or "").strip()
    parcela_atual = max(int(recebivel["parcela_numero"] or 0), 0)
    total_parcelas = parcela_atual
    if recebivel["contrato_id"] is not None:
        contrato_row = conn.execute("SELECT parcelas FROM contratos WHERE id=?", (int(recebivel["contrato_id"]),)).fetchone()
        if contrato_row is not None:
            total_parcelas = max(int(contrato_row["parcelas"] or parcela_atual or 1), 1)
    if parcela_atual == 0:
        descricao = f"{paciente_nome or 'Recebimento'} - ENTRADA"
    else:
        descricao = f"{paciente_nome or 'Recebimento'} - {parcela_atual}/{total_parcelas}"
    if desconto > 0:
        descricao = f"{descricao} (desc. {formatar_moeda_br(desconto)})"

    observacao_atual = str(recebivel["observacao"] or "").strip()
    observacao_desconto = f"Desconto na baixa: {formatar_moeda_br(desconto)}" if desconto > 0 else ""
    observacao_final = " | ".join(parte for parte in [observacao_atual, observacao_desconto, observacao.strip()] if parte)

    registrar_movimento_caixa(
        conn,
        origem=paciente_nome or "Recebimento",
        descricao=descricao,
        valor=valor_recebido,
        tipo="Entrada",
        data_movimento=data_iso,
        prontuario=formatar_prontuario_valor(recebivel["prontuario"]),
        forma_pagamento=forma,
        conta_caixa=conta,
        observacao=observacao_final,
        contrato_id=int(recebivel["contrato_id"]) if recebivel["contrato_id"] is not None else None,
        recebivel_id=int(recebivel["id"]),
    )

    conn.execute(
        """
        UPDATE recebiveis
        SET status='Pago', data_pagamento=?, forma_pagamento=?, observacao=?
        WHERE id=? AND paciente_id=?
        """,
        (data_br, forma, observacao_final, recebivel_id, paciente_id),
    )
    return carregar_recebivel_paciente(conn, paciente_id, recebivel_id)


def listar_exames_paciente(paciente_row: sqlite3.Row) -> list[ArquivoPacienteItem]:
    pasta = pasta_exames_paciente(paciente_row)
    itens: list[ArquivoPacienteItem] = []
    for nome_arquivo in sorted(os.listdir(pasta), reverse=True):
        caminho = os.path.join(pasta, nome_arquivo)
        if os.path.isfile(caminho):
            itens.append(
                ArquivoPacienteItem(
                    nome=nome_arquivo,
                    caminho=caminho,
                    modificadoEm=formatar_data_br(datetime.fromtimestamp(os.path.getmtime(caminho)).date()),
                    extensao=os.path.splitext(nome_arquivo)[1].lower(),
                )
            )
    return itens


def listar_documentos_paciente(paciente_row: sqlite3.Row, conn: sqlite3.Connection | None = None) -> list[ArquivoPacienteItem]:
    prontuario = normalizar_texto(formatar_prontuario_valor(paciente_row["prontuario"]))
    nome = normalizar_texto(limpar_nome(paciente_row["nome"]))
    if not os.path.isdir(DOCS_DIR):
        itens: list[ArquivoPacienteItem] = []
    else:
        itens = []
        for nome_arquivo in sorted(os.listdir(DOCS_DIR), reverse=True):
            caminho = os.path.join(DOCS_DIR, nome_arquivo)
            if not os.path.isfile(caminho):
                continue
            nome_upper = str(nome_arquivo or "").upper()
            if nome_upper.startswith("CONTRATO_") or nome_upper.startswith("ORDEM_SERVICO_"):
                continue
            nome_norm = normalizar_texto(nome_arquivo)
            if (prontuario and prontuario in nome_norm) or (nome and nome in nome_norm):
                itens.append(
                    ArquivoPacienteItem(
                        nome=nome_arquivo,
                        caminho=caminho,
                        modificadoEm=formatar_data_br(datetime.fromtimestamp(os.path.getmtime(caminho)).date()),
                        extensao=os.path.splitext(nome_arquivo)[1].lower(),
                    )
                )

    conexao_local = False
    if conn is None:
        conn = conectar()
        conexao_local = True
    try:
        contratos_rows = conn.execute(
            """
            SELECT id, data_aprovacao, data_criacao
            FROM contratos
            WHERE paciente_id=?
            ORDER BY COALESCE(data_aprovacao, data_criacao, '') DESC, id DESC
            """,
            (int(paciente_row["id"]),),
        ).fetchall()
        arquivos_existentes = {}
        if os.path.isdir(DOCS_DIR):
            for nome_arquivo in os.listdir(DOCS_DIR):
                caminho = os.path.join(DOCS_DIR, nome_arquivo)
                if not os.path.isfile(caminho):
                    continue
                arquivos_existentes[str(nome_arquivo)] = caminho

        for row in contratos_rows:
            contrato_id = int(row["id"])
            prefixo = f"{nome_base_contrato(paciente_row, contrato_id)}_".upper()
            arquivo_contrato = next(
                (
                    nome_arquivo
                    for nome_arquivo in sorted(arquivos_existentes.keys(), reverse=True)
                    if str(nome_arquivo).upper().startswith(prefixo)
                ),
                "",
            )
            nome_virtual = arquivo_contrato or f"{nome_base_contrato(paciente_row, contrato_id)}.docx"
            data_ref = parse_data_contrato(row["data_aprovacao"]) or parse_data_contrato(row["data_criacao"]) or date.today()
            itens.append(
                ArquivoPacienteItem(
                    nome=nome_virtual,
                    caminho=arquivos_existentes.get(nome_virtual, os.path.join(DOCS_DIR, nome_virtual)),
                    modificadoEm=formatar_data_br(data_ref),
                    extensao=".docx",
                )
            )
        ordens_rows = conn.execute(
            """
            SELECT id, documento_nome, criado_em
            FROM ordens_servico_protetico
            WHERE paciente_id=?
            ORDER BY COALESCE(criado_em, '') DESC, id DESC
            """,
            (int(paciente_row["id"]),),
        ).fetchall()
        for row in ordens_rows:
            documento_nome = str(row["documento_nome"] or "").strip()
            if not documento_nome:
                continue
            data_ref = parse_data_contrato(row["criado_em"]) or date.today()
            itens.append(
                ArquivoPacienteItem(
                    nome=documento_nome,
                    caminho=arquivos_existentes.get(documento_nome, os.path.join(DOCS_DIR, documento_nome)),
                    modificadoEm=formatar_data_br(data_ref),
                    extensao=os.path.splitext(documento_nome)[1].lower() or ".docx",
                )
            )
    finally:
        if conexao_local and conn is not None:
            conn.close()

    vistos: set[str] = set()
    itens_unicos: list[ArquivoPacienteItem] = []
    for item in itens:
        if item.nome in vistos:
            continue
        vistos.add(item.nome)
        itens_unicos.append(item)
    return itens_unicos


def extrair_contrato_id_documento(nome_arquivo: str) -> int | None:
    nome = os.path.basename(str(nome_arquivo or "").strip())
    if not nome.upper().startswith("CONTRATO_"):
        return None
    sem_extensao, _ = os.path.splitext(nome)
    partes = sem_extensao.split("_")
    numericos = [parte for parte in partes if parte.isdigit()]
    if not numericos:
        return None
    if len(numericos) >= 3 and len(numericos[-1]) >= 8 and len(numericos[-2]) >= 8:
        return int(numericos[-2])
    return int(numericos[-1])


def limpar_documentos_contrato_variantes(paciente_row: sqlite3.Row, contrato_id: int) -> None:
    if not os.path.isdir(DOCS_DIR):
        return
    prefixo = nome_base_contrato(paciente_row, contrato_id).upper()
    for nome_arquivo in os.listdir(DOCS_DIR):
        caminho = os.path.join(DOCS_DIR, nome_arquivo)
        if not os.path.isfile(caminho):
            continue
        nome_upper = str(nome_arquivo or "").upper()
        if nome_upper.startswith(prefixo) and nome_upper.endswith((".DOCX", ".HTML")):
            os.remove(caminho)


def resolver_documento_contrato_atual(
    conn: sqlite3.Connection,
    paciente_row: sqlite3.Row,
    nome_arquivo: str,
) -> str | None:
    nome_limpo = os.path.basename(str(nome_arquivo or "").strip())
    if not nome_limpo.upper().startswith("CONTRATO_"):
        return None
    contrato_id = extrair_contrato_id_documento(nome_arquivo)
    contrato = None
    if contrato_id is not None:
        contrato = conn.execute(
            "SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1",
            (contrato_id, int(paciente_row["id"])),
        ).fetchone()
    if contrato is None:
        contrato = conn.execute(
            "SELECT * FROM contratos WHERE paciente_id=? ORDER BY COALESCE(data_criacao, '') DESC, id DESC LIMIT 1",
            (int(paciente_row["id"]),),
        ).fetchone()
    if contrato is None:
        return None
    contrato_id = int(contrato["id"])
    return gerar_documento_contrato(conn, paciente_row, contrato, contrato_id)


def buscar_documento_paciente(paciente_row: sqlite3.Row, nome_arquivo: str) -> str:
    nome_busca = os.path.basename(str(nome_arquivo or "").strip())
    if not nome_busca:
        raise HTTPException(status_code=404, detail="Documento nao encontrado.")
    for item in listar_documentos_paciente(paciente_row):
        if item.nome == nome_busca and os.path.isfile(item.caminho):
            return item.caminho
    raise HTTPException(status_code=404, detail="Documento nao encontrado.")


def buscar_exame_paciente(paciente_row: sqlite3.Row, nome_arquivo: str) -> str:
    nome_busca = os.path.basename(str(nome_arquivo or "").strip())
    if not nome_busca:
        raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")
    for item in listar_exames_paciente(paciente_row):
        if item.nome == nome_busca and os.path.isfile(item.caminho):
            return item.caminho
    raise HTTPException(status_code=404, detail="Arquivo nao encontrado.")


def gerar_html_recibo_especie(recebivel: sqlite3.Row) -> str:
    paciente = formatar_titulo(str(recebivel["paciente_nome"] or ""))
    prontuario = formatar_prontuario_valor(recebivel["prontuario"])
    parcela = int(recebivel["parcela_numero"] or 0)
    descricao = "ENTRADA" if parcela == 0 else f"PARCELA {parcela}"
    valor = formatar_moeda_br(recebivel["valor"])
    data_pagamento = formatar_data_br_valor(recebivel["data_pagamento"]) or formatar_data_br(date.today())
    observacao = str(recebivel["observacao"] or "").strip()
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Recibo</title>
  <style>
    body {{ font-family: Arial, sans-serif; padding: 32px; color: #222; }}
    .sheet {{ max-width: 760px; margin: 0 auto; border: 1px solid #d7d7d7; padding: 36px; }}
    .logo-recibo {{ display: block; max-width: 220px; width: 100%; height: auto; object-fit: contain; }}
    h1 {{ margin: 0 0 24px; font-size: 24px; }}
    .meta {{ display: grid; gap: 8px; margin-bottom: 24px; }}
    .valor {{ font-size: 28px; font-weight: 700; margin: 20px 0; }}
    .assinatura {{ margin-top: 56px; padding-top: 16px; border-top: 1px solid #444; width: 320px; }}
    .small {{ color: #666; font-size: 12px; }}
    @media print {{ body {{ padding: 0; }} .sheet {{ border: 0; }} }}
  </style>
</head>
<body>
  <div class="sheet">
    <h1>RECIBO</h1>
    <div class="meta">
      <div><strong>CLÍNICA:</strong> SOUL SUL CLÍNICA INTEGRADA</div>
      <div><strong>PACIENTE:</strong> {paciente}</div>
      <div><strong>PRONTUÁRIO:</strong> {prontuario}</div>
      <div><strong>REFERÊNCIA:</strong> {descricao}</div>
      <div><strong>DATA:</strong> {data_pagamento}</div>
      <div><strong>FORMA:</strong> DINHEIRO</div>
    </div>
    <div>Recebemos de <strong>{paciente}</strong> a quantia de <strong>{valor}</strong>, referente a {descricao.lower()}.</div>
    <div class="valor">{valor}</div>
    {f'<div><strong>OBSERVAÇÃO:</strong> {observacao}</div>' if observacao else ''}
    <div class="assinatura">SOUL SUL CLÍNICA INTEGRADA</div>
    <div class="small">Documento gerado pelo sistema.</div>
  </div>
</body>
</html>"""


LOGO_RECIBO_BASE64: str | None = None


def obter_logo_recibo_base64() -> str:
    global LOGO_RECIBO_BASE64
    if LOGO_RECIBO_BASE64:
        return LOGO_RECIBO_BASE64
    caminho = os.path.join(os.path.dirname(__file__), "assets", "sou sul marca preta fundo.png")
    try:
        with open(caminho, "rb") as arquivo:
            LOGO_RECIBO_BASE64 = base64.b64encode(arquivo.read()).decode("ascii")
    except FileNotFoundError:
        LOGO_RECIBO_BASE64 = ""
    return LOGO_RECIBO_BASE64


def decodificar_base64_documento(valor: str) -> bytes:
    texto = str(valor or "").strip()
    if not texto:
        raise HTTPException(status_code=400, detail="Imagem do boleto vazia.")
    if "," in texto and texto.split(",", 1)[0].lower().startswith("data:"):
        texto = texto.split(",", 1)[1]
    try:
        return base64.b64decode(texto)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Falha ao ler uma das imagens do boleto.") from exc


def nome_arquivo_recebimento_boletos(paciente_row: sqlite3.Row) -> str:
    timestamp = agora_local().strftime("%Y%m%d_%H%M%S")
    return f"RECEBIMENTO_BOLETOS_{slug_paciente_arquivos(paciente_row)}_{timestamp}.docx"


def montar_texto_recebimento_boletos(paciente_row: sqlite3.Row) -> str:
    nome = formatar_titulo(valor_row(paciente_row, "nome")) or "________________________________"
    cpf = valor_row(paciente_row, "cpf") or "___________________"
    endereco = montar_endereco_paciente_contrato(paciente_row) or "endereço não informado"
    return (
        f"Eu, {nome}, inscrito(a) sob o CPF: {cpf}, residente em {endereco}, "
        "autorizo a empresa SOUL SUL CLINICA INTEGRADA LTDA, inscrita no CNPJ sob o nº "
        "59.002.730/0001-74, com sede à Rua Tenente Coronel Cardoso, 812, Centro, "
        "Campos dos Goytacazes/RJ, pessoa jurídica de direito privado, a emitir os boletos descritos abaixo:"
    )


def remover_imagens_corpo_documento(doc) -> None:
    """Remove imagens antigas do corpo do modelo, preservando cabecalho e rodape."""
    for paragrafo in list(doc.paragraphs):
        desenhos = paragrafo._p.xpath(".//w:drawing | .//w:pict")
        if not desenhos:
            continue
        for desenho in desenhos:
            pai = desenho.getparent()
            if pai is not None:
                pai.remove(desenho)
        if not paragrafo.text.strip() and not paragrafo._p.xpath(".//w:drawing | .//w:pict"):
            pai_paragrafo = paragrafo._p.getparent()
            if pai_paragrafo is not None:
                pai_paragrafo.remove(paragrafo._p)

    for paragrafo in list(doc.paragraphs):
        if paragrafo.text.strip() or paragrafo._p.xpath(".//w:drawing | .//w:pict"):
            continue
        pai_paragrafo = paragrafo._p.getparent()
        if pai_paragrafo is not None:
            pai_paragrafo.remove(paragrafo._p)


def gerar_documento_recebimento_boletos(
    paciente_row: sqlite3.Row,
    imagens: list[ImagemDocumentoPayload],
) -> ArquivoPacienteItem:
    if Document is None:
        raise HTTPException(status_code=500, detail="python-docx nao disponivel para gerar o documento.")
    if not os.path.isfile(TEMPLATE_RECEBIMENTO_BOLETOS_PATH):
        raise HTTPException(status_code=500, detail="Modelo de recebimento de boletos nao encontrado.")
    if not imagens:
        raise HTTPException(status_code=400, detail="Anexe ao menos um print do boleto.")

    doc = Document(TEMPLATE_RECEBIMENTO_BOLETOS_PATH)
    remover_imagens_corpo_documento(doc)
    paragrafo_principal = next((p for p in doc.paragraphs if p.text.strip()), None)
    if paragrafo_principal is None:
        paragrafo_principal = doc.add_paragraph("")
    paragrafo_principal.text = montar_texto_recebimento_boletos(paciente_row)

    indice_linha = next((indice for indice, p in enumerate(doc.paragraphs) if "___" in p.text), None)
    if indice_linha is not None:
        for indice in range(indice_linha + 1, min(indice_linha + 3, len(doc.paragraphs))):
            texto_atual = normalizar_texto_maiusculo(doc.paragraphs[indice].text)
            if texto_atual.startswith("CPF"):
                doc.paragraphs[indice].text = f"CPF: {valor_row(paciente_row, 'cpf')}"
            elif doc.paragraphs[indice].text.strip():
                doc.paragraphs[indice].text = formatar_titulo(valor_row(paciente_row, "nome"))

    pasta_imagens = pasta_boletos_paciente(paciente_row)
    timestamp = agora_local().strftime("%Y%m%d_%H%M%S")
    caminhos_imagens: list[str] = []
    for indice, imagem in enumerate(imagens, start=1):
        nome_original = os.path.basename(str(imagem.nome or f"boleto_{indice}.png").strip()) or f"boleto_{indice}.png"
        extensao = os.path.splitext(nome_original)[1].lower() or ".png"
        if extensao not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise HTTPException(status_code=400, detail="Use imagens PNG, JPG, JPEG ou WEBP para os boletos.")
        conteudo = decodificar_base64_documento(imagem.conteudo_base64)
        if not conteudo:
            raise HTTPException(status_code=400, detail="Uma das imagens do boleto está vazia.")
        caminho_imagem = os.path.join(pasta_imagens, f"boleto_{timestamp}_{indice:02d}{extensao}")
        with open(caminho_imagem, "wb") as destino:
            destino.write(conteudo)
        caminhos_imagens.append(caminho_imagem)

    ancora_xml = paragrafo_principal._p
    titulo_anexos = doc.add_paragraph("BOLETOS ANEXADOS")
    if titulo_anexos.runs:
        titulo_anexos.runs[0].bold = True
        if Pt is not None:
            titulo_anexos.runs[0].font.size = Pt(11)
    inserir_bloco_apos_docx(ancora_xml, titulo_anexos._p)
    ancora_xml = titulo_anexos._p

    for indice, caminho_imagem in enumerate(caminhos_imagens, start=1):
        legenda = doc.add_paragraph(f"Boleto {indice}")
        legenda.paragraph_format.keep_with_next = True
        if indice > 1:
            legenda.paragraph_format.page_break_before = True
        if legenda.runs and Pt is not None:
            legenda.runs[0].bold = True
            legenda.runs[0].font.size = Pt(9)
        inserir_bloco_apos_docx(ancora_xml, legenda._p)
        ancora_xml = legenda._p

        paragrafo_imagem = doc.add_paragraph("")
        paragrafo_imagem.alignment = 1
        run = paragrafo_imagem.add_run()
        if Inches is not None:
            figura = run.add_picture(caminho_imagem, width=Inches(6.0))
            altura_maxima = Inches(6.7)
            if figura.height > altura_maxima:
                proporcao = altura_maxima / figura.height
                figura.width = int(figura.width * proporcao)
                figura.height = altura_maxima
        else:
            run.add_picture(caminho_imagem)
        inserir_bloco_apos_docx(ancora_xml, paragrafo_imagem._p)
        ancora_xml = paragrafo_imagem._p

        espaco = doc.add_paragraph("")
        inserir_bloco_apos_docx(ancora_xml, espaco._p)
        ancora_xml = espaco._p

    os.makedirs(DOCS_DIR, exist_ok=True)
    nome_arquivo = nome_arquivo_recebimento_boletos(paciente_row)
    caminho_docx = os.path.join(DOCS_DIR, nome_arquivo)
    doc.save(caminho_docx)
    return ArquivoPacienteItem(
        nome=nome_arquivo,
        caminho=caminho_docx,
        modificadoEm=formatar_data_br(agora_local().date()),
        extensao=".docx",
    )


def gerar_html_recibo_manual(recibo: sqlite3.Row) -> str:
    valor = formatar_moeda_br(recibo["valor"])
    data_pagamento = formatar_data_br_valor(recibo["data_pagamento"]) or formatar_data_br(date.today())
    pagador = formatar_titulo(str(recibo["pagador"] or "")) or "________________________________"
    recebedor = formatar_titulo(str(recibo["recebedor"] or "")) or "________________________________"
    referente = str(recibo["referente"] or "").strip() or "pagamento realizado"
    observacao = str(recibo["observacao"] or "").strip()
    cidade = str(recibo["cidade"] or "").strip() or "Campos dos Goytacazes/RJ"
    numero = int(recibo["numero"] or 0)
    logo = obter_logo_recibo_base64()
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Recibo</title>
  <style>
    body {{ font-family: Arial, sans-serif; color: #222; padding: 28px; }}
    .sheet {{ max-width: 820px; margin: 0 auto; border: 1px solid #d7d7d7; padding: 40px; }}
    .logo-recibo {{ display: block; max-width: 220px; width: 100%; height: auto; object-fit: contain; flex: 0 0 auto; }}
    h1 {{ margin: 0 0 24px; font-size: 30px; }}
    .topline {{ display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; margin-bottom: 28px; font-size: 14px; }}
    .numero {{ margin-top: 4px; }}
    .body-text {{ font-size: 18px; line-height: 1.8; }}
    .valor {{ font-size: 34px; font-weight: 700; margin: 24px 0; }}
    .obs {{ margin-top: 20px; }}
    .assinaturas {{ display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 72px; }}
    .assinatura {{ padding-top: 14px; border-top: 1px solid #444; text-align: center; min-height: 48px; }}
    .small {{ color: #666; font-size: 12px; margin-top: 10px; }}
    @media print {{ body {{ padding: 0; }} .sheet {{ border: 0; }} }}
  </style>
</head>
<body>
  <div class="sheet">
    <div class="topline">
      <img class="logo-recibo" src="data:image/png;base64,{logo}" alt="Logo" />
      <div>
        <strong>RECIBO</strong>
        <div class="numero">Nº {numero:04d}</div>
      </div>
      <span>{cidade}, {data_pagamento}</span>
    </div>
    <div class="body-text">
      Recebi de <strong>{pagador}</strong> a quantia de <strong>{valor}</strong>,
      paga em {data_pagamento}, destinada a <strong>{recebedor}</strong>, referente a <strong>{referente}</strong>.
    </div>
    <div class="valor">{valor}</div>
    {f'<div class="obs"><strong>Observação:</strong> {observacao}</div>' if observacao else ''}
    <div class="assinaturas">
      <div class="assinatura">{pagador}<div class="small">Pagador(a)</div></div>
      <div class="assinatura">{recebedor}<div class="small">Recebedor(a)</div></div>
    </div>
  </div>
</body>
</html>"""


def buscar_foto_paciente(paciente_row: sqlite3.Row) -> str:
    caminho = str(paciente_row["foto_path"] or "").strip()
    if caminho and os.path.isfile(caminho):
        return caminho
    pasta = pasta_fotos_paciente(paciente_row)
    for extensao in (".png", ".jpg", ".jpeg", ".webp"):
        candidato = os.path.join(pasta, f"foto{extensao}")
        if os.path.isfile(candidato):
            return candidato
    raise HTTPException(status_code=404, detail="Foto nao encontrada.")
    return caminho


def valor_row(row: sqlite3.Row | dict, coluna: str) -> str:
    if isinstance(row, sqlite3.Row):
        valor = row[coluna] if coluna in row.keys() else ""
    else:
        valor = row.get(coluna, "")
    if valor is None:
        return ""
    return str(valor).strip()


def nome_base_contrato(paciente_row: sqlite3.Row, contrato_id: int) -> str:
    nome = limpar_nome(str(paciente_row["nome"] or "")).replace(" ", "_")
    prontuario = formatar_prontuario_valor(paciente_row["prontuario"])
    return f"CONTRATO_{nome}_{prontuario}_{contrato_id}"


def nome_arquivo_contrato(paciente_row: sqlite3.Row, contrato_id: int) -> str:
    timestamp = agora_local().strftime("%Y%m%d_%H%M%S")
    return f"{nome_base_contrato(paciente_row, contrato_id)}_{timestamp}.docx"


def nome_arquivo_ordem_servico(paciente_row: sqlite3.Row, ordem_id: int) -> str:
    nome = limpar_nome(str(paciente_row["nome"] or "")).replace(" ", "_")
    prontuario = formatar_prontuario_valor(paciente_row["prontuario"])
    timestamp = agora_local().strftime("%Y%m%d_%H%M%S")
    return f"ORDEM_SERVICO_{nome}_{prontuario}_{ordem_id}_{timestamp}.docx"


def texto_ordem_servico_carga_imediata(valor: bool) -> str:
    return "SIM" if valor else "NÃO"


def preencher_campo_rotulado(celula, prefixo: str, valor: str) -> None:
    texto = prefixo if not valor else f"{prefixo} {valor}"
    if celula.paragraphs:
        celula.paragraphs[0].text = texto
    else:
        celula.text = texto


def limpar_celula_docx(celula) -> None:
    celula.text = ""


def preencher_celula_multilinha(celula, linhas: list[str]) -> None:
    limpar_celula_docx(celula)
    linhas_validas = [str(linha or "") for linha in linhas]
    if not linhas_validas:
        return
    primeiro = True
    for linha in linhas_validas:
        if primeiro:
            celula.paragraphs[0].text = linha
            primeiro = False
        else:
            celula.add_paragraph(linha)


def remover_linhas_extras_tabela_docx(tabela, manter_total: int) -> None:
    while len(tabela.rows) > manter_total:
        tabela._tbl.remove(tabela.rows[-1]._tr)


def gerar_documento_ordem_servico(
    paciente_row: sqlite3.Row,
    ordem_id: int,
    procedimento_nome: str,
    material: str,
    material_outro: str,
    elemento_arcada: str,
    escala: str,
    cor: str,
    carga_imediata: bool,
    retorno_solicitado: str,
    etapas: list[tuple[str, str]],
    observacao: str,
    criado_por: str,
    logo_path: str | None = None,
) -> str:
    template_ordem_servico_path = caminho_template_ordem_servico()
    if Document is None or not os.path.isfile(template_ordem_servico_path):
        raise HTTPException(status_code=500, detail="Modelo da ordem de servico nao encontrado.")

    doc = Document(template_ordem_servico_path)
    if logo_path and os.path.isfile(logo_path):
        try:
            with open(logo_path, "rb") as arquivo_logo:
                conteudo_logo = arquivo_logo.read()
            for parte in doc.part.related_parts.values():
                if str(getattr(parte, "content_type", "")).startswith("image/"):
                    parte._blob = conteudo_logo
        except OSError as exc:
            raise HTTPException(status_code=500, detail=f"Falha ao carregar a logo da guia: {exc}") from exc
    tabelas = doc.tables
    if not tabelas:
        raise HTTPException(status_code=500, detail="Modelo da ordem de servico invalido.")

    data_emissao = agora_local().strftime("%d/%m/%Y %H:%M")
    etapas_texto = " | ".join(
        f"{etapa}: {descricao}" if normalizar_texto(etapa) == "outro" and descricao else etapa
        for etapa, descricao in etapas
        if str(etapa or "").strip()
    )
    linhas_topo = [
        f"PACIENTE: {formatar_titulo(valor_row(paciente_row, 'nome'))}",
        f"PRONTUÁRIO: {formatar_prontuario_valor(paciente_row['prontuario'])}",
        f"DATA E HORA DE EMISSÃO: {data_emissao}",
        f"ORDEM FEITA POR: {formatar_titulo(criado_por) if str(criado_por or '').strip() else 'NÃO INFORMADO'}",
        f"DATA DE RETORNO SOLICITADA: {formatar_data_br_valor(retorno_solicitado) or retorno_solicitado}",
    ]
    linhas_servico = [
        f"SERVIÇO: {procedimento_nome}",
        f"ELEMENTO (S): {elemento_arcada}",
        f"ESCALA: {escala}" if str(escala or "").strip() else "ESCALA:",
        f"COR: {cor}" if str(cor or "").strip() else "COR:",
    ]
    linhas_carga = [
        f"CARGA IMEDIATA: {texto_ordem_servico_carga_imediata(carga_imediata)}",
    ]
    linhas_final = [
        "FORA DE PRAZO:",
        f"ETAPAS: {etapas_texto}" if etapas_texto else "ETAPAS:",
    ]
    if observacao.strip():
        linhas_final.append(f"OBSERVAÇÃO: {observacao.strip()}")

    try:
        for tabela in tabelas:
            total_colunas = len(tabela.columns)
            colunas_alvo = range(total_colunas) if total_colunas else [0]
            for coluna in colunas_alvo:
                preencher_celula_multilinha(tabela.cell(0, coluna), linhas_topo)
                preencher_celula_multilinha(tabela.cell(1, coluna), linhas_servico)
                preencher_celula_multilinha(tabela.cell(2, coluna), linhas_carga)
                preencher_celula_multilinha(tabela.cell(3, coluna), linhas_final)
            remover_linhas_extras_tabela_docx(tabela, 4)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Falha ao preencher ordem de servico: {exc}") from exc

    os.makedirs(DOCS_DIR, exist_ok=True)
    nome_arquivo = nome_arquivo_ordem_servico(paciente_row, ordem_id)
    caminho = os.path.join(DOCS_DIR, nome_arquivo)
    doc.save(caminho)
    return nome_arquivo


def substituir_placeholders_paragrafo(paragrafo, dados: dict[str, str]) -> None:
    for run in paragrafo.runs:
        for chave, valor in dados.items():
            if chave in run.text:
                run.text = run.text.replace(chave, str(valor))

    texto_original = paragrafo.text
    texto_atualizado = texto_original
    for chave, valor in dados.items():
        texto_atualizado = texto_atualizado.replace(chave, str(valor))
    if texto_atualizado != texto_original:
        paragrafo.text = texto_atualizado


def substituir_runs_doc(doc, dados: dict[str, str]) -> None:
    for paragrafo in doc.paragraphs:
        substituir_placeholders_paragrafo(paragrafo, dados)
    for tabela in doc.tables:
        for linha in tabela.rows:
            for celula in linha.cells:
                for paragrafo in celula.paragraphs:
                    substituir_placeholders_paragrafo(paragrafo, dados)


def montar_endereco_paciente_contrato(paciente_row: sqlite3.Row) -> str:
    endereco = formatar_titulo(valor_row(paciente_row, "endereco"))
    numero = valor_row(paciente_row, "numero")
    complemento = formatar_titulo(valor_row(paciente_row, "complemento"))
    bairro = formatar_titulo(valor_row(paciente_row, "bairro"))
    cidade = formatar_titulo(valor_row(paciente_row, "cidade"))
    estado = valor_row(paciente_row, "estado")
    cep = valor_row(paciente_row, "cep")

    partes: list[str] = []
    if endereco:
        linha = endereco
        if numero:
            linha = f"{linha}, {numero}"
        if complemento:
            linha = f"{linha}, {complemento}"
        partes.append(linha)
    elif numero:
        partes.append(numero)

    for item in [bairro, cidade, estado]:
        if item:
            partes.append(item)

    texto = " - ".join(partes)
    if cep:
        texto = f"{texto} - CEP {cep}" if texto else f"CEP {cep}"
    return texto


def montar_qualificacao_contrato(paciente_row: sqlite3.Row) -> str:
    nome = formatar_titulo(valor_row(paciente_row, "nome"))
    cpf = valor_row(paciente_row, "cpf")
    telefone = valor_row(paciente_row, "telefone")
    nascimento = formatar_data_br_valor(valor_row(paciente_row, "data_nascimento"))
    endereco = montar_endereco_paciente_contrato(paciente_row)
    menor_idade = valor_row(paciente_row, "menor_idade") in {"1", "TRUE", "True", "true"}
    responsavel = formatar_titulo(valor_row(paciente_row, "responsavel"))
    cpf_responsavel = valor_row(paciente_row, "cpf_responsavel")

    if menor_idade and responsavel:
        partes = [responsavel]
        if cpf_responsavel:
            partes.append(f"CPF {cpf_responsavel}")
        if telefone:
            partes.append(f"telefone {telefone}")
        if endereco:
            partes.append(f"endereco {endereco}")
        if nome:
            partes.append(f"responsavel legal pelo(a) paciente {nome}")
        if cpf:
            partes.append(f"CPF do paciente {cpf}")
        if nascimento:
            partes.append(f"nascido(a) em {nascimento}")
        return ", ".join(partes)

    partes = [nome]
    if cpf:
        partes.append(f"CPF {cpf}")
    if telefone:
        partes.append(f"telefone {telefone}")
    if nascimento:
        partes.append(f"nascido(a) em {nascimento}")
    if endereco:
        partes.append(f"endereco {endereco}")
    return ", ".join([parte for parte in partes if parte])


def dados_assinatura_contrato(paciente_row: sqlite3.Row) -> dict[str, str | bool]:
    nome = formatar_titulo(valor_row(paciente_row, "nome"))
    cpf = valor_row(paciente_row, "cpf")
    menor_idade = valor_row(paciente_row, "menor_idade") in {"1", "TRUE", "True", "true"}
    responsavel = formatar_titulo(valor_row(paciente_row, "responsavel"))
    cpf_responsavel = valor_row(paciente_row, "cpf_responsavel")

    if menor_idade and responsavel:
        return {
            "nome_assinatura": responsavel,
            "cpf_assinatura": f"CPF do responsavel: {cpf_responsavel}" if cpf_responsavel else "CPF do responsavel:",
            "assinatura_menor": True,
            "cpf_original": cpf,
        }
    return {
        "nome_assinatura": nome,
        "cpf_assinatura": f"CPF: {cpf}" if cpf else "CPF:",
        "assinatura_menor": False,
        "cpf_original": cpf,
    }


def texto_elemento(elemento) -> str:
    return "".join(elemento.itertext())


LINHA_PREENCHIMENTO_CONTRATO = "______________________________________________________________"
FILEIRA_SUPERIOR_PERMANENTE_DOCX = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28]
FILEIRA_INFERIOR_PERMANENTE_DOCX = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38]
FILEIRA_SUPERIOR_DECIDUA_DOCX = [55, 54, 53, 52, 51, 61, 62, 63, 64, 65]
FILEIRA_INFERIOR_DECIDUA_DOCX = [85, 84, 83, 82, 81, 71, 72, 73, 74, 75]


def remover_elemento(elemento) -> None:
    parent = elemento.getparent()
    if parent is not None:
        parent.remove(elemento)


def remover_secao_termo_cirurgico(doc) -> None:
    if etree is None:
        return
    corpo = doc._element.body
    removendo = False
    elementos_para_remover = []

    for elemento in corpo:
        texto = texto_elemento(elemento)
        if "{TERMO_CIRURGIA}" in texto:
            removendo = True

        if removendo:
            if "CONTRATO DE PRESTACAO DE SERVICOS ODONTOLOGICO" in normalizar_texto_maiusculo(texto):
                removendo = False
                continue
            elementos_para_remover.append(elemento)

    for elemento in elementos_para_remover:
        remover_elemento(elemento)

    for elemento in list(corpo):
        texto = texto_elemento(elemento).strip()
        xml = etree.tostring(elemento, encoding="unicode")
        if "lastRenderedPageBreak" in xml and not texto:
            remover_elemento(elemento)


def preencher_tabela_checklist_contrato(tabela, procedimentos: list[sqlite3.Row]) -> bool:
    if Inches is None:
        return False
    for row_index, row in enumerate(tabela.rows):
        for cell in row.cells:
            if "{PROCEDIMENTO}" not in cell.text:
                continue

            if len(tabela.columns) == 1:
                tabela.add_column(Inches(1.0))

            cabecalho = tabela.rows[row_index]
            cabecalho.cells[0].text = "Procedimento"
            cabecalho.cells[1].text = "OK"

            while len(tabela.rows) < row_index + 1 + len(procedimentos):
                tabela.add_row()

            for indice_proc, proc_row in enumerate(procedimentos, start=1):
                linha = tabela.rows[row_index + indice_proc]
                linha.cells[0].text = str(proc_row["procedimento"] or "")
                linha.cells[1].text = "[   ]"
            return True
    return False


def preencher_tabela_contrato_docx(tabela, procedimentos: list[sqlite3.Row]) -> bool:
    for row_index, row in enumerate(tabela.rows):
        if len(row.cells) < 2:
            continue
        tem_procedimento = any("{PROCEDIMENTO}" in cell.text for cell in row.cells)
        tem_valor = any("{VALOR}" in cell.text for cell in row.cells)
        if not (tem_procedimento or tem_valor):
            continue

        while len(tabela.rows) < row_index + len(procedimentos):
            tabela.add_row()

        for indice_proc, proc_row in enumerate(procedimentos):
            linha = tabela.rows[row_index + indice_proc]
            linha.cells[0].text = str(proc_row["procedimento"] or "")
            linha.cells[1].text = formatar_moeda_br(proc_row["valor"])
        return True
    return False


def aplicar_fundo_celula_docx(celula, cor_hex: str) -> None:
    if OxmlElement is None or qn is None:
        return
    tc_pr = celula._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:fill"), cor_hex)


def inserir_bloco_apos_docx(ancora_xml, novo_xml) -> None:
    if ancora_xml is None or novo_xml is None:
        return
    ancora_xml.addnext(novo_xml)


def montar_tabela_odontograma_docx(doc, dentes_marcados: set[int], fileira: list[int]):
    tabela = doc.add_table(rows=1, cols=len(fileira))
    try:
        tabela.autofit = False
    except Exception:
        pass
    for indice, dente in enumerate(fileira):
        celula = tabela.rows[0].cells[indice]
        celula.text = str(dente)
        selecionado = dente in dentes_marcados
        aplicar_fundo_celula_docx(celula, "E4C7A2" if selecionado else "FFFFFF")
        for paragrafo in celula.paragraphs:
            paragrafo.alignment = 1
            formato = paragrafo.paragraph_format
            if Pt is not None:
                formato.space_before = Pt(0)
                formato.space_after = Pt(0)
            for run in paragrafo.runs:
                run.font.bold = True
                if Pt is not None:
                    run.font.size = Pt(9)
    return tabela


def montar_tabela_elementos_selecionados_docx(doc, dentes: list[int], *, colunas: int = 6):
    if not dentes:
        return None
    colunas = max(1, min(colunas, 8))
    linhas = max(1, math.ceil(len(dentes) / colunas))
    tabela = doc.add_table(rows=linhas, cols=colunas)
    try:
        tabela.autofit = False
    except Exception:
        pass
    for linha_indice in range(linhas):
        for coluna_indice in range(colunas):
            indice = linha_indice * colunas + coluna_indice
            celula = tabela.rows[linha_indice].cells[coluna_indice]
            if indice >= len(dentes):
                celula.text = ""
                aplicar_fundo_celula_docx(celula, "FFFFFF")
                continue
            celula.text = str(dentes[indice])
            aplicar_fundo_celula_docx(celula, "D8EFD2")
            for paragrafo in celula.paragraphs:
                paragrafo.alignment = 1
                formato = paragrafo.paragraph_format
                if Pt is not None:
                    formato.space_before = Pt(0)
                    formato.space_after = Pt(0)
                for run in paragrafo.runs:
                    run.font.bold = True
                    if Pt is not None:
                        run.font.size = Pt(10)
    return tabela


def limpar_conteudo_celula_docx(celula) -> None:
    if qn is None:
        return
    tc = celula._tc
    for child in list(tc):
        if child.tag == qn("w:tcPr"):
            continue
        tc.remove(child)
    celula.add_paragraph("")


def encontrar_celula_odontograma_capa(doc):
    if not getattr(doc, "tables", None):
        return None
    primeira_tabela = doc.tables[0]
    if len(primeira_tabela.rows) < 4 or not primeira_tabela.rows[0].cells:
        return None
    cabecalho = normalizar_texto_maiusculo(primeira_tabela.rows[0].cells[0].text)
    if "PRONTUARIO" not in cabecalho:
        return None
    return primeira_tabela.rows[3].cells[0]


def substituir_odontograma_na_capa_docx(doc, dentes_marcados: list[int]) -> bool:
    celula = encontrar_celula_odontograma_capa(doc)
    if celula is None:
        return False
    limpar_conteudo_celula_docx(celula)
    paragrafo_topo = celula.paragraphs[0]
    paragrafo_topo.alignment = 1
    tabela = montar_tabela_elementos_selecionados_docx(celula, dentes_marcados, colunas=8)
    if tabela is None:
        return False
    try:
        tabela.autofit = True
    except Exception:
        pass
    return True


def inserir_odontograma_contrato_docx(doc, procedimentos: list[dict], tabela_ancora=None) -> None:
    if Document is None or Paragraph is None:
        return
    dentes_marcados = {
        int(regiao)
        for item in procedimentos
        for regiao in item.get("regioes", [])
        if str(regiao).isdigit()
    }
    dentes_permanentes = {dente for dente in dentes_marcados if dente < 50}
    dentes_deciduos = {dente for dente in dentes_marcados if 50 < dente < 90}
    if not dentes_permanentes and not dentes_deciduos:
        return
    if substituir_odontograma_na_capa_docx(doc, sorted(dentes_marcados)):
        return

    ancora_paragrafo = None
    ancora_xml = ancora_paragrafo._p if ancora_paragrafo is not None else (tabela_ancora._tbl if tabela_ancora is not None else None)
    titulo = doc.add_paragraph("ODONTOGRAMA DO CONTRATO")
    if titulo.runs:
        titulo.runs[0].bold = True
        if Pt is not None:
            titulo.runs[0].font.size = Pt(11)
    if ancora_xml is not None:
        inserir_bloco_apos_docx(ancora_xml, titulo._p)
        ancora_xml = titulo._p

    def inserir_linha_resumo(titulo_linha: str, dentes_linha: set[int]) -> None:
        nonlocal ancora_xml
        if not dentes_linha:
            return
        subtitulo = doc.add_paragraph(titulo_linha)
        if subtitulo.runs:
            subtitulo.runs[0].bold = True
            if Pt is not None:
                subtitulo.runs[0].font.size = Pt(9)
        tabela = montar_tabela_elementos_selecionados_docx(doc, sorted(dentes_linha))
        if tabela is None:
            return
        if ancora_xml is not None:
            inserir_bloco_apos_docx(ancora_xml, subtitulo._p)
            ancora_xml = subtitulo._p
            inserir_bloco_apos_docx(ancora_xml, tabela._tbl)
            ancora_xml = tabela._tbl

    if dentes_permanentes:
        inserir_linha_resumo("Dentição permanente", dentes_permanentes)
    if dentes_deciduos:
        inserir_linha_resumo("Dentição decídua", dentes_deciduos)

    legenda = doc.add_paragraph("Somente os elementos selecionados no sistema são exibidos abaixo.")
    if legenda.runs and Pt is not None:
        legenda.runs[0].font.size = Pt(8)
    if ancora_xml is not None:
        inserir_bloco_apos_docx(ancora_xml, legenda._p)


def expandir_regiao_para_dentes_docx(regiao: str, denticao_snapshot: str | None = None) -> list[str]:
    regiao_limpa = str(regiao or "").strip()
    if not regiao_limpa:
        return []
    if regiao_limpa.isdigit():
        return [regiao_limpa]

    denticao_norm = normalizar_texto_maiusculo(denticao_snapshot or "")
    usar_decidua = "DECID" in denticao_norm
    fileiras = {
        "superior": FILEIRA_SUPERIOR_DECIDUA_DOCX if usar_decidua else FILEIRA_SUPERIOR_PERMANENTE_DOCX,
        "inferior": FILEIRA_INFERIOR_DECIDUA_DOCX if usar_decidua else FILEIRA_INFERIOR_PERMANENTE_DOCX,
    }

    regiao_norm = normalizar_texto_maiusculo(regiao_limpa)
    if regiao_norm in {"ARCADA SUPERIOR", "SUPERIOR"}:
        return [str(item) for item in fileiras["superior"]]
    if regiao_norm in {"ARCADA INFERIOR", "INFERIOR"}:
        return [str(item) for item in fileiras["inferior"]]
    if regiao_norm in {
        "ARCADAS SUPERIOR E INFERIOR",
        "ARCADA SUPERIOR E INFERIOR",
        "ARCADA COMPLETA",
        "BOCA TODA",
    }:
        return [str(item) for item in [*fileiras["superior"], *fileiras["inferior"]]]
    return []


def rotulo_regiao_contrato_docx(regiao: str) -> str:
    regiao_limpa = str(regiao or "").strip()
    regiao_norm = normalizar_texto_maiusculo(regiao_limpa)
    if regiao_norm in {"ARCADA SUPERIOR", "SUPERIOR"}:
        return "Arcada Superior"
    if regiao_norm in {"ARCADA INFERIOR", "INFERIOR"}:
        return "Arcada Inferior"
    if regiao_norm in {
        "ARCADAS SUPERIOR E INFERIOR",
        "ARCADA SUPERIOR E INFERIOR",
        "ARCADA COMPLETA",
        "BOCA TODA",
    }:
        return "Arcadas Superior e Inferior"
    return regiao_limpa


def carregar_procedimentos_documento_contrato(conn: sqlite3.Connection, contrato_id: int) -> list[dict]:
    procedimentos = conn.execute(
        "SELECT id, procedimento, valor, profissional_snapshot, denticao_snapshot FROM procedimentos_contrato WHERE contrato_id=? ORDER BY id",
        (contrato_id,),
    ).fetchall()
    dentes = conn.execute(
        """
        SELECT procedimento, dente, regiao, status
        FROM procedimentos_dente
        WHERE contrato_id=? AND upper(trim(COALESCE(status, ''))) <> 'EXCLUIDO'
        ORDER BY id
        """,
        (contrato_id,),
    ).fetchall()

    regioes_por_procedimento: dict[str, list[str]] = {}
    regioes_texto_por_procedimento: dict[str, list[str]] = {}
    denticao_por_procedimento: dict[str, str] = {}
    procedimentos_agrupados: dict[str, dict[str, object]] = {}
    ordem_procedimentos: list[str] = []
    for row in procedimentos:
        procedimento = str(row["procedimento"] or "").strip()
        chave = normalizar_texto(procedimento)
        if not procedimento or not chave:
            continue
        denticao_por_procedimento.setdefault(chave, str(row["denticao_snapshot"] or ""))
        if chave not in procedimentos_agrupados:
            ordem_procedimentos.append(chave)
            procedimentos_agrupados[chave] = {
                "procedimento": procedimento,
                "valor": 0.0,
                "profissional_snapshot": str(row["profissional_snapshot"] or ""),
                "denticao_snapshot": str(row["denticao_snapshot"] or ""),
            }
        procedimentos_agrupados[chave]["valor"] = float(procedimentos_agrupados[chave]["valor"] or 0) + float(row["valor"] or 0)
    for row in dentes:
        chave = normalizar_texto(row["procedimento"])
        valor = str(row["dente"]) if row["dente"] is not None else str(row["regiao"] or "").strip()
        if not valor:
            continue
        regioes_por_procedimento.setdefault(chave, [])
        regioes_texto_por_procedimento.setdefault(chave, [])
        rotulo_regiao = rotulo_regiao_contrato_docx(valor)
        if rotulo_regiao and rotulo_regiao not in regioes_texto_por_procedimento[chave]:
            regioes_texto_por_procedimento[chave].append(rotulo_regiao)
        valores_expandidos = expandir_regiao_para_dentes_docx(valor, denticao_por_procedimento.get(chave))
        if valores_expandidos:
            for item in valores_expandidos:
                if item not in regioes_por_procedimento[chave]:
                    regioes_por_procedimento[chave].append(item)
            continue
        if valor not in regioes_por_procedimento[chave]:
            regioes_por_procedimento[chave].append(valor)

    itens: list[dict] = []
    for chave in ordem_procedimentos:
        grupo = procedimentos_agrupados[chave]
        procedimento = str(grupo["procedimento"] or "")
        regioes = regioes_por_procedimento.get(chave, [])
        regioes_texto = regioes_texto_por_procedimento.get(chave, [])
        if not regioes and not regioes_texto:
            continue
        sufixo = ""
        if regioes_texto:
            somente_elementos = all(str(item).isdigit() for item in regioes_texto)
            if somente_elementos:
                rotulo = "Elemento" if len(regioes_texto) == 1 else "Elementos"
            else:
                rotulo = "Região" if len(regioes_texto) == 1 else "Regiões"
            sufixo = f" - {rotulo}: {', '.join(regioes_texto)}"
        itens.append(
            {
                "procedimento": f"{procedimento}{sufixo}",
                "valor": float(grupo["valor"] or 0),
                "profissional_snapshot": str(grupo["profissional_snapshot"] or ""),
                "denticao_snapshot": str(grupo["denticao_snapshot"] or ""),
                "regioes": regioes,
            }
        )
    return itens


def montar_termo_cirurgia_contrato(procedimentos: list[sqlite3.Row]) -> str:
    itens = [str(row["procedimento"] or "").strip() for row in procedimentos if str(row["procedimento"] or "").strip()]
    if not itens:
        return ""
    if len(itens) == 1:
        return itens[0]
    return "; ".join(itens)


def aplicar_fonte_times_new_roman(doc) -> None:
    if qn is None or Pt is None:
        return

    estilos = doc.styles
    for nome_estilo in ["Normal", "Header", "Footer"]:
        if nome_estilo in estilos:
            estilo = estilos[nome_estilo]
            estilo.font.name = "Times New Roman"
            estilo._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
            estilo._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
            estilo._element.rPr.rFonts.set(qn("w:cs"), "Times New Roman")

    def aplicar_paragrafo(paragrafo) -> None:
        for run in paragrafo.runs:
            run.font.name = "Times New Roman"
            if run._element.rPr is None:
                run._element.get_or_add_rPr()
            run._element.rPr.rFonts.set(qn("w:ascii"), "Times New Roman")
            run._element.rPr.rFonts.set(qn("w:hAnsi"), "Times New Roman")
            run._element.rPr.rFonts.set(qn("w:cs"), "Times New Roman")

    for paragrafo in doc.paragraphs:
        aplicar_paragrafo(paragrafo)
    for tabela in doc.tables:
        for linha in tabela.rows:
            for celula in linha.cells:
                for paragrafo in celula.paragraphs:
                    aplicar_paragrafo(paragrafo)


def garantir_logo_no_cabecalho(doc) -> None:
    if not doc.sections:
        return
    doc.sections[0].different_first_page_header_footer = False
    for secao in doc.sections[1:]:
        secao.different_first_page_header_footer = False
        secao.header.is_linked_to_previous = True


def substituir_par_assinatura(paragrafo_nome, paragrafo_cpf, assinatura: dict[str, str | bool]) -> None:
    paragrafo_nome.text = str(assinatura["nome_assinatura"])
    paragrafo_cpf.text = str(assinatura["cpf_assinatura"])


def ajustar_assinatura_capa(doc, nome_paciente: str, cpf_paciente: str, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    titulo_contrato = "CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICO"
    limite = len(paragrafos)

    for indice, paragrafo in enumerate(paragrafos):
        if titulo_contrato in normalizar_texto_maiusculo(paragrafo.text):
            limite = indice
            break

    for indice in range(limite - 1):
        texto_atual = paragrafos[indice].text.strip()
        texto_proximo = paragrafos[indice + 1].text.strip() if indice + 1 < limite else ""
        if texto_atual == nome_paciente and cpf_paciente and cpf_paciente in texto_proximo:
            substituir_par_assinatura(paragrafos[indice], paragrafos[indice + 1], assinatura)
            return


def ajustar_assinaturas_menor(doc, nome_paciente: str, cpf_paciente: str, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    for indice in range(len(paragrafos) - 1):
        texto_atual = paragrafos[indice].text.strip()
        texto_proximo = paragrafos[indice + 1].text.strip()
        if texto_atual == nome_paciente and cpf_paciente and cpf_paciente in texto_proximo:
            substituir_par_assinatura(paragrafos[indice], paragrafos[indice + 1], assinatura)


def ajustar_assinaturas_por_texto(doc, nome_paciente: str, cpf_paciente: str, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    for paragrafo in paragrafos:
        texto = paragrafo.text
        if not texto:
            continue
        texto_ajustado = texto
        if nome_paciente and nome_paciente in texto_ajustado:
            texto_ajustado = texto_ajustado.replace(nome_paciente, str(assinatura["nome_assinatura"]))
        if cpf_paciente:
            texto_ajustado = texto_ajustado.replace(f"CPF: {cpf_paciente}", str(assinatura["cpf_assinatura"]))
            texto_ajustado = texto_ajustado.replace(f"CPF {cpf_paciente}", str(assinatura["cpf_assinatura"]))
        if texto_ajustado != texto:
            paragrafo.text = texto_ajustado


def ajustar_ultima_assinatura_menor(doc, nome_paciente: str, cpf_paciente: str, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    for indice in range(len(paragrafos) - 2, -1, -1):
        texto_atual = paragrafos[indice].text.strip()
        texto_proximo = paragrafos[indice + 1].text.strip()
        if texto_atual == nome_paciente and cpf_paciente and cpf_paciente in texto_proximo:
            substituir_par_assinatura(paragrafos[indice], paragrafos[indice + 1], assinatura)
            return


def ajustar_bloco_final_assinatura(doc, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    for indice in range(len(paragrafos) - 1, 1, -1):
        if "SOUL SUL CLINICA INTEGRADA" not in normalizar_texto_maiusculo(paragrafos[indice].text):
            continue
        indice_linha = None
        for cursor in range(indice - 1, -1, -1):
            texto = paragrafos[cursor].text.strip()
            if "____" in texto or "___" in texto:
                indice_linha = cursor
                break
        if indice_linha is None:
            return
        candidatos = []
        for cursor in range(indice_linha + 1, indice):
            texto = paragrafos[cursor].text.strip()
            if texto:
                candidatos.append(cursor)
        if len(candidatos) < 2:
            return
        indice_nome = candidatos[0]
        indice_cpf = candidatos[1]
        paragrafos[indice_nome].text = str(assinatura["nome_assinatura"])
        paragrafos[indice_cpf].text = str(assinatura["cpf_assinatura"])
        paragrafos[indice_nome].alignment = 1
        paragrafos[indice_cpf].alignment = 1
        for cursor in candidatos[2:]:
            paragrafos[cursor].text = ""
        return


def ajustar_assinatura_termo_cirurgico_final(doc, nome_paciente: str, cpf_paciente: str, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    ultimo_indice_data = None
    ultimo_indice_clinica = None
    for indice, paragrafo in enumerate(paragrafos):
        texto = paragrafo.text.strip()
        if "Campos dos Goytacazes" in texto:
            ultimo_indice_data = indice
        if "SOUL SUL CLINICA INTEGRADA" in normalizar_texto_maiusculo(texto):
            ultimo_indice_clinica = indice
    if ultimo_indice_data is None or ultimo_indice_clinica is None or ultimo_indice_data >= ultimo_indice_clinica:
        return
    candidatos = []
    for indice in range(ultimo_indice_data + 1, ultimo_indice_clinica):
        texto = paragrafos[indice].text.strip()
        if texto:
            candidatos.append(indice)
    if len(candidatos) < 2:
        return
    for posicao in range(len(candidatos) - 1):
        indice_nome = candidatos[posicao]
        indice_cpf = candidatos[posicao + 1]
        texto_nome = paragrafos[indice_nome].text.strip()
        texto_cpf = paragrafos[indice_cpf].text.strip()
        if texto_nome == nome_paciente and cpf_paciente and cpf_paciente in texto_cpf:
            substituir_par_assinatura(paragrafos[indice_nome], paragrafos[indice_cpf], assinatura)
            return


def ajustar_assinatura_contrato(doc, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    for indice in range(len(paragrafos) - 1, 1, -1):
        if "SOUL SUL CLINICA INTEGRADA" not in normalizar_texto_maiusculo(paragrafos[indice].text):
            continue
        candidatos = []
        cursor = indice - 1
        while cursor >= 0 and len(candidatos) < 2:
            texto = paragrafos[cursor].text.strip()
            if texto:
                candidatos.append(cursor)
            cursor -= 1
        if len(candidatos) < 2:
            return
        indice_cpf = candidatos[0]
        indice_nome = candidatos[1]
        paragrafos[indice_nome].text = str(assinatura["nome_assinatura"])
        paragrafos[indice_cpf].text = str(assinatura["cpf_assinatura"])
        return


def reescrever_bloco_final_termo(doc, assinatura: dict[str, str | bool]) -> None:
    paragrafos = doc.paragraphs
    for indice in range(len(paragrafos) - 1, -1, -1):
        texto = paragrafo_texto = paragrafos[indice].text
        if "SOUL SUL" not in normalizar_texto_maiusculo(texto) or "TESTEMUNHAS" not in normalizar_texto_maiusculo(texto):
            continue
        candidatos_limpar = []
        for cursor in range(indice - 1, -1, -1):
            texto_cursor = paragrafos[cursor].text.strip()
            if not texto_cursor:
                continue
            candidatos_limpar.append(cursor)
            if len(candidatos_limpar) == 2:
                break
        for cursor in candidatos_limpar:
            paragrafos[cursor].text = ""
        paragrafos[indice].text = (
            "Campos dos Goytacazes, {DATA_ATUAL}.\n\n"
            f"{LINHA_PREENCHIMENTO_CONTRATO}\n"
            f"{assinatura['nome_assinatura']}\n"
            f"{assinatura['cpf_assinatura']}\n\n"
            f"{LINHA_PREENCHIMENTO_CONTRATO}\n"
            "SOUL SUL CLINICA INTEGRADA\n\n"
            "TESTEMUNHAS:\n\n\n"
            f"{LINHA_PREENCHIMENTO_CONTRATO}    {LINHA_PREENCHIMENTO_CONTRATO}\n"
            "NOME:                                                          NOME:\n"
            "CPF:                                                             CPF:"
        )
        paragrafos[indice].alignment = 1
        return


def normalizar_quebra_antes_titulo(doc, marcador: str) -> None:
    if WD_BREAK is None:
        return
    paragrafos = doc.paragraphs
    indice_titulo = None
    marcador_norm = normalizar_texto_maiusculo(marcador)

    for indice, paragrafo in enumerate(paragrafos):
        if marcador_norm in normalizar_texto_maiusculo(paragrafo.text):
            indice_titulo = indice
            break
    if indice_titulo is None or indice_titulo == 0:
        return

    paragrafo_anterior = paragrafos[indice_titulo - 1]
    p_pr = paragrafo_anterior._p.pPr
    if p_pr is not None and p_pr.find(qn("w:sectPr")) is not None:
        return
    tem_quebra = any(
        child.tag.endswith("br") and child.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}type") == "page"
        for run in paragrafo_anterior.runs
        for child in run._element
    )
    if not tem_quebra:
        paragrafo_anterior.add_run().add_break(WD_BREAK.PAGE)


def remover_quebras_de_pagina_paragrafo(paragrafo) -> None:
    for run in paragrafo.runs:
        for child in list(run._element):
            if child.tag.endswith("br") and child.get("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}type") == "page":
                run._element.remove(child)


def limpar_formatacao_quebra_paragrafo(paragrafo) -> None:
    if qn is None:
        return
    p_pr = getattr(paragrafo._p, "pPr", None)
    if p_pr is None:
        return
    for tag in ("w:pageBreakBefore", "w:keepNext", "w:keepLines"):
        elemento = p_pr.find(qn(tag))
        if elemento is not None:
            p_pr.remove(elemento)


def remover_quebra_proxima_marcador(doc, marcador: str) -> None:
    marcador_norm = normalizar_texto_maiusculo(marcador)
    paragrafos = doc.paragraphs
    for indice, paragrafo in enumerate(paragrafos):
        if marcador_norm not in normalizar_texto_maiusculo(paragrafo.text):
            continue
        remover_quebras_de_pagina_paragrafo(paragrafo)
        limpar_formatacao_quebra_paragrafo(paragrafo)
        if indice > 0:
            remover_quebras_de_pagina_paragrafo(paragrafos[indice - 1])
            limpar_formatacao_quebra_paragrafo(paragrafos[indice - 1])
        if indice + 1 < len(paragrafos):
            remover_quebras_de_pagina_paragrafo(paragrafos[indice + 1])
            limpar_formatacao_quebra_paragrafo(paragrafos[indice + 1])
        return


def iterar_paragrafos_doc(container):
    for paragrafo in getattr(container, "paragraphs", []):
        yield paragrafo
    for tabela in getattr(container, "tables", []):
        for linha in tabela.rows:
            for celula in linha.cells:
                yield from iterar_paragrafos_doc(celula)


def texto_eh_data_extenso_avulsa(texto: str) -> bool:
    texto_limpo = " ".join((texto or "").strip().split())
    if not texto_limpo:
        return False
    return bool(
        re.fullmatch(
            r"\d{1,2}\s+de\s+(janeiro|fevereiro|marco|março|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+\d{4}\.?",
            normalizar_texto(texto_limpo),
        )
    )


def inserir_secao_antes_titulo(doc, marcador: str, reiniciar_em: int = 1) -> None:
    if OxmlElement is None or qn is None:
        return
    marcador_norm = normalizar_texto_maiusculo(marcador)
    paragrafos = doc.paragraphs
    indice_titulo = None
    for indice, paragrafo in enumerate(paragrafos):
        if marcador_norm in normalizar_texto_maiusculo(paragrafo.text):
            indice_titulo = indice
            break
    if indice_titulo is None or indice_titulo == 0:
        return

    paragrafo_anterior = paragrafos[indice_titulo - 1]
    remover_quebras_de_pagina_paragrafo(paragrafo_anterior)
    remover_quebras_de_pagina_paragrafo(paragrafos[indice_titulo])

    p_pr = paragrafo_anterior._p.get_or_add_pPr()
    sect_existente = p_pr.find(qn("w:sectPr"))
    sect_pr_body = doc._element.body.sectPr
    if sect_pr_body is None:
        return
    if sect_existente is not None:
        sect_pr = sect_existente
    else:
        sect_pr = deepcopy(sect_pr_body)
        p_pr.append(sect_pr)

    type_el = sect_pr.find(qn("w:type"))
    if type_el is None:
        type_el = OxmlElement("w:type")
        sect_pr.insert(0, type_el)
    type_el.set(qn("w:val"), "nextPage")

    pg_num_type = sect_pr_body.find(qn("w:pgNumType"))
    if pg_num_type is None:
        pg_num_type = OxmlElement("w:pgNumType")
        sect_pr_body.append(pg_num_type)
    pg_num_type.set(qn("w:start"), str(reiniciar_em))


def substituir_total_paginas_por_secao(container) -> None:
    if qn is None:
        return
    for paragrafo in iterar_paragrafos_doc(container):
        for run in paragrafo.runs:
            for child in run._element.iter():
                if child.tag == qn("w:instrText") and child.text and "NUMPAGES" in child.text.upper():
                    child.text = re.sub(r"NUMPAGES", "SECTIONPAGES", child.text, flags=re.IGNORECASE)


def limpar_reinicio_numeracao_secoes_adicionais(doc) -> None:
    if qn is None:
        return
    for secao in list(getattr(doc, "sections", []))[1:]:
        sect_pr = getattr(secao, "_sectPr", None)
        if sect_pr is None:
            continue
        pg_num_type = sect_pr.find(qn("w:pgNumType"))
        if pg_num_type is not None:
            sect_pr.remove(pg_num_type)


def configurar_numeracao_paginas_contrato(doc) -> None:
    inserir_secao_antes_titulo(doc, "CONTRATO DE PRESTAÇÃO DE SERVIÇOS ODONTOLÓGICOS", 1)
    inserir_secao_antes_titulo(doc, "DECLARAÇÃO DE CONSENTIMENTO", 1)
    remover_quebra_proxima_marcador(doc, "PRONTUÁRIO")
    remover_quebra_proxima_marcador(doc, "PRONTUÁRIO Nº")
    substituir_total_paginas_por_secao(doc)
    for secao in getattr(doc, "sections", []):
        substituir_total_paginas_por_secao(secao.header)
        substituir_total_paginas_por_secao(secao.footer)


def atualizar_datas_cidade_contrato(doc, data_referencia: date | None = None) -> None:
    texto_data = f"Campos dos Goytacazes, {formatar_data_extenso_local(data_referencia)}."
    texto_data_avulsa = formatar_data_extenso_local(data_referencia)
    for paragrafo in iterar_paragrafos_doc(doc):
        texto_atual = paragrafo.text or ""
        texto_norm = " ".join(texto_atual.split())
        if "{DATA_ATUAL}" in texto_atual:
            alinhamento = paragrafo.alignment
            paragrafo.text = texto_atual.replace("{DATA_ATUAL}", formatar_data_extenso_local(data_referencia))
            paragrafo.alignment = alinhamento
        elif texto_norm == texto_data:
            alinhamento = paragrafo.alignment
            paragrafo.text = texto_data
            paragrafo.alignment = alinhamento
        elif texto_eh_data_extenso_avulsa(texto_atual):
            alinhamento = paragrafo.alignment
            paragrafo.text = texto_data_avulsa
            paragrafo.alignment = alinhamento


def remover_datas_duplicadas_consecutivas(doc, data_referencia: date | None = None) -> None:
    texto_data = f"Campos dos Goytacazes, {formatar_data_extenso_local(data_referencia)}."
    ultimo_data_idx = None
    paragrafos = list(iterar_paragrafos_doc(doc))
    for indice, paragrafo in enumerate(paragrafos):
        texto = " ".join((paragrafo.text or "").strip().split())
        if texto != texto_data:
            continue
        if ultimo_data_idx is None:
            ultimo_data_idx = indice
            continue
        if indice - ultimo_data_idx <= 2:
            paragrafo.text = ""
        else:
            ultimo_data_idx = indice


def compactar_linhas_declaracao(doc) -> None:
    if Pt is None:
        return
    for paragrafo in doc.paragraphs:
        texto = paragrafo.text.strip()
        if not texto:
            continue
        if set(texto) == {"_"}:
            paragrafo.text = LINHA_PREENCHIMENTO_CONTRATO
            texto = paragrafo.text
        if "DECLARO" in normalizar_texto_maiusculo(texto):
            formato = paragrafo.paragraph_format
            formato.space_before = Pt(0)
            formato.space_after = Pt(2)
            formato.line_spacing = 1.0


def normalizar_bloco_consentimento(doc, data_referencia: date | None = None) -> None:
    if Pt is None:
        return
    texto_data = f"Campos dos Goytacazes, {formatar_data_extenso_local(data_referencia)}."
    indice_titulo = None
    indice_corpo = None
    for indice, paragrafo in enumerate(doc.paragraphs):
        texto = " ".join((paragrafo.text or "").split())
        texto_norm = normalizar_texto_maiusculo(texto)
        if indice_titulo is None and "DECLARACAO DE CONSENTIMENTO" in texto_norm:
            indice_titulo = indice
        if indice_titulo is not None and indice_corpo is None and "DECLARAM PARA OS DEVIDOS FINS" in texto_norm:
            indice_corpo = indice
            break
    for paragrafo in doc.paragraphs:
        texto = " ".join((paragrafo.text or "").split())
        texto_norm = normalizar_texto_maiusculo(texto)
        if not texto:
            continue
        if "3.1. O PACIENTE DECLARA TER FEITO USO DAS MEDICACOES" in texto_norm:
            paragrafo.text = re.sub(r"\s*_{10,}\s*", f"\n{LINHA_PREENCHIMENTO_CONTRATO}", texto)
        elif "DECLARO TER TIDO AS SEGUINTES PATOLOGIAS:" in texto_norm and "DECLARO JA TER REALIZADO AS SEGUINTES CIRURGIAS ANTERIORMENTE:" in texto_norm:
            trecho_32 = ""
            if "3.2." in texto:
                partes = texto.split("3.2.", 1)
                trecho_32 = "3.2. " + partes[1].strip()
            paragrafo.text = (
                "DECLARO ter tido as seguintes patologias:\n"
                f"{LINHA_PREENCHIMENTO_CONTRATO}\n"
                "DECLARO já ter realizado as seguintes cirurgias anteriormente:\n"
                f"{LINHA_PREENCHIMENTO_CONTRATO}\n"
                f"{trecho_32}".strip()
            )
        elif "6.1. DECLARAM TER SIDO INFORMADOS" in texto_norm and "7. DO CONSENTIMENTO ESCLARECIDO" in texto_norm:
            partes = texto.split("7. Do Consentimento Esclarecido", 1)
            prefixo = partes[0].strip()
            restante = partes[1].strip() if len(partes) > 1 else ""
            paragrafo.text = f"{prefixo}\n7. Do Consentimento Esclarecido\n{restante}".strip()
        elif "{DATA_ATUAL}" in texto:
            paragrafo.text = texto.replace("{DATA_ATUAL}", formatar_data_extenso_local(data_referencia))
        formato = paragrafo.paragraph_format
        formato.space_before = Pt(0)
        formato.space_after = Pt(2)
        formato.line_spacing = 1.0
    if indice_titulo is not None and indice_corpo is not None:
        for indice in range(indice_titulo + 1, indice_corpo):
            texto = " ".join((doc.paragraphs[indice].text or "").split())
            if texto == texto_data:
                doc.paragraphs[indice].text = ""
    for tabela in doc.tables:
        texto_tabela = normalizar_texto_maiusculo(
            " ".join(
                " ".join((paragrafo.text or "").split())
                for linha in tabela.rows
                for celula in linha.cells
                for paragrafo in celula.paragraphs
            )
        )
        if "RAZAO SOCIAL" not in texto_tabela and "PACIENTE:" not in texto_tabela:
            continue
        for linha in tabela.rows:
            for celula in linha.cells:
                for paragrafo in celula.paragraphs:
                    if " ".join((paragrafo.text or "").split()) == texto_data:
                        paragrafo.text = ""


def compactar_bloco_final(doc) -> None:
    if Pt is None:
        return
    paragrafos = doc.paragraphs
    indice_data = None
    indice_testemunhas = None

    for indice in range(len(paragrafos) - 1, -1, -1):
        texto = paragrafos[indice].text.strip()
        if indice_testemunhas is None and "TESTEMUNHAS" in normalizar_texto_maiusculo(texto):
            indice_testemunhas = indice
        if indice_data is None and "CAMPOS DOS GOYTACAZES" in normalizar_texto_maiusculo(texto):
            indice_data = indice
        if indice_data is not None and indice_testemunhas is not None:
            break

    if indice_data is None or indice_testemunhas is None or indice_data >= indice_testemunhas:
        return

    for indice in range(indice_data, len(paragrafos)):
        texto = paragrafos[indice].text.strip()
        if not texto:
            continue
        formato = paragrafos[indice].paragraph_format
        formato.space_before = Pt(0)
        formato.space_after = Pt(0)
        formato.line_spacing = 1.0
        for run in paragrafos[indice].runs:
            run.font.size = Pt(10)
        if "TESTEMUNHAS" in normalizar_texto_maiusculo(texto):
            break


def garantir_bloco_final_assinaturas(doc, assinatura: dict[str, str | bool], data_referencia: date | None = None) -> None:
    paragrafos = doc.paragraphs
    if not paragrafos:
        return
    janela = paragrafos[-20:]
    tem_assinatura = any("SOUL SUL CLINICA INTEGRADA" in normalizar_texto_maiusculo(p.text) for p in janela)
    tem_testemunhas = any("TESTEMUNHAS" in normalizar_texto_maiusculo(p.text) for p in janela)
    if tem_assinatura and tem_testemunhas:
        return

    texto_data = f"Campos dos Goytacazes, {formatar_data_extenso_local(data_referencia)}."
    par_data = doc.add_paragraph()
    par_data.alignment = 1
    par_data.add_run(texto_data)

    for texto, alinhamento in [
        ("", 1),
        (LINHA_PREENCHIMENTO_CONTRATO, 1),
        (str(assinatura["nome_assinatura"]), 1),
        (str(assinatura["cpf_assinatura"]), 1),
        ("", 1),
        (LINHA_PREENCHIMENTO_CONTRATO, 1),
        ("SOUL SUL CLINICA INTEGRADA", 1),
        ("", 1),
        ("TESTEMUNHAS:", 0),
        ("", 0),
        (f"{LINHA_PREENCHIMENTO_CONTRATO}    {LINHA_PREENCHIMENTO_CONTRATO}", 0),
        ("NOME:                                                          NOME:", 0),
        ("CPF:                                                             CPF:", 0),
    ]:
        par = doc.add_paragraph()
        par.alignment = alinhamento
        if texto:
            par.add_run(texto)


def executar_ajuste_contrato(nome: str, func) -> None:
    try:
        func()
    except Exception as exc:
        print(f"[contrato] ajuste ignorado {nome}: {exc}", flush=True)
        print(traceback.format_exc(), flush=True)


def quantidade_parcelas_contrato_pagamento(itens: list[dict], forma_padrao: str) -> int:
    if not itens:
        return 0
    primeira = itens[0]
    forma = str(primeira.get("forma", forma_padrao)).replace("_", " ").upper()
    if "CARTAO" in normalizar_texto(forma).upper():
        try:
            return max(1, int(primeira.get("parcelas_cartao", 1) or 1))
        except (TypeError, ValueError):
            return 1
    return len(itens)


def valor_unitario_parcela_contrato(item: dict, quantidade_parcelas: int, forma_padrao: str) -> float:
    valor_total_item = float(item.get("valor", 0) or 0)
    forma = str(item.get("forma", forma_padrao)).replace("_", " ").upper()
    if quantidade_parcelas > 1 and "CARTAO" in normalizar_texto(forma).upper():
        return round(valor_total_item / quantidade_parcelas, 2)
    return valor_total_item


def montar_texto_pagamento_contrato(contrato: sqlite3.Row, plano: list[dict]) -> str:
    valor_total = float(contrato["valor_total"] or 0)
    itens_ativos = [item for item in plano if float(item.get("valor", 0) or 0) > 0]
    if not itens_ativos:
        return f"VALOR TOTAL {formatar_moeda_br(valor_total)}."

    def forma_legivel(item: dict) -> str:
        forma = str(item.get("forma", "A DEFINIR") or "A DEFINIR").replace("_", " ").upper()
        return forma.replace("CARTAO CREDITO", "CARTÃO DE CRÉDITO").replace("CARTAO DEBITO", "CARTÃO DE DÉBITO")

    def faz_parte_do_mesmo_grupo(anterior: dict, atual: dict) -> bool:
        if normalizar_texto(anterior.get("descricao", "")) == "entrada":
            return False
        if normalizar_texto(atual.get("descricao", "")) == "entrada":
            return False
        if forma_legivel(anterior) != forma_legivel(atual):
            return False
        if abs(float(anterior.get("valor", 0) or 0) - float(atual.get("valor", 0) or 0)) > 0.009:
            return False
        if int(anterior.get("parcelas_cartao", 1) or 1) != int(atual.get("parcelas_cartao", 1) or 1):
            return False
        data_anterior = parse_data_contrato(anterior.get("data"))
        data_atual = parse_data_contrato(atual.get("data"))
        if data_anterior is None or data_atual is None:
            return False
        proximo_mes = adicionar_meses(data_anterior, 1)
        return data_atual == proximo_mes

    grupos: list[list[dict]] = []
    for item in itens_ativos:
        if grupos and faz_parte_do_mesmo_grupo(grupos[-1][-1], item):
            grupos[-1].append(item)
        else:
            grupos.append([item])

    descricoes: list[str] = []
    for indice, grupo in enumerate(grupos, start=1):
        item = grupo[0]
        descricao_bruta = str(item.get("descricao", "") or "").strip()
        entrada = normalizar_texto(descricao_bruta) == "entrada"
        rotulo = "ENTRADA" if entrada else "SALDO"
        forma = forma_legivel(item)
        valor = float(item.get("valor", 0) or 0)
        data_pagamento = formatar_data_br_valor(item.get("data"))
        parcelas_cartao = max(1, int(item.get("parcelas_cartao", 1) or 1))
        if len(grupo) > 1:
            descricoes.append(
                f"{rotulo}: {len(grupo)} PARCELAS DE {formatar_moeda_br(valor)} VIA {forma}, "
                f"COM PRIMEIRO VENCIMENTO EM {data_pagamento}"
            )
        elif "CRÉDITO" in forma and parcelas_cartao > 1:
            descricoes.append(
                f"{rotulo}: {formatar_moeda_br(valor)} VIA {forma}, EM {parcelas_cartao}X DE "
                f"{formatar_moeda_br(valor / parcelas_cartao)}, NA DATA {data_pagamento}"
            )
        else:
            descricoes.append(f"{rotulo}: {formatar_moeda_br(valor)} VIA {forma}, NA DATA {data_pagamento}")
    return f"VALOR TOTAL {formatar_moeda_br(valor_total)}. FORMA DE PAGAMENTO: {'; '.join(descricoes)}."


def carregar_plano_pagamento_contrato(contrato: sqlite3.Row) -> list[dict]:
    try:
        bruto = json.loads(str(contrato["plano_pagamento_json"] or "[]"))
    except (TypeError, ValueError, json.JSONDecodeError):
        bruto = []
    plano = [item for item in bruto if isinstance(item, dict)]
    if plano:
        return plano

    valor_total = float(contrato["valor_total"] or 0)
    if valor_total <= 0:
        return []

    entrada = float(contrato["entrada"] or 0)
    parcelas = max(int(contrato["parcelas"] or 1), 1)
    forma = str(contrato["forma_pagamento"] or "A Definir").strip() or "A Definir"
    data_base = parse_data_contrato(contrato["primeiro_vencimento"]) or parse_data_contrato(contrato["data_criacao"]) or date.today()
    plano_legacy: list[dict] = []

    if entrada > 0:
        data_entrada = parse_data_contrato(contrato["data_pagamento_entrada"]) or data_base
        plano_legacy.append(
            {
                "indice": 0,
                "descricao": "Entrada",
                "data": data_entrada.isoformat(),
                "forma": forma,
                "valor": round(entrada, 2),
                "parcelas_cartao": 1,
            }
        )

    restante = max(valor_total - entrada, 0)
    if restante <= 0:
        return plano_legacy

    quantidade_parcelas = max(parcelas, 1)
    valor_base = round(restante / quantidade_parcelas, 2)
    acumulado = 0.0
    for indice in range(quantidade_parcelas):
        valor_parcela = valor_base
        if indice == quantidade_parcelas - 1:
            valor_parcela = round(restante - acumulado, 2)
        acumulado += valor_parcela
        plano_legacy.append(
            {
                "indice": indice + 1,
                "descricao": str(indice + 1),
                "data": adicionar_meses(data_base, indice).isoformat(),
                "forma": forma,
                "valor": valor_parcela,
                "parcelas_cartao": quantidade_parcelas if "CARTAO" in normalizar_texto(forma).upper() else 1,
            }
        )

    return plano_legacy


def gerar_html_contrato_fallback(
    paciente_row: sqlite3.Row,
    contrato_id: int,
    procedimentos: list[dict],
    plano: list[dict],
) -> str:
    caminho_html = os.path.join(DOCS_DIR, f"{nome_base_contrato(paciente_row, contrato_id)}.html")
    linhas_procedimentos = "".join(
        f"<tr><td>{row['procedimento']}</td><td>{row['profissional_snapshot'] or ''}</td><td>{row['denticao_snapshot'] or ''}</td><td style='text-align:right'>{formatar_moeda_br(row['valor'])}</td></tr>"
        for row in procedimentos
    )
    linhas_pagamento = "".join(
        f"<tr><td>{item.get('descricao', '')}</td><td>{formatar_data_br_valor(item.get('data'))}</td><td>{str(item.get('forma', '')).replace('_', ' ')}</td><td style='text-align:right'>{formatar_moeda_br(item.get('valor', 0))}</td></tr>"
        for item in plano
        if float(item.get('valor', 0) or 0) > 0
    )
    html = f"""<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Contrato {contrato_id}</title></head>
<body><h1>Contrato #{contrato_id}</h1><p>{formatar_titulo(paciente_row['nome'] or '')}</p>
<table>{linhas_procedimentos}</table><table>{linhas_pagamento}</table></body></html>"""
    with open(caminho_html, "w", encoding="utf-8") as arquivo:
        arquivo.write(html)
    return caminho_html


def gerar_docx_contrato_fallback(
    paciente_row: sqlite3.Row,
    contrato_id: int,
    procedimentos: list[dict],
    plano: list[dict],
) -> str:
    if Document is None:
        return gerar_html_contrato_fallback(paciente_row, contrato_id, procedimentos, plano)

    nome_arquivo = nome_arquivo_contrato(paciente_row, contrato_id)
    caminho = os.path.join(DOCS_DIR, nome_arquivo)
    doc = Document()
    doc.add_heading(f"Contrato #{contrato_id}", level=1)
    doc.add_paragraph(f"Paciente: {formatar_titulo(valor_row(paciente_row, 'nome'))}")
    doc.add_paragraph(f"Prontuário: {formatar_prontuario_valor(paciente_row['prontuario'])}")
    doc.add_paragraph("")

    doc.add_paragraph("Procedimentos")
    tabela_proc = doc.add_table(rows=1, cols=4)
    header_proc = tabela_proc.rows[0].cells
    header_proc[0].text = "Procedimento"
    header_proc[1].text = "Profissional"
    header_proc[2].text = "Dentição"
    header_proc[3].text = "Valor"
    for row in procedimentos:
        cells = tabela_proc.add_row().cells
        cells[0].text = str(row.get("procedimento", "") or "")
        cells[1].text = str(row.get("profissional_snapshot", "") or "")
        cells[2].text = str(row.get("denticao_snapshot", "") or "")
        cells[3].text = formatar_moeda_br(row.get("valor", 0))

    doc.add_paragraph("")
    inserir_odontograma_contrato_docx(doc, procedimentos)
    doc.add_paragraph("")
    doc.add_paragraph("Plano de pagamento")
    tabela_pag = doc.add_table(rows=1, cols=4)
    header_pag = tabela_pag.rows[0].cells
    header_pag[0].text = "Descrição"
    header_pag[1].text = "Data"
    header_pag[2].text = "Forma"
    header_pag[3].text = "Valor"
    for item in plano:
        if float(item.get("valor", 0) or 0) <= 0:
            continue
        cells = tabela_pag.add_row().cells
        cells[0].text = str(item.get("descricao", "") or "")
        cells[1].text = formatar_data_br_valor(item.get("data"))
        cells[2].text = str(item.get("forma", "") or "").replace("_", " ")
        cells[3].text = formatar_moeda_br(item.get("valor", 0))

    aplicar_fonte_times_new_roman(doc)
    doc.save(caminho)
    return caminho


def gerar_documento_contrato(
    conn: sqlite3.Connection,
    paciente_row: sqlite3.Row,
    contrato: sqlite3.Row,
    contrato_id: int,
    *,
    procedimentos_override: list[dict] | None = None,
    caminho_override: str = "",
) -> str:
    pasta_documentos = os.path.dirname(caminho_override) if caminho_override else DOCS_DIR
    os.makedirs(pasta_documentos, exist_ok=True)
    procedimentos = procedimentos_override if procedimentos_override is not None else carregar_procedimentos_documento_contrato(conn, contrato_id)
    plano = carregar_plano_pagamento_contrato(contrato)
    nome_arquivo = nome_arquivo_contrato(paciente_row, contrato_id)
    caminho = caminho_override or os.path.join(DOCS_DIR, nome_arquivo)

    if Document is None or (not os.path.isfile(TEMPLATE_PATH) and not os.path.isfile(TEMPLATE_B64_PATH)):
        return gerar_docx_contrato_fallback(paciente_row, contrato_id, procedimentos, plano)

    doc = None
    try:
        doc = carregar_template_contrato_docx()
        data_documento = parse_data_contrato(contrato["data_criacao"]) or parse_data_contrato(contrato["data_aprovacao"]) or agora_local().date()
        executar_ajuste_contrato("garantir_logo_no_cabecalho", lambda: garantir_logo_no_cabecalho(doc))
        termo_cirurgia = montar_termo_cirurgia_contrato(procedimentos)
        if not termo_cirurgia:
            executar_ajuste_contrato("remover_secao_termo_cirurgico", lambda: remover_secao_termo_cirurgico(doc))
        nome_paciente = formatar_titulo(valor_row(paciente_row, "nome"))
        cpf_paciente = valor_row(paciente_row, "cpf")
        assinatura = dados_assinatura_contrato(paciente_row)
        qualificacao = montar_qualificacao_contrato(paciente_row)
        pagamento = montar_texto_pagamento_contrato(contrato, plano)

        dados = {
            "{PACIENTE}": nome_paciente,
            "{paciente}": nome_paciente,
            "{CPF}": cpf_paciente,
            "{cpf}": cpf_paciente,
            "{PRONTUARIO}": formatar_prontuario_valor(paciente_row["prontuario"]),
            "{prontuario}": formatar_prontuario_valor(paciente_row["prontuario"]),
            "{PAGAMENTO}": pagamento,
            "{pagamento}": pagamento,
            "{QUALIFICACAO}": qualificacao,
            "{qualificacao}": qualificacao,
            "{ENDERECO}": formatar_titulo(valor_row(paciente_row, "endereco")),
            "{endereco}": formatar_titulo(valor_row(paciente_row, "endereco")),
            "{NUMERO}": valor_row(paciente_row, "numero"),
            "{numero}": valor_row(paciente_row, "numero"),
            "{BAIRRO}": formatar_titulo(valor_row(paciente_row, "bairro")),
            "{bairro}": formatar_titulo(valor_row(paciente_row, "bairro")),
            "{CIDADE}": formatar_titulo(valor_row(paciente_row, "cidade")),
            "{cidade}": formatar_titulo(valor_row(paciente_row, "cidade")),
            "{ESTADO}": valor_row(paciente_row, "estado"),
            "{estado}": valor_row(paciente_row, "estado"),
            "{CEP}": valor_row(paciente_row, "cep"),
            "{cep}": valor_row(paciente_row, "cep"),
            "{TELEFONE}": valor_row(paciente_row, "telefone"),
            "{telefone}": valor_row(paciente_row, "telefone"),
            "{DATA_NASCIMENTO}": formatar_data_br_valor(valor_row(paciente_row, "data_nascimento")),
            "{data_nascimento}": formatar_data_br_valor(valor_row(paciente_row, "data_nascimento")),
            "{TERMO_CIRURGIA}": termo_cirurgia,
            "{termo_cirurgia}": termo_cirurgia,
        }
        executar_ajuste_contrato("substituir_runs_doc", lambda: substituir_runs_doc(doc, dados))

        checklist_preenchido = False
        tabela_contrato_preenchida = False
        tabela_contrato_referencia = None
        for tabela in doc.tables:
            preenchido_checklist = False
            if not checklist_preenchido:
                try:
                    preenchido_checklist = preencher_tabela_checklist_contrato(tabela, procedimentos)
                except Exception as exc:
                    print(f"[contrato] ajuste ignorado preencher_tabela_checklist_contrato: {exc}", flush=True)
                    print(traceback.format_exc(), flush=True)
            if not checklist_preenchido and preenchido_checklist:
                checklist_preenchido = True
                continue
            preenchido_tabela = False
            if not tabela_contrato_preenchida:
                try:
                    preenchido_tabela = preencher_tabela_contrato_docx(tabela, procedimentos)
                except Exception as exc:
                    print(f"[contrato] ajuste ignorado preencher_tabela_contrato_docx: {exc}", flush=True)
                    print(traceback.format_exc(), flush=True)
            if not tabela_contrato_preenchida and preenchido_tabela:
                tabela_contrato_preenchida = True
                tabela_contrato_referencia = tabela

        if bool(assinatura["assinatura_menor"]):
            executar_ajuste_contrato("ajustar_assinaturas_menor", lambda: ajustar_assinaturas_menor(doc, nome_paciente, cpf_paciente, assinatura))
            executar_ajuste_contrato("ajustar_assinaturas_por_texto", lambda: ajustar_assinaturas_por_texto(doc, nome_paciente, cpf_paciente, assinatura))
            executar_ajuste_contrato("ajustar_assinatura_termo_cirurgico_final", lambda: ajustar_assinatura_termo_cirurgico_final(doc, nome_paciente, cpf_paciente, assinatura))
            executar_ajuste_contrato("ajustar_ultima_assinatura_menor", lambda: ajustar_ultima_assinatura_menor(doc, nome_paciente, cpf_paciente, assinatura))
            executar_ajuste_contrato("ajustar_bloco_final_assinatura", lambda: ajustar_bloco_final_assinatura(doc, assinatura))
        else:
            executar_ajuste_contrato("ajustar_assinatura_capa", lambda: ajustar_assinatura_capa(doc, nome_paciente, cpf_paciente, assinatura))
            executar_ajuste_contrato("ajustar_assinatura_contrato", lambda: ajustar_assinatura_contrato(doc, assinatura))
        executar_ajuste_contrato("reescrever_bloco_final_termo", lambda: reescrever_bloco_final_termo(doc, assinatura))
        executar_ajuste_contrato("atualizar_datas_cidade_contrato", lambda: atualizar_datas_cidade_contrato(doc, data_documento))
        executar_ajuste_contrato("remover_datas_duplicadas_consecutivas", lambda: remover_datas_duplicadas_consecutivas(doc, data_documento))
        executar_ajuste_contrato("normalizar_quebra_antes_titulo_termo", lambda: normalizar_quebra_antes_titulo(doc, "TERMO DE CONSENTIMENTO ESCLARECIDO"))
        executar_ajuste_contrato("inserir_odontograma_contrato_docx", lambda: inserir_odontograma_contrato_docx(doc, procedimentos, tabela_contrato_referencia))
        executar_ajuste_contrato("compactar_linhas_declaracao", lambda: compactar_linhas_declaracao(doc))
        executar_ajuste_contrato("normalizar_bloco_consentimento", lambda: normalizar_bloco_consentimento(doc, data_documento))
        executar_ajuste_contrato("compactar_bloco_final", lambda: compactar_bloco_final(doc))
        executar_ajuste_contrato("garantir_bloco_final_assinaturas", lambda: garantir_bloco_final_assinaturas(doc, assinatura, data_documento))
        executar_ajuste_contrato("configurar_numeracao_paginas_contrato", lambda: configurar_numeracao_paginas_contrato(doc))
        executar_ajuste_contrato("aplicar_fonte_times_new_roman", lambda: aplicar_fonte_times_new_roman(doc))
        doc.save(caminho)
        return caminho
    except Exception as exc:
        print(f"[contrato] fallback docx acionado contrato={contrato_id} erro={exc}", flush=True)
        print(traceback.format_exc(), flush=True)
        if doc is not None:
            try:
                doc.save(caminho)
                return caminho
            except Exception as save_exc:
                print(f"[contrato] falha ao salvar template parcial contrato={contrato_id} erro={save_exc}", flush=True)
                print(traceback.format_exc(), flush=True)
        return gerar_docx_contrato_fallback(paciente_row, contrato_id, procedimentos, plano)


def gerar_documento_contrato_educacao(
    conn: sqlite3.Connection,
    paciente_row: sqlite3.Row,
    contrato_row: sqlite3.Row,
    contrato_id: int,
) -> str:
    rows = conn.execute(
        "SELECT * FROM procedimentos_contrato_educacao WHERE contrato_id=? AND COALESCE(ativo,1)=1 ORDER BY id",
        (contrato_id,),
    ).fetchall()
    procedimentos: list[dict] = []
    for row in rows:
        try:
            regioes_brutas = json.loads(str(row["regioes_json"] or "[]"))
        except (TypeError, ValueError, json.JSONDecodeError):
            regioes_brutas = []
        regioes = []
        regioes_texto = []
        for regiao in regioes_brutas if isinstance(regioes_brutas, list) else []:
            if isinstance(regiao, dict):
                valor_regiao = regiao.get("dente") or regiao.get("regiao") or ""
            else:
                valor_regiao = regiao
            if str(valor_regiao).strip():
                regioes.append(str(valor_regiao))
                regioes_texto.append(rotulo_regiao_contrato_docx(str(valor_regiao)))
        procedimentos.append({
            "procedimento": str(row["procedimento"] or ""),
            "valor": float(row["valor"] or 0),
            "profissional_snapshot": str(row["profissional_snapshot"] or ""),
            "denticao_snapshot": str(row["denticao_snapshot"] or ""),
            "regioes": regioes,
            "regioes_texto": regioes_texto,
        })
    contrato = educacao_row(contrato_row)
    contrato["data_criacao"] = contrato.get("data_contrato") or contrato.get("criado_em") or agora_str()
    contrato["primeiro_vencimento"] = contrato.get("data_contrato") or agora_local().date().isoformat()
    contrato["data_pagamento_entrada"] = contrato.get("data_contrato") or agora_local().date().isoformat()
    contrato["observacoes"] = contrato.get("descricao") or ""
    pasta = os.path.join(ARQUIVOS_BASE_DIR, "documentos_educacao")
    nome_limpo = re.sub(r"[^A-Za-z0-9]+", "_", str(paciente_row["nome"] or "").strip()).strip("_").upper()
    caminho = os.path.join(pasta, f"CONTRATO_EDUCACAO_{nome_limpo}_{contrato_id}.docx")
    return gerar_documento_contrato(
        conn, paciente_row, contrato, contrato_id,
        procedimentos_override=procedimentos,
        caminho_override=caminho,
    )


def limpar_documento_contrato(paciente_row: sqlite3.Row, contrato_id: int) -> None:
    limpar_documentos_contrato_variantes(paciente_row, contrato_id)


def sincronizar_recebiveis_contrato(conn: sqlite3.Connection, paciente_row: sqlite3.Row, contrato: sqlite3.Row, contrato_id: int) -> None:
    if contrato_eh_permuta(contrato):
        conn.execute("DELETE FROM recebiveis WHERE contrato_id=? AND lower(COALESCE(status, ''))<>'pago'", (contrato_id,))
        conn.execute("DELETE FROM financeiro WHERE contrato_id=?", (contrato_id,))
        return
    plano = carregar_plano_pagamento_contrato(contrato)
    prontuario = formatar_prontuario_valor(paciente_row["prontuario"])
    existentes = conn.execute(
        "SELECT * FROM recebiveis WHERE contrato_id=? ORDER BY parcela_numero, id",
        (contrato_id,),
    ).fetchall()
    existentes_por_numero: dict[int, list[sqlite3.Row]] = {}
    for row in existentes:
        existentes_por_numero.setdefault(int(row["parcela_numero"] or 0), []).append(row)
    ids_utilizados: set[int] = set()
    numero_posterior = 0
    for item in plano:
        forma = str(item.get("forma", "") or "").strip().upper()
        valor_item = float(item.get("valor", 0) or 0)
        if valor_item <= 0:
            continue
        descricao_item = normalizar_texto(item.get("descricao", ""))
        if descricao_item == "entrada":
            parcela_numero = 0
        else:
            numero_posterior += 1
            parcela_numero = numero_posterior
        parcelas_cartao = max(1, int(item.get("parcelas_cartao", 1) or 1))
        detalhe = f"CONTRATO_APROVADO_{contrato_id} | {str(item.get('descricao', '') or '').strip() or parcela_numero}"
        if forma == "CARTAO_CREDITO":
            detalhe += f" | CARTAO {parcelas_cartao}X"
        candidatos = existentes_por_numero.get(parcela_numero, [])
        existente = next((row for row in candidatos if int(row["id"]) not in ids_utilizados), None)
        if existente is not None:
            ids_utilizados.add(int(existente["id"]))
            if normalizar_texto(existente["status"]) == "pago" or data_financeira_retroativa(existente["vencimento"]):
                continue
            conn.execute(
                """
                UPDATE recebiveis
                SET paciente_id=?, paciente_nome=?, prontuario=?, vencimento=?, valor=?,
                    forma_pagamento=?, observacao=?
                WHERE id=?
                """,
                (
                    int(paciente_row["id"]),
                    str(paciente_row["nome"] or ""),
                    prontuario,
                    str(item.get("data", "") or ""),
                    valor_item,
                    forma.replace("_", " "),
                    detalhe,
                    int(existente["id"]),
                ),
            )
        else:
            cursor = conn.execute(
                """
                INSERT INTO recebiveis (
                    contrato_id, paciente_id, paciente_nome, prontuario, parcela_numero, vencimento, valor,
                    forma_pagamento, status, observacao, data_criacao, data_pagamento
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Aberto', ?, ?, NULL)
                """,
                (
                    contrato_id,
                    int(paciente_row["id"]),
                    str(paciente_row["nome"] or ""),
                    prontuario,
                    parcela_numero,
                    str(item.get("data", "") or ""),
                    valor_item,
                    forma.replace("_", " "),
                    detalhe,
                    agora_str(),
                ),
            )
            ids_utilizados.add(int(cursor.lastrowid))
    for row in existentes:
        row_id = int(row["id"])
        if row_id in ids_utilizados or normalizar_texto(row["status"]) == "pago" or data_financeira_retroativa(row["vencimento"]):
            continue
        conn.execute("DELETE FROM recebiveis WHERE id=?", (row_id,))


def sincronizar_financeiro_contrato(conn: sqlite3.Connection, paciente_row: sqlite3.Row, contrato: sqlite3.Row, contrato_id: int) -> None:
    conn.execute("DELETE FROM financeiro WHERE contrato_id=?", (contrato_id,))
    # O financeiro registra apenas caixa real. O contrato aprovado gera
    # recebiveis planejados; a entrada no financeiro acontece somente quando
    # a parcela e baixada no caixa.


def carregar_historico_cobranca_recebiveis(
    conn: sqlite3.Connection,
    recebivel_ids: list[int],
) -> dict[int, list[RecebivelHistoricoItemResposta]]:
    ids_validos = [int(recebivel_id) for recebivel_id in recebivel_ids if int(recebivel_id or 0) > 0]
    if not ids_validos:
        return {}
    placeholders = ",".join("?" for _ in ids_validos)
    rows = conn.execute(
        f"""
        SELECT id, recebivel_id, status, observacao, cobrado, criado_por, criado_em
        FROM recebiveis_historico
        WHERE recebivel_id IN ({placeholders})
        ORDER BY datetime(COALESCE(criado_em, '')) DESC, id DESC
        """,
        ids_validos,
    ).fetchall()
    historico_por_recebivel: dict[int, list[RecebivelHistoricoItemResposta]] = {}
    for row in rows:
        recebivel_id = int(row["recebivel_id"] or 0)
        historico_por_recebivel.setdefault(recebivel_id, []).append(
            RecebivelHistoricoItemResposta(
                id=int(row["id"] or 0),
                status=str(row["status"] or ""),
                observacao=str(row["observacao"] or ""),
                cobrado=bool(row["cobrado"]),
                criadoPor=str(row["criado_por"] or ""),
                criadoEm=str(row["criado_em"] or ""),
            )
        )
    return historico_por_recebivel


def registrar_historico_cobranca_recebivel(
    conn: sqlite3.Connection,
    *,
    recebivel_id: int,
    paciente_id: int,
    status: str,
    observacao: str,
    cobrado: bool,
    criado_por: str,
) -> None:
    conn.execute(
        """
        INSERT INTO recebiveis_historico (
            recebivel_id, paciente_id, status, observacao, cobrado, criado_por, criado_em
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            int(recebivel_id),
            int(paciente_id),
            str(status or "").strip(),
            str(observacao or "").strip(),
            1 if cobrado else 0,
            str(criado_por or "").strip(),
            agora_str(),
        ),
    )


def mapear_recebivel(
    row: sqlite3.Row,
    historico_cobranca: list[RecebivelHistoricoItemResposta] | None = None,
) -> RecebivelResumo:
    return RecebivelResumo(
        id=int(row["id"]),
        pacienteId=int(row["paciente_id"]) if row["paciente_id"] is not None else None,
        pacienteNome=str(row["paciente_nome"] or ""),
        prontuario=formatar_prontuario_valor(row["prontuario"]),
        contratoId=int(row["contrato_id"]) if row["contrato_id"] is not None else None,
        parcela=int(row["parcela_numero"]) if row["parcela_numero"] is not None else None,
        vencimento=formatar_data_br_valor(row["vencimento"]),
        valor=formatar_moeda_br(row["valor"]),
        formaPagamento=str(row["forma_pagamento"] or ""),
        status=str(row["status"] or ""),
        dataPagamento=formatar_data_br_valor(row["data_pagamento"]) if "data_pagamento" in row.keys() else "",
        observacao=str(row["observacao"] or ""),
        historicoCobranca=historico_cobranca or [],
    )


def carregar_recebivel_paciente(conn: sqlite3.Connection, paciente_id: int, recebivel_id: int) -> sqlite3.Row:
    row = conn.execute(
        """
        SELECT *
        FROM recebiveis
        WHERE id=? AND paciente_id=?
        LIMIT 1
        """,
        (recebivel_id, paciente_id),
    ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Recebível não encontrado.")
    return row


def mapear_agendamento(row: sqlite3.Row) -> AgendamentoResumo:
    procedimento = str(row["procedimento_nome_snapshot"] or row["procedimento"] or "")
    horario_inicio = str(row["hora_inicio"] or "")
    horario_fim = str(row["hora_fim"] or "")
    horario = f"{horario_inicio} - {horario_fim}".strip(" -")
    return AgendamentoResumo(
        id=int(row["id"]),
        data=formatar_data_br_valor(row[DATA_COLUNA_AGENDA] if DATA_COLUNA_AGENDA in row.keys() else row["data"]),
        horario=horario,
        profissional=str(row["profissional"] or ""),
        status=str(row["status"] or ""),
        procedimento=procedimento,
        observacao=str(row["observacao"] or row["observacoes"] or ""),
    )


CRM_ETAPAS_PADRAO = [
    "Novo lead",
    "Contato inicial",
    "Tentando contato",
    "Conversando",
    "Agendou avaliação",
    "Em negociação",
    "Convertido",
    "Perdido",
]

CRM_STATUS_RESGATE_PADRAO = {
    "EM TRATAMENTO": "Em tratativa",
    "EM TRATATIVA": "Em tratativa",
    "LIGAR NOVAMENTE": "Ligar novamente",
    "DESISTENTE": "Desistente",
    "CONVERTIDO": "Convertido",
}

CRM_CANAIS_SUPORTADOS = {"whatsapp", "instagram"}


def whatsapp_service() -> WhatsAppService:
    # Lê o ambiente por chamada para facilitar deploy, testes e rotação de credenciais.
    return WhatsAppService()


def crm_int(valor: object, padrao: int = 0) -> int:
    try:
        texto = str(valor if valor is not None else "").strip()
        if not texto:
            return padrao
        return int(float(texto))
    except Exception:
        return padrao


def crm_bool(valor: object) -> bool:
    texto = normalizar_texto(str(valor or ""))
    if texto in {"1", "true", "sim", "yes"}:
        return True
    if texto in {"0", "false", "nao", "não", "no", ""}:
        return False
    return bool(crm_int(valor, 0))


def crm_row_val(row: sqlite3.Row, chave: str, padrao: object = "") -> object:
    try:
        return row[chave]
    except Exception:
        return padrao


def normalizar_telefone_crm(valor: object) -> str:
    return WhatsAppService.normalize_phone(valor)


def resumir_conteudo_mensagem(tipo: str, payload: dict) -> str:
    tipo_limpo = str(tipo or "").strip().lower() or "text"
    if tipo_limpo == "text":
        return str(((payload.get("text") or {}) if isinstance(payload, dict) else {}).get("body") or "").strip()
    if tipo_limpo == "button":
        return str(((payload.get("button") or {}) if isinstance(payload, dict) else {}).get("text") or "").strip()
    if tipo_limpo == "interactive":
        interactive = (payload.get("interactive") or {}) if isinstance(payload, dict) else {}
        button_reply = interactive.get("button_reply") or {}
        list_reply = interactive.get("list_reply") or {}
        return str(button_reply.get("title") or list_reply.get("title") or tipo_limpo).strip()
    legenda = str(((payload.get(tipo_limpo) or {}) if isinstance(payload, dict) else {}).get("caption") or "").strip()
    return legenda or f"[{tipo_limpo}]"


def buscar_paciente_por_telefone(conn: sqlite3.Connection, telefone: str) -> sqlite3.Row | None:
    telefone_limpo = normalizar_telefone_crm(telefone)
    if not telefone_limpo:
        return None
    rows = conn.execute(
        """
        SELECT *
        FROM pacientes
        WHERE COALESCE(telefone, '') <> ''
        ORDER BY id DESC
        """
    ).fetchall()
    for row in rows:
        telefone_row = normalizar_telefone_crm(row["telefone"])
        if not telefone_row:
            continue
        if telefone_row == telefone_limpo or telefone_row.endswith(telefone_limpo[-8:]) or telefone_limpo.endswith(telefone_row[-8:]):
            return row
    return None


def conversa_crm_por_externo(
    conn: sqlite3.Connection,
    *,
    canal: str,
    externo_usuario_id: str = "",
    externo_conversa_id: str = "",
) -> sqlite3.Row | None:
    canal_limpo = str(canal or "").strip().lower()
    externo_usuario_limpo = str(externo_usuario_id or "").strip()
    externo_conversa_limpo = str(externo_conversa_id or "").strip()
    if externo_conversa_limpo:
        row = conn.execute(
            "SELECT * FROM crm_conversas WHERE canal=? AND externo_conversa_id=? LIMIT 1",
            (canal_limpo, externo_conversa_limpo),
        ).fetchone()
        if row is not None:
            return row
    if externo_usuario_limpo:
        return conn.execute(
            "SELECT * FROM crm_conversas WHERE canal=? AND externo_usuario_id=? LIMIT 1",
            (canal_limpo, externo_usuario_limpo),
        ).fetchone()
    return None


def mapear_crm_conversa_resumo(row: sqlite3.Row) -> CrmConversaResumoResposta:
    return CrmConversaResumoResposta(
        id=crm_int(row["id"]),
        crmId=crm_int(row["crm_id"], 0) or None,
        pacienteId=crm_int(row["paciente_id"], 0) or None,
        pacienteNome=str(row["paciente_nome"] or ""),
        prontuario=formatar_prontuario_valor(row["prontuario"]),
        canal=str(row["canal"] or ""),
        contatoNome=str(row["contato_nome"] or ""),
        contatoTelefone=str(row["contato_telefone"] or ""),
        contatoInstagram=str(row["contato_instagram"] or ""),
        externoUsuarioId=str(row["externo_usuario_id"] or ""),
        externoConversaId=str(row["externo_conversa_id"] or ""),
        etapaFunil=str(row["etapa_funil"] or "Novo lead"),
        responsavel=str(row["responsavel"] or ""),
        ultimaMensagem=str(row["ultima_mensagem"] or ""),
        ultimaMensagemEm=formatar_data_hora_relatorio(row["ultima_mensagem_em"]),
        ultimaMensagemSentido=str(row["ultima_mensagem_sentido"] or ""),
        naoLidas=crm_int(row["nao_lidas"], 0),
        status=str(row["status"] or "aberta"),
    )


def mapear_crm_mensagem(row: sqlite3.Row) -> CrmConversaMensagemResposta:
    return CrmConversaMensagemResposta(
        id=crm_int(row["id"]),
        conversaId=crm_int(row["conversa_id"]),
        canal=str(row["canal"] or ""),
        direcao=str(row["direcao"] or ""),
        remetenteTipo=str(row["remetente_tipo"] or ""),
        remetenteExternoId=str(row["remetente_externo_id"] or ""),
        tipoMensagem=str(row["tipo_mensagem"] or "text"),
        conteudo=str(row["conteudo"] or ""),
        midiaUrl=str(row["midia_url"] or ""),
        statusEnvio=str(row["status_envio"] or ""),
        erroEnvio=str(row["erro_envio"] or ""),
        criadoEm=formatar_data_hora_relatorio(row["criado_em"]),
        mensagemExternaId=str(row["mensagem_externa_id"] or ""),
    )


def listar_mensagens_conversa(conn: sqlite3.Connection, conversa_id: int) -> list[CrmConversaMensagemResposta]:
    rows = conn.execute(
        """
        SELECT *
        FROM crm_mensagens
        WHERE conversa_id=?
        ORDER BY COALESCE(criado_em, '') ASC, id ASC
        """,
        (int(conversa_id),),
    ).fetchall()
    return [mapear_crm_mensagem(row) for row in rows]


def detalhar_conversa_crm(conn: sqlite3.Connection, conversa_id: int) -> CrmConversaDetalheResposta:
    row = conn.execute(
        """
        SELECT c.*, p.nome AS paciente_nome, p.prontuario
        FROM crm_conversas c
        LEFT JOIN pacientes p ON p.id = c.paciente_id
        WHERE c.id=?
        LIMIT 1
        """,
        (int(conversa_id),),
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Conversa não encontrada.")
    resumo = mapear_crm_conversa_resumo(row)
    return CrmConversaDetalheResposta(**resumo.model_dump(), mensagens=listar_mensagens_conversa(conn, int(conversa_id)))


def carregar_config_meta() -> MetaConfiguracaoResposta:
    config = whatsapp_service().config
    return MetaConfiguracaoResposta(
        webhookVerifyTokenConfigurado=bool(config.verify_token),
        appSecretConfigurado=bool(config.app_secret),
        whatsappPhoneNumberIdConfigurado=bool(config.phone_number_id),
        whatsappAccessTokenConfigurado=bool(config.access_token),
    )


def validar_assinatura_meta(body: bytes, assinatura: str) -> bool:
    return whatsapp_service().validate_signature(body, assinatura)


def garantir_evento_webhook_unico(
    conn: sqlite3.Connection,
    *,
    canal: str,
    evento_externo_id: str,
    tipo_evento: str,
    payload_json: str,
) -> bool:
    evento_id = str(evento_externo_id or "").strip()
    if not evento_id:
        return True
    existente = conn.execute(
        "SELECT id FROM crm_webhook_eventos WHERE canal=? AND evento_externo_id=? LIMIT 1",
        (str(canal or "").strip().lower(), evento_id),
    ).fetchone()
    if existente is not None:
        return False
    conn.execute(
        """
        INSERT INTO crm_webhook_eventos (canal, evento_externo_id, tipo_evento, payload_json, processado_em)
        VALUES (?, ?, ?, ?, ?)
        """,
        (str(canal or "").strip().lower(), evento_id, str(tipo_evento or "").strip(), payload_json, agora_str()),
    )
    return True


def mapear_crm_paciente_resumo(row: sqlite3.Row | None) -> CrmPacienteResumoResposta | None:
    if row is None:
        return None
    return CrmPacienteResumoResposta(
        crmId=crm_int(row["id"], 0) if row["id"] is not None else None,
        finalizado=crm_bool(row["origem_finalizado"]),
        cancelado=crm_bool(row["origem_cancelado"]),
        avaliacao=crm_bool(row["origem_avaliacao"]),
        etapaFunil=str(row["etapa_funil"] or "Novo lead"),
        campanha=str(row["campanha"] or ""),
        canal=str(row["canal"] or "Facebook"),
        ultimaAvaliacaoEm=formatar_data_br_valor(row["ultima_avaliacao_em"]),
        finalizadoEm=formatar_data_br_valor(row["finalizado_em"]),
        canceladoEm=formatar_data_br_valor(row["cancelado_em"]),
    )


def mapear_crm_paciente_item(row: sqlite3.Row) -> CrmPacienteItemResposta:
    return CrmPacienteItemResposta(
        id=crm_int(row["id"]),
        pacienteId=crm_int(row["paciente_id"]),
        nome=str(row["nome"] or ""),
        prontuario=formatar_prontuario_valor(row["prontuario"]),
        telefone=str(row["telefone"] or ""),
        origemFinalizado=crm_bool(row["origem_finalizado"]),
        origemCancelado=crm_bool(row["origem_cancelado"]),
        origemAvaliacao=crm_bool(row["origem_avaliacao"]),
        etapaFunil=str(row["etapa_funil"] or "Novo lead"),
        canal=str(row["canal"] or "Facebook"),
        campanha=str(row["campanha"] or ""),
        conjuntoAnuncio=str(row["conjunto_anuncio"] or ""),
        anuncio=str(row["anuncio"] or ""),
        responsavel=str(row["responsavel"] or ""),
        proximoContato=formatar_data_br_valor(row["proximo_contato"]),
        observacao=str(row["observacao"] or ""),
        ultimaInteracao=formatar_data_br_valor(row["ultima_interacao"]),
        ultimaAvaliacaoEm=formatar_data_br_valor(row["ultima_avaliacao_em"]),
        finalizadoEm=formatar_data_br_valor(row["finalizado_em"]),
        canceladoEm=formatar_data_br_valor(row["cancelado_em"]),
        atualizadoEm=str(row["atualizado_em"] or ""),
    )


def crm_entry_por_paciente(conn: sqlite3.Connection, paciente_id: int) -> sqlite3.Row | None:
    return conn.execute("SELECT * FROM crm_pacientes WHERE paciente_id=? LIMIT 1", (int(paciente_id),)).fetchone()


def normalizar_status_resgate(valor: object) -> str:
    texto = normalizar_texto(str(valor or "")).upper().replace("_", " ")
    return CRM_STATUS_RESGATE_PADRAO.get(texto, "")


def validar_data_retorno_crm(valor: object) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return ""
    data_parse = parse_data_contrato(texto)
    if data_parse is None:
        raise HTTPException(status_code=400, detail="Informe uma data de retorno valida.")
    return data_parse.isoformat()


def registrar_historico_resgate(
    conn: sqlite3.Connection,
    *,
    crm_id: int | None,
    paciente_id: int,
    contrato_id: int,
    status: str,
    observacao: str,
    proximo_contato: str,
    criado_por: str,
    automatico: bool = False,
) -> None:
    conn.execute(
        """
        INSERT INTO crm_contatos_historico (
            crm_id, paciente_id, contrato_id, status, observacao, proximo_contato, criado_por, criado_em, automatico
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            int(crm_id) if crm_id else None,
            int(paciente_id),
            int(contrato_id),
            status.strip(),
            observacao.strip(),
            proximo_contato.strip(),
            str(criado_por or "").strip(),
            agora_str(),
            1 if automatico else 0,
        ),
    )


def atualizar_snapshot_resgate_contrato(
    conn: sqlite3.Connection,
    *,
    contrato_id: int,
    data_retorno: str,
    status: str,
    observacao: str,
    usuario: str,
) -> None:
    conn.execute(
        """
        UPDATE contratos
        SET data_retorno_crm=?, crm_status=?, crm_observacao_contato=?, crm_ultimo_contato_em=?, crm_ultimo_contato_por=?
        WHERE id=?
        """,
        (
            data_retorno.strip(),
            status.strip(),
            observacao.strip(),
            agora_str(),
            str(usuario or "").strip(),
            int(contrato_id),
        ),
    )


def sincronizar_status_resgate_por_orcamento_aprovado(
    conn: sqlite3.Connection,
    *,
    paciente_id: int,
    contrato_id_origem: int,
    usuario: str,
) -> None:
    usuario_limpo = str(usuario or "").strip() or "sistema"
    crm = crm_entry_por_paciente(conn, int(paciente_id))
    contratos = conn.execute(
        """
        SELECT id, COALESCE(data_retorno_crm, '') AS data_retorno_crm, COALESCE(status, '') AS status_orcamento
        FROM contratos
        WHERE paciente_id=?
        """,
        (int(paciente_id),),
    ).fetchall()
    for contrato in contratos:
        contrato_id = crm_int(contrato["id"], 0)
        if contrato_id <= 0:
            continue
        data_retorno = str(contrato["data_retorno_crm"] or "").strip()
        status_orcamento = normalizar_texto(str(contrato["status_orcamento"] or "")).upper()
        if contrato_id != int(contrato_id_origem) and status_orcamento != "APROVADO":
            atualizar_snapshot_resgate_contrato(
                conn,
                contrato_id=contrato_id,
                data_retorno=data_retorno,
                status="Ligar novamente",
                observacao="Orçamento ainda não aprovado.",
                usuario=usuario_limpo,
            )
            continue
        atualizar_snapshot_resgate_contrato(
            conn,
            contrato_id=contrato_id,
            data_retorno="" if contrato_id == int(contrato_id_origem) else data_retorno,
            status="Convertido",
            observacao="Convertido automaticamente por orçamento aprovado.",
            usuario=usuario_limpo,
        )
        registrar_historico_resgate(
            conn,
            crm_id=crm_int(crm["id"], 0) if crm is not None else None,
            paciente_id=int(paciente_id),
            contrato_id=contrato_id,
            status="Convertido",
            observacao=(
                "Convertido automaticamente por orçamento aprovado."
                if contrato_id == int(contrato_id_origem)
                else f"Paciente convertido automaticamente após aprovação do orçamento #{contrato_id_origem}."
            ),
            proximo_contato="" if contrato_id == int(contrato_id_origem) else data_retorno,
            criado_por=usuario_limpo,
            automatico=True,
        )


def garantir_paciente_minimo_crm(
    conn: sqlite3.Connection,
    nome: str,
    telefone: str = "",
) -> int:
    nome_limpo = str(nome or "").strip()
    telefone_limpo = str(telefone or "").strip()
    if not nome_limpo:
        raise HTTPException(status_code=400, detail="Informe o nome do paciente.")

    existente = conn.execute(
        """
        SELECT id
        FROM pacientes
        WHERE lower(trim(nome)) = lower(trim(?))
          AND COALESCE(telefone, '') = COALESCE(?, '')
        LIMIT 1
        """,
        (nome_limpo, telefone_limpo),
    ).fetchone()
    if existente:
        return int(existente["id"])

    cursor = conn.execute(
        """
        INSERT INTO pacientes (nome, telefone, criado_em)
        VALUES (?, ?, ?)
        """,
        (nome_limpo, telefone_limpo, agora_str()),
    )
    paciente_id = int(cursor.lastrowid or 0)
    conn.execute(
        """
        INSERT INTO pacientes_rapidos (nome, telefone, email, criado_em)
        VALUES (?, ?, '', ?)
        """,
        (nome_limpo, telefone_limpo, agora_str()),
    )
    return paciente_id


def agendamento_eh_avaliacao(row: sqlite3.Row) -> bool:
    blocos = [
        str(crm_row_val(row, "tipo_atendimento_nome_snapshot", "") or ""),
        str(crm_row_val(row, "procedimento_nome_snapshot", "") or ""),
        str(crm_row_val(row, "procedimento", "") or ""),
        str(crm_row_val(row, "observacoes", "") or crm_row_val(row, "observacao", "") or ""),
    ]
    texto = " ".join(blocos)
    normalizado = normalizar_texto(texto)
    return "avaliacao" in normalizado or re.search(r"\baval\b", normalizado) is not None


def listar_avaliacoes_crm(conn: sqlite3.Connection) -> list[CrmAvaliacaoItemResposta]:
    rows = conn.execute(
        """
        SELECT
            a.id,
            a.paciente_id,
            COALESCE(NULLIF(p.nome, ''), NULLIF(a.nome_paciente_snapshot, ''), NULLIF(a.paciente_nome, '')) AS nome,
            COALESCE(p.prontuario, '') AS prontuario,
            COALESCE(NULLIF(p.telefone, ''), NULLIF(a.telefone_snapshot, '')) AS telefone,
            COALESCE(a.data_agendamento, a.data) AS data_referencia,
            COALESCE(a.hora_inicio, '') AS hora_inicio,
            COALESCE(a.profissional, '') AS profissional,
            COALESCE(a.status, '') AS status,
            COALESCE(NULLIF(a.procedimento_nome_snapshot, ''), NULLIF(a.procedimento, '')) AS procedimento,
            COALESCE(a.tipo_atendimento_nome_snapshot, '') AS tipo_atendimento,
            COALESCE(crm.id, 0) AS crm_id,
            COALESCE(crm.origem_avaliacao, 0) AS origem_avaliacao
        FROM agendamentos a
        LEFT JOIN pacientes p ON p.id = a.paciente_id
        LEFT JOIN crm_pacientes crm ON crm.paciente_id = a.paciente_id
        WHERE a.paciente_id IS NOT NULL
        ORDER BY COALESCE(a.data_agendamento, a.data) DESC, COALESCE(a.hora_inicio, '') DESC, a.id DESC
        """
    ).fetchall()
    por_paciente: dict[int, CrmAvaliacaoItemResposta] = {}
    hoje = date.today()
    for row in rows:
        paciente_id = crm_int(row["paciente_id"], 0)
        if paciente_id <= 0 or paciente_id in por_paciente:
            continue
        if not agendamento_eh_avaliacao(row):
            continue
        status = normalizar_texto(str(row["status"] or ""))
        if status in {"cancelado", "desmarcado", "faltou"}:
            continue
        data_ref = parse_data_contrato(row["data_referencia"])
        if not data_ref or data_ref > hoje:
            continue
        data_avaliacao = formatar_data_br_valor(row["data_referencia"])
        if str(row["hora_inicio"] or "").strip():
            data_avaliacao = f"{data_avaliacao} {str(row['hora_inicio'] or '').strip()}".strip()
        por_paciente[paciente_id] = CrmAvaliacaoItemResposta(
            pacienteId=paciente_id,
            nome=str(row["nome"] or ""),
            prontuario=formatar_prontuario_valor(row["prontuario"]),
            telefone=str(row["telefone"] or ""),
            dataAvaliacao=data_avaliacao,
            profissional=str(row["profissional"] or ""),
            status=str(row["status"] or ""),
            procedimento=str(row["procedimento"] or row["tipo_atendimento"] or ""),
            jaNoCrm=crm_bool(row["crm_id"]),
            origemAvaliacao=crm_bool(row["origem_avaliacao"]),
        )
    if not por_paciente:
        return []

    paciente_ids = sorted(por_paciente.keys())
    marcadores = ",".join("?" for _ in paciente_ids)
    contratos_rows = conn.execute(
        f"""
        SELECT
            c.id,
            c.paciente_id,
            c.valor_total,
            COALESCE(c.observacoes, '') AS observacoes,
            COALESCE(c.data_criacao, '') AS data_criacao,
            COALESCE(c.status, '') AS status,
            COALESCE(pc.procedimento, '') AS procedimento
        FROM contratos c
        LEFT JOIN procedimentos_contrato pc ON pc.contrato_id = c.id
        WHERE c.paciente_id IN ({marcadores})
        ORDER BY c.paciente_id, COALESCE(c.data_criacao, '') DESC, c.id DESC, pc.id
        """,
        tuple(paciente_ids),
    ).fetchall()

    contratos_por_id: dict[int, dict] = {}
    contratos_por_paciente: dict[int, list[dict]] = {}
    for row in contratos_rows:
        contrato_id = crm_int(row["id"], 0)
        paciente_id = crm_int(row["paciente_id"], 0)
        if contrato_id <= 0 or paciente_id <= 0:
            continue
        contrato = contratos_por_id.get(contrato_id)
        if contrato is None:
            contrato = {
                "contratoId": contrato_id,
                "valorTotal": formatar_moeda_br(float(row["valor_total"] or 0)),
                "observacao": str(row["observacoes"] or ""),
                "data": formatar_data_br_valor(row["data_criacao"]),
                "status": str(row["status"] or ""),
                "procedimentos": [],
            }
            contratos_por_id[contrato_id] = contrato
            contratos_por_paciente.setdefault(paciente_id, []).append(contrato)
        procedimento = str(row["procedimento"] or "").strip()
        if procedimento and procedimento not in contrato["procedimentos"]:
            contrato["procedimentos"].append(procedimento)

    for paciente_id, item in por_paciente.items():
        item.orcamentos = contratos_por_paciente.get(paciente_id, [])
    return list(por_paciente.values())


def listar_primeira_avaliacao_perdida_crm(conn: sqlite3.Connection) -> list[CrmPrimeiraAvaliacaoPerdidaItemResposta]:
    rows = conn.execute(
        """
        SELECT
            a.id,
            a.paciente_id,
            COALESCE(NULLIF(p.nome, ''), NULLIF(a.nome_paciente_snapshot, ''), NULLIF(a.paciente_nome, '')) AS nome,
            COALESCE(p.prontuario, '') AS prontuario,
            COALESCE(NULLIF(p.telefone, ''), NULLIF(a.telefone_snapshot, '')) AS telefone,
            COALESCE(a.data_agendamento, a.data) AS data_referencia,
            COALESCE(a.hora_inicio, '') AS hora_inicio,
            COALESCE(a.profissional, '') AS profissional,
            COALESCE(a.status, '') AS status,
            COALESCE(a.status_motivo, '') AS status_motivo,
            COALESCE(a.status_usuario, '') AS status_usuario,
            COALESCE(NULLIF(a.procedimento_nome_snapshot, ''), NULLIF(a.procedimento, '')) AS procedimento,
            COALESCE(a.tipo_atendimento_nome_snapshot, '') AS tipo_atendimento
        FROM agendamentos a
        LEFT JOIN pacientes p ON p.id = a.paciente_id
        WHERE a.paciente_id IS NOT NULL
        ORDER BY a.paciente_id, COALESCE(a.data_agendamento, a.data), COALESCE(a.hora_inicio, ''), a.id
        """
    ).fetchall()
    historico_por_paciente: dict[int, list[sqlite3.Row]] = {}
    for row in rows:
        paciente_id = crm_int(row["paciente_id"], 0)
        if paciente_id <= 0:
            continue
        data_ref = parse_data_contrato(row["data_referencia"])
        if not data_ref:
            continue
        historico_por_paciente.setdefault(paciente_id, []).append(row)

    itens: list[CrmPrimeiraAvaliacaoPerdidaItemResposta] = []
    for paciente_id, historico in historico_por_paciente.items():
        historico_ordenado = sorted(
            historico,
            key=lambda row: (
                parse_data_contrato(row["data_referencia"]) or date.min,
                str(row["hora_inicio"] or ""),
                crm_int(row["id"], 0),
            ),
        )
        primeira_consulta = historico_ordenado[0] if historico_ordenado else None
        if primeira_consulta is None or not agendamento_eh_avaliacao(primeira_consulta):
            continue
        status_primeira = normalizar_texto(str(primeira_consulta["status"] or ""))
        if status_primeira not in {"faltou", "desmarcado"}:
            continue

        teve_procedimento_depois = False
        for row in historico_ordenado[1:]:
            status_linha = normalizar_texto(str(row["status"] or ""))
            if status_linha in {"cancelado", "desmarcado", "faltou"}:
                continue
            if agendamento_eh_avaliacao(row):
                continue
            teve_procedimento_depois = True
            break
        if teve_procedimento_depois:
            continue

        data_avaliacao = formatar_data_br_valor(primeira_consulta["data_referencia"])
        if str(primeira_consulta["hora_inicio"] or "").strip():
            data_avaliacao = f"{data_avaliacao} {str(primeira_consulta['hora_inicio'] or '').strip()}".strip()
        itens.append(
            CrmPrimeiraAvaliacaoPerdidaItemResposta(
                pacienteId=paciente_id,
                nome=str(primeira_consulta["nome"] or ""),
                prontuario=formatar_prontuario_valor(primeira_consulta["prontuario"]),
                telefone=str(primeira_consulta["telefone"] or ""),
                dataAvaliacao=data_avaliacao,
                profissional=str(primeira_consulta["profissional"] or ""),
                status=str(primeira_consulta["status"] or ""),
                procedimento=str(primeira_consulta["procedimento"] or primeira_consulta["tipo_atendimento"] or ""),
                motivo=str(primeira_consulta["status_motivo"] or ""),
                usuario=str(primeira_consulta["status_usuario"] or ""),
            )
        )
    itens.sort(
        key=lambda item: (
            (parse_data_contrato(str(item.dataAvaliacao).split(" ")[0]) or date.min).isoformat(),
            normalizar_texto(item.nome),
        ),
        reverse=True,
    )
    return itens


def listar_resgates_crm(conn: sqlite3.Connection) -> list[CrmResgateItemResposta]:
    rows = conn.execute(
        """
        SELECT
            c.id AS contrato_id,
            c.paciente_id,
            COALESCE(crm.id, 0) AS crm_id,
            COALESCE(NULLIF(p.nome, ''), 'Sem nome') AS nome,
            COALESCE(p.cpf, '') AS cpf,
            COALESCE(p.data_nascimento, '') AS data_nascimento,
            COALESCE(p.prontuario, '') AS prontuario,
            COALESCE(p.telefone, '') AS telefone,
            COALESCE(c.data_criacao, '') AS data_criacao,
            COALESCE(c.data_retorno_crm, '') AS data_retorno_crm,
            COALESCE(c.crm_status, '') AS crm_status,
            COALESCE(c.crm_observacao_contato, '') AS crm_observacao_contato,
            COALESCE(c.crm_ultimo_contato_em, '') AS crm_ultimo_contato_em,
            COALESCE(c.crm_ultimo_contato_por, '') AS crm_ultimo_contato_por,
            COALESCE(c.observacoes, '') AS observacoes,
            COALESCE(c.valor_total, 0) AS valor_total,
            COALESCE(c.status, '') AS status_orcamento,
            COALESCE(pc.procedimento, '') AS procedimento
        FROM contratos c
        JOIN pacientes p ON p.id = c.paciente_id
        LEFT JOIN crm_pacientes crm ON crm.paciente_id = c.paciente_id
        LEFT JOIN procedimentos_contrato pc ON pc.contrato_id = c.id
        WHERE COALESCE(c.status, '') != 'EXCLUIDO'
        ORDER BY
            CASE
                WHEN COALESCE(c.data_retorno_crm, '') = '' THEN 1
                ELSE 0
            END,
            COALESCE(c.data_retorno_crm, ''),
            nome,
            c.id
        """
    ).fetchall()
    itens_por_contrato: dict[int, CrmResgateItemResposta] = {}
    historico_rows = conn.execute(
        """
        SELECT *
        FROM crm_contatos_historico
        ORDER BY criado_em DESC, id DESC
        """
    ).fetchall()
    historico_por_contrato: dict[int, list[CrmResgateHistoricoItemResposta]] = {}
    for row in historico_rows:
        contrato_id = crm_int(row["contrato_id"], 0)
        if contrato_id <= 0:
            continue
        historico_por_contrato.setdefault(contrato_id, []).append(
            CrmResgateHistoricoItemResposta(
                id=crm_int(row["id"], 0),
                status=str(row["status"] or ""),
                observacao=str(row["observacao"] or ""),
                proximoContato=formatar_data_br_valor(row["proximo_contato"]),
                criadoPor=str(row["criado_por"] or ""),
                criadoEm=formatar_data_hora_relatorio(row["criado_em"]),
                automatico=crm_bool(row["automatico"]),
            )
        )

    paciente_ids = sorted({crm_int(row["paciente_id"], 0) for row in rows if crm_int(row["paciente_id"], 0) > 0})
    observacao_avaliacao_por_paciente: dict[int, str] = {}
    if paciente_ids:
        marcadores = ",".join("?" for _ in paciente_ids)
        avaliacao_rows = conn.execute(
            f"""
            SELECT paciente_id, COALESCE(observacoes, '') AS observacoes, COALESCE(data_agendamento, data) AS data_ref, COALESCE(hora_inicio, '') AS hora_ref
            FROM agendamentos
            WHERE paciente_id IN ({marcadores})
            ORDER BY COALESCE(data_agendamento, data) DESC, COALESCE(hora_inicio, '') DESC, id DESC
            """,
            tuple(paciente_ids),
        ).fetchall()
        for row in avaliacao_rows:
            paciente_id = crm_int(row["paciente_id"], 0)
            if paciente_id <= 0 or paciente_id in observacao_avaliacao_por_paciente:
                continue
            if not agendamento_eh_avaliacao(row):
                continue
            observacao = str(row["observacoes"] or "").strip()
            if observacao:
                observacao_avaliacao_por_paciente[paciente_id] = observacao

    for row in rows:
        contrato_id = crm_int(row["contrato_id"], 0)
        if contrato_id <= 0:
            continue
        item = itens_por_contrato.get(contrato_id)
        if item is None:
            paciente_id = crm_int(row["paciente_id"], 0)
            status_orcamento = normalizar_texto(str(row["status_orcamento"] or "")).upper()
            status_snapshot = normalizar_status_resgate(row["crm_status"])
            if status_orcamento == "APROVADO":
                status_snapshot = "Convertido"
            elif status_snapshot == "Convertido":
                status_snapshot = "Ligar novamente"
            if not status_snapshot:
                status_snapshot = "Ligar novamente"
            item = CrmResgateItemResposta(
                crmId=crm_int(row["crm_id"], 0) or None,
                contratoId=contrato_id,
                pacienteId=paciente_id,
                nome=str(row["nome"] or ""),
                cpf=str(row["cpf"] or ""),
                idadeAtual=calcular_idade_atual(row["data_nascimento"]),
                prontuario=formatar_prontuario_valor(row["prontuario"]),
                telefone=str(row["telefone"] or ""),
                dataOrcamento=formatar_data_br_valor(row["data_criacao"]),
                dataRetorno=formatar_data_br_valor(row["data_retorno_crm"]),
                statusResgate=status_snapshot,
                observacaoContato=str(row["crm_observacao_contato"] or ""),
                observacaoAvaliacao=observacao_avaliacao_por_paciente.get(paciente_id, ""),
                observacaoOrcamento=str(row["observacoes"] or ""),
                valorTotal=formatar_moeda_br(float(row["valor_total"] or 0)),
                procedimentos=[],
                ultimoContatoEm=formatar_data_hora_relatorio(row["crm_ultimo_contato_em"]),
                ultimoContatoPor=str(row["crm_ultimo_contato_por"] or ""),
                historico=historico_por_contrato.get(contrato_id, []),
            )
            itens_por_contrato[contrato_id] = item
        procedimento = str(row["procedimento"] or "").strip()
        if procedimento and procedimento not in item.procedimentos:
            item.procedimentos.append(procedimento)
    return list(itens_por_contrato.values())


def upsert_crm_origem(
    conn: sqlite3.Connection,
    paciente_id: int,
    *,
    marcar_finalizado: bool = False,
    marcar_cancelado: bool = False,
    marcar_avaliacao: bool = False,
    usuario: str = "",
    ultima_avaliacao_em: str = "",
    canal_novo: str = "Facebook",
) -> sqlite3.Row:
    existente = crm_entry_por_paciente(conn, paciente_id)
    agora = agora_str()
    usuario_limpo = str(usuario or "").strip()
    if existente is None:
        conn.execute(
            """
            INSERT INTO crm_pacientes (
                paciente_id, origem_finalizado, origem_cancelado, origem_avaliacao, etapa_funil, canal,
                ultima_avaliacao_em, finalizado_em, cancelado_em, criado_por, atualizado_por, criado_em, atualizado_em
            )
            VALUES (?, ?, ?, ?, 'Novo lead', ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                int(paciente_id),
                1 if marcar_finalizado else 0,
                1 if marcar_cancelado else 0,
                1 if marcar_avaliacao else 0,
                str(canal_novo or "Facebook").strip() or "Facebook",
                ultima_avaliacao_em or "",
                agora if marcar_finalizado else "",
                agora if marcar_cancelado else "",
                usuario_limpo,
                usuario_limpo,
                agora,
                agora,
            ),
        )
    else:
        conn.execute(
            """
            UPDATE crm_pacientes
            SET
                origem_finalizado=?,
                origem_cancelado=?,
                origem_avaliacao=?,
                ultima_avaliacao_em=?,
                finalizado_em=?,
                cancelado_em=?,
                atualizado_por=?,
                atualizado_em=?
            WHERE paciente_id=?
            """,
            (
                1 if (bool(int(existente["origem_finalizado"] or 0)) or marcar_finalizado) else 0,
                1 if (bool(int(existente["origem_cancelado"] or 0)) or marcar_cancelado) else 0,
                1 if (bool(int(existente["origem_avaliacao"] or 0)) or marcar_avaliacao) else 0,
                ultima_avaliacao_em or str(existente["ultima_avaliacao_em"] or ""),
                str(existente["finalizado_em"] or "") or (agora if marcar_finalizado else ""),
                str(existente["cancelado_em"] or "") or (agora if marcar_cancelado else ""),
                usuario_limpo or str(existente["atualizado_por"] or ""),
                agora,
                int(paciente_id),
            ),
        )
    return crm_entry_por_paciente(conn, paciente_id)


def garantir_conversa_crm_canal(
    conn: sqlite3.Connection,
    *,
    canal: str,
    externo_usuario_id: str,
    externo_conversa_id: str = "",
    contato_nome: str = "",
    contato_telefone: str = "",
    contato_instagram: str = "",
) -> sqlite3.Row:
    canal_limpo = str(canal or "").strip().lower()
    if canal_limpo not in CRM_CANAIS_SUPORTADOS:
        raise HTTPException(status_code=400, detail="Canal de conversa não suportado.")

    conversa = conversa_crm_por_externo(
        conn,
        canal=canal_limpo,
        externo_usuario_id=externo_usuario_id,
        externo_conversa_id=externo_conversa_id,
    )
    paciente = buscar_paciente_por_telefone(conn, contato_telefone) if canal_limpo == "whatsapp" else None
    if paciente is None and contato_nome.strip():
        paciente_id = garantir_paciente_minimo_crm(conn, contato_nome.strip(), contato_telefone.strip())
        paciente = carregar_paciente_por_id(conn, paciente_id)
    crm = None
    if paciente is not None:
        crm = upsert_crm_origem(
            conn,
            int(paciente["id"]),
            usuario="META",
            canal_novo="WhatsApp" if canal_limpo == "whatsapp" else canal_limpo.title(),
        )
    agora = agora_str()

    if conversa is None:
        conn.execute(
            """
            INSERT INTO crm_conversas (
                crm_id, paciente_id, canal, contato_nome, contato_telefone, contato_instagram,
                externo_usuario_id, externo_conversa_id, etapa_funil, responsavel, ultima_mensagem,
                ultima_mensagem_em, ultima_mensagem_sentido, nao_lidas, status, criado_em, atualizado_em
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', '', '', 0, 'aberta', ?, ?)
            """,
            (
                crm_int(crm["id"], 0) if crm is not None else None,
                int(paciente["id"]) if paciente is not None else None,
                canal_limpo,
                contato_nome.strip(),
                contato_telefone.strip(),
                contato_instagram.strip(),
                str(externo_usuario_id or "").strip(),
                str(externo_conversa_id or "").strip(),
                str(crm["etapa_funil"] or "Novo lead") if crm is not None else "Novo lead",
                str(crm["responsavel"] or "") if crm is not None else "",
                agora,
                agora,
            ),
        )
        conversa_id = crm_int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
    else:
        conversa_id = crm_int(conversa["id"])
        conn.execute(
            """
            UPDATE crm_conversas
            SET crm_id=?,
                paciente_id=?,
                contato_nome=?,
                contato_telefone=?,
                contato_instagram=?,
                externo_usuario_id=CASE WHEN trim(COALESCE(externo_usuario_id, ''))='' THEN ? ELSE externo_usuario_id END,
                externo_conversa_id=CASE WHEN trim(COALESCE(externo_conversa_id, ''))='' THEN ? ELSE externo_conversa_id END,
                atualizado_em=?
            WHERE id=?
            """,
            (
                crm_int(crm["id"], 0) if crm is not None else crm_int(conversa["crm_id"], 0) or None,
                int(paciente["id"]) if paciente is not None else crm_int(conversa["paciente_id"], 0) or None,
                contato_nome.strip() or str(conversa["contato_nome"] or ""),
                contato_telefone.strip() or str(conversa["contato_telefone"] or ""),
                contato_instagram.strip() or str(conversa["contato_instagram"] or ""),
                str(externo_usuario_id or "").strip(),
                str(externo_conversa_id or "").strip(),
                agora,
                conversa_id,
            ),
        )
    return conn.execute(
        """
        SELECT c.*, p.nome AS paciente_nome, p.prontuario
        FROM crm_conversas c
        LEFT JOIN pacientes p ON p.id = c.paciente_id
        WHERE c.id=?
        LIMIT 1
        """,
        (conversa_id,),
    ).fetchone()


def registrar_mensagem_conversa(
    conn: sqlite3.Connection,
    *,
    conversa_id: int,
    crm_id: int | None,
    paciente_id: int | None,
    canal: str,
    mensagem_externa_id: str,
    remetente_externo_id: str,
    direcao: str,
    remetente_tipo: str,
    tipo_mensagem: str,
    conteudo: str,
    midia_url: str = "",
    status_envio: str = "",
    erro_envio: str = "",
    metadata: dict | None = None,
    criado_em: str = "",
) -> sqlite3.Row:
    mensagem_id = str(mensagem_externa_id or "").strip()
    if mensagem_id:
        existente = conn.execute(
            "SELECT * FROM crm_mensagens WHERE canal=? AND mensagem_externa_id=? LIMIT 1",
            (str(canal or "").strip().lower(), mensagem_id),
        ).fetchone()
        if existente is not None:
            return existente
    agora = str(criado_em or "").strip() or agora_str()
    conn.execute(
        """
        INSERT INTO crm_mensagens (
            conversa_id, crm_id, paciente_id, canal, mensagem_externa_id, remetente_externo_id,
            direcao, remetente_tipo, tipo_mensagem, conteudo, midia_url, status_envio, erro_envio,
            metadata_json, criado_em, atualizado_em
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            int(conversa_id),
            int(crm_id) if crm_id else None,
            int(paciente_id) if paciente_id else None,
            str(canal or "").strip().lower(),
            mensagem_id,
            str(remetente_externo_id or "").strip(),
            str(direcao or "").strip(),
            str(remetente_tipo or "").strip(),
            str(tipo_mensagem or "text").strip(),
            str(conteudo or "").strip(),
            str(midia_url or "").strip(),
            str(status_envio or "").strip() or ("received" if direcao == "entrada" else "sent"),
            str(erro_envio or "").strip(),
            json.dumps(metadata or {}, ensure_ascii=False),
            agora,
            agora,
        ),
    )
    novo_id = crm_int(conn.execute("SELECT last_insert_rowid() AS id").fetchone()["id"])
    incremento_nao_lidas = 1 if direcao == "entrada" else 0
    conn.execute(
        """
        UPDATE crm_conversas
        SET ultima_mensagem=?,
            ultima_mensagem_em=?,
            ultima_mensagem_sentido=?,
            nao_lidas=CASE WHEN ?=1 THEN COALESCE(nao_lidas, 0) + 1 ELSE COALESCE(nao_lidas, 0) END,
            atualizado_em=?
        WHERE id=?
        """,
        (str(conteudo or "").strip(), agora, str(direcao or "").strip(), incremento_nao_lidas, agora, int(conversa_id)),
    )
    return conn.execute("SELECT * FROM crm_mensagens WHERE id=? LIMIT 1", (novo_id,)).fetchone()


def atualizar_status_mensagem_externa(
    conn: sqlite3.Connection,
    *,
    canal: str,
    mensagem_externa_id: str,
    status_envio: str,
) -> None:
    if not str(mensagem_externa_id or "").strip():
        return
    conn.execute(
        """
        UPDATE crm_mensagens
        SET status_envio=?, atualizado_em=?
        WHERE canal=? AND mensagem_externa_id=?
        """,
        (str(status_envio or "").strip(), agora_str(), str(canal or "").strip().lower(), str(mensagem_externa_id or "").strip()),
    )


def enviar_texto_meta_whatsapp(destino: str, conteudo: str) -> dict:
    try:
        return whatsapp_service().send_text(destino, conteudo)
    except WhatsAppConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (WhatsAppAPIError, ValueError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


def timestamp_meta_para_banco(valor: object) -> str:
    try:
        return datetime.fromtimestamp(int(str(valor)), tz=TIMEZONE_LOCAL).replace(tzinfo=None).isoformat(sep=" ", timespec="seconds")
    except (TypeError, ValueError, OSError):
        return agora_str()


def processar_mensagem_meta_whatsapp(conn: sqlite3.Connection, mensagem: dict, metadata: dict) -> bool:
    mensagem_id = str(mensagem.get("id") or "").strip()
    if not garantir_evento_webhook_unico(
        conn,
        canal="whatsapp",
        evento_externo_id=mensagem_id,
        tipo_evento="message",
        payload_json=json.dumps({"message": mensagem, "metadata": metadata}, ensure_ascii=False),
    ):
        return False
    perfil = (mensagem.get("profile") or {}) if isinstance(mensagem.get("profile"), dict) else {}
    nome = str(perfil.get("name") or "").strip()
    telefone = str(mensagem.get("from") or "").strip()
    conversa = garantir_conversa_crm_canal(
        conn,
        canal="whatsapp",
        externo_usuario_id=telefone,
        externo_conversa_id="",
        contato_nome=nome or telefone,
        contato_telefone=telefone,
    )
    conteudo = resumir_conteudo_mensagem(str(mensagem.get("type") or "text"), mensagem)
    tipo = str(mensagem.get("type") or "text").strip().lower()
    midia = mensagem.get(tipo) if isinstance(mensagem.get(tipo), dict) else {}
    midia_id = str(midia.get("id") or "").strip()
    registrar_mensagem_conversa(
        conn,
        conversa_id=crm_int(conversa["id"]),
        crm_id=crm_int(conversa["crm_id"], 0) or None,
        paciente_id=crm_int(conversa["paciente_id"], 0) or None,
        canal="whatsapp",
        mensagem_externa_id=mensagem_id,
        remetente_externo_id=telefone,
        direcao="entrada",
        remetente_tipo="contato",
        tipo_mensagem=tipo,
        conteudo=conteudo,
        midia_url=f"meta-media://{midia_id}" if midia_id else "",
        metadata={"message": mensagem, "metadata": metadata},
        criado_em=timestamp_meta_para_banco(mensagem.get("timestamp")),
    )
    return True


def processar_status_meta_whatsapp(conn: sqlite3.Connection, status_item: dict, metadata: dict) -> bool:
    status_id = str(status_item.get("id") or "").strip()
    if not garantir_evento_webhook_unico(
        conn,
        canal="whatsapp",
        evento_externo_id=f"status:{status_id}:{status_item.get('status') or ''}",
        tipo_evento="status",
        payload_json=json.dumps({"status": status_item, "metadata": metadata}, ensure_ascii=False),
    ):
        return False
    atualizar_status_mensagem_externa(
        conn,
        canal="whatsapp",
        mensagem_externa_id=status_id,
        status_envio=str(status_item.get("status") or "").strip() or "sent",
    )
    if str(status_item.get("status") or "").strip().lower() == "failed":
        erros = status_item.get("errors") if isinstance(status_item.get("errors"), list) else []
        erro = str((erros[0] or {}).get("title") or (erros[0] or {}).get("message") or "Falha informada pela Meta") if erros else "Falha informada pela Meta"
        conn.execute(
            "UPDATE crm_mensagens SET erro_envio=?, atualizado_em=? WHERE canal='whatsapp' AND mensagem_externa_id=?",
            (erro[:500], agora_str(), status_id),
        )
    return True


def processar_webhook_meta(payload: dict) -> int:
    processados = 0
    conn = conectar()
    try:
        for entry in payload.get("entry") or []:
            for change in entry.get("changes") or []:
                value = change.get("value") or {}
                metadata = value.get("metadata") or {}
                contatos = value.get("contacts") if isinstance(value.get("contacts"), list) else []
                perfis = {
                    str(contato.get("wa_id") or ""): (contato.get("profile") or {})
                    for contato in contatos if isinstance(contato, dict)
                }
                for mensagem in value.get("messages") or []:
                    mensagem_com_perfil = dict(mensagem)
                    mensagem_com_perfil["profile"] = perfis.get(str(mensagem.get("from") or ""), {})
                    if processar_mensagem_meta_whatsapp(conn, mensagem_com_perfil, metadata):
                        processados += 1
                for status_item in value.get("statuses") or []:
                    if processar_status_meta_whatsapp(conn, status_item, metadata):
                        processados += 1
        conn.commit()
    finally:
        conn.close()
    return processados


def montar_ficha_paciente(conn: sqlite3.Connection, paciente_row: sqlite3.Row) -> FichaPacienteResposta:
    atualizar_status_recebiveis_automaticamente(conn)
    contratos_rows = conn.execute(
        "SELECT * FROM contratos WHERE paciente_id=? ORDER BY COALESCE(data_criacao, '') DESC, id DESC",
        (int(paciente_row["id"]),),
    ).fetchall()
    recebiveis_rows = carregar_recebiveis_paciente(conn, paciente_row)
    agendamentos_rows = carregar_agendamentos_paciente(conn, paciente_row)
    proximo = proximo_agendamento_paciente(agendamentos_rows)

    contratos = [
        ContratoResumo(
            id=int(row["id"]),
            valorTotal=formatar_moeda_br(row["valor_total"]),
            entrada=formatar_moeda_br(row["entrada"]),
            parcelas=int(row["parcelas"] or 1),
            primeiroVencimento=formatar_data_br_valor(row["primeiro_vencimento"]),
            dataCriacao=formatar_data_br_valor(row["data_criacao"]),
            formaPagamento=str(row["forma_pagamento"] or ""),
            status=str(row["status"] or "EM_ABERTO"),
            aprovadoPor=str(row["aprovado_por"] or ""),
            dataAprovacao=formatar_data_br_valor(row["data_aprovacao"]),
            jaFoiAprovado=bool(int(row["ja_foi_aprovado"] or 0)),
            tipoMovimentoVenda=str(row["tipo_movimento_venda"] or "NOVA"),
            valorVendaConsiderado=float(row["valor_venda_considerado"]) if row["valor_venda_considerado"] is not None else None,
            procedimentos=carregar_procedimentos_contrato(conn, int(row["id"])),
        )
        for row in contratos_rows
    ]

    historico_por_recebivel = carregar_historico_cobranca_recebiveis(
        conn,
        [int(row["id"] or 0) for row in recebiveis_rows],
    )
    recebiveis = [
        mapear_recebivel(row, historico_por_recebivel.get(int(row["id"] or 0), []))
        for row in recebiveis_rows
    ]
    agendamentos = [mapear_agendamento(row) for row in agendamentos_rows]
    recibos = [
        mapear_recebivel(row, historico_por_recebivel.get(int(row["id"] or 0), []))
        for row in recebiveis_rows
        if str(row["status"] or "") == "Pago"
    ]

    return FichaPacienteResposta(
        paciente=mapear_paciente_detalhe(paciente_row),
        contratos=contratos,
        recebiveis=recebiveis,
        financeiro=resumo_financeiro_paciente(recebiveis_rows),
        agendamentos=agendamentos,
        proximoAgendamento=mapear_agendamento(proximo) if proximo else None,
        documentos=listar_documentos_paciente(paciente_row, conn),
        exames=listar_exames_paciente(paciente_row),
        recibos=recibos,
        crm=mapear_crm_paciente_resumo(crm_entry_por_paciente(conn, int(paciente_row["id"]))),
    )


@app.get("/api/pacientes", response_model=list[PacienteResumo])
def listar_pacientes(
    q: str = Query("", description="Busca por nome, apelido, prontuario, CPF ou telefone"),
    limit: int = Query(50, ge=1, le=5000),
):
    conn = conectar()
    try:
        rows = conn.execute("SELECT * FROM pacientes ORDER BY nome").fetchall()
        filtrados = filtrar_pacientes(rows, q)
        return [mapear_paciente_resumo(row) for row in filtrados[:limit]]
    finally:
        conn.close()


@app.get("/api/pacientes/proximo-prontuario", response_model=ProximoProntuarioResposta)
def obter_proximo_prontuario():
    conn = conectar()
    try:
        return ProximoProntuarioResposta(prontuario=proximo_prontuario(conn))
    finally:
        conn.close()


@app.get("/api/pacientes/recentes", response_model=list[PacienteResumo])
def listar_pacientes_recentes(limit: int = Query(6, ge=1, le=50)):
    conn = conectar()
    try:
        rows = conn.execute("SELECT * FROM pacientes ORDER BY id DESC LIMIT ?", (limit,)).fetchall()
        return [mapear_paciente_resumo(row) for row in rows]
    finally:
        conn.close()


@app.get("/api/pacientes/cep/{cep}")
def consultar_cep(cep: str):
    return buscar_endereco_por_cep(cep)


@app.get("/api/pacientes/{paciente_id}", response_model=PacienteDetalhe)
def detalhar_paciente(paciente_id: int):
    conn = conectar()
    try:
        row = carregar_paciente_por_id(conn, paciente_id)
        return mapear_paciente_detalhe(row)
    finally:
        conn.close()


@app.get("/api/pacientes/{paciente_id}/ficha", response_model=FichaPacienteResposta)
def ficha_paciente(paciente_id: int):
    conn = conectar()
    try:
        row = carregar_paciente_por_id(conn, paciente_id)
        return montar_ficha_paciente(conn, row)
    finally:
        conn.close()


@app.get("/api/crm", response_model=CrmPainelResposta)
def listar_crm():
    conn = conectar()
    try:
        pipeline_rows = conn.execute(
            """
            SELECT
                crm.*,
                COALESCE(p.nome, '') AS nome,
                COALESCE(p.prontuario, '') AS prontuario,
                COALESCE(p.telefone, '') AS telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            ORDER BY
                CASE COALESCE(crm.etapa_funil, 'Novo lead')
                    WHEN 'Novo lead' THEN 1
                    WHEN 'Contato inicial' THEN 2
                    WHEN 'Tentando contato' THEN 3
                    WHEN 'Conversando' THEN 4
                    WHEN 'Agendou avaliação' THEN 5
                    WHEN 'Em negociação' THEN 6
                    WHEN 'Convertido' THEN 7
                    WHEN 'Perdido' THEN 8
                    ELSE 99
                END,
                lower(COALESCE(p.nome, '')),
                crm.id DESC
            """
        ).fetchall()
        pipeline: list[CrmPacienteItemResposta] = []
        for row in pipeline_rows:
            try:
                item = mapear_crm_paciente_item(row)
            except Exception:
                continue
            if item.id <= 0 or item.pacienteId <= 0:
                continue
            pipeline.append(item)
        finalizados = [item for item in pipeline if item.origemFinalizado]
        cancelados = [item for item in pipeline if item.origemCancelado]
        avaliacoes = listar_avaliacoes_crm(conn)
        avaliacoes_primeira_consulta_perdida = listar_primeira_avaliacao_perdida_crm(conn)
        resgates = listar_resgates_crm(conn)
        return CrmPainelResposta(
            pipeline=pipeline,
            finalizados=finalizados,
            cancelados=cancelados,
            avaliacoes=avaliacoes,
            avaliacoesPrimeiraConsultaPerdida=avaliacoes_primeira_consulta_perdida,
            resgates=resgates,
        )
    finally:
        conn.close()


@app.get("/api/meta/config", response_model=MetaConfiguracaoResposta)
def buscar_configuracao_meta():
    return carregar_config_meta()


@app.get("/api/meta/webhook")
def verificar_webhook_meta(
    hub_mode: str = Query(default="", alias="hub.mode"),
    hub_verify_token: str = Query(default="", alias="hub.verify_token"),
    hub_challenge: str = Query(default="", alias="hub.challenge"),
):
    try:
        challenge = whatsapp_service().verify_challenge(hub_mode, hub_verify_token, hub_challenge)
    except WhatsAppConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except PermissionError as exc:
        raise HTTPException(status_code=403, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return Response(content=challenge, media_type="text/plain")


@app.post("/api/meta/webhook", response_model=MetaWebhookResposta)
async def receber_webhook_meta(request: Request):
    body = await request.body()
    assinatura = request.headers.get("x-hub-signature-256", "")
    if not validar_assinatura_meta(body, assinatura):
        raise HTTPException(status_code=403, detail="Assinatura do webhook Meta inválida.")
    try:
        payload = json.loads(body.decode("utf-8") or "{}")
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Payload inválido para webhook Meta.")
    eventos_processados = processar_webhook_meta(payload if isinstance(payload, dict) else {})
    return MetaWebhookResposta(ok=True, eventosProcessados=eventos_processados)


@app.post("/api/dev/whatsapp/simular", response_model=MetaWebhookResposta)
def simular_webhook_whatsapp(payload: CrmConversaEnvioPayload, request: Request):
    if normalizar_texto(os.getenv("APP_ENV", "development")) in {"production", "producao", "prod"}:
        raise HTTPException(status_code=404, detail="Rota não encontrada.")
    if not usuario_request(request):
        raise HTTPException(status_code=401, detail="Usuário não autenticado.")
    telefone = str(request.query_params.get("telefone") or "5511999999999").strip()
    nome = str(request.query_params.get("nome") or "Contato WhatsApp Teste").strip()
    evento = {
        "object": "whatsapp_business_account",
        "entry": [{"changes": [{"value": {
            "messaging_product": "whatsapp",
            "contacts": [{"profile": {"name": nome}, "wa_id": telefone}],
            "messages": [{
                "from": telefone,
                "id": f"dev-{int(datetime.now().timestamp() * 1000000)}",
                "timestamp": str(int(datetime.now().timestamp())),
                "type": "text",
                "text": {"body": str(payload.conteudo or "Olá, teste do WhatsApp").strip()},
            }],
        }, "field": "messages"}]}],
    }
    return MetaWebhookResposta(ok=True, eventosProcessados=processar_webhook_meta(evento))


@app.get("/api/crm/conversas", response_model=list[CrmConversaResumoResposta])
def listar_conversas_crm(
    canal: str = Query(default=""),
    abertas_apenas: bool = Query(default=False),
    busca: str = Query(default=""),
):
    conn = conectar()
    try:
        rows = conn.execute(
            """
            SELECT c.*, p.nome AS paciente_nome, p.prontuario
            FROM crm_conversas c
            LEFT JOIN pacientes p ON p.id = c.paciente_id
            ORDER BY COALESCE(c.ultima_mensagem_em, c.atualizado_em, c.criado_em, '') DESC, c.id DESC
            """
        ).fetchall()
        itens: list[CrmConversaResumoResposta] = []
        canal_filtro = str(canal or "").strip().lower()
        busca_filtro = normalizar_texto(busca)
        for row in rows:
            if canal_filtro and str(row["canal"] or "").strip().lower() != canal_filtro:
                continue
            if abertas_apenas and str(row["status"] or "aberta").strip().lower() != "aberta":
                continue
            if busca_filtro:
                texto_base = " ".join(
                    [
                        str(row["paciente_nome"] or ""),
                        str(row["contato_nome"] or ""),
                        str(row["contato_telefone"] or ""),
                        str(row["contato_instagram"] or ""),
                        str(row["ultima_mensagem"] or ""),
                    ]
                )
                if busca_filtro not in normalizar_texto(texto_base):
                    continue
            itens.append(mapear_crm_conversa_resumo(row))
        return itens
    finally:
        conn.close()


@app.get("/api/crm/conversas/{conversa_id}", response_model=CrmConversaDetalheResposta)
def buscar_conversa_crm(conversa_id: int):
    conn = conectar()
    try:
        detalhe = detalhar_conversa_crm(conn, conversa_id)
        conn.execute(
            "UPDATE crm_conversas SET nao_lidas=0, atualizado_em=? WHERE id=?",
            (agora_str(), int(conversa_id)),
        )
        conn.commit()
        return detalhar_conversa_crm(conn, conversa_id)
    finally:
        conn.close()


@app.post("/api/crm/conversas/{conversa_id}/mensagens", response_model=CrmConversaMensagemResposta)
def enviar_mensagem_conversa_crm(conversa_id: int, payload: CrmConversaEnvioPayload, request: Request):
    conteudo = str(payload.conteudo or "").strip()
    if not conteudo:
        raise HTTPException(status_code=400, detail="Informe o conteúdo da mensagem.")
    conn = conectar()
    try:
        conversa = conn.execute("SELECT * FROM crm_conversas WHERE id=? LIMIT 1", (int(conversa_id),)).fetchone()
        if conversa is None:
            raise HTTPException(status_code=404, detail="Conversa não encontrada.")
        canal = str(conversa["canal"] or "").strip().lower()
        mensagem_externa_id = ""
        status_envio = "queued"
        metadata_resposta: dict = {}
        if canal == "whatsapp":
            destino = str(conversa["contato_telefone"] or conversa["externo_usuario_id"] or "").strip()
            if not destino:
                raise HTTPException(status_code=400, detail="Conversa sem telefone para envio pelo WhatsApp.")
            metadata_resposta = enviar_texto_meta_whatsapp(destino, conteudo)
            mensagens_meta = metadata_resposta.get("messages") if isinstance(metadata_resposta, dict) else None
            if isinstance(mensagens_meta, list) and mensagens_meta:
                mensagem_externa_id = str((mensagens_meta[0] or {}).get("id") or "").strip()
            status_envio = "sent"
        elif canal == "instagram":
            raise HTTPException(status_code=501, detail="Envio pelo Instagram ainda será habilitado na próxima etapa.")
        else:
            raise HTTPException(status_code=400, detail="Canal da conversa não suportado.")

        row = registrar_mensagem_conversa(
            conn,
            conversa_id=int(conversa_id),
            crm_id=crm_int(conversa["crm_id"], 0) or None,
            paciente_id=crm_int(conversa["paciente_id"], 0) or None,
            canal=canal,
            mensagem_externa_id=mensagem_externa_id,
            remetente_externo_id="",
            direcao="saida",
            remetente_tipo="usuario",
            tipo_mensagem="text",
            conteudo=conteudo,
            status_envio=status_envio,
            metadata=metadata_resposta,
        )
        conn.commit()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Mensagem enviada",
        info=f"Conversa {conversa_id}",
        metodo_http="POST",
        rota=f"/api/crm/conversas/{conversa_id}/mensagens",
    )
    return mapear_crm_mensagem(row)


@app.post("/api/crm/pacientes/{paciente_id}/finalizado", response_model=CrmPacienteItemResposta)
def marcar_paciente_finalizado_crm(paciente_id: int, request: Request):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        crm = upsert_crm_origem(
            conn,
            paciente_id=int(paciente_id),
            marcar_finalizado=True,
            usuario=usuario_request(request),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.id=?
            LIMIT 1
            """,
            (int(crm["id"]),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Paciente finalizado",
        info=str(paciente["nome"] or f"Paciente {paciente_id}"),
        metodo_http="POST",
        rota=f"/api/crm/pacientes/{paciente_id}/finalizado",
    )
    return mapear_crm_paciente_item(row)


@app.post("/api/crm/pacientes/{paciente_id}/cancelado", response_model=CrmPacienteItemResposta)
def marcar_paciente_cancelado_crm(paciente_id: int, request: Request):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        crm = upsert_crm_origem(
            conn,
            paciente_id=int(paciente_id),
            marcar_cancelado=True,
            usuario=usuario_request(request),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.id=?
            LIMIT 1
            """,
            (int(crm["id"]),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Paciente cancelado",
        info=str(paciente["nome"] or f"Paciente {paciente_id}"),
        metodo_http="POST",
        rota=f"/api/crm/pacientes/{paciente_id}/cancelado",
    )
    return mapear_crm_paciente_item(row)


@app.post("/api/crm/pacientes/{paciente_id}/reativar", response_model=CrmPacienteItemResposta)
def reativar_paciente_crm(paciente_id: int, request: Request):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        atual = crm_entry_por_paciente(conn, int(paciente_id))
        if atual is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado no CRM.")
        conn.execute(
            """
            UPDATE crm_pacientes
            SET origem_finalizado=0,
                finalizado_em='',
                atualizado_por=?,
                atualizado_em=?
            WHERE paciente_id=?
            """,
            (
                usuario_request(request),
                agora_str(),
                int(paciente_id),
            ),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.paciente_id=?
            LIMIT 1
            """,
            (int(paciente_id),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Paciente reativado",
        info=str(paciente["nome"] or f"Paciente {paciente_id}"),
        metodo_http="POST",
        rota=f"/api/crm/pacientes/{paciente_id}/reativar",
    )
    return mapear_crm_paciente_item(row)


@app.post("/api/crm/pacientes/{paciente_id}/cancelado/remover", response_model=CrmPacienteItemResposta)
def remover_paciente_cancelado_crm(paciente_id: int, request: Request):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        atual = crm_entry_por_paciente(conn, int(paciente_id))
        if atual is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado no CRM.")
        conn.execute(
            """
            UPDATE crm_pacientes
            SET origem_cancelado=0,
                cancelado_em='',
                atualizado_por=?,
                atualizado_em=?
            WHERE paciente_id=?
            """,
            (
                usuario_request(request),
                agora_str(),
                int(paciente_id),
            ),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.paciente_id=?
            LIMIT 1
            """,
            (int(paciente_id),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Paciente reativado de cancelados",
        info=str(paciente["nome"] or f"Paciente {paciente_id}"),
        metodo_http="POST",
        rota=f"/api/crm/pacientes/{paciente_id}/cancelado/remover",
    )
    return mapear_crm_paciente_item(row)


@app.post("/api/crm/pacientes/{paciente_id}/avaliacao", response_model=CrmPacienteItemResposta)
def adicionar_paciente_avaliacao_crm(paciente_id: int, request: Request):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        avaliacao = next((item for item in listar_avaliacoes_crm(conn) if item.pacienteId == int(paciente_id)), None)
        ultima_avaliacao_iso = ""
        if avaliacao and str(avaliacao.dataAvaliacao or "").strip():
            data_avaliacao = parse_data_contrato(str(avaliacao.dataAvaliacao).split(" ")[0])
            ultima_avaliacao_iso = data_avaliacao.isoformat() if data_avaliacao else ""
        crm = upsert_crm_origem(
            conn,
            paciente_id=int(paciente_id),
            marcar_avaliacao=True,
            usuario=usuario_request(request),
            ultima_avaliacao_em=ultima_avaliacao_iso,
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.id=?
            LIMIT 1
            """,
            (int(crm["id"]),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Paciente avaliação",
        info=str(paciente["nome"] or f"Paciente {paciente_id}"),
        metodo_http="POST",
        rota=f"/api/crm/pacientes/{paciente_id}/avaliacao",
    )
    return mapear_crm_paciente_item(row)


@app.post("/api/crm/pacientes/{paciente_id}/avaliacao/remover", response_model=CrmPacienteItemResposta)
def remover_paciente_avaliacao_crm(paciente_id: int, request: Request):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        atual = crm_entry_por_paciente(conn, int(paciente_id))
        if atual is None:
            raise HTTPException(status_code=404, detail="Paciente não encontrado no CRM.")
        conn.execute(
            """
            UPDATE crm_pacientes
            SET origem_avaliacao=0,
                atualizado_por=?,
                atualizado_em=?
            WHERE paciente_id=?
            """,
            (
                usuario_request(request),
                agora_str(),
                int(paciente_id),
            ),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.paciente_id=?
            LIMIT 1
            """,
            (int(paciente_id),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Paciente avaliação removida",
        info=str(paciente["nome"] or f"Paciente {paciente_id}"),
        metodo_http="POST",
        rota=f"/api/crm/pacientes/{paciente_id}/avaliacao/remover",
    )
    return mapear_crm_paciente_item(row)


@app.post("/api/crm/manual", response_model=CrmPacienteItemResposta)
def adicionar_paciente_manual_crm(payload: CrmNovoLeadPayload, request: Request):
    conn = conectar()
    try:
        paciente_id = garantir_paciente_minimo_crm(conn, payload.nome, payload.telefone)
        crm = upsert_crm_origem(
            conn,
            paciente_id=paciente_id,
            usuario=usuario_request(request),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.id=?
            LIMIT 1
            """,
            (int(crm["id"]),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Novo lead manual",
        info=str(payload.nome or "Paciente manual"),
        metodo_http="POST",
        rota="/api/crm/manual",
    )
    return mapear_crm_paciente_item(row)


@app.put("/api/crm/{crm_id}", response_model=CrmPacienteItemResposta)
def atualizar_item_crm(crm_id: int, payload: CrmAtualizacaoPayload, request: Request):
    conn = conectar()
    try:
        atual = conn.execute("SELECT * FROM crm_pacientes WHERE id=? LIMIT 1", (int(crm_id),)).fetchone()
        if atual is None:
            raise HTTPException(status_code=404, detail="Registro de CRM não encontrado.")
        etapa_funil = str(payload.etapa_funil or atual["etapa_funil"] or "Novo lead").strip() or "Novo lead"
        if etapa_funil not in CRM_ETAPAS_PADRAO:
            etapa_funil = "Novo lead"
        conn.execute(
            """
            UPDATE crm_pacientes
            SET etapa_funil=?, canal=?, campanha=?, conjunto_anuncio=?, anuncio=?,
                responsavel=?, proximo_contato=?, observacao=?, ultima_interacao=?,
                atualizado_por=?, atualizado_em=?
            WHERE id=?
            """,
            (
                etapa_funil,
                str(payload.canal or atual["canal"] or "Facebook").strip() or "Facebook",
                str(payload.campanha or "").strip(),
                str(payload.conjunto_anuncio or "").strip(),
                str(payload.anuncio or "").strip(),
                str(payload.responsavel or "").strip(),
                str(payload.proximo_contato or "").strip(),
                str(payload.observacao or "").strip(),
                str(payload.ultima_interacao or "").strip(),
                usuario_request(request),
                agora_str(),
                int(crm_id),
            ),
        )
        conn.commit()
        row = conn.execute(
            """
            SELECT crm.*, p.nome, p.prontuario, p.telefone
            FROM crm_pacientes crm
            JOIN pacientes p ON p.id = crm.paciente_id
            WHERE crm.id=?
            LIMIT 1
            """,
            (int(crm_id),),
        ).fetchone()
    finally:
        conn.close()
    registrar_acao_usuario(
        usuario_request(request),
        acao="CRM",
        tipo="Atualização do funil",
        info=str(row["nome"] or f"CRM {crm_id}"),
        metodo_http="PUT",
        rota=f"/api/crm/{crm_id}",
    )
    return mapear_crm_paciente_item(row)


@app.put("/api/crm/resgates/{contrato_id}", response_model=CrmResgateItemResposta)
def atualizar_resgate_crm(contrato_id: int, payload: CrmResgateAtualizacaoPayload, request: Request):
    conn = conectar()
    try:
        contrato = conn.execute(
            "SELECT * FROM contratos WHERE id=? LIMIT 1",
            (int(contrato_id),),
        ).fetchone()
        if contrato is None:
            raise HTTPException(status_code=404, detail="Orçamento não encontrado para resgate.")
        paciente_id = crm_int(contrato["paciente_id"], 0)
        if paciente_id <= 0:
            raise HTTPException(status_code=400, detail="Paciente inválido no orçamento informado.")
        status = normalizar_status_resgate(payload.status)
        if not status:
            raise HTTPException(status_code=400, detail="Selecione um status válido para o resgate.")
        observacao = str(payload.observacao or "").strip()
        if not observacao:
            raise HTTPException(status_code=400, detail="A observação do contato é obrigatória.")
        data_retorno = validar_data_retorno_crm(payload.proximo_contato)
        if status not in {"Desistente", "Convertido"} and not data_retorno:
            raise HTTPException(status_code=400, detail="Informe a nova data de retorno para continuar o acompanhamento.")
        if status in {"Desistente", "Convertido"}:
            data_retorno = ""
        crm = crm_entry_por_paciente(conn, paciente_id)
        usuario = usuario_request(request)
        atualizar_snapshot_resgate_contrato(
            conn,
            contrato_id=int(contrato_id),
            data_retorno=data_retorno,
            status=status,
            observacao=observacao,
            usuario=usuario,
        )
        registrar_historico_resgate(
            conn,
            crm_id=crm_int(crm["id"], 0) if crm is not None else None,
            paciente_id=paciente_id,
            contrato_id=int(contrato_id),
            status=status,
            observacao=observacao,
            proximo_contato=data_retorno,
            criado_por=usuario,
            automatico=False,
        )
        conn.commit()
        item = next((resgate for resgate in listar_resgates_crm(conn) if resgate.contratoId == int(contrato_id)), None)
        if item is None:
            raise HTTPException(status_code=404, detail="Resgate não encontrado após atualização.")
        return item
    finally:
        conn.close()


@app.put("/api/pacientes/{paciente_id}/recebiveis/{recebivel_id}", response_model=RecebivelResumo)
def atualizar_recebivel_paciente(paciente_id: int, recebivel_id: int, payload: RecebivelAtualizacaoPayload, request: Request):
    conn = conectar()
    try:
        carregar_paciente_por_id(conn, paciente_id)
        atual = carregar_recebivel_paciente(conn, paciente_id, recebivel_id)
        status = (payload.status or atual["status"] or "Aberto").strip() or "Aberto"
        data_pagamento = payload.data_pagamento.strip() if payload.data_pagamento else ""
        if normalizar_texto(status) == "pago" and not data_pagamento:
            data_pagamento = date.today().isoformat()
        if normalizar_texto(status) != "pago":
            data_pagamento = ""

        alteracao_financeira = any((
            payload.vencimento.strip() and payload.vencimento.strip() != str(atual["vencimento"] or "").strip(),
            round(float(payload.valor or 0), 2) != round(float(atual["valor"] or 0), 2),
            payload.forma_pagamento.strip() and payload.forma_pagamento.strip() != str(atual["forma_pagamento"] or "").strip(),
            normalizar_texto(status) != normalizar_texto(atual["status"]),
            data_pagamento != str(atual["data_pagamento"] or "").strip(),
        ))
        if alteracao_financeira and (
            data_financeira_retroativa(atual["vencimento"])
            or data_financeira_retroativa(payload.vencimento)
            or data_financeira_retroativa(data_pagamento)
        ):
            validar_senha_administrativa_clinica(conn, payload.senha_administrativa)

        conn.execute(
            """
            UPDATE recebiveis
            SET paciente_nome=?, prontuario=?, vencimento=?, valor=?, forma_pagamento=?, status=?, data_pagamento=?, observacao=?
            WHERE id=? AND paciente_id=?
            """,
            (
                payload.paciente_nome.strip() or str(atual["paciente_nome"] or ""),
                payload.prontuario.strip() or str(atual["prontuario"] or ""),
                payload.vencimento.strip() or str(atual["vencimento"] or ""),
                float(payload.valor or 0),
                payload.forma_pagamento.strip() or str(atual["forma_pagamento"] or ""),
                status,
                data_pagamento,
                payload.observacao.strip(),
                recebivel_id,
                paciente_id,
            ),
        )
        observacao_cobranca = str(payload.observacao_cobranca or "").strip()
        if payload.cobranca_realizada or observacao_cobranca:
            registrar_historico_cobranca_recebivel(
                conn,
                recebivel_id=recebivel_id,
                paciente_id=paciente_id,
                status="Cobrado" if payload.cobranca_realizada else "Contato",
                observacao=observacao_cobranca or payload.observacao.strip(),
                cobrado=bool(payload.cobranca_realizada),
                criado_por=usuario_request(request),
            )
        conn.commit()
        atualizado = carregar_recebivel_paciente(conn, paciente_id, recebivel_id)
        return mapear_recebivel(
            atualizado,
            carregar_historico_cobranca_recebiveis(conn, [recebivel_id]).get(recebivel_id, []),
        )
    finally:
        conn.close()


@app.put("/api/financeiro/recebiveis/lote/{lote_id}")
def atualizar_recebiveis_lote(lote_id: str, payload: RecebivelLotePayload, request: Request):
    conn = conectar()
    try:
        recebiveis_lote, _contrato_id = carregar_recebiveis_lote_generico(
            conn, lote_id, payload.paciente_id, payload.paciente_nome, payload.prontuario
        )
        tem_data_retroativa = any(data_financeira_retroativa(row["vencimento"]) for row in recebiveis_lote)
        tem_nova_data_retroativa = any(data_financeira_retroativa(item.vencimento) for item in payload.novas_parcelas)
        if tem_data_retroativa or tem_nova_data_retroativa or data_financeira_retroativa(payload.primeiro_vencimento):
            validar_senha_administrativa_clinica(conn, payload.senha_administrativa)
        if payload.suspender_anteriores and not payload.novas_parcelas:
            suspender_recebiveis_lote_generico(
                conn,
                lote_id=lote_id,
                paciente_id=payload.paciente_id,
                paciente_nome=payload.paciente_nome,
                prontuario=payload.prontuario,
                observacao_renegociacao=payload.observacao_renegociacao or payload.observacao,
                criado_por=usuario_request(request),
            )
            conn.commit()
            return {"ok": True}
        if payload.novas_parcelas:
            renegociar_recebiveis_lote_generico(
                conn,
                lote_id=lote_id,
                paciente_id=payload.paciente_id,
                paciente_nome=payload.paciente_nome,
                prontuario=payload.prontuario,
                novas_parcelas=payload.novas_parcelas,
                observacao_renegociacao=payload.observacao_renegociacao or payload.observacao,
                criado_por=usuario_request(request),
            )
            conn.commit()
            return {"ok": True}
        atualizar_recebiveis_lote_generico(
            conn,
            lote_id=lote_id,
            paciente_id=payload.paciente_id,
            paciente_nome=payload.paciente_nome,
            prontuario=payload.prontuario,
            forma_pagamento=payload.forma_pagamento,
            status=payload.status,
            observacao=payload.observacao,
            primeiro_vencimento=payload.primeiro_vencimento,
        )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.post("/api/pacientes/{paciente_id}/recebiveis/{recebivel_id}/baixar", response_model=RecebivelResumo)
def baixar_recebivel_paciente(paciente_id: int, recebivel_id: int, payload: BaixaRecebivelPayload, request: Request):
    conn = conectar()
    try:
        carregar_paciente_por_id(conn, paciente_id)
        if data_financeira_retroativa(payload.data_pagamento):
            validar_senha_administrativa_clinica(conn, payload.senha_administrativa)
        atualizado = baixar_recebivel_no_caixa(
            conn,
            paciente_id=paciente_id,
            recebivel_id=recebivel_id,
            data_pagamento=payload.data_pagamento or date.today().isoformat(),
            forma_pagamento=payload.forma_pagamento,
            conta_caixa=payload.conta_caixa,
            desconto_valor=payload.desconto_valor,
            observacao=payload.observacao,
        )
        registrar_historico_cobranca_recebivel(
            conn,
            recebivel_id=recebivel_id,
            paciente_id=paciente_id,
            status="Pago",
            observacao=str(payload.observacao or "").strip() or "Recebível baixado no caixa.",
            cobrado=True,
            criado_por=usuario_request(request),
        )
        conn.commit()
        return mapear_recebivel(
            atualizado,
            carregar_historico_cobranca_recebiveis(conn, [recebivel_id]).get(recebivel_id, []),
        )
    finally:
        conn.close()


@app.get("/api/pacientes/{paciente_id}/odontograma", response_model=OdontogramaResposta)
@app.get("/paciente/{paciente_id}/odontograma", response_model=OdontogramaResposta)
def odontograma_paciente(paciente_id: int):
    conn = conectar()
    try:
        carregar_paciente_por_id(conn, paciente_id)
        return OdontogramaResposta(
            dentes_contratados=carregar_dentes_contratados(conn, paciente_id),
            elementos=carregar_elementos_odontograma(conn, paciente_id),
        )
    finally:
        conn.close()


@app.get("/api/financeiro/painel", response_model=FinanceiroPainelResposta)
def painel_financeiro():
    conn = conectar()
    try:
        recebiveis_rows = carregar_recebiveis_financeiro(conn)
        caixa_rows = carregar_caixa_financeiro(conn)
        contas_rows = carregar_contas_pagar_financeiro(conn)
        saldos_rows = carregar_saldos_conta_financeiro(conn)
        historico_por_recebivel = carregar_historico_cobranca_recebiveis(
            conn,
            [int(row["id"] or 0) for row in recebiveis_rows],
        )
        return FinanceiroPainelResposta(
            resumo=resumo_financeiro_global(recebiveis_rows),
            recebiveis=[
                mapear_recebivel(row, historico_por_recebivel.get(int(row["id"] or 0), []))
                for row in recebiveis_rows
            ],
            caixa=[mapear_movimento_caixa(row) for row in caixa_rows],
            contasPagar=[mapear_conta_pagar(row) for row in contas_rows],
            saldosConta=[mapear_saldo_conta(row) for row in saldos_rows],
        )
    finally:
        conn.close()


def _comissao_forma(forma: str) -> float:
    texto = normalizar_texto(forma).replace("_", " ")
    if "pix" in texto or "dinheiro" in texto:
        return 0.01
    if "cartao" in texto or "credito" in texto or "debito" in texto:
        return 0.006
    if "boleto" in texto:
        return 0.004
    return 0.0


def _calcular_comissao_contrato(row: sqlite3.Row, valor_base: float | None = None) -> float:
    valor_total = float(valor_base if valor_base is not None else row["valor_total"] or 0)
    try:
        plano = json.loads(str(row["plano_pagamento_json"] or "[]"))
    except (TypeError, ValueError, json.JSONDecodeError):
        plano = []
    partes = [(float(item.get("valor", 0) or 0), str(item.get("forma", "") or "")) for item in plano if isinstance(item, dict)]
    soma = sum(valor for valor, _ in partes)
    if partes and soma > 0:
        fator = valor_total / soma
        return round(sum(valor * fator * _comissao_forma(forma) for valor, forma in partes), 2)
    return round(valor_total * _comissao_forma(str(row["forma_pagamento"] or "")), 2)


def carregar_relatorio_comissoes(conn: sqlite3.Connection, inicio: date, fim: date) -> ComissaoRelatorioResposta:
    contratos = conn.execute(
        """
        SELECT c.*, p.nome AS paciente_nome
        FROM contratos c LEFT JOIN pacientes p ON p.id=c.paciente_id
        WHERE lower(COALESCE(c.status, '')) IN ('aprovado', 'aprovada', 'convertido')
        """
    ).fetchall()
    agenda = conn.execute(
        """
        SELECT a.*, COALESCE(GROUP_CONCAT(ap.procedimento_nome_snapshot, ', '), a.procedimento, '') AS procedimentos_lista
        FROM agendamentos a
        LEFT JOIN agendamento_procedimentos ap ON ap.agendamento_id=a.id
        GROUP BY a.id ORDER BY a.data, a.hora_inicio, a.id
        """
    ).fetchall()
    por_paciente: dict[int, list[sqlite3.Row]] = {}
    for agendamento in agenda:
        paciente_id = crm_int(agendamento["paciente_id"])
        if paciente_id > 0:
            por_paciente.setdefault(paciente_id, []).append(agendamento)

    def compareceu(item: sqlite3.Row) -> bool:
        return normalizar_texto(item["status"]) in {"atendido", "em atendimento"}

    def avaliacao(item: sqlite3.Row) -> bool:
        return normalizar_texto(item["profissional"]) == "avaliacao"

    def agendador(item: sqlite3.Row | None) -> str:
        if item is None:
            return "Não localizado"
        return str(item["criado_por"] or item["status_usuario"] or "Não registrado").strip()

    vendas: list[ComissaoVendaItemResposta] = []
    avaliacoes_elegiveis_ids: set[int] = set()
    for contrato in contratos:
        if contrato_eh_permuta(contrato):
            continue
        if not bool(int(contrato["incluir_total_vendido"] or 0)):
            continue
        fechamento = parse_data_contrato(str(contrato["data_aprovacao"] or "")) or parse_data_contrato(str(contrato["data_criacao"] or ""))
        if not fechamento or fechamento < inicio or fechamento > fim:
            continue
        paciente_id = crm_int(contrato["paciente_id"])
        registros = por_paciente.get(paciente_id, [])
        primeiro = registros[0] if registros else None
        avaliacoes_paciente = [
            item for item in registros
            if avaliacao(item)
            and compareceu(item)
            and (parse_data_contrato(str(item["data"] or "")) or date.max) <= fechamento
        ]
        avaliacao_comparecida = avaliacoes_paciente[0] if avaliacoes_paciente else None
        # Comissão só existe para a interseção: compareceu à avaliação e fechou contrato.
        if avaliacao_comparecida is None:
            continue
        avaliacoes_elegiveis_ids.add(crm_int(avaliacao_comparecida["id"]))
        no_fechamento = [item for item in registros if parse_data_contrato(str(item["data"] or "")) == fechamento and normalizar_texto(item["status"]) not in {"cancelado", "desmarcado"}]
        preferidos = [item for item in no_fechamento if avaliacao(item) and compareceu(item)] or [item for item in no_fechamento if compareceu(item)] or no_fechamento
        fechamento_agenda = preferidos[0] if preferidos else None
        captacao = agendador(avaliacao_comparecida)
        resgate = agendador(fechamento_agenda)
        pago = bool(str(contrato["data_pagamento_entrada"] or "").strip()) or bool(conn.execute(
            "SELECT 1 FROM recebiveis WHERE contrato_id=? AND lower(COALESCE(status,''))='pago' LIMIT 1", (contrato["id"],)
        ).fetchone())
        valor_venda = float(contrato["valor_venda_considerado"] if contrato["valor_venda_considerado"] is not None else contrato["valor_total"] or 0)
        total = _calcular_comissao_contrato(contrato, valor_venda) if pago else 0.0
        dados_ausentes = primeiro is None or fechamento_agenda is None
        mesma_pessoa = normalizar_texto(captacao) == normalizar_texto(resgate) and captacao not in {"Não localizado", "Não registrado"}
        vendas.append(ComissaoVendaItemResposta(
            contratoId=crm_int(contrato["id"]), pacienteId=paciente_id or None,
            paciente=str(contrato["paciente_nome"] or f"Paciente #{paciente_id}"), dataFechamento=formatar_data_br(fechamento),
            valorContrato=round(valor_venda, 2), formaPagamento=str(contrato["forma_pagamento"] or ""),
            primeiroAgendamento=formatar_data_br(parse_data_contrato(str(primeiro["data"] or ""))) if primeiro else "",
            primeiroAgendador=agendador(primeiro),
            avaliacaoComparecida=formatar_data_br(parse_data_contrato(str(avaliacao_comparecida["data"] or ""))) if avaliacao_comparecida else "",
            agendadorAvaliacao=captacao, agendadorFechamento=resgate, pagamentoConfirmado=pago,
            comissaoTotal=total, comissaoCaptacao=total if mesma_pessoa else round(total * .30, 2),
            comissaoResgate=0 if mesma_pessoa else round(total * .70, 2),
            status="Revisar dados ausentes" if dados_ausentes else ("Aguardando confirmação do pagamento" if not pago else "Completo"),
        ))

    avaliacoes_periodo = []
    for item in agenda:
        data_item = parse_data_contrato(str(item["data"] or ""))
        if crm_int(item["id"]) not in avaliacoes_elegiveis_ids:
            continue
        avaliacoes_periodo.append(ComissaoAvaliacaoItemResposta(
            agendamentoId=crm_int(item["id"]), pacienteId=crm_int(item["paciente_id"]) or None,
            paciente=str(item["paciente_nome"] or item["nome_paciente_snapshot"] or ""), data=formatar_data_br(data_item),
            hora=str(item["hora_inicio"] or ""), status=str(item["status"] or ""), agendadoPor=agendador(item),
            agendadoEm=str(item["data_agendamento"] or item["data_criacao"] or item["criado_em"] or ""),
            procedimentos=str(item["procedimentos_lista"] or ""),
        ))
    return ComissaoRelatorioResposta(
        inicio=inicio.isoformat(), fim=fim.isoformat(), vendas=vendas, avaliacoes=avaliacoes_periodo,
        totalVendido=round(sum(item.valorContrato for item in vendas), 2), totalComissao=round(sum(item.comissaoTotal for item in vendas), 2),
    )


@app.get("/api/relatorios/comissoes", response_model=ComissaoRelatorioResposta)
def relatorio_comissoes(inicio: date = Query(...), fim: date = Query(...)):
    if fim < inicio:
        raise HTTPException(status_code=400, detail="Período inválido.")
    conn = conectar()
    try:
        return carregar_relatorio_comissoes(conn, inicio, fim)
    finally:
        conn.close()


@app.get("/api/relatorios/comissoes/export.xlsx")
def exportar_relatorio_comissoes(inicio: date = Query(...), fim: date = Query(...)):
    if Workbook is None:
        raise HTTPException(status_code=503, detail="Exportação Excel indisponível.")
    conn = conectar()
    try:
        relatorio = carregar_relatorio_comissoes(conn, inicio, fim)
    finally:
        conn.close()
    wb = Workbook()
    ws = wb.active
    ws.title = "Vendas e comissões"
    cabecalho = ["Contrato", "Paciente", "Fechamento", "Valor", "Pagamento", "Primeiro agendamento", "Quem agendou primeiro", "Avaliação comparecida", "Quem agendou a avaliação", "Quem agendou no fechamento", "Pagamento confirmado", "Comissão total", "Captação 30%", "Resgate 70%", "Status"]
    ws.append(cabecalho)
    for item in relatorio.vendas:
        ws.append([str(item.contratoId), item.paciente, item.dataFechamento, item.valorContrato, item.formaPagamento, item.primeiroAgendamento, item.primeiroAgendador, item.avaliacaoComparecida, item.agendadorAvaliacao, item.agendadorFechamento, "Sim" if item.pagamentoConfirmado else "Não", item.comissaoTotal, item.comissaoCaptacao, item.comissaoResgate, item.status])
    av = wb.create_sheet("Avaliações comparecidas")
    av.append(["Agendamento", "Paciente", "Data", "Hora", "Status", "Quem agendou esta avaliação", "Agendado em", "Procedimentos"])
    for item in relatorio.avaliacoes:
        av.append([str(item.agendamentoId), item.paciente, item.data, item.hora, item.status, item.agendadoPor, item.agendadoEm, item.procedimentos])
    for planilha in (ws, av):
        for cell in planilha[1]:
            cell.font = Font(bold=True, color="FFFFFF")
            cell.fill = PatternFill("solid", fgColor="183B56")
        planilha.freeze_panes = "A2"
        planilha.auto_filter.ref = planilha.dimensions
        for coluna in planilha.columns:
            letra = coluna[0].column_letter
            planilha.column_dimensions[letra].width = min(38, max(12, max(len(str(c.value or "")) for c in coluna) + 2))
    for linha in range(2, ws.max_row + 1):
        for coluna in (4, 12, 13, 14):
            ws.cell(linha, coluna).number_format = 'R$ #,##0.00'
    buffer = BytesIO()
    wb.save(buffer)
    nome = f"relatorio-comissoes-{inicio.isoformat()}-a-{fim.isoformat()}.xlsx"
    return Response(buffer.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f'attachment; filename="{nome}"'})


@app.get("/api/dashboard", response_model=DashboardPainelResposta)
def painel_dashboard():
    conn = conectar()
    try:
        return dados_dashboard(conn)
    finally:
        conn.close()


@app.get("/api/financeiro/metas", response_model=list[MetaMensalResumo])
def listar_metas_financeiras(ano: int = Query(default_factory=lambda: date.today().year)):
    conn = conectar()
    try:
        return carregar_metas_mensais(conn, ano)
    finally:
        conn.close()


@app.put("/api/financeiro/metas/{ano}/{mes}", response_model=MetaMensalResumo)
def atualizar_meta_financeira(ano: int, mes: int, payload: MetaMensalPayload):
    if mes < 1 or mes > 12:
        raise HTTPException(status_code=400, detail="Mes invalido.")
    conn = conectar()
    try:
        carregar_metas_mensais(conn, ano)
        conn.execute(
            """
            UPDATE metas_mensais
            SET meta=?, supermeta=?, hipermeta=?, data_atualizacao=?
            WHERE ano=? AND mes=?
            """,
            (
                float(payload.meta or 0),
                float(payload.supermeta or 0),
                float(payload.hipermeta or 0),
                agora_str(),
                int(ano),
                int(mes),
            ),
        )
        conn.commit()
        return obter_meta_mensal(conn, ano, mes)
    finally:
        conn.close()


@app.get("/api/financeiro/notas-fiscais", response_model=list[NotaFiscalEmitidaResumo])
def listar_notas_fiscais_emitidas():
    conn = conectar()
    try:
        return [mapear_nota_fiscal_emitida(row) for row in carregar_notas_fiscais_emitidas(conn)]
    finally:
        conn.close()


@app.post("/api/financeiro/notas-fiscais", response_model=NotaFiscalEmitidaResumo)
def criar_nota_fiscal_emitida(payload: NotaFiscalEmitidaPayload):
    conn = conectar()
    try:
        cursor = conn.execute(
            """
            INSERT INTO notas_fiscais_emitidas (
                competencia, data_emissao, data_recebimento, numero_nf, serie, cliente,
                descricao, conta_destino, valor_nf, valor_recebido, status, observacao,
                criado_em, atualizado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.competencia.strip(),
                payload.data_emissao.strip(),
                payload.data_recebimento.strip(),
                payload.numero_nf.strip(),
                payload.serie.strip(),
                payload.cliente.strip(),
                payload.descricao.strip(),
                payload.conta_destino.strip(),
                float(payload.valor_nf or 0),
                float(payload.valor_recebido or 0),
                payload.status.strip() or "Pendente",
                payload.observacao.strip(),
                agora_str(),
                agora_str(),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM notas_fiscais_emitidas WHERE id=?", (int(cursor.lastrowid),)).fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Falha ao salvar nota fiscal.")
        return mapear_nota_fiscal_emitida(row)
    finally:
        conn.close()


@app.put("/api/financeiro/notas-fiscais/{nota_id}", response_model=NotaFiscalEmitidaResumo)
def atualizar_nota_fiscal_emitida(nota_id: int, payload: NotaFiscalEmitidaPayload):
    conn = conectar()
    try:
        row = conn.execute("SELECT * FROM notas_fiscais_emitidas WHERE id=?", (nota_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Nota fiscal nao encontrada.")
        conn.execute(
            """
            UPDATE notas_fiscais_emitidas
            SET competencia=?, data_emissao=?, data_recebimento=?, numero_nf=?, serie=?, cliente=?,
                descricao=?, conta_destino=?, valor_nf=?, valor_recebido=?, status=?, observacao=?, atualizado_em=?
            WHERE id=?
            """,
            (
                payload.competencia.strip(),
                payload.data_emissao.strip(),
                payload.data_recebimento.strip(),
                payload.numero_nf.strip(),
                payload.serie.strip(),
                payload.cliente.strip(),
                payload.descricao.strip(),
                payload.conta_destino.strip(),
                float(payload.valor_nf or 0),
                float(payload.valor_recebido or 0),
                payload.status.strip() or "Pendente",
                payload.observacao.strip(),
                agora_str(),
                int(nota_id),
            ),
        )
        conn.commit()
        atualizado = conn.execute("SELECT * FROM notas_fiscais_emitidas WHERE id=?", (nota_id,)).fetchone()
        if atualizado is None:
            raise HTTPException(status_code=500, detail="Falha ao atualizar nota fiscal.")
        return mapear_nota_fiscal_emitida(atualizado)
    finally:
        conn.close()


@app.post("/api/financeiro/contas-pagar", response_model=ContaPagarResumo)
def criar_conta_pagar(payload: ContaPagarPayload):
    conn = conectar()
    try:
        status = payload.status.strip() or ("Pago" if payload.pago_em.strip() else "A vencer")
        cursor = conn.execute(
            """
            INSERT INTO contas_pagar (
                data_vencimento, descricao, fornecedor, categoria, valor, pago, valor_pago, status, observacao, data_criacao
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.vencimento.strip(),
                payload.descricao.strip(),
                payload.fornecedor.strip(),
                payload.categoria.strip(),
                float(payload.valor or 0),
                payload.pago_em.strip(),
                float(payload.valor_pago or 0),
                status,
                payload.observacao.strip(),
                agora_str(),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM contas_pagar WHERE id=?", (int(cursor.lastrowid),)).fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Falha ao criar conta a pagar.")
        return mapear_conta_pagar(row)
    finally:
        conn.close()


@app.post("/api/financeiro/caixa", response_model=MovimentoCaixaResumo)
def criar_movimento_caixa(payload: MovimentoCaixaPayload):
    conn = conectar()
    try:
        data_movimento = payload.data_movimento.strip() or date.today().isoformat()
        movimento_id = registrar_movimento_caixa(
            conn,
            origem=payload.origem,
            descricao=payload.descricao,
            valor=payload.valor,
            tipo=payload.tipo or "Entrada",
            data_movimento=data_movimento,
            prontuario=payload.prontuario,
            forma_pagamento=payload.forma_pagamento,
            conta_caixa=payload.conta_caixa,
            observacao=payload.observacao,
            contrato_id=payload.contrato_id,
            recebivel_id=payload.recebivel_id,
        )
        conn.commit()
        row = conn.execute("SELECT * FROM financeiro WHERE id=?", (movimento_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Falha ao registrar movimento de caixa.")
        return mapear_movimento_caixa(row)
    finally:
        conn.close()


@app.put("/api/financeiro/caixa/{movimento_id}", response_model=MovimentoCaixaResumo)
def atualizar_movimento_caixa(movimento_id: int, payload: MovimentoCaixaAtualizacaoPayload):
    conn = conectar()
    try:
        row = conn.execute("SELECT * FROM financeiro WHERE id=?", (movimento_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Movimento de caixa nao encontrado.")
        conn.execute(
            """
            UPDATE financeiro
            SET origem=?, descricao=?, valor=?, data=?, tipo=?, prontuario=?, forma_pagamento=?, conta_caixa=?, observacao=?
            WHERE id=?
            """,
            (
                payload.origem.strip() or str(row["origem"] or ""),
                payload.descricao.strip() or str(row["descricao"] or ""),
                float(payload.valor or row["valor"] or 0),
                payload.data_movimento.strip() or str(row["data"] or ""),
                payload.tipo.strip() or str(row["tipo"] or ""),
                payload.prontuario.strip() or str(row["prontuario"] or ""),
                payload.forma_pagamento.strip() or str(row["forma_pagamento"] or ""),
                payload.conta_caixa.strip() or str(row["conta_caixa"] or ""),
                payload.observacao.strip() or str(row["observacao"] or ""),
                movimento_id,
            ),
        )
        conn.commit()
        atualizado = conn.execute("SELECT * FROM financeiro WHERE id=?", (movimento_id,)).fetchone()
        if atualizado is None:
            raise HTTPException(status_code=500, detail="Falha ao atualizar movimento.")
        return mapear_movimento_caixa(atualizado)
    finally:
        conn.close()


@app.delete("/api/financeiro/caixa/{movimento_id}")
def excluir_movimento_caixa(movimento_id: int):
    conn = conectar()
    try:
        row = conn.execute("SELECT * FROM financeiro WHERE id=?", (movimento_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Movimento de caixa nao encontrado.")
        recebivel_id = int(row["recebivel_id"]) if row["recebivel_id"] is not None else None
        conn.execute("DELETE FROM financeiro WHERE id=?", (movimento_id,))
        if recebivel_id is not None:
            conn.execute(
                """
                UPDATE recebiveis
                SET status='Aberto', data_pagamento=NULL
                WHERE id=?
                """,
                (recebivel_id,),
            )
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.post("/api/financeiro/saldos-conta", response_model=SaldoContaResumo)
def criar_saldo_conta(payload: SaldoContaPayload):
    conn = conectar()
    try:
        saldo_id = registrar_saldo_conta(
            conn,
            data_saldo=payload.data,
            conta=payload.conta,
            saldo=payload.saldo,
            observacao=payload.observacao,
        )
        conn.commit()
        row = conn.execute("SELECT * FROM saldos_conta WHERE id=?", (saldo_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Falha ao registrar saldo.")
        return mapear_saldo_conta(row)
    finally:
        conn.close()


@app.get("/api/financeiro/caixa/export.xlsx")
def exportar_caixa_excel():
    conn = conectar()
    try:
        caixa_rows = carregar_caixa_financeiro(conn)
        conteudo = caixa_diario_para_excel_bytes(conn, caixa_rows)
        if not conteudo:
            raise HTTPException(status_code=400, detail="Nao ha dados de caixa para exportar.")
        nome = f"caixa_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return Response(
            content=conteudo,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{nome}"'},
        )
    finally:
        conn.close()


@app.get("/api/financeiro/recibos", response_model=list[ReciboManualResumo])
def listar_recibos_manuais():
    conn = conectar()
    try:
        rows = conn.execute("SELECT * FROM recibos_manuais ORDER BY date(COALESCE(data_pagamento, '')) DESC, id DESC").fetchall()
        return [mapear_recibo_manual(row) for row in rows]
    finally:
        conn.close()


@app.post("/api/financeiro/recibos", response_model=ReciboManualResumo)
def criar_recibo_manual(payload: ReciboManualPayload):
    conn = conectar()
    try:
        numero = proximo_numero_recibo_manual(conn)
        cursor = conn.execute(
            """
            INSERT INTO recibos_manuais (
                numero, valor, pagador, recebedor, data_pagamento, referente, observacao, cidade, criado_em
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                numero,
                float(payload.valor or 0),
                payload.pagador.strip(),
                payload.recebedor.strip(),
                payload.data_pagamento.strip(),
                payload.referente.strip(),
                payload.observacao.strip(),
                payload.cidade.strip(),
                agora_str(),
            ),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM recibos_manuais WHERE id=?", (cursor.lastrowid,)).fetchone()
        if row is None:
            raise HTTPException(status_code=500, detail="Falha ao salvar recibo.")
        return mapear_recibo_manual(row)
    finally:
        conn.close()


@app.get("/api/financeiro/recibos/{recibo_id}")
def abrir_recibo_manual(recibo_id: int):
    conn = conectar()
    try:
        row = garantir_numero_recibo_manual(conn, recibo_id)
        if row is None:
            raise HTTPException(status_code=404, detail="Recibo nao encontrado.")
        html = gerar_html_recibo_manual(row)
        return Response(content=html, media_type="text/html; charset=utf-8")
    finally:
        conn.close()


@app.get("/api/sistema/export.xlsx")
def exportar_sistema_excel():
    conn = conectar()
    try:
        conteudo = exportar_todas_tabelas_excel_bytes(conn)
        nome = f"sistema_completo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
        return Response(
            content=conteudo,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{nome}"'},
        )
    finally:
        conn.close()


@app.put("/api/financeiro/contas-pagar/{conta_id}", response_model=ContaPagarResumo)
def atualizar_conta_pagar(conta_id: int, payload: ContaPagarPayload):
    conn = conectar()
    try:
        row = conn.execute("SELECT * FROM contas_pagar WHERE id=?", (conta_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Conta a pagar nao encontrada.")
        status = payload.status.strip() or ("Pago" if payload.pago_em.strip() else str(row["status"] or "A vencer"))
        conn.execute(
            """
            UPDATE contas_pagar
            SET data_vencimento=?, descricao=?, fornecedor=?, categoria=?, valor=?, pago=?, valor_pago=?, status=?, observacao=?
            WHERE id=?
            """,
            (
                payload.vencimento.strip(),
                payload.descricao.strip(),
                payload.fornecedor.strip(),
                payload.categoria.strip(),
                float(payload.valor or 0),
                payload.pago_em.strip(),
                float(payload.valor_pago or 0),
                status,
                payload.observacao.strip(),
                conta_id,
            ),
        )
        conn.commit()
        atualizado = conn.execute("SELECT * FROM contas_pagar WHERE id=?", (conta_id,)).fetchone()
        if atualizado is None:
            raise HTTPException(status_code=500, detail="Falha ao atualizar conta a pagar.")
        return mapear_conta_pagar(atualizado)
    finally:
        conn.close()


@app.post("/api/financeiro/contas-pagar/{conta_id}/baixar", response_model=ContaPagarResumo)
def baixar_conta_pagar(conta_id: int, payload: BaixaRecebivelPayload):
    conn = conectar()
    try:
        row = conn.execute("SELECT * FROM contas_pagar WHERE id=?", (conta_id,)).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Conta a pagar nao encontrada.")
        if normalizar_texto(row["status"]) == "pago":
            raise HTTPException(status_code=400, detail="Esta conta a pagar ja esta paga.")

        data_ref = parse_data_contrato(payload.data_pagamento) or date.today()
        data_iso = data_ref.isoformat()
        data_br = formatar_data_br(data_ref)
        valor_pago = float(row["valor"] or 0)
        forma = payload.forma_pagamento.strip() or "PIX"
        conta_caixa = payload.conta_caixa.strip() or forma

        registrar_movimento_caixa(
            conn,
            origem=str(row["fornecedor"] or "Pagamento"),
            descricao=str(row["descricao"] or "Conta a pagar"),
            valor=valor_pago,
            tipo="Saida",
            data_movimento=data_iso,
            forma_pagamento=forma,
            conta_caixa=conta_caixa,
            observacao=payload.observacao.strip(),
        )

        observacao_atual = str(row["observacao"] or "").strip()
        observacao_final = " | ".join(parte for parte in [observacao_atual, payload.observacao.strip()] if parte)
        conn.execute(
            """
            UPDATE contas_pagar
            SET pago=?, valor_pago=?, status='Pago', observacao=?
            WHERE id=?
            """,
            (data_br, valor_pago, observacao_final, conta_id),
        )
        conn.commit()
        atualizado = conn.execute("SELECT * FROM contas_pagar WHERE id=?", (conta_id,)).fetchone()
        if atualizado is None:
            raise HTTPException(status_code=500, detail="Falha ao baixar conta a pagar.")
        return mapear_conta_pagar(atualizado)
    finally:
        conn.close()


@app.get("/api/pacientes/{paciente_id}/documentos/{nome_arquivo}")
def abrir_documento_paciente(paciente_id: int, nome_arquivo: str, download: int = Query(default=0)):
    conn = conectar()
    try:
        paciente_row = carregar_paciente_por_id(conn, paciente_id)
        try:
            # Entrega exatamente a versão escolhida. Só gera a versão atual
            # quando o arquivo solicitado ainda não existe.
            caminho = buscar_documento_paciente(paciente_row, nome_arquivo)
        except HTTPException as exc:
            if exc.status_code != 404:
                raise
            caminho = resolver_documento_contrato_atual(conn, paciente_row, nome_arquivo)
            if not caminho:
                raise
        media_type = None
        extensao = os.path.splitext(caminho)[1].lower()
        if extensao == ".html":
            media_type = "text/html; charset=utf-8"
        elif extensao == ".pdf":
            media_type = "application/pdf"
        elif extensao == ".docx":
            media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        return FileResponse(
            path=caminho,
            filename=os.path.basename(caminho),
            media_type=media_type,
            content_disposition_type="attachment" if int(download or 0) else "inline",
        )
    finally:
        conn.close()


@app.post("/api/pacientes/{paciente_id}/documentos/recebimento-boletos", response_model=ArquivoPacienteItem)
def gerar_recebimento_boletos_paciente(paciente_id: int, payload: RecebimentoBoletosPayload):
    conn = conectar()
    try:
        paciente_row = carregar_paciente_por_id(conn, paciente_id)
        return gerar_documento_recebimento_boletos(paciente_row, payload.imagens)
    finally:
        conn.close()


@app.get("/api/pacientes/{paciente_id}/recibos/{recebivel_id}")
def abrir_recibo_paciente(paciente_id: int, recebivel_id: int):
    conn = conectar()
    try:
        carregar_paciente_por_id(conn, paciente_id)
        recebivel = carregar_recebivel_paciente(conn, paciente_id, recebivel_id)
        if normalizar_texto(recebivel["status"]) != "pago":
            raise HTTPException(status_code=400, detail="O recibo so pode ser emitido para recebiveis pagos.")
        forma = normalizar_texto(str(recebivel["forma_pagamento"] or ""))
        if forma != "dinheiro":
            raise HTTPException(status_code=400, detail="O recibo desta tela esta disponivel apenas para pagamentos em especie.")
        html = gerar_html_recibo_especie(recebivel)
        return Response(content=html, media_type="text/html; charset=utf-8")
    finally:
        conn.close()


@app.get("/api/pacientes/{paciente_id}/exames/{nome_arquivo}")
def abrir_exame_paciente(paciente_id: int, nome_arquivo: str, download: int = Query(default=0)):
    conn = conectar()
    try:
        paciente_row = carregar_paciente_por_id(conn, paciente_id)
        caminho = buscar_exame_paciente(paciente_row, nome_arquivo)
        return FileResponse(
            path=caminho,
            filename=os.path.basename(caminho),
            content_disposition_type="attachment" if int(download or 0) else "inline",
        )
    finally:
        conn.close()


@app.get("/api/pacientes/{paciente_id}/foto")
def abrir_foto_paciente(paciente_id: int):
    conn = conectar()
    try:
        paciente_row = carregar_paciente_por_id(conn, paciente_id)
        caminho = buscar_foto_paciente(paciente_row)
        extensao = os.path.splitext(caminho)[1].lower()
        media_type = "image/jpeg"
        if extensao == ".png":
            media_type = "image/png"
        elif extensao == ".webp":
            media_type = "image/webp"
        return FileResponse(
            path=caminho,
            filename=os.path.basename(caminho),
            media_type=media_type,
            content_disposition_type="inline",
        )
    finally:
        conn.close()


@app.post("/api/pacientes/{paciente_id}/foto", response_model=PacienteDetalhe)
async def enviar_foto_paciente(paciente_id: int, request: Request):
    conn = conectar()
    try:
        paciente_row = carregar_paciente_por_id(conn, paciente_id)
        nome_arquivo = request.headers.get("x-filename", "foto.jpg")
        extensao = os.path.splitext(nome_arquivo)[1].lower()
        if extensao not in {".png", ".jpg", ".jpeg", ".webp"}:
            raise HTTPException(status_code=400, detail="Formato de foto invalido.")

        pasta = pasta_fotos_paciente(paciente_row)
        caminho = os.path.join(pasta, f"foto{extensao}")
        conteudo = await request.body()
        if not conteudo:
            raise HTTPException(status_code=400, detail="Arquivo de foto vazio.")
        with open(caminho, "wb") as destino:
            destino.write(conteudo)

        conn.execute("UPDATE pacientes SET foto_path=? WHERE id=?", (caminho, paciente_id))
        conn.commit()
        atualizado = carregar_paciente_por_id(conn, paciente_id)
        return mapear_paciente_detalhe(atualizado)
    finally:
        conn.close()


@app.post("/api/pacientes", response_model=PacienteDetalhe)
def criar_paciente(payload: PacientePayload):
    conn = conectar()
    try:
        prontuario = formatar_prontuario_valor(payload.prontuario) or proximo_prontuario(conn)
        erros = validar_dados_paciente(
            payload.nome,
            prontuario,
            payload.cpf,
            payload.menor_idade,
            payload.responsavel,
            payload.cpf_responsavel,
        )
        if erros:
            raise HTTPException(status_code=400, detail=erros)
        erros_duplicidade = validar_duplicidade_paciente(conn, prontuario, payload.cpf)
        if erros_duplicidade:
            raise HTTPException(status_code=400, detail=erros_duplicidade)

        cursor = conn.execute(
            """
            INSERT INTO pacientes (
                nome, apelido, sexo, prontuario, cpf, rg, data_nascimento, telefone, email, cep,
                endereco, complemento, numero, bairro, cidade, estado, estado_civil, profissao, origem, observacoes,
                menor_idade, responsavel, cpf_responsavel, criado_em
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.nome.strip(),
                payload.apelido.strip(),
                payload.sexo.strip(),
                prontuario,
                limpar_cpf(payload.cpf),
                payload.rg.strip(),
                payload.data_nascimento.strip(),
                payload.telefone.strip(),
                payload.email.strip(),
                payload.cep.strip(),
                payload.endereco.strip(),
                payload.complemento.strip(),
                payload.numero.strip(),
                payload.bairro.strip(),
                payload.cidade.strip(),
                payload.estado.strip(),
                payload.estado_civil.strip(),
                payload.profissao.strip(),
                payload.origem.strip(),
                payload.observacoes.strip(),
                int(bool(payload.menor_idade)),
                payload.responsavel.strip(),
                limpar_cpf(payload.cpf_responsavel),
                agora_str(),
            ),
        )
        conn.commit()
        row = carregar_paciente_por_id(conn, int(cursor.lastrowid))
        return mapear_paciente_detalhe(row)
    finally:
        conn.close()


@app.put("/api/pacientes/{paciente_id}", response_model=PacienteDetalhe)
def atualizar_paciente(paciente_id: int, payload: PacientePayload):
    conn = conectar()
    try:
        existente = carregar_paciente_por_id(conn, paciente_id)
        prontuario = (
            formatar_prontuario_valor(payload.prontuario)
            or formatar_prontuario_valor(existente["prontuario"])
            or proximo_prontuario(conn)
        )
        prontuario_existente = formatar_prontuario_valor(existente["prontuario"])
        cpf_limpo = limpar_cpf(payload.cpf)
        cpf_existente = limpar_cpf(existente["cpf"])
        cpf_responsavel_limpo = limpar_cpf(payload.cpf_responsavel)
        cpf_responsavel_existente = limpar_cpf(existente["cpf_responsavel"])
        erros = validar_dados_paciente(
            payload.nome,
            prontuario,
            cpf_limpo if cpf_limpo != cpf_existente else "",
            payload.menor_idade,
            payload.responsavel,
            cpf_responsavel_limpo if cpf_responsavel_limpo != cpf_responsavel_existente else "",
        )
        if erros:
            raise HTTPException(status_code=400, detail=erros)
        erros_duplicidade = validar_duplicidade_paciente(
            conn,
            prontuario if prontuario != prontuario_existente else "",
            cpf_limpo if cpf_limpo != cpf_existente else "",
            paciente_id_atual=paciente_id,
        )
        if erros_duplicidade:
            raise HTTPException(status_code=400, detail=erros_duplicidade)

        conn.execute(
            """
            UPDATE pacientes
            SET nome=?, apelido=?, sexo=?, prontuario=?, cpf=?, rg=?, data_nascimento=?, telefone=?, email=?, cep=?,
                endereco=?, complemento=?, numero=?, bairro=?, cidade=?, estado=?, estado_civil=?, profissao=?, origem=?, observacoes=?, menor_idade=?,
                responsavel=?, cpf_responsavel=?
            WHERE id=?
            """,
            (
                payload.nome.strip(),
                payload.apelido.strip(),
                payload.sexo.strip(),
                prontuario,
                cpf_limpo,
                payload.rg.strip(),
                payload.data_nascimento.strip(),
                payload.telefone.strip(),
                payload.email.strip(),
                payload.cep.strip(),
                payload.endereco.strip(),
                payload.complemento.strip(),
                payload.numero.strip(),
                payload.bairro.strip(),
                payload.cidade.strip(),
                payload.estado.strip(),
                payload.estado_civil.strip(),
                payload.profissao.strip(),
                payload.origem.strip(),
                payload.observacoes.strip(),
                int(bool(payload.menor_idade)),
                payload.responsavel.strip() if payload.menor_idade else "",
                cpf_responsavel_limpo if payload.menor_idade else "",
                paciente_id,
            ),
        )
        conn.commit()
        row = carregar_paciente_por_id(conn, paciente_id)
        return mapear_paciente_detalhe(row)
    finally:
        conn.close()


@app.put("/api/dashboard/vendas/{contrato_id}/inclusao-total")
def atualizar_inclusao_venda_total(contrato_id: int, payload: DashboardVendaInclusaoPayload, request: Request):
    conn = conectar()
    try:
        contrato = conn.execute("SELECT id, status FROM contratos WHERE id=? LIMIT 1", (contrato_id,)).fetchone()
        if contrato is None:
            raise HTTPException(status_code=404, detail="Contrato nao encontrado.")
        if normalizar_texto(contrato["status"]) not in {"aprovado", "aprovada", "convertido"}:
            raise HTTPException(status_code=400, detail="Somente vendas aprovadas podem ser ajustadas no dashboard.")
        conn.execute(
            "UPDATE contratos SET incluir_total_vendido=? WHERE id=?",
            (1 if payload.incluir else 0, contrato_id),
        )
        conn.commit()
        return {"ok": True, "contratoId": contrato_id, "incluirTotalVendido": bool(payload.incluir)}
    finally:
        conn.close()


@app.put("/api/pacientes/{paciente_id}/tratamento-suspensao", response_model=PacienteDetalhe)
def atualizar_tratamento_suspensao_paciente(paciente_id: int, payload: TratamentoSuspensaoPayload, request: Request):
    conn = conectar()
    try:
        usuario = validar_usuario_bloqueio_tratamento(request)
        row = atualizar_suspensao_tratamento_paciente_db(
            conn,
            paciente_id=int(paciente_id),
            suspenso=bool(payload.suspenso),
            observacao=str(payload.observacao or ""),
            usuario=usuario,
        )
        return mapear_paciente_detalhe(row)
    finally:
        conn.close()


@app.post("/api/pacientes/{paciente_id}/orcamentos", response_model=OrcamentoCriadoResposta)
def criar_orcamento_paciente(paciente_id: int, payload: OrcamentoPacientePayload, request: Request):
    conn = conectar()
    try:
        carregar_paciente_por_id(conn, paciente_id)
        crm = upsert_crm_origem(conn, int(paciente_id), usuario=usuario_request(request))
        contrato_id = salvar_orcamento_paciente_com_pagamento(conn, paciente_id, payload)
        if payload.nova_observacao.strip():
            registrar_historico_orcamento(
                conn,
                paciente_id=int(paciente_id),
                contrato_id=contrato_id,
                tipo="OBSERVACAO",
                observacao=payload.nova_observacao.strip(),
                criado_por=usuario_request(request),
            )
        data_retorno = validar_data_retorno_crm(payload.data_retorno_crm)
        atualizar_snapshot_resgate_contrato(
            conn,
            contrato_id=contrato_id,
            data_retorno=data_retorno,
            status="Ligar novamente",
            observacao="Orçamento lançado no sistema.",
            usuario=usuario_request(request),
        )
        registrar_historico_resgate(
            conn,
            crm_id=crm_int(crm["id"], 0) if crm is not None else None,
            paciente_id=int(paciente_id),
            contrato_id=contrato_id,
            status="Ligar novamente",
            observacao="Orçamento lançado no sistema.",
            proximo_contato=data_retorno,
            criado_por=usuario_request(request),
            automatico=True,
        )
        conn.commit()
        return OrcamentoCriadoResposta(contrato_id=contrato_id)
    finally:
        conn.close()

@app.get("/api/pacientes/{paciente_id}/orcamentos/{contrato_id}", response_model=OrcamentoDetalheResposta)
def detalhar_orcamento_paciente(paciente_id: int, contrato_id: int):
    conn = conectar()
    try:
        carregar_paciente_por_id(conn, paciente_id)
        return carregar_orcamento_detalhe(conn, paciente_id, contrato_id)
    finally:
        conn.close()


@app.put("/api/pacientes/{paciente_id}/orcamentos/{contrato_id}", response_model=OrcamentoCriadoResposta)
def atualizar_orcamento_paciente(paciente_id: int, contrato_id: int, payload: OrcamentoPacientePayload, request: Request):
    conn = conectar()
    try:
        carregar_paciente_por_id(conn, paciente_id)
        crm = upsert_crm_origem(conn, int(paciente_id), usuario=usuario_request(request))
        contrato_anterior = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id, paciente_id)).fetchone()
        assinatura_anterior = assinatura_orcamento_atual(conn, contrato_id) if contrato_anterior is not None else ""
        valor_bruto_novo = sum(
            sum(float(regiao.valor or 0) for regiao in item.regioes if regiao.ativo)
            for item in payload.itens
        )
        valor_total_novo = max(
            0.0,
            valor_bruto_novo
            - (valor_bruto_novo * max(0.0, float(payload.desconto_percentual or 0)) / 100.0)
            - max(0.0, float(payload.desconto_valor or 0)),
        )
        contrato_id_salvo = salvar_orcamento_paciente_com_pagamento(conn, paciente_id, payload, contrato_id=contrato_id)
        if contrato_anterior is not None and bool(int(contrato_anterior["ja_foi_aprovado"] or 0)):
            conn.execute(
                """
                UPDATE contratos
                SET valor_total=?, entrada=?, parcelas=?, primeiro_vencimento=?, data_pagamento_entrada=?,
                    forma_pagamento=?, plano_pagamento_json=?, desconto_percentual=?, desconto_valor=?
                WHERE id=? AND paciente_id=?
                """,
                (
                    contrato_anterior["valor_total"], contrato_anterior["entrada"], contrato_anterior["parcelas"],
                    contrato_anterior["primeiro_vencimento"], contrato_anterior["data_pagamento_entrada"],
                    contrato_anterior["forma_pagamento"], contrato_anterior["plano_pagamento_json"],
                    contrato_anterior["desconto_percentual"], contrato_anterior["desconto_valor"],
                    contrato_id_salvo, paciente_id,
                ),
            )
        data_retorno = validar_data_retorno_crm(payload.data_retorno_crm)
        data_orcamento = normalizar_data_contrato_iso(payload.data, "")
        validade_orcamento = normalizar_data_contrato_iso(payload.validade_orcamento, "")
        contrato_atual = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id_salvo, paciente_id)).fetchone()
        assinatura_atual = assinatura_orcamento_atual(conn, contrato_id_salvo) if contrato_atual is not None else ""
        alteracoes: list[str] = []
        if contrato_anterior is not None:
            if str(contrato_anterior["observacoes"] or "").strip() != payload.observacoes.strip():
                alteracoes.append("observações gerais")
            if str(contrato_anterior["forma_pagamento"] or "").strip() != str(payload.forma_pagamento or "").strip():
                alteracoes.append("forma de pagamento")
            if str(contrato_anterior["data_retorno_crm"] or "").strip() != data_retorno:
                alteracoes.append("retorno CRM")
            if str(contrato_anterior["data_criacao"] or "").strip() != data_orcamento:
                alteracoes.append("data do orçamento")
            if str(contrato_anterior["validade_orcamento"] or "").strip() != validade_orcamento:
                alteracoes.append("validade")
            if round(float(contrato_anterior["valor_total"] or 0), 2) != round(valor_total_novo, 2):
                alteracoes.append("valor total")
            if assinatura_anterior != assinatura_atual:
                alteracoes.append("procedimentos")
        if alteracoes:
            registrar_historico_orcamento(
                conn,
                paciente_id=int(paciente_id),
                contrato_id=contrato_id_salvo,
                tipo="ALTERACAO",
                observacao=f"Orçamento alterado: {', '.join(alteracoes)}.",
                criado_por=usuario_request(request),
            )
        if payload.nova_observacao.strip():
            registrar_historico_orcamento(
                conn,
                paciente_id=int(paciente_id),
                contrato_id=contrato_id_salvo,
                tipo="OBSERVACAO",
                observacao=payload.nova_observacao.strip(),
                criado_por=usuario_request(request),
            )
        status_snapshot = normalizar_status_resgate(contrato_atual["crm_status"]) if contrato_atual is not None else ""
        observacao_snapshot = str(contrato_atual["crm_observacao_contato"] or "") if contrato_atual is not None else ""
        atualizar_snapshot_resgate_contrato(
            conn,
            contrato_id=contrato_id_salvo,
            data_retorno=data_retorno,
            status=status_snapshot or "Ligar novamente",
            observacao=observacao_snapshot or "Orçamento atualizado no sistema.",
            usuario=usuario_request(request),
        )
        registrar_historico_resgate(
            conn,
            crm_id=crm_int(crm["id"], 0) if crm is not None else None,
            paciente_id=int(paciente_id),
            contrato_id=contrato_id_salvo,
            status=status_snapshot or "Ligar novamente",
            observacao="Orçamento atualizado no sistema.",
            proximo_contato=data_retorno,
            criado_por=usuario_request(request),
            automatico=True,
        )
        conn.commit()
        return OrcamentoCriadoResposta(contrato_id=contrato_id_salvo)
    finally:
        conn.close()


@app.put("/api/pacientes/{paciente_id}/orcamentos/{contrato_id}/status")
def alterar_status_orcamento_paciente(paciente_id: int, contrato_id: int, payload: OrcamentoStatusPayload, request: Request):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        contrato = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id, paciente_id)).fetchone()
        if contrato is None:
            raise HTTPException(status_code=404, detail="Orcamento nao encontrado.")
        status = normalizar_texto(payload.status).upper().replace(" ", "_")
        if status not in {"APROVADO", "EM_ABERTO"}:
            raise HTTPException(status_code=400, detail="Status de orcamento invalido.")
        usuario_aprovador = validar_usuario_aprovacao_orcamento(request)

        if status == "APROVADO":
            reaprovacao = bool(int(contrato["ja_foi_aprovado"] or 0))
            tipo_reaprovacao = normalizar_texto(payload.tipo_reaprovacao).upper().replace(" ", "_")
            if reaprovacao and tipo_reaprovacao not in {"ALTERACAO", "NOVA", "ACRESCIMO"}:
                raise HTTPException(status_code=409, detail="Informe se a reaprovação é alteração contratual, nova venda ou acréscimo.")
            incluir_venda, contar_venda, valor_considerado, tipo_movimento = 1, 1, None, "NOVA"
            if reaprovacao and tipo_reaprovacao == "ALTERACAO":
                incluir_venda, contar_venda, valor_considerado, tipo_movimento = 0, 0, 0.0, "ALTERACAO"
            elif reaprovacao and tipo_reaprovacao == "ACRESCIMO":
                if float(payload.valor_acrescimo or 0) <= 0:
                    raise HTTPException(status_code=400, detail="Informe o valor positivo do acréscimo.")
                incluir_venda, contar_venda, valor_considerado, tipo_movimento = 1, 0, round(float(payload.valor_acrescimo), 2), "ACRESCIMO"
            elif reaprovacao and tipo_reaprovacao == "NOVA":
                incluir_venda, contar_venda, valor_considerado, tipo_movimento = 1, 1, None, "NOVA"
            conn.execute(
                """UPDATE contratos SET status='APROVADO', aprovado_por=?, data_aprovacao=?, ja_foi_aprovado=1,
                   incluir_total_vendido=?, contar_quantidade_venda=?, valor_venda_considerado=?, tipo_movimento_venda=?
                   WHERE id=? AND paciente_id=?""",
                (usuario_aprovador or "JULIANA", agora_str(), incluir_venda, contar_venda, valor_considerado, tipo_movimento, contrato_id, paciente_id),
            )
            conn.execute(
                """UPDATE procedimentos_dente
                   SET status='CONTRATADO'
                   WHERE contrato_id=? AND paciente_id=?
                     AND upper(trim(COALESCE(status, ''))) <> 'EXCLUIDO'""",
                (contrato_id, paciente_id),
            )
            contrato_atualizado = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id, paciente_id)).fetchone()
            if contrato_atualizado is not None and tipo_movimento != "ALTERACAO":
                sincronizar_recebiveis_contrato(conn, paciente, contrato_atualizado, contrato_id)
                sincronizar_financeiro_contrato(conn, paciente, contrato_atualizado, contrato_id)
            if contrato_atualizado is not None:
                try:
                    gerar_documento_contrato(conn, paciente, contrato_atualizado, contrato_id)
                except Exception as exc:
                    print(f"[orcamento] falha ao gerar documento do contrato {contrato_id}: {exc}", flush=True)
            sincronizar_status_resgate_por_orcamento_aprovado(
                conn,
                paciente_id=int(paciente_id),
                contrato_id_origem=int(contrato_id),
                usuario=usuario_aprovador or "JULIANA",
            )
        else:
            conn.execute(
                "UPDATE contratos SET status='EM_ABERTO', aprovado_por='', data_aprovacao=NULL WHERE id=? AND paciente_id=?",
                (contrato_id, paciente_id),
            )
            conn.execute(
                "UPDATE procedimentos_dente SET status='ORCAMENTO' WHERE contrato_id=? AND paciente_id=?",
                (contrato_id, paciente_id),
            )
            # Desaprovar permite o ajuste contratual, mas não apaga a história financeira.
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@app.delete("/api/pacientes/{paciente_id}/orcamentos/{contrato_id}")
def excluir_orcamento_paciente(paciente_id: int, contrato_id: int):
    conn = conectar()
    try:
        paciente = carregar_paciente_por_id(conn, paciente_id)
        contrato = conn.execute("SELECT * FROM contratos WHERE id=? AND paciente_id=? LIMIT 1", (contrato_id, paciente_id)).fetchone()
        if contrato is None:
            raise HTTPException(status_code=404, detail="Orcamento nao encontrado.")
        if normalizar_texto(contrato["status"]).upper() == "APROVADO":
            raise HTTPException(status_code=400, detail="Desaprove o orcamento antes de excluir.")

        conn.execute("DELETE FROM recebiveis WHERE contrato_id=?", (contrato_id,))
        conn.execute("DELETE FROM financeiro WHERE contrato_id=?", (contrato_id,))
        conn.execute("DELETE FROM agendamento_procedimentos WHERE contrato_id=?", (contrato_id,))
        conn.execute("UPDATE agendamentos SET contrato_id=NULL, origem_contrato=0 WHERE contrato_id=?", (contrato_id,))
        conn.execute("DELETE FROM procedimentos_dente WHERE contrato_id=? AND paciente_id=?", (contrato_id, paciente_id))
        conn.execute("DELETE FROM procedimentos_contrato WHERE contrato_id=?", (contrato_id,))
        conn.execute("DELETE FROM contratos WHERE id=? AND paciente_id=?", (contrato_id, paciente_id))
        try:
            limpar_documento_contrato(paciente, contrato_id)
        except Exception as exc:
            print(f"[orcamento] falha ao limpar documento do contrato {contrato_id}: {exc}", flush=True)
        conn.commit()
        return {"ok": True}
    finally:
        conn.close()
