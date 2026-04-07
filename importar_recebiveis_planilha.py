from __future__ import annotations

import math
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from api_pacientes import garantir_colunas_pacientes_api
from database import conectar, inicializar_banco


POSSIVEIS_ARQUIVOS_RECEBIVEIS = [
    Path(r"C:\Users\jusgo\Desktop\a receber.xlsx"),
    Path(r"C:\Users\jusgo\Desktop\recebiveis.xlsx"),
    Path(r"C:\Users\jusgo\Desktop\recebíveis.xlsx"),
]
TODAY = datetime.now().date()


def localizar_arquivo_recebiveis() -> Path:
    for arquivo in POSSIVEIS_ARQUIVOS_RECEBIVEIS:
        if arquivo.exists():
            return arquivo
    return POSSIVEIS_ARQUIVOS_RECEBIVEIS[0]


def is_blank(value: Any) -> bool:
    if value is None:
        return True
    try:
        if pd.isna(value):
            return True
    except Exception:
        pass
    if isinstance(value, float) and math.isnan(value):
        return True
    return str(value).strip() == ""


def clean_str(value: Any) -> str:
    if is_blank(value):
        return ""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value).strip()


def normalize_text(value: Any) -> str:
    return " ".join(clean_str(value).lower().split())


def title_case(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    return " ".join(part.capitalize() for part in text.split())


def to_float(value: Any) -> float:
    if is_blank(value):
        return 0.0
    if isinstance(value, (int, float)):
        return round(float(value), 2)
    text = clean_str(value).replace(".", "").replace(",", ".")
    try:
        return round(float(text), 2)
    except ValueError:
        return 0.0


def is_numeric_like(value: Any) -> bool:
    if is_blank(value):
        return False
    if isinstance(value, (int, float)):
        return True
    text = clean_str(value).replace(".", "").replace(",", ".")
    try:
        float(text)
        return True
    except ValueError:
        return False


def parse_date(value: Any) -> str:
    if is_blank(value):
        return ""
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d")
        except Exception:
            pass
    text = clean_str(value)
    if not text:
        return ""
    try:
        if len(text) >= 10 and text[4] == "-" and text[7] == "-":
            parsed = pd.to_datetime(text, errors="coerce", dayfirst=False)
        else:
            parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
    except Exception:
        parsed = pd.NaT
    if pd.isna(parsed):
        return ""
    return parsed.strftime("%Y-%m-%d")


def parse_datetime(value: Any) -> str:
    if is_blank(value):
        return ""
    if hasattr(value, "strftime"):
        try:
            return value.strftime("%Y-%m-%d %H:%M:%S")
        except Exception:
            pass
    text = clean_str(value)
    if not text:
        return ""
    try:
        if len(text) >= 10 and text[4] == "-" and text[7] == "-":
            parsed = pd.to_datetime(text, errors="coerce", dayfirst=False)
        else:
            parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
    except Exception:
        parsed = pd.NaT
    if pd.isna(parsed):
        return ""
    return parsed.strftime("%Y-%m-%d %H:%M:%S")


def map_status(pago: Any, status: Any, vencimento: str, cobranca: Any = None) -> tuple[str, str]:
    pago_text = normalize_text(pago)
    status_text = normalize_text(status)
    cobranca_text = normalize_text(cobranca)
    combinado = " ".join(part for part in [pago_text, status_text, cobranca_text] if part)

    if "susp" in combinado:
        return "Suspenso", ""

    if any(flag in combinado for flag in ["cancel", "abatido"]):
        return "Cancelado", ""

    data_pagamento = parse_datetime(pago)
    if data_pagamento:
        return "Pago", data_pagamento

    if is_numeric_like(pago) and to_float(pago) > 0:
        return "Pago", ""

    if status_text == "devendo":
        if vencimento:
            try:
                if datetime.strptime(vencimento, "%Y-%m-%d").date() < TODAY:
                    return "Atrasado", ""
            except ValueError:
                pass
        return "Aberto", ""

    if vencimento:
        try:
            if datetime.strptime(vencimento, "%Y-%m-%d").date() < TODAY:
                return "Atrasado", ""
        except ValueError:
            pass
    return "Aberto", ""


def build_patient_lookup(conn: sqlite3.Connection) -> dict[str, sqlite3.Row]:
    rows = conn.execute(
        "SELECT id, nome, prontuario, telefone FROM pacientes"
    ).fetchall()
    lookup: dict[str, sqlite3.Row] = {}
    for row in rows:
        key = normalize_text(row["nome"])
        if key and key not in lookup:
            lookup[key] = row
    return lookup


def build_plan_groups(df: pd.DataFrame) -> dict[tuple[str, float], list[dict[str, Any]]]:
    groups: dict[tuple[str, float], list[dict[str, Any]]] = defaultdict(list)
    for _, row in df.iterrows():
        paciente = title_case(row.get("PACIENTE"))
        vencimento = parse_date(row.get("DATA VENC"))
        valor = to_float(row.get("VALOR"))
        if not paciente or valor <= 0:
            continue
        status, data_pagamento = map_status(row.get("PAGO"), row.get("STATUS"), vencimento, row.get("cobrança"))
        groups[(normalize_text(paciente), valor)].append(
            {
                "paciente_nome": paciente,
                "vencimento": vencimento,
                "valor": valor,
                "status": status,
                "data_pagamento": data_pagamento,
                "observacao": " | ".join(
                    part for part in [clean_str(row.get("STATUS")), clean_str(row.get("PAGO")), clean_str(row.get("cobrança"))] if part
                ),
            }
        )

    for items in groups.values():
        items.sort(key=lambda item: (item["vencimento"], item["valor"]))
    return groups


def reconcile() -> dict[str, int]:
    arquivo_recebiveis = localizar_arquivo_recebiveis()
    if not arquivo_recebiveis.exists():
        raise FileNotFoundError(f"Planilha não encontrada: {arquivo_recebiveis}")

    inicializar_banco()
    garantir_colunas_pacientes_api()

    df = pd.read_excel(arquivo_recebiveis)
    conn = conectar()
    patient_lookup = build_patient_lookup(conn)
    plan_groups = build_plan_groups(df)

    reconciled_rows: list[dict[str, Any]] = []
    next_id = 1
    for _, plan_items in sorted(plan_groups.items(), key=lambda entry: entry[0]):
        for plan_item in plan_items:
            patient = patient_lookup.get(normalize_text(plan_item["paciente_nome"]))
            reconciled_rows.append(
                {
                    "id": next_id,
                    "contrato_id": None,
                    "paciente_id": int(patient["id"]) if patient else None,
                    "paciente_nome": plan_item["paciente_nome"],
                    "prontuario": clean_str(patient["prontuario"]) if patient else "",
                    "parcela_numero": None,
                    "vencimento": plan_item["vencimento"],
                    "valor": plan_item["valor"],
                    "forma_pagamento": "BOLETO",
                    "status": plan_item["status"],
                    "observacao": plan_item["observacao"],
                    "data_criacao": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    "hash_importacao": f"recebiveis-planilha:{next_id}",
                    "data_pagamento": plan_item["data_pagamento"],
                }
            )
            next_id += 1

    conn.execute("DELETE FROM recebiveis")
    for item in reconciled_rows:
        conn.execute(
            """
            INSERT INTO recebiveis (
                id, contrato_id, paciente_id, paciente_nome, prontuario, parcela_numero,
                vencimento, valor, forma_pagamento, status, observacao, data_criacao,
                hash_importacao, data_pagamento
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item["id"],
                item["contrato_id"],
                item["paciente_id"],
                item["paciente_nome"],
                item["prontuario"],
                item["parcela_numero"],
                item["vencimento"],
                item["valor"],
                item["forma_pagamento"],
                item["status"],
                item["observacao"],
                item["data_criacao"],
                item["hash_importacao"],
                item["data_pagamento"],
            ),
        )

    conn.commit()
    conn.close()

    return {
        "planilha": len(df),
        "importados": len(reconciled_rows),
        "casados": len(reconciled_rows),
        "novos": 0,
        "removidos": 0,
    }


if __name__ == "__main__":
    result = reconcile()
    for key, value in result.items():
        print(f"{key.upper()}={value}")
