from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import sqlite3

from api_agenda import garantir_colunas_agenda_api
from api_pacientes import garantir_colunas_pacientes_api
from database import conectar, inicializar_banco
from importar_dados_operacionais import (
    BASE_DOWNLOADS,
    clean_str,
    digits_only,
    load_dataframe,
    normalize_text,
)


AGORA = datetime.now().strftime("%d/%m/%Y %H:%M")


@dataclass(frozen=True)
class RegistroStatusAgenda:
    status: str
    data: str
    nome: str
    telefone: str
    categoria: str
    origem: str
    motivo: str
    usuario: str


def normalizar_nome_paciente(valor: object) -> str:
    texto = clean_str(valor)
    if not texto:
        return ""
    texto = texto.replace(" - Desmarcado", "")
    texto = texto.replace(" - Faltou", "")
    return " ".join(texto.split()).strip()


def titulo_curto(valor: object) -> str:
    texto = clean_str(valor)
    if not texto:
        return ""
    return " ".join(parte.capitalize() for parte in texto.split())


def listar_arquivos(prefixo: str) -> list[Path]:
    arquivos = sorted(BASE_DOWNLOADS.glob(f"{prefixo}*.xlsx"))
    existentes = [arquivo for arquivo in arquivos if arquivo.exists()]
    return existentes


def carregar_registros_faltas() -> list[RegistroStatusAgenda]:
    unicos: dict[tuple[str, ...], RegistroStatusAgenda] = {}
    for arquivo in listar_arquivos("Agendamentos - Faltas"):
        df = load_dataframe(arquivo)
        for _, row in df.iterrows():
            data = clean_str(row.get("Data"))
            nome = normalizar_nome_paciente(row.get("Nome"))
            telefone = digits_only(row.get("Contato"))
            categoria = titulo_curto(row.get("Categoria"))
            if not data or not nome:
                continue
            registro = RegistroStatusAgenda(
                status="Faltou",
                data=data,
                nome=nome,
                telefone=telefone,
                categoria=categoria or "Consulta",
                origem="Paciente",
                motivo="",
                usuario="Importacao",
            )
            unicos[(registro.status, registro.data, normalize_text(registro.nome), registro.telefone, normalize_text(registro.categoria))] = registro
    return list(unicos.values())


def carregar_registros_desmarcacoes() -> list[RegistroStatusAgenda]:
    unicos: dict[tuple[str, ...], RegistroStatusAgenda] = {}
    for arquivo in listar_arquivos("Agendamentos - Desmarcações"):
        df = load_dataframe(arquivo)
        for _, row in df.iterrows():
            data = clean_str(row.get("Data"))
            nome = normalizar_nome_paciente(row.get("Nome"))
            telefone = digits_only(row.get("Contato"))
            categoria = titulo_curto(row.get("Categoria"))
            origem = titulo_curto(row.get("Quem desmarcou")) or "Paciente"
            motivo = clean_str(row.get("Motivo"))
            usuario = titulo_curto(row.get("Usuário")) or "Importacao"
            if not data or not nome:
                continue
            registro = RegistroStatusAgenda(
                status="Desmarcado",
                data=data,
                nome=nome,
                telefone=telefone,
                categoria=categoria or "Consulta",
                origem=origem,
                motivo=motivo,
                usuario=usuario,
            )
            unicos[
                (
                    registro.status,
                    registro.data,
                    normalize_text(registro.nome),
                    registro.telefone,
                    normalize_text(registro.categoria),
                    normalize_text(registro.origem),
                    normalize_text(registro.motivo),
                    normalize_text(registro.usuario),
                )
            ] = registro
    return list(unicos.values())


def carregar_mapa_pacientes(conn: sqlite3.Connection) -> tuple[dict[str, sqlite3.Row], dict[str, sqlite3.Row]]:
    rows = conn.execute(
        """
        SELECT id, nome, prontuario, telefone
        FROM pacientes
        """
    ).fetchall()
    por_telefone: dict[str, sqlite3.Row] = {}
    por_nome: dict[str, sqlite3.Row] = {}
    for row in rows:
        telefone = digits_only(row["telefone"])
        nome = normalize_text(row["nome"])
        if telefone and telefone not in por_telefone:
            por_telefone[telefone] = row
        if nome and nome not in por_nome:
            por_nome[nome] = row
    return por_telefone, por_nome


