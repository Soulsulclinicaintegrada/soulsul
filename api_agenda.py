from __future__ import annotations

from datetime import datetime, timedelta
import json
import sqlite3
from typing import Literal

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from database import conectar, inicializar_banco


def agora_br() -> str:
    return datetime.now().strftime("%d/%m/%Y %H:%M")


def para_minutos(hora: str) -> int:
    horas, minutos = hora.split(":")
    return int(horas) * 60 + int(minutos)


def adicionar_minutos(hora: str, minutos: int) -> str:
    total = para_minutos(hora) + minutos
    return f"{total // 60:02d}:{total % 60:02d}"


def gerar_slots_quinze(inicio: str = "07:00", fim: str = "20:00") -> list[str]:
    atual = para_minutos(inicio)
    limite = para_minutos(fim)
    slots: list[str] = []
    while atual < limite:
        slots.append(f"{atual // 60:02d}:{atual % 60:02d}")
        atual += 15
    return slots


def data_br_para_date(data_br: str) -> datetime.date:
    return datetime.strptime(normalizar_data_agenda(data_br), "%d/%m/%Y").date()


def data_date_para_br(data_valor: datetime.date) -> str:
    return data_valor.strftime("%d/%m/%Y")


def adicionar_dias_data_br(data_br: str, dias: int) -> str:
    return data_date_para_br(data_br_para_date(data_br) + timedelta(days=dias))


def colunas_tabela(conn: sqlite3.Connection, nome_tabela: str) -> set[str]:
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({nome_tabela})")}


def garantir_coluna(conn: sqlite3.Connection, nome_tabela: str, definicao: str) -> None:
    nome_coluna = definicao.split()[0]
    if nome_coluna not in colunas_tabela(conn, nome_tabela):
        conn.execute(f"ALTER TABLE {nome_tabela} ADD COLUMN {definicao}")


def garantir_colunas_agenda_api() -> None:
    conn = conectar()
    try:
        garantir_coluna(conn, "agendamentos", "prontuario_snapshot TEXT")
        garantir_coluna(conn, "agendamentos", "tipo_atendimento_nome_snapshot TEXT")
        garantir_coluna(conn, "agendamentos", "status_origem TEXT")
        garantir_coluna(conn, "agendamentos", "status_motivo TEXT")
        garantir_coluna(conn, "agendamentos", "status_usuario TEXT")
        garantir_coluna(conn, "agendamentos", "recorrencia_grupo TEXT")
        garantir_coluna(conn, "agendamentos", "recorrencia_intervalo_dias INTEGER")
        garantir_coluna(conn, "agendamentos", "recorrencia_total INTEGER")
        garantir_coluna(conn, "agendamentos", "recorrencia_indice INTEGER")
        conn.commit()
    finally:
        conn.close()


def normalizar_nome_coluna_data() -> str:
    conn = conectar()
    try:
        cols = colunas_tabela(conn, "agendamentos")
    finally:
        conn.close()
    return "data_agendamento" if "data_agendamento" in cols else "data"


DATA_COLUNA_AGENDA: str | None = None


def obter_data_coluna_agenda() -> str:
    global DATA_COLUNA_AGENDA
    if not DATA_COLUNA_AGENDA:
        DATA_COLUNA_AGENDA = normalizar_nome_coluna_data()
    return DATA_COLUNA_AGENDA


def row_val(row: sqlite3.Row, key: str, default=None):
    try:
        return row[key]
    except Exception:
        return default


def normalizar_status_agendamento(valor: object) -> str:
    texto = " ".join(str(valor or "").strip().lower().split())
    mapa = {
        "agendado": "Agendado",
        "scheduled": "Agendado",
        "confirmado": "Confirmado",
        "confirmed": "Confirmado",
        "aguardando": "Aguardando",
        "em espera": "Em espera",
        "pending": "Em espera",
        "em atendimento": "Em atendimento",
        "in session": "Em atendimento",
        "atendido": "Atendido",
        "checkout": "Atendido",
        "atrasado": "Atrasado",
        "late": "Atrasado",
        "faltou": "Faltou",
        "missed": "Faltou",
        "desmarcado": "Desmarcado",
        "rescheduled": "Desmarcado",
        "cancelado": "Cancelado",
        "canceled": "Cancelado",
        "cancelled": "Cancelado",
    }
    return mapa.get(texto, str(valor or "").strip() or "Agendado")


def normalizar_data_agenda(valor: object) -> str:
    texto = str(valor or "").strip()
    if not texto:
        return ""
    for formato in ("%d/%m/%Y", "%Y-%m-%d", "%d-%m-%Y"):
        try:
            return datetime.strptime(texto, formato).strftime("%d/%m/%Y")
        except Exception:
            continue
    return texto


def chave_ordenacao_data_agenda(valor: object) -> tuple[int, int, int, str]:
    texto = normalizar_data_agenda(valor)
    try:
        data = datetime.strptime(texto, "%d/%m/%Y")
        return (data.year, data.month, data.day, texto)
    except Exception:
        return (9999, 12, 31, texto)


def data_agenda_no_intervalo(valor: object, inicio: str, fim: str) -> bool:
    data_normalizada = normalizar_data_agenda(valor)
    inicio_normalizado = normalizar_data_agenda(inicio)
    fim_normalizado = normalizar_data_agenda(fim)
    if not data_normalizada or not inicio_normalizado or not fim_normalizado:
        return False
    try:
        data_atual = datetime.strptime(data_normalizada, "%d/%m/%Y").date()
        data_inicio = datetime.strptime(inicio_normalizado, "%d/%m/%Y").date()
        data_fim = datetime.strptime(fim_normalizado, "%d/%m/%Y").date()
    except Exception:
        return data_normalizada == inicio_normalizado if inicio_normalizado == fim_normalizado else False
    return data_inicio <= data_atual <= data_fim


class ProcedimentoPayload(BaseModel):
    nome: str
    origem: Literal["contrato", "manual"]
    contratoId: int | None = None
    procedimentoId: int | None = None
    duracaoMinutos: int | None = None


class AgendamentoPayload(BaseModel):
    pacienteId: int | None = None
    nomePaciente: str
    prontuario: str | None = None
    telefone: str | None = None
    profissionalId: int
    profissionalNome: str
    tipoAtendimentoId: int
    tipoAtendimentoNome: str
    data: str
    horaInicio: str
    horaFim: str
    duracaoMinutos: int
    status: str | None = "Agendado"
    agendadoPor: str
    agendadoEm: str
    observacoes: str | None = None
    trabalhoTipo: str | None = None
    ordemServicoId: int | None = None
    ordemServicoDocumentoNome: str | None = None
    elementoArcada: str | None = None
    recorrenciaGrupo: str | None = None
    recorrenciaIntervaloDias: int | None = None
    recorrenciaTotal: int | None = None
    recorrenciaIndice: int | None = None
    procedimentos: list[ProcedimentoPayload] = Field(default_factory=list)


class AgendamentoHistoricoItem(BaseModel):
    acao: str
    descricao: str
    criadoPor: str
    criadoEm: str


