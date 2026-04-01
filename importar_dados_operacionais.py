from __future__ import annotations

import json
import math
import sqlite3
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any

import pandas as pd

from api_agenda import garantir_colunas_agenda_api
from api_pacientes import garantir_colunas_pacientes_api
from database import conectar, inicializar_banco
from importar_pacientes_planilha import should_import_row as should_import_patient_row


BASE_DOWNLOADS = Path(r"C:\Users\jusgo\Downloads")
PATIENTS_XLSX = BASE_DOWNLOADS / "Patient (1).xlsx"
BUDGETS_XLSX = BASE_DOWNLOADS / "Budgets (1).xlsx"
PAYMENT_HEADER_XLSX = BASE_DOWNLOADS / "PaymentHeader (1).xlsx"
PAYMENT_ITEM_XLSX = BASE_DOWNLOADS / "PaymentItem (1).xlsx"
BOOK_ENTRY_FILES = [
    BASE_DOWNLOADS / "BookEntry.xlsx",
    BASE_DOWNLOADS / "BookEntry (1).xlsx",
]
APPOINTMENT_XLSX = BASE_DOWNLOADS / "Appointment (1).xlsx"
TREATMENT_OPERATION_XLSX = BASE_DOWNLOADS / "TreatmentOperation.xlsx"

NOW = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
TODAY = datetime.now().date()


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


def normalize_text(value: Any) -> str:
    return " ".join(clean_str(value).strip().lower().split())


