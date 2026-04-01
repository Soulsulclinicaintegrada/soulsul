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


ARQUIVO_RECEBIVEIS = Path(r"C:\Users\jusgo\Desktop\recebíveis.xlsx")
TODAY = datetime.now().date()


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


def parse_date(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    try:
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
    except Exception:
        parsed = pd.NaT
    if pd.isna(parsed):
        return ""
    return parsed.strftime("%Y-%m-%d")


def parse_datetime(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    try:
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
    except Exception:
        parsed = pd.NaT
    if pd.isna(parsed):
        return ""
    return parsed.strftime("%Y-%m-%d %H:%M:%S")


def map_status(pago: Any, status: Any, vencimento: str) -> tuple[str, str]:
    pago_text = normalize_text(pago)
    status_text = normalize_text(status)

    if any(flag in pago_text for flag in ["cancel", "suspens", "abatido"]):
        return "Cancelado", ""

    data_pagamento = parse_datetime(pago)
    if data_pagamento:
        return "Pago", data_pagamento

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


def build_db_groups(conn: sqlite3.Connection) -> tuple[dict[tuple[str, float], list[dict[str, Any]]], int]:
    rows = conn.execute(
        """
        SELECT id, contrato_id, paciente_id, paciente_nome, prontuario, parcela_numero,
               vencimento, valor, forma_pagamento, status, observacao, data_criacao,
               hash_importacao, data_pagamento
        FROM recebiveis
        ORDER BY paciente_nome, valor, vencimento, id
        """
    ).fetchall()
    groups: dict[tuple[str, float], list[dict[str, Any]]] = defaultdict(list)
    max_id = 0
    for row in rows:
        item = dict(row)
        max_id = max(max_id, int(item["id"]))
        groups[(normalize_text(item["paciente_nome"]), round(float(item["valor"] or 0), 2))].append(item)
    return groups, max_id


def build_plan_groups(df: pd.DataFrame) -> dict[tuple[str, float], list[dict[str, Any]]]:
    groups: dict[tuple[str, float], list[dict[str, Any]]] = defaultdict(list)
    for _, row in df.iterrows():
        paciente = title_case(row.get("PACIENTE"))
        vencimento = parse_date(row.get("DATA VENC"))
        valor = to_float(row.get("VALOR"))
        if not paciente or valor <= 0:
            continue
        status, data_pagamento = map_status(row.get("PAGO"), row.get("STATUS"), vencimento)
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
    if not ARQUIVO_RECEBIVEIS.exists():
        raise FileNotFoundError(f"Planilha não encontrada: {ARQUIVO_RECEBIVEIS}")

    inicializar_banco()
    garantir_colunas_pacientes_api()

    df = pd.read_excel(ARQUIVO_RECEBIVEIS)
    conn = conectar()
    patient_lookup = build_patient_lookup(conn)
    db_groups, max_id = build_db_groups(conn)
    plan_groups = build_plan_groups(df)

    reconciled_rows: list[dict[str, Any]] = []
    matched = 0
    created = 0
    removed = 0

    all_keys = sorted(set(db_groups.keys()) | set(plan_groups.keys()))
    for key in all_keys:
        db_items = sorted(db_groups.get(key, []), key=lambda item: (item["vencimento"] or "", int(item["id"])))
        plan_items = plan_groups.get(key, [])
        max_len = max(len(db_items), len(plan_items))
        for index in range(max_len):
            db_item = db_items[index] if index < len(db_items) else None
            plan_item = plan_items[index] if index < len(plan_items) else None

            if db_item and plan_item:
                db_item["paciente_nome"] = plan_item["paciente_nome"] or db_item["paciente_nome"]
                db_item["vencimento"] = plan_item["vencimento"] or db_item["vencimento"]
                db_item["valor"] = plan_item["valor"]
                db_item["status"] = plan_item["status"]
                db_item["data_pagamento"] = plan_item["data_pagamento"]
                db_item["observacao"] = plan_item["observacao"] or db_item["observacao"]
                reconciled_rows.append(db_item)
                matched += 1
                continue

            if plan_item and not db_item:
                patient = patient_lookup.get(normalize_text(plan_item["paciente_nome"]))
                max_id += 1
                reconciled_rows.append(
                    {
                        "id": max_id,
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
                        "hash_importacao": f"recebiveis-planilha:{max_id}",
                        "data_pagamento": plan_item["data_pagamento"],
                    }
                )
                created += 1
                continue

            if db_item and not plan_item:
                removed += 1

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
        "casados": matched,
        "novos": created,
        "removidos": removed,
    }


if __name__ == "__main__":
    result = reconcile()
    for key, value in result.items():
        print(f"{key.upper()}={value}")