class AgendamentoResposta(BaseModel):
    id: int
    pacienteId: int | None = None
    paciente: str
    prontuario: str = ""
    telefone: str = ""
    profissionalId: int
    profissional: str
    tipoAtendimentoId: int
    tipoAtendimento: str
    procedimentos: list[str]
    status: str
    data: str
    inicio: str
    fim: str
    consultorio: str | None = None
    observacoes: str | None = None
    statusOrigem: str | None = None
    statusMotivo: str | None = None
    statusUsuario: str | None = None
    financeiro: str | None = None
    agendadoPor: str | None = None
    agendadoEm: str | None = None
    atualizadoPor: str | None = None
    atualizadoEm: str | None = None
    contratoId: int | None = None
    trabalhoTipo: str | None = None
    ordemServicoId: int | None = None
    ordemServicoDocumentoNome: str | None = None
    elementoArcada: str | None = None
    recorrenciaGrupo: str | None = None
    recorrenciaIntervaloDias: int | None = None
    recorrenciaTotal: int | None = None
    recorrenciaIndice: int | None = None
    historico: list[AgendamentoHistoricoItem] = Field(default_factory=list)


class AgendamentosSerieResposta(BaseModel):
    agendamentos: list[AgendamentoResposta]


class PacienteBuscaItem(BaseModel):
    id: int
    nome: str
    prontuario: str
    celular: str


class ProcedimentoContratoItem(BaseModel):
    chave: str
    contratoId: int
    nome: str
    sessoesTotal: int
    sessoesRestantes: int
    duracaoMinutos: int
    valor: str | None = None


class GuiaEmitidaItem(BaseModel):
    id: int
    procedimentoNome: str
    retornoSolicitado: str = ""
    documentoNome: str = ""
    elementoArcada: str = ""
    dataEmissao: str = ""
    etapasResumo: str = ""


class PacienteContextoResposta(BaseModel):
    id: int
    nome: str
    prontuario: str
    celular: str
    procedimentosContratados: list[ProcedimentoContratoItem]
    guiasEmitidas: list[GuiaEmitidaItem] = Field(default_factory=list)


class DisponibilidadeResposta(BaseModel):
    ocupados: list[str]
    agendamentos: list[AgendamentoResposta]


class AgendamentosListaResposta(BaseModel):
    agendamentos: list[AgendamentoResposta]


class AgendaDiaConfigPayload(BaseModel):
    ativo: bool = True
    inicio: str = "08:00"
    fim: str = "19:00"
    almocoInicio: str = "12:00"
    almocoFim: str = "13:00"
    consultorio: str = ""


class AgendaProfissionalConfigPayload(BaseModel):
    id: int
    nomeAgenda: str = ""
    usuarioVinculado: str = ""
    mostrar: bool = True
    cor: str = "#c7aa78"
    corSuave: str = ""
    maxAgendamentosPorHorario: int = 1
    configuracaoDias: dict[str, AgendaDiaConfigPayload] = Field(default_factory=dict)


class AgendaConfiguracaoPayload(BaseModel):
    totalConsultorios: int = 3
    salas: list[str] = Field(default_factory=list)
    ordemProfissionais: list[int] = Field(default_factory=list)
    configClinicaDias: dict[str, AgendaDiaConfigPayload] = Field(default_factory=dict)
    configProfissionais: list[AgendaProfissionalConfigPayload] = Field(default_factory=list)