def title_case(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    return " ".join(part.capitalize() for part in text.split())


def to_float(value: Any) -> float:
    if is_blank(value):
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    text = clean_str(value).replace(".", "").replace(",", ".")
    try:
        return float(text)
    except ValueError:
        return 0.0


def to_int(value: Any, default: int = 0) -> int:
    text = digits_only(value)
    if not text:
        return default
    try:
        return int(text)
    except ValueError:
        return default


def parse_datetime(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    try:
        parsed = pd.to_datetime(text, utc=False, errors="coerce", dayfirst=True)
    except Exception:
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return ""
    try:
        parsed = parsed.tz_localize(None)
    except Exception:
        try:
            parsed = parsed.tz_convert(None)
        except Exception:
            pass
    return parsed.strftime("%Y-%m-%d %H:%M:%S")


def parse_date(value: Any) -> str:
    dt = parse_datetime(value)
    return dt[:10] if dt else ""


def parse_time(value: Any) -> str:
    text = clean_str(value)
    if not text:
        return ""
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).strftime("%H:%M")
        except ValueError:
            continue
    try:
        parsed = pd.to_datetime(text, errors="coerce")
    except Exception:
        parsed = pd.NaT
    if pd.isna(parsed):
        return ""
    return parsed.strftime("%H:%M")


def combine_date_time(date_value: Any, time_value: Any) -> tuple[str, str]:
    data = parse_date(date_value)
    hora = parse_time(time_value)
    return data, hora


def parse_bool_x(value: Any) -> bool:
    return normalize_text(value) in {"x", "true", "1", "sim", "yes"}


def map_payment_form(raw_type: Any) -> str:
    value = normalize_text(raw_type)
    if "credit" in value or "credito" in value:
        return "CARTAO_CREDITO"
    if "debit" in value or "debito" in value:
        return "CARTAO_DEBITO"
    if "pix" in value:
        return "PIX"
    if "boleto" in value:
        return "BOLETO"
    return "DINHEIRO"


def map_recebivel_status(row: pd.Series) -> str:
    if parse_bool_x(row.get("Canceled")) or parse_bool_x(row.get("CancelInstallment")):
        return "Cancelado"
    if parse_bool_x(row.get("PaymentConfirmed")) or parse_bool_x(row.get("PaymentReceived")):
        return "Pago"
    vencimento = parse_date(row.get("DueDate")) or parse_date(row.get("PaymentDate")) or parse_date(row.get("PostDate"))
    if vencimento:
        try:
            if datetime.strptime(vencimento, "%Y-%m-%d").date() < TODAY:
                return "Atrasado"
        except ValueError:
            pass
    return "Aberto"


def map_agendamento_status(row: pd.Series) -> str:
    if parse_bool_x(row.get("Canceled")):
        return "Cancelado"
    status = normalize_text(row.get("Status"))
    if status == "checkout":
        return "Atendido"
    if status == "missed":
        return "Faltou"
    if status == "confirmed":
        return "Confirmado"
    if status in {"arrived", "in_session"}:
        return "Em atendimento"
    if status == "late":
        return "Atrasado"
    return "Agendado"


def format_parcela_label(numero: int, total: int) -> str:
    if numero <= 0:
        return "ENTRADA"
    if total <= 0:
        return str(numero)
    return f"{numero}/{total}"


def load_dataframe(path: Path, sheet_name: str | None = None) -> pd.DataFrame:
    if not path.exists():
        raise FileNotFoundError(f"Arquivo não encontrado: {path}")
    if sheet_name is None:
        return pd.read_excel(path)
    return pd.read_excel(path, sheet_name=sheet_name)


def build_patient_mapping(conn: sqlite3.Connection) -> dict[int, dict[str, Any]]:
    df = load_dataframe(PATIENTS_XLSX)
    rows = conn.execute(
        """
        SELECT id, nome, prontuario, cpf, telefone
        FROM pacientes
        """
    ).fetchall()

    by_prontuario = {clean_str(row["prontuario"]): dict(row) for row in rows if clean_str(row["prontuario"])}
    by_cpf = {digits_only(row["cpf"]): dict(row) for row in rows if digits_only(row["cpf"])}
    by_name = {normalize_text(row["nome"]): dict(row) for row in rows if normalize_text(row["nome"])}

    mapped: dict[int, dict[str, Any]] = {}

    for _, row in df.iterrows():
        if not should_import_patient_row(row):
            continue
        imported_id = to_int(row.get("id"), 0)
        if not imported_id:
            continue
        patient = None
        prontuario = clean_str(row.get("ClinicalRecordNumber"))
        if prontuario:
            patient = by_prontuario.get(prontuario)
        if not patient:
            cpf = digits_only(row.get("OtherDocumentId"))
            if cpf:
                patient = by_cpf.get(cpf)
        if not patient:
            patient = by_name.get(normalize_text(title_case(row.get("Name"))))
        if patient:
            mapped[imported_id] = patient
    return mapped


def load_profissionais_mapping(conn: sqlite3.Connection) -> tuple[dict[str, int], dict[str, int]]:
    usuarios = conn.execute("SELECT id, nome, usuario FROM usuarios WHERE ativo=1").fetchall()
    by_name = {}
    by_login = {}
    for row in usuarios:
        if normalize_text(row["nome"]):
            by_name[normalize_text(row["nome"])] = int(row["id"])
        if normalize_text(row["usuario"]):
            by_login[normalize_text(row["usuario"])] = int(row["id"])
    return by_name, by_login


def load_tipo_atendimento_mapping(conn: sqlite3.Connection) -> dict[str, int]:
    rows = conn.execute("SELECT id, nome FROM tipos_atendimento WHERE ativo=1").fetchall()
    mapping = {}
    for row in rows:
        key = normalize_text(row["nome"])
        if key:
            mapping[key] = int(row["id"])
    return mapping


def clear_operational_tables(conn: sqlite3.Connection) -> None:
    for table in [
        "agendamento_procedimentos",
        "agendamentos",
        "procedimentos_dente",
        "procedimentos_contrato",
        "recebiveis",
        "financeiro",
        "contas_pagar",
        "contratos",
    ]:
        conn.execute(f"DELETE FROM {table}")


def import_contratos(
    conn: sqlite3.Connection,
    budgets_df: pd.DataFrame,
    patient_map: dict[int, dict[str, Any]],
) -> tuple[int, dict[int, dict[str, Any]]]:
    contratos_importados = 0
    contratos_meta: dict[int, dict[str, Any]] = {}
    grouped = budgets_df.sort_values(["BudgetId", "Sequence"]).groupby("BudgetId", dropna=True)

    for budget_id, group in grouped:
        budget_id_int = to_int(budget_id)
        if not budget_id_int:
            continue
        patient_old_id = to_int(group.iloc[0].get("PatientId"))
        patient = patient_map.get(patient_old_id)
        if not patient:
            continue

        approved = any(parse_bool_x(v) for v in group["BudgetApproved"].tolist())
        rejected = any(parse_bool_x(v) for v in group.get("NotApproved", pd.Series(dtype=object)).tolist())
        status = "APROVADO" if approved else "EM_ABERTO"

        notes = clean_str(group.iloc[0].get("BudgetsNotes"))
        rejected_reason = clean_str(group.iloc[0].get("BudgetRejectedReason"))
        observacoes_parts = [p for p in [notes, rejected_reason and f"Motivo reprovacao: {rejected_reason}"] if p]
        observacoes = " | ".join(observacoes_parts)

        valor_total = to_float(group.iloc[0].get("BudgetAmount")) or float(group["ProcedureFinalAmount"].fillna(0).map(to_float).sum())
        desconto_percentual = to_float(group.iloc[0].get("BudgetDiscount"))
        desconto_valor = to_float(group.iloc[0].get("BudgetDiscountAmount"))
        created_at = parse_datetime(group.iloc[0].get("BudgetsCreateDate")) or NOW
        aprovado_por = title_case(group.iloc[0].get("BudgetApprovedByUserName"))
        data_aprovacao = parse_datetime(group.iloc[0].get("BudgetApprovedDate"))
        clinica_snapshot = title_case(group.iloc[0].get("TableName"))
        criado_por_snapshot = title_case(group.iloc[0].get("DentistName"))

        conn.execute(
            """
            INSERT INTO contratos (
                id, paciente_id, valor_total, entrada, parcelas, primeiro_vencimento,
                data_pagamento_entrada, forma_pagamento, hash_importacao, data_criacao,
                status, aprovado_por, data_aprovacao, observacoes, clinica_snapshot,
                criado_por_snapshot, tabela_snapshot, plano_pagamento_json,
                desconto_percentual, desconto_valor, validade_orcamento
            ) VALUES (?, ?, ?, 0, 1, '', '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '')
            """,
            (
                budget_id_int,
                int(patient["id"]),
                valor_total,
                f"budget:{budget_id_int}",
                created_at,
                status,
                aprovado_por,
                data_aprovacao,
                observacoes,
                clinica_snapshot,
                criado_por_snapshot,
                clinica_snapshot,
                "[]",
                desconto_percentual,
                desconto_valor,
            ),
        )
        contratos_importados += 1

        seen_procedures: set[tuple[str, float, int]] = set()
        for _, proc in group.iterrows():
            procedimento = title_case(proc.get("ProcedureName"))
            valor_proc = to_float(proc.get("ProcedureFinalAmount")) or to_float(proc.get("ProcedureAmount"))
            sequence = to_int(proc.get("Sequence"))
            proc_key = (normalize_text(procedimento), round(valor_proc, 2), sequence)
            if procedimento and proc_key not in seen_procedures:
                conn.execute(
                    """
                    INSERT INTO procedimentos_contrato (
                        contrato_id, procedimento, valor, profissional_snapshot, denticao_snapshot
                    ) VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        budget_id_int,
                        procedimento,
                        valor_proc,
                        title_case(proc.get("DentistName")),
                        "Permanente",
                    ),
                )
                seen_procedures.add(proc_key)

            tooth_text = clean_str(proc.get("Tooth"))
            region = ""
            tooth_num = None
            if digits_only(tooth_text):
                tooth_num = to_int(tooth_text)
            else:
                region = title_case(tooth_text)

            conn.execute(
                """
                INSERT INTO procedimentos_dente (
                    paciente_id, contrato_id, dente, regiao, procedimento, status, faces, valor, data
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    int(patient["id"]),
                    budget_id_int,
                    tooth_num,
                    region,
                    procedimento,
                    title_case(proc.get("ProcedureCondition")) or "Open",
                    clean_str(proc.get("Surface")),
                    valor_proc,
                    created_at[:10],
                ),
            )

        contratos_meta[budget_id_int] = {
            "patient_id": int(patient["id"]),
            "patient_name": patient["nome"],
            "prontuario": clean_str(patient["prontuario"]),
            "approved": approved and not rejected,
        }

    return contratos_importados, contratos_meta


def import_recebiveis(
    conn: sqlite3.Connection,
    headers_df: pd.DataFrame,
    items_df: pd.DataFrame,
    patient_map: dict[int, dict[str, Any]],
    contratos_meta: dict[int, dict[str, Any]],
) -> tuple[int, dict[int, list[dict[str, Any]]], dict[int, dict[str, Any]]]:
    recebiveis_importados = 0
    contract_plan: dict[int, list[dict[str, Any]]] = defaultdict(list)
    recebiveis_by_id: dict[int, dict[str, Any]] = {}
    header_map: dict[int, pd.Series] = {}

    for _, row in headers_df.iterrows():
        header_id = to_int(row.get("id"))
        if header_id:
            header_map[header_id] = row

    for _, row in items_df.iterrows():
        item_id = to_int(row.get("id"))
        if not item_id:
            continue

        header_id = to_int(row.get("PaymentHeaderId"))
        header = header_map.get(header_id)
        contract_id = to_int(row.get("TreatmentId"))
        if not contract_id and header is not None:
            contract_id = to_int(header.get("TreatmentId"))

        patient_old_id = to_int(row.get("PatientId"))
        if not patient_old_id and header is not None:
            patient_old_id = to_int(header.get("PatientId"))
        patient = patient_map.get(patient_old_id)
        if not patient:
            continue

        patient_name = title_case(row.get("PayerName")) or patient["nome"]
        installments_count = to_int(row.get("InstallmentsCount")) or (header is not None and to_int(header.get("InstallmentsCount"))) or 1
        installment_number = to_int(row.get("InstallmentNumber"))
        valor = to_float(row.get("Amount"))
        vencimento = parse_date(row.get("DueDate")) or parse_date(row.get("PaymentDate")) or parse_date(row.get("PostDate")) or TODAY.strftime("%Y-%m-%d")
        data_pagamento = parse_datetime(row.get("ConfirmedDate")) or parse_datetime(row.get("ReceivedDate")) or parse_datetime(row.get("PaymentDate"))
        forma = map_payment_form(row.get("Type"))
        status = map_recebivel_status(row)
        descricao = clean_str(row.get("PaymentDescription"))
        type_text = clean_str(row.get("Type"))
        observacao_parts = [part for part in [descricao, type_text] if part]
        observacao = " | ".join(observacao_parts)

        conn.execute(
            """
            INSERT INTO recebiveis (
                id, contrato_id, paciente_id, paciente_nome, prontuario, parcela_numero,
                vencimento, valor, forma_pagamento, status, observacao, data_criacao,
                hash_importacao, data_pagamento
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                item_id,
                contract_id or None,
                int(patient["id"]),
                patient_name,
                clean_str(patient["prontuario"]),
                installment_number,
                vencimento,
                valor,
                forma,
                status,
                observacao,
                parse_datetime(row.get("PostDate")) or NOW,
                f"payment-item:{item_id}",
                data_pagamento,
            ),
        )
        recebiveis_importados += 1

        plan_item = {
            "id": item_id,
            "parcela_numero": installment_number,
            "parcelas_total": installments_count,
            "vencimento": vencimento,
            "valor": valor,
            "forma_pagamento": forma,
            "status": status,
            "data_pagamento": data_pagamento,
        }
        if contract_id:
            contract_plan[contract_id].append(plan_item)

        recebiveis_by_id[item_id] = {
            "contrato_id": contract_id,
            "paciente_nome": patient_name,
            "parcela_numero": installment_number,
            "parcelas_total": installments_count,
            "valor": valor,
            "forma_pagamento": forma,
            "status": status,
            "prontuario": clean_str(patient["prontuario"]),
        }

    for contract_id, plano in contract_plan.items():
        plano_ordenado = sorted(plano, key=lambda item: (item["parcela_numero"], item["vencimento"], item["id"]))
        entrada_item = next((item for item in plano_ordenado if item["parcela_numero"] == 0), None)
        parcelas = max((int(item["parcela_numero"]) for item in plano_ordenado if int(item["parcela_numero"]) > 0), default=max((int(item["parcelas_total"]) for item in plano_ordenado), default=1))
        primeiro_vencimento = next((item["vencimento"] for item in plano_ordenado if int(item["parcela_numero"]) > 0), plano_ordenado[0]["vencimento"] if plano_ordenado else "")
        formas = {item["forma_pagamento"] for item in plano_ordenado if item["forma_pagamento"]}
        forma_pagamento = formas.pop() if len(formas) == 1 else ("MULTIPLAS" if formas else "")
        conn.execute(
            """
            UPDATE contratos
            SET entrada=?,
                parcelas=?,
                primeiro_vencimento=?,
                data_pagamento_entrada=?,
                forma_pagamento=?,
                plano_pagamento_json=?
            WHERE id=?
            """,
            (
                float(entrada_item["valor"]) if entrada_item else 0.0,
                parcelas or 1,
                primeiro_vencimento,
                entrada_item["data_pagamento"] if entrada_item else "",
                forma_pagamento,
                json.dumps(plano_ordenado, ensure_ascii=False),
                contract_id,
            ),
        )

    return recebiveis_importados, contract_plan, recebiveis_by_id


def infer_conta_caixa(description: str, forma: str) -> str:
    text = normalize_text(description)
    forma_norm = normalize_text(forma)
    if "sicoob" in text:
        return "SICOOB"
    if "pagbank" in text:
        return "PAGBANK"
    if "infinitepay" in text:
        return "INFINITEPAY"
    if "c6" in text:
        return "C6"
    if "debito" in forma_norm or "credito" in forma_norm:
        return "INFINITEPAY"
    return "CAIXA"


def import_financeiro_e_contas(
    conn: sqlite3.Connection,
    book_df: pd.DataFrame,
    recebiveis_by_id: dict[int, dict[str, Any]],
) -> tuple[int, int]:
    financeiro_importado = 0
    contas_importadas = 0
    contas_by_reference: dict[str, int] = {}

    for _, row in book_df.iterrows():
        entry_id = to_int(row.get("id"))
        entry_type = normalize_text(row.get("EntryType"))
        descricao_legado = clean_str(row.get("Description"))
        valor = to_float(row.get("Amount"))
        data_mov = parse_date(row.get("Date")) or TODAY.strftime("%Y-%m-%d")
        payment_item_id = to_int(row.get("PaymentItemId"))
        reference_key = clean_str(row.get("ReferenceId")) or clean_str(row.get("id"))

        if entry_type == "account_to_pay":
            status = "Pago" if parse_bool_x(row.get("Open")) is False else "A vencer"
            if status != "Pago":
                try:
                    if datetime.strptime(data_mov, "%Y-%m-%d").date() < TODAY:
                        status = "Atrasado"
                except ValueError:
                    pass
            conn.execute(
                """
                INSERT INTO contas_pagar (
                    id, data_vencimento, descricao, fornecedor, valor, pago, valor_pago,
                    status, observacao, data_criacao, hash_importacao, categoria
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    entry_id,
                    data_mov,
                    descricao_legado or "Conta a pagar importada",
                    title_case(row.get("PayeeName")) or title_case(row.get("Description")),
                    valor,
                    "SIM" if status == "Pago" else "NAO",
                    valor if status == "Pago" else 0.0,
                    status,
                    clean_str(row.get("AP_Notes")),
                    parse_datetime(row.get("Date")) or NOW,
                    f"book-entry:{entry_id}",
                    title_case(row.get("AP_Classification")),
                ),
            )
            contas_importadas += 1
            contas_by_reference[reference_key] = entry_id
            continue

        if entry_type not in {
            "patient_payment",
            "patient_manual_post",
            "penalty_received",
            "interest_received",
            "accounts_payment",
            "cancel_payment_item",
            "busines_manual_post",
        }:
            continue

        try:
            data_mov_date = datetime.strptime(data_mov, "%Y-%m-%d").date()
        except ValueError:
            data_mov_date = TODAY

        if data_mov_date > TODAY:
            continue

        tipo = "Entrada"
        if entry_type in {"accounts_payment", "cancel_payment_item"}:
            tipo = "Saida"

        recebivel = recebiveis_by_id.get(payment_item_id)
        if entry_type == "patient_payment":
            if recebivel:
                if clean_str(recebivel.get("status")) != "Pago":
                    continue
            elif parse_bool_x(row.get("Open")):
                continue

        if entry_type == "accounts_payment" and parse_bool_x(row.get("Open")):
            continue

        contrato_id = recebivel["contrato_id"] if recebivel else None
        prontuario = recebivel["prontuario"] if recebivel else ""
        forma = recebivel["forma_pagamento"] if recebivel else map_payment_form(row.get("Type"))
        if recebivel:
            label = format_parcela_label(int(recebivel["parcela_numero"]), int(recebivel["parcelas_total"]))
            descricao = f"{title_case(recebivel['paciente_nome'])} - {label}"
        else:
            descricao = descricao_legado or "Movimentação importada"

        if entry_type == "cancel_payment_item":
            descricao = f"Estorno - {descricao}"

        conta_caixa = infer_conta_caixa(descricao_legado, forma)
        observacao = clean_str(row.get("Type"))

        conn.execute(
            """
            INSERT INTO financeiro (
                id, origem, descricao, valor, data, tipo, contrato_id, recebivel_id,
                prontuario, forma_pagamento, observacao, conta_caixa
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                entry_id,
                clean_str(row.get("EntryType")).upper(),
                descricao,
                valor,
                data_mov,
                tipo,
                contrato_id,
                payment_item_id or None,
                prontuario,
                forma,
                observacao,
                conta_caixa,
            ),
        )
        financeiro_importado += 1

    return financeiro_importado, contas_importadas


def build_profissional_id(
    name: str,
    by_name: dict[str, int],
    by_login: dict[str, int],
) -> int:
    normalized = normalize_text(name)
    return by_name.get(normalized) or by_login.get(normalized) or 0


def find_tipo_atendimento_id(name: str, mapping: dict[str, int]) -> int:
    normalized = normalize_text(name)
    if normalized in mapping:
        return mapping[normalized]
    aliases = {
        "avaliacao": "avaliação",
        "consulta": "consulta",
        "cirurgia": "cirurgia",
        "compromisso": "compromisso",
        "evento": "evento",
    }
    for key, target in aliases.items():
        if key in normalized and target in mapping:
            return mapping[target]
    return 0


def import_agendamentos(
    conn: sqlite3.Connection,
    appointments_df: pd.DataFrame,
    patient_map: dict[int, dict[str, Any]],
) -> int:
    profissionais_by_name, profissionais_by_login = load_profissionais_mapping(conn)
    tipos_mapping = load_tipo_atendimento_mapping(conn)
    imported = 0

    for _, row in appointments_df.iterrows():
        if parse_bool_x(row.get("Deleted")):
            continue
        appointment_id = to_int(row.get("id"))
        if not appointment_id:
            continue
        patient_old_id = to_int(row.get("PatientId"))
        patient = patient_map.get(patient_old_id)
        patient_id = int(patient["id"]) if patient else None
        patient_name = title_case(row.get("PatientName")) or (patient["nome"] if patient else "")
        prontuario = clean_str(patient["prontuario"]) if patient else ""
        telefone = digits_only(row.get("MobilePhone")) or (digits_only(patient["telefone"]) if patient else "")
        data = parse_date(row.get("date"))
        hora_inicio = parse_time(row.get("fromTime"))
        hora_fim = parse_time(row.get("toTime"))
        profissional = title_case(row.get("DentistName"))
        profissional_id = build_profissional_id(profissional, profissionais_by_name, profissionais_by_login)
        tipo_nome = title_case(row.get("CategoryDescription")) or "Consulta"
        tipo_id = find_tipo_atendimento_id(tipo_nome, tipos_mapping)
        procedimento = clean_str(row.get("Procedures"))
        observacoes = clean_str(row.get("Notes"))
        if parse_bool_x(row.get("Canceled")):
            reason = clean_str(row.get("CancelReason"))
            by = title_case(row.get("CancelBy"))
            extras = [part for part in [reason and f"Motivo: {reason}", by and f"Cancelado por: {by}"] if part]
            if extras:
                observacoes = " | ".join([observacoes] + extras) if observacoes else " | ".join(extras)
        criado_em = parse_datetime(row.get("CreateDate")) or parse_datetime(row.get("InsertDate")) or NOW
        status = map_agendamento_status(row)
        duracao = 0
        if hora_inicio and hora_fim:
            try:
                dt_ini = datetime.strptime(hora_inicio, "%H:%M")
                dt_fim = datetime.strptime(hora_fim, "%H:%M")
                duracao = int((dt_fim - dt_ini).total_seconds() / 60)
            except ValueError:
                duracao = 0

        conn.execute(
            """
            INSERT INTO agendamentos (
                id, data, hora_inicio, hora_fim, paciente_id, paciente_nome, profissional,
                procedimento, status, observacao, data_criacao, nome_paciente_snapshot,
                telefone_snapshot, email_snapshot, profissional_id, tipo_atendimento_id,
                procedimento_id, procedimento_nome_snapshot, contrato_id, origem_contrato,
                data_agendamento, duracao_minutos, observacoes, criado_por, criado_em,
                atualizado_em, prontuario_snapshot, tipo_atendimento_nome_snapshot
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                appointment_id,
                data,
                hora_inicio,
                hora_fim,
                patient_id,
                patient_name,
                profissional,
                procedimento,
                status,
                observacoes,
                criado_em,
                patient_name,
                telefone,
                "",
                profissional_id,
                tipo_id,
                None,
                procedimento,
                None,
                0,
                data,
                duracao,
                observacoes,
                "IMPORTACAO",
                criado_em,
                NOW,
                prontuario,
                tipo_nome,
            ),
        )
        imported += 1

    return imported


def import_operational_data() -> dict[str, int]:
    inicializar_banco()
    garantir_colunas_pacientes_api()
    garantir_colunas_agenda_api()

    budgets_df = load_dataframe(BUDGETS_XLSX)
    headers_df = load_dataframe(PAYMENT_HEADER_XLSX)
    items_df = load_dataframe(PAYMENT_ITEM_XLSX)
    appointment_df = load_dataframe(APPOINTMENT_XLSX)
    treatment_operation_df = load_dataframe(TREATMENT_OPERATION_XLSX)
    _ = treatment_operation_df  # reservado para uso futuro; orçamento já leva ProcedureCondition.

    book_parts = [load_dataframe(path) for path in BOOK_ENTRY_FILES if path.exists()]
    if not book_parts:
        raise FileNotFoundError("Nenhum arquivo de BookEntry encontrado.")
    book_df = pd.concat(book_parts, ignore_index=True).drop_duplicates(subset=["id"], keep="first")

    conn = conectar()
    clear_operational_tables(conn)
    patient_map = build_patient_mapping(conn)

    contratos_count, contratos_meta = import_contratos(conn, budgets_df, patient_map)
    recebiveis_count, _, recebiveis_by_id = import_recebiveis(conn, headers_df, items_df, patient_map, contratos_meta)
    financeiro_count, contas_count = import_financeiro_e_contas(conn, book_df, recebiveis_by_id)
    agendamentos_count = import_agendamentos(conn, appointment_df, patient_map)

    conn.commit()
    conn.close()

    return {
        "contratos": contratos_count,
        "recebiveis": recebiveis_count,
        "financeiro": financeiro_count,
        "contas_pagar": contas_count,
        "agendamentos": agendamentos_count,
    }


if __name__ == "__main__":
    resultado = import_operational_data()
    for chave, valor in resultado.items():
        print(f"{chave.upper()}_IMPORTADOS={valor}")
