from __future__ import annotations

import shutil
import sqlite3
from datetime import datetime
from pathlib import Path

from api_agenda import garantir_colunas_agenda_api
from api_pacientes import garantir_colunas_pacientes_api
from database import conectar, inicializar_banco
import importar_pacientes_planilha as importar_pacientes_mod
import importar_recebiveis_planilha as importar_recebiveis_mod
import importar_a_pagar_planilha as importar_pagar_mod
from importar_dados_operacionais import (
    build_patient_mapping,
    clear_operational_tables,
    import_agendamentos,
    import_contratos,
    import_financeiro_e_contas,
    import_recebiveis,
    load_dataframe,
)


BASE_DIR = Path(r"C:\Users\jusgo\Documents\sistema_clinica")
DB_PATH = BASE_DIR / "clinica.db"
BACKUP_DIR = BASE_DIR / "backup_db"
START_DATE = "2026-04-13"

PATIENTS_XLSX = Path(r"C:\Users\jusgo\Downloads\Patient (3).xlsx")
BUDGETS_XLSX = Path(r"C:\Users\jusgo\Downloads\Budgets (3).xlsx")
PAYMENT_HEADER_XLSX = Path(r"C:\Users\jusgo\Downloads\PaymentHeader (3).xlsx")
PAYMENT_ITEM_XLSX = Path(r"C:\Users\jusgo\Downloads\PaymentItem (3).xlsx")
BOOK_ENTRY_XLSX = Path(r"C:\Users\jusgo\Downloads\BookEntry (7).xlsx")
APPOINTMENT_XLSX = Path(r"C:\Users\jusgo\Downloads\Appointment (5).xlsx")


def backup_database() -> Path:
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    destino = BACKUP_DIR / f"clinica_pre_inicio_operacao_{stamp}.db"
    shutil.copy2(DB_PATH, destino)
    return destino


def clear_operational_without_agenda(conn: sqlite3.Connection) -> None:
    for table in [
        "procedimentos_dente",
        "procedimentos_contrato",
        "recebiveis",
        "financeiro",
        "contas_pagar",
        "contratos",
    ]:
        conn.execute(f"DELETE FROM {table}")


def replace_future_agenda(conn: sqlite3.Connection) -> int:
    appointment_df = load_dataframe(APPOINTMENT_XLSX)
    future_df = appointment_df.copy()
    if "date" in future_df.columns:
        future_df["date"] = future_df["date"].astype(str)
        future_df = future_df[future_df["date"].str.len() > 0]

    from importar_dados_operacionais import parse_date

    future_df = future_df[
        future_df["date"].map(parse_date).fillna("").ge(START_DATE)
    ].copy()

    existing_ids = [
        row["id"]
        for row in conn.execute(
            "SELECT id FROM agendamentos WHERE COALESCE(data_agendamento, data, '') >= ?",
            (START_DATE,),
        ).fetchall()
    ]
    if existing_ids:
        placeholders = ",".join("?" for _ in existing_ids)
        for table in ["agendamento_procedimentos", "agendamento_historico", "lembretes_agendamento"]:
            conn.execute(
                f"DELETE FROM {table} WHERE agendamento_id IN ({placeholders})",
                existing_ids,
            )
    conn.execute(
        "DELETE FROM agendamentos WHERE COALESCE(data_agendamento, data, '') >= ?",
        (START_DATE,),
    )

    patient_map = build_patient_mapping(conn)
    return import_agendamentos(conn, future_df, patient_map)


def import_operational_data_without_past_agenda() -> dict[str, int]:
    budgets_df = load_dataframe(BUDGETS_XLSX)
    headers_df = load_dataframe(PAYMENT_HEADER_XLSX)
    items_df = load_dataframe(PAYMENT_ITEM_XLSX)
    book_df = load_dataframe(BOOK_ENTRY_XLSX)

    conn = conectar()
    clear_operational_without_agenda(conn)
    patient_map = build_patient_mapping(conn)

    contratos_count, contratos_meta = import_contratos(conn, budgets_df, patient_map)
    recebiveis_count, _, recebiveis_by_id = import_recebiveis(
        conn,
        headers_df,
        items_df,
        patient_map,
        contratos_meta,
    )
    financeiro_count, contas_count = import_financeiro_e_contas(conn, book_df, recebiveis_by_id)
    agendamentos_count = replace_future_agenda(conn)

    conn.commit()
    conn.close()
    return {
        "contratos": contratos_count,
        "recebiveis_operacionais": recebiveis_count,
        "financeiro": financeiro_count,
        "contas_pagar_operacionais": contas_count,
        "agendamentos_desde_segunda": agendamentos_count,
    }


def summarize(conn: sqlite3.Connection) -> dict[str, int]:
    return {
        "pacientes": conn.execute("SELECT COUNT(*) FROM pacientes").fetchone()[0],
        "contratos": conn.execute("SELECT COUNT(*) FROM contratos").fetchone()[0],
        "recebiveis": conn.execute("SELECT COUNT(*) FROM recebiveis").fetchone()[0],
        "financeiro": conn.execute("SELECT COUNT(*) FROM financeiro").fetchone()[0],
        "contas_pagar": conn.execute("SELECT COUNT(*) FROM contas_pagar").fetchone()[0],
        "agendamentos_desde_segunda": conn.execute(
            "SELECT COUNT(*) FROM agendamentos WHERE COALESCE(data_agendamento, data, '') >= ?",
            (START_DATE,),
        ).fetchone()[0],
    }


def main() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(f"Banco não encontrado: {DB_PATH}")

    inicializar_banco()
    garantir_colunas_pacientes_api()
    garantir_colunas_agenda_api()

    backup_path = backup_database()

    importar_pacientes_mod.ARQUIVO_PLANILHA = PATIENTS_XLSX
    pacientes_importados, pacientes_descartados = importar_pacientes_mod.importar()

    operacionais = import_operational_data_without_past_agenda()

    importar_recebiveis_mod.reconcile()
    importar_pagar_mod.import_planilha()

    conn = conectar()
    totais = summarize(conn)
    conn.close()

    print(f"BACKUP={backup_path}")
    print(f"PACIENTES_IMPORTADOS={pacientes_importados}")
    print(f"PACIENTES_DESCARTADOS={pacientes_descartados}")
    for chave, valor in operacionais.items():
        print(f"{chave.upper()}={valor}")
    for chave, valor in totais.items():
        print(f"TOTAL_{chave.upper()}={valor}")


if __name__ == "__main__":
    main()