app = FastAPI(title="SoulSul Agenda API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event() -> None:
    inicializar_banco()
    garantir_colunas_agenda_api()


def criar_config_dias_padrao() -> dict[str, dict[str, object]]:
    return {
        str(indice): {
            "ativo": bool(indice >= 1 and indice <= 5),
            "inicio": "08:00",
            "fim": "18:00" if indice == 4 else "19:00",
            "almocoInicio": "12:00",
            "almocoFim": "13:00",
            "consultorio": "",
        }
        for indice in range(7)
    }


def normalizar_consultorio(valor: object) -> str:
    texto = " ".join(str(valor or "").strip().split())
    if not texto:
        return ""
    return texto.upper()


SALAS_PADRAO = [
    "CONSULTÓRIO 1",
    "CONSULTÓRIO 2",
    "CONSULTÓRIO 3",
    "AVALIAÇÃO",
    "FINANCEIRO",
    "T.O. FISIOTERAPIA",
    "FONO",
]


def normalizar_lista_salas(valores: list[object] | tuple[object, ...] | None) -> list[str]:
    resultado: list[str] = []
    vistos: set[str] = set()
    for valor in valores or []:
        sala = normalizar_consultorio(valor)
        if not sala or sala in vistos:
            continue
        vistos.add(sala)
        resultado.append(sala)
    return resultado or SALAS_PADRAO.copy()


def dia_semana_data_br(data_br: str) -> str:
    try:
        return str(datetime.strptime(data_br, "%d/%m/%Y").weekday() + 1)
    except Exception:
        return "1"


def obter_consultorio_profissional_configurado(
    conn: sqlite3.Connection,
    profissional_id: int,
    data_br: str,
) -> str:
    dia_semana = dia_semana_data_br(data_br)
    row = conn.execute("SELECT config_profissionais_json FROM agenda_configuracao WHERE id=1").fetchone()
    if not row:
        return ""
    try:
        bruto = json.loads(str(row["config_profissionais_json"] or "{}"))
    except Exception:
        return ""
    if not isinstance(bruto, dict):
        return ""
    profissional = bruto.get(str(int(profissional_id)))
    if not isinstance(profissional, dict):
        return ""
    configuracao_dias = profissional.get("configuracaoDias") or {}
    if not isinstance(configuracao_dias, dict):
        return ""
    configuracao_dia = configuracao_dias.get(str(dia_semana)) or {}
    if not isinstance(configuracao_dia, dict):
        return ""
    return normalizar_consultorio(configuracao_dia.get("consultorio"))


def listar_salas_configuradas(row: sqlite3.Row | None) -> list[str]:
    if not row:
        return SALAS_PADRAO.copy()
    try:
        bruto = json.loads(str(row["salas_json"] or "[]"))
    except Exception:
        bruto = []
    return normalizar_lista_salas(bruto if isinstance(bruto, list) else [])


def intervalos_se_sobrepoem(inicio_a: str, fim_a: str, inicio_b: str, fim_b: str) -> bool:
    return not (fim_a <= inicio_b or inicio_a >= fim_b)


def listar_salas_ocupadas(
    conn: sqlite3.Connection,
    data: str,
    inicio: str,
    fim: str,
    *,
    ignorar_agendamento_id: int | None = None,
) -> set[str]:
    data_coluna_agenda = obter_data_coluna_agenda()
    sql = f"""
        SELECT id, consultorio, hora_inicio, hora_fim
        FROM agendamentos
        WHERE {data_coluna_agenda}=?
          AND COALESCE(status, 'Agendado') NOT IN ('Cancelado', 'Desmarcado')
          AND TRIM(COALESCE(consultorio, '')) <> ''
    """
    params: list[object] = [data]
    if ignorar_agendamento_id is not None:
        sql += " AND id <> ?"
        params.append(int(ignorar_agendamento_id))
    rows = conn.execute(sql, tuple(params)).fetchall()
    ocupadas: set[str] = set()
    for row in rows:
        if intervalos_se_sobrepoem(
            str(row_val(row, "hora_inicio", "") or ""),
            str(row_val(row, "hora_fim", "") or ""),
            inicio,
            fim,
        ):
            sala = normalizar_consultorio(row_val(row, "consultorio", ""))
            if sala:
                ocupadas.add(sala)
    return ocupadas


def definir_consultorio_agendamento(
    conn: sqlite3.Connection,
    profissional_id: int,
    data: str,
    inicio: str,
    fim: str,
    *,
    ignorar_agendamento_id: int | None = None,
) -> str:
    row = conn.execute("SELECT salas_json FROM agenda_configuracao WHERE id=1").fetchone()
    salas = listar_salas_configuradas(row)
    salas_normalizadas = normalizar_lista_salas(salas)
    ocupadas = listar_salas_ocupadas(conn, data, inicio, fim, ignorar_agendamento_id=ignorar_agendamento_id)
    consultorio_configurado = obter_consultorio_profissional_configurado(conn, profissional_id, data)
    if consultorio_configurado:
        if consultorio_configurado not in salas_normalizadas:
            salas_normalizadas.append(consultorio_configurado)
        if consultorio_configurado in ocupadas:
            raise HTTPException(
                status_code=409,
                detail=f"{consultorio_configurado} já está ocupado neste horário.",
            )
        return consultorio_configurado
    for sala in salas_normalizadas:
        if sala not in ocupadas:
            return sala
    raise HTTPException(
        status_code=409,
        detail="Todas as salas/consultórios estão ocupados neste horário.",
    )


def obter_configuracao_agenda():
    conn = conectar()
    try:
        usuarios = conn.execute(
            """
            SELECT id, nome, usuario, nome_agenda, agenda_disponivel, ativo
            FROM usuarios
            WHERE COALESCE(ativo, 1)=1
            ORDER BY lower(COALESCE(nome_agenda, nome, usuario, '')), id
            """
        ).fetchall()
        row = conn.execute("SELECT * FROM agenda_configuracao WHERE id=1").fetchone()
    finally:
        conn.close()

    ordem_salva: list[int] = []
    config_clinica = criar_config_dias_padrao()
    mapa_profissionais_salvo: dict[str, dict[str, object]] = {}
    if row is not None:
        try:
            ordem_salva = [int(item) for item in json.loads(str(row["ordem_profissionais_json"] or "[]")) if str(item).strip()]
        except Exception:
            ordem_salva = []
        try:
            bruto = json.loads(str(row["config_clinica_dias_json"] or "{}"))
            if isinstance(bruto, dict):
                for chave, valor in bruto.items():
                    if isinstance(valor, dict):
                        config_clinica[str(chave)] = {**config_clinica.get(str(chave), {}), **valor}
        except Exception:
            pass
        try:
            bruto = json.loads(str(row["config_profissionais_json"] or "{}"))
            if isinstance(bruto, dict):
                mapa_profissionais_salvo = {str(chave): valor for chave, valor in bruto.items() if isinstance(valor, dict)}
        except Exception:
            pass

    ids_usuarios = [int(usuario["id"]) for usuario in usuarios if bool(int(usuario["agenda_disponivel"] or 0))]
    ordem_profissionais = [usuario_id for usuario_id in ordem_salva if usuario_id in ids_usuarios] + [usuario_id for usuario_id in ids_usuarios if usuario_id not in ordem_salva]
    profissionais: list[dict[str, object]] = []
    cores = ["#f4b2be", "#f6e88f", "#ff8d0a", "#ff2f2f", "#ef10ff", "#8ce07a", "#9f92f0", "#7ccfd8", "#f7a9b8"]
    for indice, usuario in enumerate(usuarios):
        if not bool(int(usuario["agenda_disponivel"] or 0)):
            continue
        salvo = mapa_profissionais_salvo.get(str(int(usuario["id"])), {})
        profissionais.append(
            {
                "id": int(usuario["id"]),
                "nomeAgenda": str(salvo.get("nomeAgenda") or usuario["nome_agenda"] or usuario["nome"] or "").upper(),
                "usuarioVinculado": str(salvo.get("usuarioVinculado") or usuario["usuario"] or ""),
                "mostrar": bool(salvo.get("mostrar", True)),
                "cor": str(salvo.get("cor") or cores[indice % len(cores)]),
                "corSuave": str(salvo.get("corSuave") or ""),
                "maxAgendamentosPorHorario": max(1, int(salvo.get("maxAgendamentosPorHorario", 1) or 1)),
                "configuracaoDias": {**criar_config_dias_padrao(), **(salvo.get("configuracaoDias") or {})},
            }
        )
    return {
        "salas": listar_salas_configuradas(row),
        "ordemProfissionais": ordem_profissionais,
        "configClinicaDias": config_clinica,
        "configProfissionais": profissionais,
    }


def carregar_procedimentos_agendamento(conn: sqlite3.Connection, agendamento_id: int) -> list[str]:
    rows = conn.execute(
        """
        SELECT procedimento_nome_snapshot
        FROM agendamento_procedimentos
        WHERE agendamento_id=?
        ORDER BY id
        """,
        (agendamento_id,),
    ).fetchall()
    return [row["procedimento_nome_snapshot"] for row in rows if row["procedimento_nome_snapshot"]]


def carregar_historico_agendamento(conn: sqlite3.Connection, agendamento_id: int) -> list[AgendamentoHistoricoItem]:
    rows = conn.execute(
        """
        SELECT acao, descricao, criado_por, criado_em
        FROM agendamento_historico
        WHERE agendamento_id=?
        ORDER BY id DESC
        """,
        (agendamento_id,),
    ).fetchall()
    return [
        AgendamentoHistoricoItem(
            acao=str(row_val(row, "acao", "") or ""),
            descricao=str(row_val(row, "descricao", "") or ""),
            criadoPor=str(row_val(row, "criado_por", "") or ""),
            criadoEm=str(row_val(row, "criado_em", "") or ""),
        )
        for row in rows
    ]


def registrar_historico_agendamento(
    conn: sqlite3.Connection,
    agendamento_id: int,
    acao: str,
    descricao: str,
    usuario: str,
    quando: str,
) -> None:
    conn.execute(
        """
        INSERT INTO agendamento_historico (agendamento_id, acao, descricao, criado_por, criado_em)
        VALUES (?, ?, ?, ?, ?)
        """,
        (agendamento_id, acao, descricao.strip(), usuario.strip(), quando.strip()),
    )


def usuario_request(request: Request) -> str:
    return (request.headers.get("x-usuario") or "").strip() or "Sistema"


def descrever_agendamento_para_auditoria(
    agendamento_id: int,
    payload: AgendamentoPayload,
    alteracoes: str = "",
) -> str:
    procedimentos = ", ".join(item.nome.strip() for item in payload.procedimentos if item.nome.strip())
    partes = [
        f"Agendamento #{agendamento_id}",
        str(payload.nomePaciente or "").strip() or "Paciente sem nome",
        f"{payload.data} {payload.horaInicio}-{payload.horaFim}",
        str(payload.profissionalNome or "").strip() or "Profissional não informado",
    ]
    if procedimentos:
        partes.append(procedimentos)
    if alteracoes.strip():
        partes.append(f"alterações: {alteracoes.strip()}")
    return " | ".join(partes)


def registrar_acao_agendamento(
    usuario: str,
    *,
    acao: str,
    rota: str,
    info: str,
) -> None:
    try:
        from api_pacientes import registrar_acao_usuario

        registrar_acao_usuario(
            usuario,
            acao=acao,
            tipo="Agendamento",
            info=info,
            metodo_http="POST" if acao == "Criacao" else "PUT",
            rota=rota,
        )
    except Exception:
        pass


def descrever_alteracoes_agendamento(
    existente: sqlite3.Row,
    payload: AgendamentoPayload,
    procedimentos_atuais: list[str],
) -> str:
    alteracoes: list[str] = []
    campos_texto = [
        ("paciente", str(row_val(existente, "nome_paciente_snapshot", "") or row_val(existente, "paciente_nome", "") or ""), payload.nomePaciente),
        ("profissional", str(row_val(existente, "profissional", "") or ""), payload.profissionalNome),
        ("tipo", str(row_val(existente, "tipo_atendimento_nome_snapshot", "") or ""), payload.tipoAtendimentoNome),
        ("status", normalizar_status_agendamento(row_val(existente, "status", "")), normalizar_status_agendamento(payload.status or "Agendado")),
    ]
    for rotulo, anterior, novo in campos_texto:
        anterior_limpo = anterior.strip()
        novo_limpo = str(novo or "").strip()
        if anterior_limpo != novo_limpo:
            alteracoes.append(f"{rotulo}: {anterior_limpo or '-'} -> {novo_limpo or '-'}")

    data_anterior = str(row_val(existente, obter_data_coluna_agenda(), "") or "")
    if data_anterior != payload.data:
        alteracoes.append(f"data: {data_anterior or '-'} -> {payload.data}")

    hora_inicio_anterior = str(row_val(existente, "hora_inicio", "") or "")
    hora_fim_anterior = str(row_val(existente, "hora_fim", "") or "")
    if hora_inicio_anterior != payload.horaInicio or hora_fim_anterior != payload.horaFim:
        alteracoes.append(f"horário: {hora_inicio_anterior or '-'} - {hora_fim_anterior or '-'} -> {payload.horaInicio} - {payload.horaFim}")

    observacoes_anteriores = str(row_val(existente, "observacoes", "") or row_val(existente, "observacao", "") or "").strip()
    observacoes_novas = str(payload.observacoes or "").strip()
    if observacoes_anteriores != observacoes_novas:
        alteracoes.append("observações alteradas")

    procedimentos_novos = [item.nome.strip() for item in payload.procedimentos if item.nome.strip()]
    if procedimentos_atuais != procedimentos_novos:
        alteracoes.append(
            f"procedimentos: {', '.join(procedimentos_atuais) or '-'} -> {', '.join(procedimentos_novos) or '-'}"
        )

    return "; ".join(alteracoes)


def mapear_agendamento(conn: sqlite3.Connection, row: sqlite3.Row) -> AgendamentoResposta:
    data_coluna_agenda = obter_data_coluna_agenda()
    procedimentos = carregar_procedimentos_agendamento(conn, row["id"])
    primeiro = procedimentos[0] if procedimentos else (
        row_val(row, "procedimento_nome_snapshot", "") or row_val(row, "procedimento", "") or ""
    )
    contrato_id = row_val(row, "contrato_id")
    financeiro = "Financeiro Ok" if contrato_id else "Sem vínculo"
    return AgendamentoResposta(
        id=row["id"],
        pacienteId=row_val(row, "paciente_id"),
        paciente=row_val(row, "nome_paciente_snapshot", "") or row_val(row, "paciente_nome", "") or "",
        prontuario=row_val(row, "prontuario_snapshot", "") or "",
        telefone=row_val(row, "telefone_snapshot", "") or "",
        profissionalId=row_val(row, "profissional_id", 0) or 0,
        profissional=row_val(row, "profissional", "") or "",
        tipoAtendimentoId=row_val(row, "tipo_atendimento_id", 0) or 0,
        tipoAtendimento=row_val(row, "tipo_atendimento_nome_snapshot", "") or "",
        procedimentos=procedimentos or ([primeiro] if primeiro else []),
        status=normalizar_status_agendamento(row_val(row, "status", "Agendado")),
        data=row[data_coluna_agenda],
        inicio=row_val(row, "hora_inicio", ""),
        fim=row_val(row, "hora_fim", ""),
        consultorio=normalizar_consultorio(row_val(row, "consultorio", "")) or None,
        observacoes=row_val(row, "observacoes", "") or row_val(row, "observacao", ""),
        statusOrigem=row_val(row, "status_origem", "") or "",
        statusMotivo=row_val(row, "status_motivo", "") or "",
        statusUsuario=row_val(row, "status_usuario", "") or "",
        financeiro=financeiro,
        agendadoPor=row_val(row, "criado_por", "") or "",
        agendadoEm=row_val(row, "criado_em", "") or row_val(row, "data_criacao", ""),
        atualizadoPor=row_val(row, "atualizado_por", "") or "",
        atualizadoEm=row_val(row, "atualizado_em", "") or "",
        contratoId=contrato_id,
        trabalhoTipo=row_val(row, "trabalho_tipo", "") or "",
        ordemServicoId=row_val(row, "ordem_servico_id"),
        ordemServicoDocumentoNome=row_val(row, "ordem_servico_documento_nome", "") or "",
        elementoArcada=row_val(row, "elemento_arcada", "") or "",
        recorrenciaGrupo=row_val(row, "recorrencia_grupo", "") or "",
        recorrenciaIntervaloDias=row_val(row, "recorrencia_intervalo_dias"),
        recorrenciaTotal=row_val(row, "recorrencia_total"),
        recorrenciaIndice=row_val(row, "recorrencia_indice"),
        historico=carregar_historico_agendamento(conn, row["id"]),
    )


def existe_conflito(conn: sqlite3.Connection, profissional_id: int, data: str, inicio: str, fim: str) -> bool:
    data_coluna_agenda = obter_data_coluna_agenda()
    row = conn.execute(
        f"""
        SELECT 1
        FROM agendamentos
        WHERE profissional_id=?
          AND {data_coluna_agenda}=?
          AND lower(trim(COALESCE(status, 'Agendado'))) NOT IN ('cancelado', 'canceled', 'cancelled', 'desmarcado')
          AND NOT (hora_fim <= ? OR hora_inicio >= ?)
        LIMIT 1
        """,
        (profissional_id, data, inicio, fim),
    ).fetchone()
    return row is not None


def existe_conflito_excluindo(
    conn: sqlite3.Connection,
    agendamento_id: int,
    profissional_id: int,
    data: str,
    inicio: str,
    fim: str,
) -> bool:
    data_coluna_agenda = obter_data_coluna_agenda()
    row = conn.execute(
        f"""
        SELECT 1
        FROM agendamentos
        WHERE id <> ?
          AND profissional_id=?
          AND {data_coluna_agenda}=?
          AND lower(trim(COALESCE(status, 'Agendado'))) NOT IN ('cancelado', 'canceled', 'cancelled', 'desmarcado')
          AND NOT (hora_fim <= ? OR hora_inicio >= ?)
        LIMIT 1
        """,
        (agendamento_id, profissional_id, data, inicio, fim),
    ).fetchone()
    return row is not None


def garantir_paciente_minimo(
    conn: sqlite3.Connection,
    paciente_id: int | None,
    nome: str,
    telefone: str | None,
) -> int | None:
    if paciente_id:
        return paciente_id
    nome_limpo = (nome or "").strip()
    telefone_limpo = (telefone or "").strip()
    if not nome_limpo:
        return None

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
        return existente["id"]

    cursor = conn.execute(
        """
        INSERT INTO pacientes (nome, telefone)
        VALUES (?, ?)
        """,
        (nome_limpo, telefone_limpo),
    )
    paciente_criado_id = cursor.lastrowid
    conn.execute(
        """
        INSERT INTO pacientes_rapidos (nome, telefone, email, criado_em)
        VALUES (?, ?, '', ?)
        """,
        (nome_limpo, telefone_limpo, agora_br()),
    )
    return paciente_criado_id


@app.get("/api/agenda/disponibilidade", response_model=DisponibilidadeResposta)
def buscar_disponibilidade(
    profissional_id: int = Query(..., alias="profissional_id"),
    data: str = Query(...),
    excluir_agendamento_id: int | None = Query(None, alias="excluir_agendamento_id"),
):
    data_consulta = normalizar_data_agenda(data)
    conn = conectar()
    try:
        rows = conn.execute(
            """
            SELECT *
            FROM agendamentos
            WHERE profissional_id=?
              AND lower(trim(COALESCE(status, 'Agendado'))) NOT IN ('cancelado', 'canceled', 'cancelled', 'desmarcado')
            ORDER BY hora_inicio
            """,
            (profissional_id,),
        ).fetchall()
        rows_filtrados = [
            row
            for row in rows
            if normalizar_data_agenda(row_val(row, obter_data_coluna_agenda(), "")) == data_consulta
            and (not excluir_agendamento_id or int(row_val(row, "id", 0) or 0) != int(excluir_agendamento_id))
        ]

        ocupados: list[str] = []
        for row in rows_filtrados:
            inicio = para_minutos(row["hora_inicio"])
            fim = para_minutos(row["hora_fim"])
            ocupados.extend(
                slot
                for slot in gerar_slots_quinze()
                if para_minutos(slot) >= inicio and para_minutos(slot) < fim
            )

        return DisponibilidadeResposta(
            ocupados=sorted(set(ocupados), key=para_minutos),
            agendamentos=[mapear_agendamento(conn, row) for row in rows_filtrados],
        )
    finally:
        conn.close()


@app.get("/api/agenda/agendamentos", response_model=AgendamentosListaResposta)
def listar_agendamentos(
    data_inicio: str = Query(..., alias="data_inicio"),
    data_fim: str | None = Query(None, alias="data_fim"),
    incluir_ocultos: bool = Query(False, alias="incluir_ocultos"),
):
    conn = conectar()
    try:
        data_fim_real = data_fim or data_inicio
        if incluir_ocultos:
            rows = conn.execute(
                """
                SELECT *
                FROM agendamentos
                ORDER BY hora_inicio, profissional
                """,
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT *
                FROM agendamentos
                WHERE lower(trim(COALESCE(status, 'Agendado'))) NOT IN ('cancelado', 'canceled', 'cancelled', 'desmarcado')
                ORDER BY hora_inicio, profissional
                """,
            ).fetchall()
        data_coluna_agenda = obter_data_coluna_agenda()
        rows_filtrados = [
            row
            for row in rows
            if data_agenda_no_intervalo(row_val(row, data_coluna_agenda, ""), data_inicio, data_fim_real)
        ]
        rows_filtrados.sort(
            key=lambda row: (
                chave_ordenacao_data_agenda(row_val(row, data_coluna_agenda, "")),
                str(row_val(row, "hora_inicio", "") or ""),
                str(row_val(row, "profissional", "") or "").lower(),
            )
        )
        return AgendamentosListaResposta(
            agendamentos=[mapear_agendamento(conn, row) for row in rows_filtrados]
        )
    finally:
        conn.close()


@app.get("/api/agenda/configuracao", response_model=AgendaConfiguracaoPayload)
def buscar_configuracao_agenda():
    return AgendaConfiguracaoPayload(**obter_configuracao_agenda())


@app.put("/api/agenda/configuracao", response_model=AgendaConfiguracaoPayload)
def salvar_configuracao_agenda(payload: AgendaConfiguracaoPayload):
    configuracao_atual = obter_configuracao_agenda()
    ids_validos = {int(item["id"]) for item in configuracao_atual["configProfissionais"]}
    ordem = [int(item) for item in payload.ordemProfissionais if int(item) in ids_validos]
    for usuario_id in ids_validos:
        if usuario_id not in ordem:
            ordem.append(usuario_id)

    clinica = criar_config_dias_padrao()
    for chave, valor in payload.configClinicaDias.items():
        clinica[str(chave)] = {
            **clinica.get(str(chave), {}),
            **valor.model_dump(),
        }

    salas = normalizar_lista_salas(payload.salas)
    profissionais: dict[str, dict[str, object]] = {}
    for item in payload.configProfissionais:
        if int(item.id) not in ids_validos:
            continue
        profissionais[str(int(item.id))] = {
            "nomeAgenda": str(item.nomeAgenda or "").upper(),
            "usuarioVinculado": str(item.usuarioVinculado or ""),
            "mostrar": bool(item.mostrar),
            "cor": str(item.cor or "#c7aa78"),
            "corSuave": str(item.corSuave or ""),
            "maxAgendamentosPorHorario": max(1, int(item.maxAgendamentosPorHorario or 1)),
            "configuracaoDias": {str(chave): valor.model_dump() for chave, valor in item.configuracaoDias.items()},
        }

    conn = conectar()
    try:
        conn.execute(
            """
            INSERT INTO agenda_configuracao (id, ordem_profissionais_json, config_clinica_dias_json, config_profissionais_json, salas_json, atualizado_em)
            VALUES (1, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              ordem_profissionais_json=excluded.ordem_profissionais_json,
              config_clinica_dias_json=excluded.config_clinica_dias_json,
              config_profissionais_json=excluded.config_profissionais_json,
              salas_json=excluded.salas_json,
              atualizado_em=excluded.atualizado_em
            """,
            (
                json.dumps(ordem, ensure_ascii=False),
                json.dumps(clinica, ensure_ascii=False),
                json.dumps(profissionais, ensure_ascii=False),
                json.dumps(salas, ensure_ascii=False),
                agora_br(),
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return AgendaConfiguracaoPayload(**obter_configuracao_agenda())


@app.get("/api/agenda/pacientes/buscar", response_model=list[PacienteBuscaItem])
def buscar_pacientes(q: str = Query(..., min_length=1)):
    termo = f"%{q.strip()}%"
    conn = conectar()
    try:
        rows = conn.execute(
            """
            SELECT id, nome, COALESCE(prontuario, '') AS prontuario, COALESCE(telefone, '') AS telefone
            FROM pacientes
            WHERE nome LIKE ? OR prontuario LIKE ? OR telefone LIKE ?
            ORDER BY nome
            LIMIT 10
            """,
            (termo, termo, termo),
        ).fetchall()
        return [
            PacienteBuscaItem(
                id=row["id"],
                nome=row["nome"],
                prontuario=row["prontuario"],
                celular=row["telefone"],
            )
            for row in rows
        ]
    finally:
        conn.close()


@app.get("/api/agenda/pacientes/{paciente_id}/contexto", response_model=PacienteContextoResposta)
def buscar_contexto_paciente(paciente_id: int):
    conn = conectar()
    try:
        paciente = conn.execute(
            """
            SELECT id, nome, COALESCE(prontuario, '') AS prontuario, COALESCE(telefone, '') AS telefone
            FROM pacientes
            WHERE id=?
            """,
            (paciente_id,),
        ).fetchone()
        if not paciente:
            raise HTTPException(status_code=404, detail="Paciente não encontrado.")

        itens: list[ProcedimentoContratoItem] = []
        try:
            rows = conn.execute(
                """
                SELECT
                  c.id AS contrato_id,
                  pc.procedimento,
                  pc.valor,
                  45 AS duracao
                FROM contratos c
                JOIN procedimentos_contrato pc ON pc.contrato_id = c.id
                WHERE c.paciente_id=?
                ORDER BY c.id DESC, pc.rowid
                """,
                (paciente_id,),
            ).fetchall()

            for row in rows:
                usados_row = conn.execute(
                    """
                    SELECT COUNT(*) AS total
                    FROM agendamento_procedimentos ap
                    JOIN agendamentos a ON a.id = ap.agendamento_id
                    WHERE ap.contrato_id=?
                      AND lower(trim(ap.procedimento_nome_snapshot)) = lower(trim(?))
                      AND COALESCE(a.status, 'Agendado') NOT IN ('Cancelado', 'Desmarcado')
                    """,
                    (row["contrato_id"], row["procedimento"]),
                ).fetchone()
                sessoes_total = 1
                sessoes_restantes = max(0, sessoes_total - int((usados_row["total"] if usados_row else 0) or 0))
                if sessoes_restantes <= 0:
                    continue
                itens.append(
                    ProcedimentoContratoItem(
                        chave=f"{row['contrato_id']}-{row['procedimento']}",
                        contratoId=row["contrato_id"],
                        nome=row["procedimento"],
                        sessoesTotal=sessoes_total,
                        sessoesRestantes=sessoes_restantes,
                        duracaoMinutos=int(row["duracao"] or 45),
                        valor=f"R$ {float(row['valor'] or 0):.2f}".replace(".", ","),
                    )
                )
        except Exception:
            itens = []

        guias_rows = conn.execute(
            """
            SELECT
                os.id,
                os.procedimento_nome_snapshot,
                os.retorno_solicitado,
                os.documento_nome,
                os.elemento_arcada,
                os.criado_em,
                COALESCE(
                    (
                        SELECT GROUP_CONCAT(
                            CASE
                                WHEN lower(COALESCE(e.etapa, ''))='outro' AND COALESCE(e.descricao_outro, '')<>''
                                    THEN e.descricao_outro
                                ELSE e.etapa
                            END,
                            ' | '
                        )
                        FROM ordem_servico_protetico_etapas e
                        WHERE e.ordem_servico_id = os.id
                    ),
                    ''
                ) AS etapas_resumo
            FROM ordens_servico_protetico os
            WHERE os.paciente_id=?
            ORDER BY COALESCE(os.atualizado_em, os.criado_em, '') DESC, os.id DESC
            """,
            (int(paciente_id),),
        ).fetchall()
        guias_emitidas = [
            GuiaEmitidaItem(
                id=int(row["id"]),
                procedimentoNome=str(row["procedimento_nome_snapshot"] or ""),
                retornoSolicitado=str(row["retorno_solicitado"] or ""),
                documentoNome=str(row["documento_nome"] or f"Guia {int(row['id'])}"),
                elementoArcada=str(row["elemento_arcada"] or ""),
                dataEmissao=formatar_data_br_valor(row["criado_em"]),
                etapasResumo=str(row["etapas_resumo"] or ""),
            )
            for row in guias_rows
        ]

        return PacienteContextoResposta(
            id=paciente["id"],
            nome=paciente["nome"],
            prontuario=paciente["prontuario"],
            celular=paciente["telefone"],
            procedimentosContratados=itens,
            guiasEmitidas=guias_emitidas,
        )
    finally:
        conn.close()


@app.post("/api/agenda/agendamentos", response_model=AgendamentoResposta)
def criar_agendamento(payload: AgendamentoPayload, request: Request):
    data_coluna_agenda = obter_data_coluna_agenda()
    conn = conectar()
    try:
        if payload.tipoAtendimentoId and not any(item.nome.strip() for item in payload.procedimentos):
            raise HTTPException(status_code=400, detail="Selecione ao menos um procedimento para salvar a consulta.")
        if payload.tipoAtendimentoId and not any(item.nome.strip() for item in payload.procedimentos):
            raise HTTPException(status_code=400, detail="Selecione ao menos um procedimento para salvar a consulta.")
        paciente_id_final = garantir_paciente_minimo(conn, payload.pacienteId, payload.nomePaciente, payload.telefone)
        if existe_conflito(conn, payload.profissionalId, payload.data, payload.horaInicio, payload.horaFim):
            raise HTTPException(status_code=409, detail="Conflito de horário para o profissional selecionado.")

        colunas_agendamento = colunas_tabela(conn, "agendamentos")
        primeiro_procedimento = payload.procedimentos[0].nome if payload.procedimentos else ""
        contrato_id = next((item.contratoId for item in payload.procedimentos if item.contratoId), None)
        origem_contrato = 1 if contrato_id else 0
        consultorio = definir_consultorio_agendamento(conn, payload.profissionalId, payload.data, payload.horaInicio, payload.horaFim)
        usuario = usuario_request(request)
        momento = agora_br()

        colunas_insert = [
            "paciente_id",
            "paciente_nome",
            "nome_paciente_snapshot",
            "telefone_snapshot",
            "profissional",
            "profissional_id",
            "tipo_atendimento_id",
            "procedimento_nome_snapshot",
            "procedimento",
            "contrato_id",
            "origem_contrato",
            data_coluna_agenda,
            "hora_inicio",
            "hora_fim",
            "duracao_minutos",
            "consultorio",
            "observacao",
            "observacoes",
            "trabalho_tipo",
            "ordem_servico_id",
            "ordem_servico_documento_nome",
            "elemento_arcada",
            "recorrencia_grupo",
            "recorrencia_intervalo_dias",
            "recorrencia_total",
            "recorrencia_indice",
            "status",
            "criado_por",
            "criado_em",
            "atualizado_por",
            "atualizado_em",
            "data_criacao",
        ]
        valores_insert = [
            paciente_id_final,
            payload.nomePaciente,
            payload.nomePaciente,
            payload.telefone or "",
            payload.profissionalNome,
            payload.profissionalId,
            payload.tipoAtendimentoId,
            primeiro_procedimento,
            primeiro_procedimento,
            contrato_id,
            origem_contrato,
            payload.data,
            payload.horaInicio,
            payload.horaFim,
            payload.duracaoMinutos,
            consultorio,
            payload.observacoes or "",
            payload.observacoes or "",
            str(payload.trabalhoTipo or "").strip(),
            payload.ordemServicoId,
            str(payload.ordemServicoDocumentoNome or "").strip(),
            str(payload.elementoArcada or "").strip(),
            str(payload.recorrenciaGrupo or "").strip(),
            int(payload.recorrenciaIntervaloDias or 0),
            int(payload.recorrenciaTotal or 0),
            int(payload.recorrenciaIndice or 0),
            normalizar_status_agendamento(payload.status or "Agendado"),
            usuario,
            momento,
            usuario,
            momento,
            momento,
        ]

        if data_coluna_agenda != "data" and "data" in colunas_agendamento:
            colunas_insert.append("data")
            valores_insert.append(payload.data)

        opcionais = {
            "prontuario_snapshot": payload.prontuario or "",
            "tipo_atendimento_nome_snapshot": payload.tipoAtendimentoNome,
        }
        for coluna, valor in opcionais.items():
            if coluna in colunas_agendamento:
                colunas_insert.append(coluna)
                valores_insert.append(valor)

        placeholders = ", ".join(["?"] * len(colunas_insert))
        cursor = conn.execute(
            f"INSERT INTO agendamentos ({', '.join(colunas_insert)}) VALUES ({placeholders})",
            tuple(valores_insert),
        )
        agendamento_id = cursor.lastrowid
        registrar_historico_agendamento(
            conn,
            agendamento_id,
            "CRIADO",
            f"Agendado para {payload.data} em {payload.horaInicio} com {payload.profissionalNome}.",
            usuario,
            momento,
        )

        for procedimento in payload.procedimentos:
            conn.execute(
                """
                INSERT INTO agendamento_procedimentos (
                  agendamento_id,
                  procedimento_id,
                  procedimento_nome_snapshot,
                  valor_snapshot,
                  duracao_snapshot_minutos,
                  origem_contrato,
                  contrato_id
                )
                VALUES (?, ?, ?, 0, ?, ?, ?)
                """,
                (
                    agendamento_id,
                    procedimento.procedimentoId,
                    procedimento.nome,
                    procedimento.duracaoMinutos or payload.duracaoMinutos,
                    1 if procedimento.origem == "contrato" else 0,
                    procedimento.contratoId,
                ),
            )

        conn.commit()
        row = conn.execute("SELECT * FROM agendamentos WHERE id=?", (agendamento_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Agendamento não encontrado após salvar.")
        registrar_acao_agendamento(
            usuario,
            acao="Criacao",
            rota="/api/agenda/agendamentos",
            info=descrever_agendamento_para_auditoria(agendamento_id, payload),
        )
        return mapear_agendamento(conn, row)
    finally:
        conn.close()


@app.put("/api/agenda/agendamentos/{agendamento_id}/serie", response_model=AgendamentosSerieResposta)
def atualizar_agendamento_serie(agendamento_id: int, payload: AgendamentoPayload, request: Request):
    data_coluna_agenda = obter_data_coluna_agenda()
    conn = conectar()
    try:
        base = conn.execute("SELECT * FROM agendamentos WHERE id=?", (agendamento_id,)).fetchone()
        if not base:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        grupo = str(row_val(base, "recorrencia_grupo", "") or "").strip()
        if not grupo:
            return AgendamentosSerieResposta(agendamentos=[atualizar_agendamento(agendamento_id, payload, request)])

        paciente_id_final = garantir_paciente_minimo(conn, payload.pacienteId, payload.nomePaciente, payload.telefone)
        usuario = usuario_request(request)
        momento = agora_br()
        primeiro_procedimento = payload.procedimentos[0].nome if payload.procedimentos else ""
        contrato_id = next((item.contratoId for item in payload.procedimentos if item.contratoId), None)
        origem_contrato = 1 if contrato_id else 0
        delta_dias = (data_br_para_date(payload.data) - data_br_para_date(row_val(base, data_coluna_agenda, payload.data))).days

        rows = conn.execute(
            f"SELECT * FROM agendamentos WHERE COALESCE(recorrencia_grupo, '')=? ORDER BY {data_coluna_agenda}, hora_inicio, id",
            (grupo,),
        ).fetchall()

        for row in rows:
            nova_data = adicionar_dias_data_br(row_val(row, data_coluna_agenda, payload.data), delta_dias)
            if existe_conflito_excluindo(conn, int(row["id"]), payload.profissionalId, nova_data, payload.horaInicio, payload.horaFim):
                raise HTTPException(status_code=409, detail=f"Conflito de horário na série para {nova_data}.")

        for row in rows:
            row_id = int(row["id"])
            nova_data = adicionar_dias_data_br(row_val(row, data_coluna_agenda, payload.data), delta_dias)
            consultorio = definir_consultorio_agendamento(
                conn,
                payload.profissionalId,
                nova_data,
                payload.horaInicio,
                payload.horaFim,
                ignorar_agendamento_id=row_id,
            )
            procedimentos_atuais = carregar_procedimentos_agendamento(conn, row_id)
            payload_item = AgendamentoPayload(
                **{
                    **payload.model_dump(),
                    "data": nova_data,
                    "recorrenciaGrupo": grupo,
                    "recorrenciaIntervaloDias": int(row_val(row, "recorrencia_intervalo_dias", 0) or 0),
                    "recorrenciaTotal": int(row_val(row, "recorrencia_total", 0) or 0),
                    "recorrenciaIndice": int(row_val(row, "recorrencia_indice", 0) or 0),
                }
            )
            descricao_alteracoes = descrever_alteracoes_agendamento(row, payload_item, procedimentos_atuais)
            if normalizar_consultorio(row_val(row, "consultorio", "")) != consultorio:
                alteracao_sala = f"sala: {normalizar_consultorio(row_val(row, 'consultorio', '')) or '-'} -> {consultorio or '-'}"
                descricao_alteracoes = f"{descricao_alteracoes}; {alteracao_sala}" if descricao_alteracoes else alteracao_sala

            conn.execute(
                f"""
                UPDATE agendamentos
                SET paciente_id=?,
                    paciente_nome=?,
                    nome_paciente_snapshot=?,
                    telefone_snapshot=?,
                    profissional=?,
                    profissional_id=?,
                    tipo_atendimento_id=?,
                    tipo_atendimento_nome_snapshot=?,
                    procedimento_nome_snapshot=?,
                    procedimento=?,
                    contrato_id=?,
                    origem_contrato=?,
                    {data_coluna_agenda}=?,
                    hora_inicio=?,
                    hora_fim=?,
                    duracao_minutos=?,
                    consultorio=?,
                    observacao=?,
                    observacoes=?,
                    trabalho_tipo=?,
                    ordem_servico_id=?,
                    ordem_servico_documento_nome=?,
                    elemento_arcada=?,
                    status=?,
                    atualizado_por=?,
                    atualizado_em=?
                WHERE id=?
                """,
                (
                    paciente_id_final,
                    payload.nomePaciente,
                    payload.nomePaciente,
                    payload.telefone or "",
                    payload.profissionalNome,
                    payload.profissionalId,
                    payload.tipoAtendimentoId,
                    payload.tipoAtendimentoNome,
                    primeiro_procedimento,
                    primeiro_procedimento,
                    contrato_id,
                    origem_contrato,
                    nova_data,
                    payload.horaInicio,
                    payload.horaFim,
                    payload.duracaoMinutos,
                    consultorio,
                    payload.observacoes or "",
                    payload.observacoes or "",
                    str(payload.trabalhoTipo or "").strip(),
                    payload.ordemServicoId,
                    str(payload.ordemServicoDocumentoNome or "").strip(),
                    str(payload.elementoArcada or "").strip(),
                    normalizar_status_agendamento(payload.status or "Agendado"),
                    usuario,
                    momento,
                    row_id,
                ),
            )
            conn.execute("DELETE FROM agendamento_procedimentos WHERE agendamento_id=?", (row_id,))
            for procedimento in payload.procedimentos:
                conn.execute(
                    """
                    INSERT INTO agendamento_procedimentos (
                      agendamento_id,
                      procedimento_id,
                      procedimento_nome_snapshot,
                      valor_snapshot,
                      duracao_snapshot_minutos,
                      origem_contrato,
                      contrato_id
                    )
                    VALUES (?, ?, ?, 0, ?, ?, ?)
                    """,
                    (
                        row_id,
                        procedimento.procedimentoId,
                        procedimento.nome,
                        procedimento.duracaoMinutos or payload.duracaoMinutos,
                        1 if procedimento.origem == "contrato" else 0,
                        procedimento.contratoId,
                    ),
                )
            if descricao_alteracoes:
                registrar_historico_agendamento(conn, row_id, "MODIFICADO", f"Série atualizada: {descricao_alteracoes}", usuario, momento)

        conn.commit()
        atualizados = [
            mapear_agendamento(conn, conn.execute("SELECT * FROM agendamentos WHERE id=?", (int(row["id"]),)).fetchone())
            for row in rows
        ]
        registrar_acao_agendamento(
            usuario,
            acao="Edicao",
            rota=f"/api/agenda/agendamentos/{agendamento_id}/serie",
            info=f"Série {grupo} atualizada a partir do agendamento {agendamento_id}",
        )
        return AgendamentosSerieResposta(agendamentos=atualizados)
    finally:
        conn.close()


@app.get("/api/agenda/agendamentos/{agendamento_id}", response_model=AgendamentoResposta)
def detalhar_agendamento(agendamento_id: int):
    conn = conectar()
    try:
        row = conn.execute("SELECT * FROM agendamentos WHERE id=?", (agendamento_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado.")
        return mapear_agendamento(conn, row)
    finally:
        conn.close()


@app.put("/api/agenda/agendamentos/{agendamento_id}", response_model=AgendamentoResposta)
def atualizar_agendamento(agendamento_id: int, payload: AgendamentoPayload, request: Request):
    data_coluna_agenda = obter_data_coluna_agenda()
    conn = conectar()
    try:
        existente = conn.execute("SELECT * FROM agendamentos WHERE id=?", (agendamento_id,)).fetchone()
        if not existente:
            raise HTTPException(status_code=404, detail="Agendamento não encontrado.")

        paciente_id_final = garantir_paciente_minimo(conn, payload.pacienteId, payload.nomePaciente, payload.telefone)
        if existe_conflito_excluindo(conn, agendamento_id, payload.profissionalId, payload.data, payload.horaInicio, payload.horaFim):
            raise HTTPException(status_code=409, detail="Conflito de horário para o profissional selecionado.")

        primeiro_procedimento = payload.procedimentos[0].nome if payload.procedimentos else ""
        contrato_id = next((item.contratoId for item in payload.procedimentos if item.contratoId), None)
        origem_contrato = 1 if contrato_id else 0
        consultorio = definir_consultorio_agendamento(
            conn,
            payload.profissionalId,
            payload.data,
            payload.horaInicio,
            payload.horaFim,
            ignorar_agendamento_id=agendamento_id,
        )
        procedimentos_atuais = carregar_procedimentos_agendamento(conn, agendamento_id)
        descricao_alteracoes = descrever_alteracoes_agendamento(existente, payload, procedimentos_atuais)
        if normalizar_consultorio(row_val(existente, "consultorio", "")) != consultorio:
            alteracao_sala = f"sala: {normalizar_consultorio(row_val(existente, 'consultorio', '')) or '-'} -> {consultorio or '-'}"
            descricao_alteracoes = f"{descricao_alteracoes}; {alteracao_sala}" if descricao_alteracoes else alteracao_sala
        usuario = usuario_request(request)
        momento = agora_br()

        conn.execute(
            f"""
            UPDATE agendamentos
            SET paciente_id=?,
                paciente_nome=?,
                nome_paciente_snapshot=?,
                telefone_snapshot=?,
                profissional=?,
                profissional_id=?,
                tipo_atendimento_id=?,
                tipo_atendimento_nome_snapshot=?,
                procedimento_nome_snapshot=?,
                procedimento=?,
                contrato_id=?,
                origem_contrato=?,
                {data_coluna_agenda}=?,
                hora_inicio=?,
                hora_fim=?,
                duracao_minutos=?,
                consultorio=?,
                observacao=?,
                observacoes=?,
                trabalho_tipo=?,
                ordem_servico_id=?,
                ordem_servico_documento_nome=?,
                elemento_arcada=?,
                recorrencia_grupo=?,
                recorrencia_intervalo_dias=?,
                recorrencia_total=?,
                recorrencia_indice=?,
                status=?,
                atualizado_por=?,
                atualizado_em=?
            WHERE id=?
            """,
            (
                paciente_id_final,
                payload.nomePaciente,
                payload.nomePaciente,
                payload.telefone or "",
                payload.profissionalNome,
                payload.profissionalId,
                payload.tipoAtendimentoId,
                payload.tipoAtendimentoNome,
                primeiro_procedimento,
                primeiro_procedimento,
                contrato_id,
                origem_contrato,
                payload.data,
                payload.horaInicio,
                payload.horaFim,
                payload.duracaoMinutos,
                consultorio,
                payload.observacoes or "",
                payload.observacoes or "",
                str(payload.trabalhoTipo or "").strip(),
                payload.ordemServicoId,
                str(payload.ordemServicoDocumentoNome or "").strip(),
                str(payload.elementoArcada or "").strip(),
                str(payload.recorrenciaGrupo or row_val(existente, "recorrencia_grupo", "") or "").strip(),
                int(payload.recorrenciaIntervaloDias or row_val(existente, "recorrencia_intervalo_dias", 0) or 0),
                int(payload.recorrenciaTotal or row_val(existente, "recorrencia_total", 0) or 0),
                int(payload.recorrenciaIndice or row_val(existente, "recorrencia_indice", 0) or 0),
                normalizar_status_agendamento(payload.status or "Agendado"),
                usuario,
                momento,
                agendamento_id,
            ),
            )

        if descricao_alteracoes:
            registrar_historico_agendamento(
                conn,
                agendamento_id,
                "MODIFICADO",
                descricao_alteracoes,
                usuario,
                momento,
            )

        conn.execute("DELETE FROM agendamento_procedimentos WHERE agendamento_id=?", (agendamento_id,))
        for procedimento in payload.procedimentos:
            conn.execute(
                """
                INSERT INTO agendamento_procedimentos (
                  agendamento_id,
                  procedimento_id,
                  procedimento_nome_snapshot,
                  valor_snapshot,
                  duracao_snapshot_minutos,
                  origem_contrato,
                  contrato_id
                )
                VALUES (?, ?, ?, 0, ?, ?, ?)
                """,
                (
                    agendamento_id,
                    procedimento.procedimentoId,
                    procedimento.nome,
                    procedimento.duracaoMinutos or payload.duracaoMinutos,
                    1 if procedimento.origem == "contrato" else 0,
                    procedimento.contratoId,
                ),
            )

        conn.commit()
        row = conn.execute("SELECT * FROM agendamentos WHERE id=?", (agendamento_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=500, detail="Agendamento não encontrado após atualizar.")
        registrar_acao_agendamento(
            usuario,
            acao="Edicao",
            rota=f"/api/agenda/agendamentos/{agendamento_id}",
            info=descrever_agendamento_para_auditoria(
                agendamento_id,
                payload,
                descricao_alteracoes or "sem mudancas estruturais identificadas",
            ),
        )
        return mapear_agendamento(conn, row)
    finally:
        conn.close()
