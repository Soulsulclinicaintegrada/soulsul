from __future__ import annotations

from datetime import datetime
import json
import sqlite3
from typing import Literal

from fastapi import FastAPI, HTTPException, Query
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
    procedimentos: list[ProcedimentoPayload] = Field(default_factory=list)


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
    observacoes: str | None = None
    financeiro: str | None = None
    agendadoEm: str | None = None
    contratoId: int | None = None


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


class PacienteContextoResposta(BaseModel):
    id: int
    nome: str
    prontuario: str
    celular: str
    procedimentosContratados: list[ProcedimentoContratoItem]


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
        }
        for indice in range(7)
    }


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
        status=row_val(row, "status", "Agendado") or "Agendado",
        data=row[data_coluna_agenda],
        inicio=row_val(row, "hora_inicio", ""),
        fim=row_val(row, "hora_fim", ""),
        observacoes=row_val(row, "observacoes", "") or row_val(row, "observacao", ""),
        financeiro=financeiro,
        agendadoEm=row_val(row, "criado_em", "") or row_val(row, "data_criacao", ""),
        contratoId=contrato_id,
    )


def existe_conflito(conn: sqlite3.Connection, profissional_id: int, data: str, inicio: str, fim: str) -> bool:
    data_coluna_agenda = obter_data_coluna_agenda()
    row = conn.execute(
        f"""
        SELECT 1
        FROM agendamentos
        WHERE profissional_id=?
          AND {data_coluna_agenda}=?
          AND COALESCE(status, 'Agendado') <> 'Cancelado'
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
          AND COALESCE(status, 'Agendado') <> 'Cancelado'
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
):
    data_coluna_agenda = obter_data_coluna_agenda()
    conn = conectar()
    try:
        rows = conn.execute(
            f"""
            SELECT *
            FROM agendamentos
            WHERE profissional_id=?
              AND {data_coluna_agenda}=?
              AND COALESCE(status, 'Agendado') <> 'Cancelado'
            ORDER BY hora_inicio
            """,
            (profissional_id, data),
        ).fetchall()

        ocupados: list[str] = []
        for row in rows:
            inicio = para_minutos(row["hora_inicio"])
            fim = para_minutos(row["hora_fim"])
            ocupados.extend(
                slot
                for slot in gerar_slots_quinze()
                if para_minutos(slot) >= inicio and para_minutos(slot) < fim
            )

        return DisponibilidadeResposta(
            ocupados=sorted(set(ocupados), key=para_minutos),
            agendamentos=[mapear_agendamento(conn, row) for row in rows],
        )
    finally:
        conn.close()


@app.get("/api/agenda/agendamentos", response_model=AgendamentosListaResposta)
def listar_agendamentos(
    data_inicio: str = Query(..., alias="data_inicio"),
    data_fim: str | None = Query(None, alias="data_fim"),
):
    data_coluna_agenda = obter_data_coluna_agenda()
    conn = conectar()
    try:
        data_fim_real = data_fim or data_inicio
        rows = conn.execute(
            f"""
            SELECT *
            FROM agendamentos
            WHERE {data_coluna_agenda} >= ?
              AND {data_coluna_agenda} <= ?
            ORDER BY {data_coluna_agenda}, hora_inicio, profissional
            """,
            (data_inicio, data_fim_real),
        ).fetchall()
        return AgendamentosListaResposta(
            agendamentos=[mapear_agendamento(conn, row) for row in rows]
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
            INSERT INTO agenda_configuracao (id, ordem_profissionais_json, config_clinica_dias_json, config_profissionais_json, atualizado_em)
            VALUES (1, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              ordem_profissionais_json=excluded.ordem_profissionais_json,
              config_clinica_dias_json=excluded.config_clinica_dias_json,
              config_profissionais_json=excluded.config_profissionais_json,
              atualizado_em=excluded.atualizado_em
            """,
            (
                json.dumps(ordem, ensure_ascii=False),
                json.dumps(clinica, ensure_ascii=False),
                json.dumps(profissionais, ensure_ascii=False),
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

        rows = conn.execute(
            """
            SELECT
              c.id AS contrato_id,
              pc.procedimento,
              pc.valor,
              COALESCE(pr.duracao_padrao_minutos, 45) AS duracao
            FROM contratos c
            JOIN procedimentos_contrato pc ON pc.contrato_id = c.id
            LEFT JOIN procedimentos pr ON lower(trim(pr.nome)) = lower(trim(pc.procedimento))
            WHERE c.paciente_id=?
            ORDER BY c.id DESC, pc.id
            """,
            (paciente_id,),
        ).fetchall()

        itens: list[ProcedimentoContratoItem] = []
        for row in rows:
            usados_row = conn.execute(
                """
                SELECT COUNT(*) AS total
                FROM agendamento_procedimentos ap
                JOIN agendamentos a ON a.id = ap.agendamento_id
                WHERE ap.contrato_id=?
                  AND lower(trim(ap.procedimento_nome_snapshot)) = lower(trim(?))
                  AND COALESCE(a.status, 'Agendado') <> 'Cancelado'
                """,
                (row["contrato_id"], row["procedimento"]),
            ).fetchone()
            sessoes_total = 1
            sessoes_restantes = max(0, sessoes_total - int(usados_row["total"]))
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

        return PacienteContextoResposta(
            id=paciente["id"],
            nome=paciente["nome"],
            prontuario=paciente["prontuario"],
            celular=paciente["telefone"],
            procedimentosContratados=itens,
        )
    finally:
        conn.close()


@app.post("/api/agenda/agendamentos", response_model=AgendamentoResposta)
def criar_agendamento(payload: AgendamentoPayload):
    data_coluna_agenda = obter_data_coluna_agenda()
    conn = conectar()
    try:
        paciente_id_final = garantir_paciente_minimo(conn, payload.pacienteId, payload.nomePaciente, payload.telefone)
        if existe_conflito(conn, payload.profissionalId, payload.data, payload.horaInicio, payload.horaFim):
            raise HTTPException(status_code=409, detail="Conflito de horário para o profissional selecionado.")

        colunas_agendamento = colunas_tabela(conn, "agendamentos")
        primeiro_procedimento = payload.procedimentos[0].nome if payload.procedimentos else ""
        contrato_id = next((item.contratoId for item in payload.procedimentos if item.contratoId), None)
        origem_contrato = 1 if contrato_id else 0

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
            "observacao",
            "observacoes",
            "status",
            "criado_por",
            "criado_em",
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
            payload.observacoes or "",
            payload.observacoes or "",
            payload.status or "Agendado",
            payload.agendadoPor,
            payload.agendadoEm,
            payload.agendadoEm,
            payload.agendadoEm,
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
        return mapear_agendamento(conn, row)
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
def atualizar_agendamento(agendamento_id: int, payload: AgendamentoPayload):
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
                observacao=?,
                observacoes=?,
                status=?,
                criado_por=?,
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
                payload.observacoes or "",
                payload.observacoes or "",
                payload.status or "Agendado",
                payload.agendadoPor,
                agora_br(),
                agendamento_id,
            ),
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
        return mapear_agendamento(conn, row)
    finally:
        conn.close()
