from __future__ import annotations

import math
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from database import conectar, inicializar_banco


ARQUIVO_A_PAGAR = Path(r"C:\Users\jusgo\Desktop\a pagar.xlsx")
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


def infer_status(status_raw: Any, pago_raw: Any, vencimento_iso: str) -> str:
    status_text = normalize_text(status_raw)
    pago_text = normalize_text(pago_raw)

    if any(flag in status_text for flag in ("cancel", "suspens")) or any(flag in pago_text for flag in ("cancel", "suspens")):
        return "Cancelado"

    if parse_date(pago_raw) or "pago" in status_text:
        return "Pago"

    if vencimento_iso:
        try:
            vencimento = datetime.strptime(vencimento_iso, "%Y-%m-%d").date()
            if vencimento < TODAY:
                return "Atrasado"
        except ValueError:
            pass
    return "A vencer"


def load_sheet() -> pd.DataFrame:
    if not ARQUIVO_A_PAGAR.exists():
        raise FileNotFoundError(f"Planilha não encontrada: {ARQUIVO_A_PAGAR}")
    bruto = pd.read_excel(ARQUIVO_A_PAGAR, header=None)
    if bruto.empty:
        return pd.DataFrame()

    header_index = 0
    for index in range(len(bruto)):
      linha = [clean_str(value) for value in bruto.iloc[index].tolist()]
      if any(linha):
          header_index = index
          break

    header = [clean_str(value) for value in bruto.iloc[header_index].tolist()]
    df = bruto.iloc[header_index + 1 :].copy()
    df.columns = header
    df = df.fillna("")
    return df


def import_planilha() -> dict[str, int]:
    inicializar_banco()
    df = load_sheet()
    conn = conectar()

    existentes = conn.execute(
        """
        SELECT descricao, fornecedor, data_vencimento, valor, categoria, observacao
        FROM contas_pagar
        """
    ).fetchall()
    preservados: dict[tuple[str, str, str, float], dict[str, str]] = {}
    for row in existentes:
        chave = (
            normalize_text(row["descricao"]),
            normalize_text(row["fornecedor"]),
            clean_str(row["data_vencimento"]),
            round(float(row["valor"] or 0), 2),
        )
        preservados[chave] = {
            "categoria": clean_str(row["categoria"]),
            "observacao": clean_str(row["observacao"]),
        }

    conn.execute("DELETE FROM contas_pagar")

    importados = 0
    descartados = 0
    pagos = 0
    atrasados = 0
    cancelados = 0

    for _, row in df.iterrows():
        descricao = clean_str(row.get("DESCRIÇÃO"))
        fornecedor = title_case(row.get("FORNECEDOR"))
        vencimento = parse_date(row.get("Data de Vencimento"))
        valor = to_float(row.get("VALOR"))
        pago_em = parse_date(row.get("PAGO"))
        valor_pago = to_float(row.get("VALOR PAGO"))
        status = infer_status(row.get("Status"), row.get("PAGO"), vencimento)

        if not descricao and not fornecedor and valor <= 0:
            descartados += 1
            continue

        if status == "Pago" and valor_pago <= 0:
            valor_pago = valor

        chave = (
            normalize_text(descricao),
            normalize_text(fornecedor),
            vencimento,
            valor,
        )
        dados_preservados = preservados.get(chave, {})
        categoria = dados_preservados.get("categoria", "")
        observacao_base = dados_preservados.get("observacao", "")
        observacao_planilha = clean_str(row.get("Status"))
        observacao = " | ".join(part for part in [observacao_planilha, observacao_base] if part)

        conn.execute(
            """
            INSERT INTO contas_pagar (
                data_vencimento, descricao, fornecedor, categoria, valor, pago, valor_pago, status, observacao, data_criacao, hash_importacao
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                vencimento,
                descricao,
                fornecedor,
                categoria,
                valor,
                pago_em,
                valor_pago,
                status,
                observacao,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                f"a-pagar-planilha:{importados + 1}",
            ),
        )
        importados += 1
        if status == "Pago":
            pagos += 1
        elif status == "Atrasado":
            atrasados += 1
        elif status == "Cancelado":
            cancelados += 1

    conn.commit()
    conn.close()
    return {
        "IMPORTADOS": importados,
        "DESCARTADOS": descartados,
        "PAGOS": pagos,
        "ATRASADOS": atrasados,
        "CANCELADOS": cancelados,
    }


if __name__ == "__main__":
    resultado = import_planilha()
    print(" ".join(f"{chave}={valor}" for chave, valor in resultado.items()))
