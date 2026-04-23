from __future__ import annotations

import math
import sqlite3
from pathlib import Path
from typing import Any

import pandas as pd

from api_pacientes import garantir_colunas_pacientes_api
from database import conectar, inicializar_banco


POSSIVEIS_PLANILHAS = [
    Path(r"C:\Users\jusgo\Downloads\Patient (5).xlsx"),
    Path(r"C:\Users\jusgo\Downloads\Patient (6).xlsx"),
    Path(r"C:\Users\jusgo\Downloads\Patient (4).xlsx"),
    Path(r"C:\Users\jusgo\Downloads\Patient (2).xlsx"),
]


def localizar_planilha() -> Path:
    for arquivo in POSSIVEIS_PLANILHAS:
        if arquivo.exists():
            return arquivo
    return POSSIVEIS_PLANILHAS[0]


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip() == ""


def clean_str(value: Any) -> str:
    if is_blank(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def digits_only(value: Any) -> str:
    return "".join(ch for ch in clean_str(value) if ch.isdigit())


def title_case(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    return " ".join(part.capitalize() for part in text.split())


def parse_date(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    try:
        parsed = pd.to_datetime(text, utc=True, errors="coerce")
    except Exception:
        parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        return ""
    try:
        parsed = parsed.tz_convert(None)
    except Exception:
        try:
            parsed = parsed.tz_localize(None)
        except Exception:
            pass
    return parsed.strftime("%Y-%m-%d")


def translate_sex(value: Any) -> str:
    raw = clean_str(value).upper()
    mapping = {
        "F": "Feminino",
        "M": "Masculino",
        "O": "Outro",
    }
    return mapping.get(raw, clean_str(value))


def translate_civil_status(value: Any) -> str:
    raw = clean_str(value).upper()
    mapping = {
        "SINGLE": "Solteiro(a)",
        "MARRIED": "Casado(a)",
        "DIVORCED": "Divorciado(a)",
        "WIDOWED": "Viúvo(a)",
        "SEPARATED": "Separado(a)",
        "STABLE_UNION": "União Estável",
    }
    return mapping.get(raw, clean_str(value))


def build_observacoes(row: pd.Series) -> str:
    linhas: list[str] = []

    notes = clean_str(row.get("Notes"))
    if notes:
        linhas.append(notes)

    campos_rotulados = [
        ("Escolaridade", row.get("Education")),
        ("Outros Telefones", row.get("OtherPhones")),
        ("Fone Fixo", row.get("Landline")),
        ("Nome do Pai", row.get("fatherName")),
        ("CPF do Pai", row.get("FatherOtherDocument")),
        ("RG do Pai", row.get("FatherDocument")),
        ("Nome da Mãe", row.get("motherName")),
        ("CPF da Mãe", row.get("MotherOtherDocument")),
        ("RG da Mãe", row.get("MotherDocument")),
        ("Profissão/Local de Trabalho Legado", row.get("Workplace")),
        ("Origem de Indicação", row.get("IndicationSource")),
        ("ID Importado", row.get("ImportedId")),
    ]

    for label, value in campos_rotulados:
        text = clean_str(value)
        if text:
            linhas.append(f"{label}: {text}")

    return "\n".join(linhas).strip()


def should_import_row(row: pd.Series) -> bool:
    tipo = clean_str(row.get("Type")).upper()
    ativo = clean_str(row.get("Active")).upper()
    deletado = clean_str(row.get("Deleted")).upper()
    nome = clean_str(row.get("Name"))

    if not nome:
        return False
    if tipo and tipo != "PATIENT":
        return False
    if deletado in {"X", "TRUE", "1"}:
        return False
    if ativo and ativo not in {"X", "TRUE", "1"}:
        return False
    return True


def next_prontuario(conn: sqlite3.Connection) -> int:
    row = conn.execute(
        """
        SELECT MAX(CAST(prontuario AS INTEGER))
        FROM pacientes
        WHERE prontuario GLOB '[0-9]*'
        """
    ).fetchone()
    current = row[0] or 0
    return int(current) + 1


def importar() -> tuple[int, int]:
    arquivo_planilha = localizar_planilha()
    if not arquivo_planilha.exists():
        raise FileNotFoundError(f"Planilha não encontrada: {arquivo_planilha}")

    inicializar_banco()
    garantir_colunas_pacientes_api()

    df = pd.read_excel(arquivo_planilha)

    conn = conectar()
    conn.execute("DELETE FROM pacientes")
    conn.commit()

    imported = 0
    skipped = 0
    proximo_prontuario = next_prontuario(conn)

    insert_sql = """
        INSERT INTO pacientes (
            nome,
            apelido,
            sexo,
            prontuario,
            cpf,
            rg,
            data_nascimento,
            telefone,
            email,
            cep,
            endereco,
            complemento,
            numero,
            bairro,
            cidade,
            estado,
            estado_civil,
            profissao,
            origem,
            observacoes,
            menor_idade,
            responsavel,
            cpf_responsavel
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """

    for _, row in df.iterrows():
        if not should_import_row(row):
            skipped += 1
            continue

        prontuario = clean_str(row.get("ClinicalRecordNumber"))
        if not prontuario:
            prontuario = str(proximo_prontuario)
            proximo_prontuario += 1

        idade = clean_str(row.get("Age"))
        menor_idade = 0
        if idade.isdigit():
            menor_idade = 1 if int(idade) < 18 else 0
        if clean_str(row.get("PersonInCharge")):
            menor_idade = 1

        origem = clean_str(row.get("HowDidMeet")) or clean_str(row.get("IndicationSource"))

        values = (
            title_case(row.get("Name")),
            title_case(row.get("NickName")),
            translate_sex(row.get("Sex")),
            prontuario,
            digits_only(row.get("OtherDocumentId")),
            digits_only(row.get("DocumentId")),
            parse_date(row.get("BirthDate")),
            digits_only(row.get("MobilePhone")) or digits_only(row.get("Landline")),
            clean_str(row.get("Email")),
            digits_only(row.get("Zip")),
            title_case(row.get("Address")),
            title_case(row.get("AddressComplement")),
            clean_str(row.get("AddressNumber")),
            title_case(row.get("Neighborhood")),
            title_case(row.get("City")),
            clean_str(row.get("state")).upper(),
            translate_civil_status(row.get("CivilStatus")),
            title_case(row.get("Profession")),
            title_case(origem),
            build_observacoes(row),
            menor_idade,
            title_case(row.get("PersonInCharge")),
            digits_only(row.get("PersonInChargeOtherDocument")),
        )

        conn.execute(insert_sql, values)
        imported += 1

    conn.commit()
    conn.close()
    return imported, skipped


if __name__ == "__main__":
    imported, skipped = importar()
    print(f"PACIENTES_IMPORTADOS={imported}")
    print(f"LINHAS_DESCARTADAS={skipped}")