def carregar_mapa_tipos(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute("SELECT id, nome FROM tipos_atendimento WHERE ativo=1").fetchall()
    return {normalize_text(row["nome"]): int(row["id"]) for row in rows if normalize_text(row["nome"])}


def categoria_equivale(categoria: str, row: sqlite3.Row) -> bool:
    categoria_norm = normalize_text(categoria)
    if not categoria_norm:
        return True
    candidatos = [
        normalize_text(row["tipo_atendimento_nome_snapshot"]),
        normalize_text(row["procedimento_nome_snapshot"]),
        normalize_text(row["procedimento"]),
    ]
    return any(categoria_norm and categoria_norm in candidato for candidato in candidatos if candidato)


def escolher_agendamento_existente(conn: sqlite3.Connection, registro: RegistroStatusAgenda, paciente_id: int | None) -> sqlite3.Row | None:
    rows = conn.execute(
        """
        SELECT *
        FROM agendamentos
        WHERE COALESCE(data_agendamento, data, '')=?
        ORDER BY
            CASE WHEN lower(trim(COALESCE(status, 'Agendado'))) IN ('desmarcado', 'faltou', 'cancelado') THEN 0 ELSE 1 END,
            CASE WHEN paciente_id IS NOT NULL THEN 0 ELSE 1 END,
            hora_inicio,
            id
        """,
        (registro.data,),
    ).fetchall()
    nome_norm = normalize_text(registro.nome)
    telefone_norm = registro.telefone
    melhor_row: sqlite3.Row | None = None
    melhor_score = -1
    for row in rows:
        score = 0
        row_nome = normalize_text(row["nome_paciente_snapshot"] or row["paciente_nome"])
        row_telefone = digits_only(row["telefone_snapshot"])
        if paciente_id and row["paciente_id"] == paciente_id:
            score += 6
        if telefone_norm and row_telefone and telefone_norm == row_telefone:
            score += 5
        if nome_norm and row_nome == nome_norm:
            score += 4
        elif nome_norm and row_nome and (nome_norm in row_nome or row_nome in nome_norm):
            score += 2
        if categoria_equivale(registro.categoria, row):
            score += 2
        if score > melhor_score:
            melhor_score = score
            melhor_row = row
    return melhor_row if melhor_score >= 4 else None


def atualizar_observacoes(observacoes: str, registro: RegistroStatusAgenda) -> str:
    extras: list[str] = []
    if registro.status == "Desmarcado" and registro.origem:
        extras.append(f"Desmarcado por: {registro.origem}")
    if registro.motivo:
        extras.append(f"Motivo: {registro.motivo}")
    if registro.usuario:
        extras.append(f"Registrado por: {registro.usuario}")
    base = clean_str(observacoes)
    partes = [parte for parte in [base, " | ".join(extras)] if parte]
    return " | ".join(partes)


def aplicar_registro(
    conn: sqlite3.Connection,
    registro: RegistroStatusAgenda,
    mapa_pacientes_telefone: dict[str, sqlite3.Row],
    mapa_pacientes_nome: dict[str, sqlite3.Row],
    mapa_tipos: dict[str, int],
) -> tuple[str, int]:
    paciente = None
    if registro.telefone:
        paciente = mapa_pacientes_telefone.get(registro.telefone)
    if not paciente:
        paciente = mapa_pacientes_nome.get(normalize_text(registro.nome))

    paciente_id = int(paciente["id"]) if paciente else None
    prontuario = clean_str(paciente["prontuario"]) if paciente else ""
    telefone = registro.telefone or (digits_only(paciente["telefone"]) if paciente else "")
    tipo_nome = registro.categoria or "Consulta"
    tipo_id = mapa_tipos.get(normalize_text(tipo_nome), 0)
    existente = escolher_agendamento_existente(conn, registro, paciente_id)

    if existente:
        observacoes_atuais = clean_str(existente["observacoes"] or existente["observacao"])
        conn.execute(
            """
            UPDATE agendamentos
            SET
                paciente_id=COALESCE(paciente_id, ?),
                nome_paciente_snapshot=COALESCE(NULLIF(nome_paciente_snapshot, ''), ?),
                paciente_nome=COALESCE(NULLIF(paciente_nome, ''), ?),
                prontuario_snapshot=COALESCE(NULLIF(prontuario_snapshot, ''), ?),
                telefone_snapshot=COALESCE(NULLIF(telefone_snapshot, ''), ?),
                tipo_atendimento_id=CASE WHEN COALESCE(tipo_atendimento_id, 0)=0 THEN ? ELSE tipo_atendimento_id END,
                tipo_atendimento_nome_snapshot=COALESCE(NULLIF(tipo_atendimento_nome_snapshot, ''), ?),
                procedimento_nome_snapshot=COALESCE(NULLIF(procedimento_nome_snapshot, ''), ?),
                procedimento=COALESCE(NULLIF(procedimento, ''), ?),
                status=?,
                status_origem=?,
                status_motivo=?,
                status_usuario=?,
                observacoes=?,
                atualizado_em=?,
                atualizado_por=?
            WHERE id=?
            """,
            (
                paciente_id,
                registro.nome,
                registro.nome,
                prontuario,
                telefone,
                tipo_id,
                tipo_nome,
                tipo_nome,
                tipo_nome,
                registro.status,
                registro.origem,
                registro.motivo,
                registro.usuario,
                atualizar_observacoes(observacoes_atuais, registro),
                AGORA,
                "Importacao",
                int(existente["id"]),
            ),
        )
        return ("atualizado", int(existente["id"]))

    cursor = conn.execute(
        """
        INSERT INTO agendamentos (
            data,
            hora_inicio,
            hora_fim,
            paciente_id,
            paciente_nome,
            profissional,
            procedimento,
            status,
            observacao,
            data_criacao,
            nome_paciente_snapshot,
            telefone_snapshot,
            prontuario_snapshot,
            tipo_atendimento_id,
            tipo_atendimento_nome_snapshot,
            procedimento_nome_snapshot,
            data_agendamento,
            duracao_minutos,
            observacoes,
            status_origem,
            status_motivo,
            status_usuario,
            criado_por,
            criado_em,
            atualizado_por,
            atualizado_em
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            registro.data,
            "",
            "",
            paciente_id,
            registro.nome,
            "",
            tipo_nome,
            registro.status,
            registro.motivo,
            AGORA,
            registro.nome,
            telefone,
            prontuario,
            tipo_id or None,
            tipo_nome,
            tipo_nome,
            registro.data,
            0,
            atualizar_observacoes("", registro),
            registro.origem,
            registro.motivo,
            registro.usuario,
            "Importacao",
            AGORA,
            "Importacao",
            AGORA,
        ),
    )
    return ("criado", int(cursor.lastrowid))


def importar_status_agendamentos() -> dict[str, int]:
    inicializar_banco()
    garantir_colunas_pacientes_api()
    garantir_colunas_agenda_api()

    registros = carregar_registros_faltas() + carregar_registros_desmarcacoes()
    conn = conectar()
    try:
        mapa_pacientes_telefone, mapa_pacientes_nome = carregar_mapa_pacientes(conn)
        mapa_tipos = carregar_mapa_tipos(conn)
        atualizados = 0
        criados = 0
        for registro in registros:
            acao, _ = aplicar_registro(conn, registro, mapa_pacientes_telefone, mapa_pacientes_nome, mapa_tipos)
            if acao == "atualizado":
                atualizados += 1
            else:
                criados += 1
        conn.commit()
        return {
            "registros": len(registros),
            "atualizados": atualizados,
            "criados": criados,
            "faltas": sum(1 for item in registros if item.status == "Faltou"),
            "desmarcacoes": sum(1 for item in registros if item.status == "Desmarcado"),
        }
    finally:
        conn.close()


if __name__ == "__main__":
    resultado = importar_status_agendamentos()
    for chave, valor in resultado.items():
        print(f"{chave.upper()}={valor}")
