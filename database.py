import os
import sqlite3
from datetime import datetime
import hashlib
import hmac
import secrets
import json
from pathlib import Path


DB_PATH = os.getenv("DB_PATH", "clinica.db")
USUARIO_ADMIN_INICIAL = "admin"
SENHA_ADMIN_INICIAL = "admin123"
SENHA_PADRAO_USUARIOS = "soulsul"

USUARIOS_PADRAO = [
    {"nome": "Juliana", "usuario": "juliana", "perfil": "Administrador", "cargo": "Administrador", "agenda_escopo": "TODA_CLINICA"},
    {"nome": "Eliane", "usuario": "eliane", "perfil": "Usuario", "cargo": "Profissional", "agenda_escopo": "SOMENTE_PROPRIA"},
    {"nome": "Dra Ester", "usuario": "draester", "perfil": "Usuario", "cargo": "Profissional", "agenda_escopo": "SOMENTE_PROPRIA"},
    {"nome": "Camila", "usuario": "camila", "perfil": "Usuario", "cargo": "Recepcionista", "agenda_escopo": "TODA_CLINICA"},
]

PROCEDIMENTOS_PADRAO = [
    {"nome": "Aumento De Coroa", "valor": 415},
    {"nome": "Clareamento Caseiro", "valor": 900},
    {"nome": "Clareamento Caseiro Inferior", "valor": 450},
    {"nome": "Clareamento Caseiro Superior", "valor": 450},
    {"nome": "Clareamento de consultÃ³rio", "valor": 1240},
    {"nome": "Clareamento Interno", "valor": 475},
    {"nome": "Clareamento Misto", "valor": 1720},
    {"nome": "Consulta de emergÃªncia", "valor": 300},
    {"nome": "ContenÃ§Ã£o Ortodontica", "valor": 300},
    {"nome": "Coroa CerÃ¢mica Sobre Dente", "valor": 1900},
    {"nome": "Coroa CerÃ¢mica Sobre Implante", "valor": 2000},
    {"nome": "Coroa cerÃ´mero sobre dente", "valor": 800},
    {"nome": "Coroa cerÃ´mero sobre implante", "valor": 1300},
    {"nome": "Coroa ProvisÃ³ria Sobre Dente", "valor": 480},
    {"nome": "Coroa ProvisÃ³ria Sobre Implante", "valor": 800},
    {"nome": "Enxerto De Preenchimento", "valor": 900},
    {"nome": "Enxerto Extra Graft", "valor": 900},
    {"nome": "Exodontia Dente Incluso", "valor": 600},
    {"nome": "Exodontia Raiz Residual", "valor": 270},
    {"nome": "Exodontia Simples", "valor": 250},
    {"nome": "Faceta Porcelana", "valor": 1925},
    {"nome": "Faceta Resina", "valor": 755},
    {"nome": "Fechamento Diastema", "valor": 600},
    {"nome": "Gengivoplastia/Gengivectomia", "valor": 270},
    {"nome": "Implante", "valor": 1200},
    {"nome": "Inlay de Porcelana", "valor": 2000},
    {"nome": "InstalaÃ§Ã£o de aparelho autoligado", "valor": 1700},
    {"nome": "InstalaÃ§Ã£o de aparelho convencional", "valor": 1600},
    {"nome": "InstalaÃ§Ã£o de aparelho estÃ©tico", "valor": 2700},
    {"nome": "Laserterapia", "valor": 150},
    {"nome": "Levantamento De Seio Maxilar Bilateral", "valor": 4500},
    {"nome": "Levantamento De Seio Maxilar Unilateral", "valor": 2250},
    {"nome": "Limpeza De Protocolo", "valor": 700},
    {"nome": "Limpeza De Protocolo Duplo", "valor": 1200},
    {"nome": "ManutenÃ§Ã£o Ortodontia EstÃ©tico", "valor": 190},
    {"nome": "ManutenÃ§Ã£o Protocolo", "valor": 1000},
    {"nome": "Onlay de Porcelana", "valor": 2000},
    {"nome": "OrientaÃ§Ã£o De Higiene Bucal", "valor": 300},
    {"nome": "Overlay Porcelana", "valor": 2000},
    {"nome": "Pino intraradicular", "valor": 500},
    {"nome": "Placa Miorrelaxante", "valor": 700},
    {"nome": "Profilaxia", "valor": 220},
    {"nome": "Protese Parcial Removivel", "valor": 2520},
    {"nome": "PrÃ³tese Parcial RemovÃ­vel com Grampo", "valor": 2520},
    {"nome": "PrÃ³tese Parcial RemovÃ­vel ProvisÃ³ria", "valor": 520},
    {"nome": "PrÃ³tese Total", "valor": 2520},
    {"nome": "PrÃ³tese Total ProvisÃ³ria", "valor": 700},
    {"nome": "PrÃ³tese Total ProvisÃ³ria Imediata", "valor": 2100},
    {"nome": "Protocolo (Fase CirÃºrgica)", "valor": 10000},
    {"nome": "Protocolo CerÃ¢mico (Parte ProtÃ©tica)", "valor": 32000},
    {"nome": "Protocolo Resinoso (Parte ProtÃ©tica)", "valor": 9000},
    {"nome": "RemoÃ§Ã£o Da ContenÃ§Ã£o Ortodontica", "valor": 430},
    {"nome": "RemoÃ§Ã£o De Aparelho", "valor": 950},
    {"nome": "RemoÃ§Ã£o De Implante", "valor": 780},
    {"nome": "Reparo PrÃ³tese Parcial", "valor": 650},
    {"nome": "Reparo PrÃ³tese Total", "valor": 950},
    {"nome": "RestauraÃ§Ã£o Resina-1 Face", "valor": 270},
    {"nome": "RestauraÃ§Ã£o Resina-2 Faces", "valor": 370},
    {"nome": "RestauraÃ§Ã£o Resina-3 Faces", "valor": 470},
    {"nome": "RestauraÃ§Ã£o Resina-4 Faces", "valor": 570},
    {"nome": "Retratamento EndodÃ´ntico Incisivo/Canino", "valor": 1290},
    {"nome": "Retratamento EndodÃ´ntico Molar", "valor": 1400},
    {"nome": "Retratamento EndodÃ´ntico PrÃ©-Molar", "valor": 1290},
    {"nome": "Ã“xido nitroso", "valor": 1000},
    {"nome": "Tracionamento OrtodÃ´ntico", "valor": 1300},
    {"nome": "Tratamento EndodÃ´ntico Incisivo/Canino", "valor": 860},
    {"nome": "Tratamento EndodÃ´ntico Molar", "valor": 1075},
    {"nome": "Tratamento EndodÃ´ntico PrÃ©-Molar", "valor": 1000},
    {"nome": "Tratamento Periodontal Leve", "valor": 350},
    {"nome": "Tratamento Periodontal Moderado", "valor": 430},
    {"nome": "Tratamento Periodontal Severo", "valor": 540},
]

ETAPAS_PADRAO_POR_NOME = {
    "Clareamento Caseiro": ["Confecção de placa de clareamento"],
    "Clareamento Caseiro Inferior": ["Confecção de placa de clareamento"],
    "Clareamento Caseiro Superior": ["Confecção de placa de clareamento"],
    "Coroa Cerâmica Sobre Dente": [
        "confecção de pino metálico intracanal",
        "casquete metálico",
        "aplicação de cerâmica",
        "aplicação de glaze",
        "ajuste de cerâmica",
    ],
    "Coroa Cerâmica Sobre Implante": [
        "confecção de metal",
        "aplicação de cerâmica",
        "aplicação de glaze",
        "ajuste de metal",
        "ajuste de cerâmica",
    ],
    "Coroa cerômero sobre dente": ["confecção de coroa de cerômero"],
    "Coroa cerômero sobre implante": [
        "confecção de metal para coroa de cerômero sobre implante",
        "aplicação de cerômero sobre metal",
        "ajuste de coroa de cerômero sobre implante",
    ],
    "Faceta Porcelana": ["mockup", "confecção de facetas em porcelana"],
    "Faceta Resina": ["mockup"],
    "Inlay de Porcelana": ["confecção de inlay de porcelana"],
    "Manutenção Protocolo": ["Manutenção de protocolo"],
    "Onlay de Porcelana": ["confecção de onlay de porcelana"],
    "Overlay Porcelana": ["confecção de overlay de porcelana"],
    "Placa Miorrelaxante": ["Confecção de placa miorrelaxante"],
    "Protese Parcial Removivel": ["confecção de rolete de cera", "montagem de dentes", "acrilização"],
    "Prótese Parcial Removível com Grampo": ["confeção da grade metálica", "confecção de rolete de cera", "montagem de dentes", "acrilização"],
    "Prótese Parcial Removível Provisória": ["confecção de rolete de cera", "montagem de dentes", "acrilização"],
    "Prótese Total": ["confecção de rolete de cera", "montagem de dentes", "acrilização"],
    "Prótese Total Provisória": ["confecção de rolete de cera", "montagem de dentes", "acrilização"],
    "Prótese Total Provisória Imediata": ["confecção de rolete de cera", "montagem de dentes", "acrilização"],
    "Protocolo Cerâmico (Parte Protética)": ["confecção de rolete de cera", "montagem de dentes", "confecção index", "aplicação de cerâmica (finalização)"],
    "Protocolo Resinoso (Parte Protética)": ["confecção de rolete de cera", "montagem de dentes", "confecção barra", "montagem de dente sobre barra", "acrilização"],
    "Reparo Prótese Parcial": ["Reparo"],
    "Reparo Prótese Total": ["Reparo"],
}


def conectar():
    db_path = Path(DB_PATH)
    if db_path.parent and str(db_path.parent) not in {"", "."}:
        db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def tabela_existe(conn, nome_tabela):
    row = conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
        (nome_tabela,),
    ).fetchone()
    return row is not None


def colunas_tabela(conn, nome_tabela):
    if not tabela_existe(conn, nome_tabela):
        return set()
    return {row["name"] for row in conn.execute(f"PRAGMA table_info({nome_tabela})")}


def garantir_coluna(conn, nome_tabela, definicao_coluna):
    nome_coluna = definicao_coluna.split()[0]
    if nome_coluna not in colunas_tabela(conn, nome_tabela):
        conn.execute(f"ALTER TABLE {nome_tabela} ADD COLUMN {definicao_coluna}")


def garantir_indice(conn, sql_criacao):
    conn.execute(sql_criacao)


def agora_str():
    return datetime.now().isoformat(sep=" ", timespec="seconds")


def corrigir_texto_importado(texto):
    valor = str(texto or "")
    correcoes = {
        "Ã§": "ç",
        "Ã£": "ã",
        "Ã¡": "á",
        "Ãà": "à",
        "Ã¢": "â",
        "Ãª": "ê",
        "Ã©": "é",
        "Ã­": "í",
        "Ã³": "ó",
        "Ã´": "ô",
        "Ãº": "ú",
        "Ã‰": "É",
        "Ã“": "Ó",
        "Ãš": "Ú",
        "Ã‡": "Ç",
    }
    for origem, destino in correcoes.items():
        valor = valor.replace(origem, destino)
    return valor


def categoria_procedimento_padrao(nome):
    texto = corrigir_texto_importado(nome).lower()
    if "endod" in texto:
        return "Endodontia"
    if "clareamento" in texto or "faceta" in texto or "inlay" in texto or "onlay" in texto or "overlay" in texto:
        return "Estetica"
    if "protocolo" in texto or "protese" in texto or "prótese" in texto or "coroa" in texto or "placa" in texto:
        return "Protese"
    if "implante" in texto or "enxerto" in texto or "seio maxilar" in texto:
        return "Implantodontia"
    if "aparelho" in texto or "ortodont" in texto or "contenção" in texto or "contenc" in texto or "tracionamento" in texto:
        return "Ortodontia"
    if "periodontal" in texto or "gengiv" in texto or "profilaxia" in texto or "higiene" in texto:
        return "Periodontia"
    if "exodontia" in texto:
        return "Cirurgia"
    return "Clinico"


def etapas_padrao_procedimento(nome):
    nome_limpo = corrigir_texto_importado(nome).strip()
    return ETAPAS_PADRAO_POR_NOME.get(nome_limpo, [])


def gerar_hash_senha(senha, salt=None):
    salt_bytes = salt or secrets.token_bytes(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", str(senha or "").encode("utf-8"), salt_bytes, 100000)
    return f"{salt_bytes.hex()}${hash_bytes.hex()}"


def verificar_senha(senha, senha_hash):
    texto = str(senha_hash or "")
    if "$" not in texto:
        return False
    salt_hex, hash_hex = texto.split("$", 1)
    try:
        salt_bytes = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    hash_bytes = hashlib.pbkdf2_hmac("sha256", str(senha or "").encode("utf-8"), salt_bytes, 100000)
    return hmac.compare_digest(hash_bytes.hex(), hash_hex)


def garantir_usuario_admin_inicial(conn):
    row = conn.execute("SELECT id FROM usuarios WHERE ativo=1 ORDER BY id LIMIT 1").fetchone()
    if row is not None:
        return
    conn.execute(
        """
        INSERT INTO usuarios
        (nome, usuario, senha_hash, perfil, cargo, agenda_escopo, senha_temporaria, precisa_trocar_senha, ativo, acesso_dashboard, acesso_pacientes, acesso_contratos, acesso_financeiro, acesso_usuarios, data_criacao)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, 1, ?, ?, ?, ?, ?, ?)
        """,
        (
            "Administrador",
            USUARIO_ADMIN_INICIAL,
            gerar_hash_senha(SENHA_ADMIN_INICIAL),
            "Administrador",
            "Administrador",
            "TODA_CLINICA",
            1,
            1,
            1,
            1,
            1,
            agora_str(),
        ),
    )


def garantir_usuarios_padrao(conn):
    total_usuarios = conn.execute("SELECT COUNT(1) AS total FROM usuarios").fetchone()
    criar_padrao = int((total_usuarios or {})["total"] or 0) <= 1
    for usuario in USUARIOS_PADRAO:
        row = conn.execute("SELECT id, senha_hash FROM usuarios WHERE lower(usuario)=lower(?) LIMIT 1", (usuario["usuario"],)).fetchone()
        if row is None:
            if not criar_padrao:
                continue
            conn.execute(
                """
                INSERT INTO usuarios
                (nome, usuario, senha_hash, perfil, cargo, agenda_escopo, senha_temporaria, precisa_trocar_senha, ativo, acesso_dashboard, acesso_pacientes, acesso_contratos, acesso_financeiro, acesso_usuarios, data_criacao)
                VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, 1, 1, 0, ?, ?, ?)
                """,
                (
                    usuario["nome"],
                    usuario["usuario"],
                    gerar_hash_senha(SENHA_PADRAO_USUARIOS),
                    usuario["perfil"],
                    usuario["cargo"],
                    usuario["agenda_escopo"],
                    1 if usuario["perfil"] == "Administrador" or usuario["cargo"] == "Recepcionista" else 0,
                    1 if usuario["perfil"] == "Administrador" else 0,
                    agora_str(),
                ),
            )
            continue

        conn.execute(
            """
            UPDATE usuarios
            SET nome=COALESCE(NULLIF(nome, ''), ?),
                perfil=COALESCE(NULLIF(perfil, ''), ?),
                cargo=COALESCE(NULLIF(cargo, ''), ?),
                agenda_escopo=COALESCE(NULLIF(agenda_escopo, ''), ?)
            WHERE id=?
            """,
            (usuario["nome"], usuario["perfil"], usuario["cargo"], usuario["agenda_escopo"], row["id"]),
        )


def garantir_configuracao_usuarios_agenda(conn):
    conn.execute(
        """
        UPDATE usuarios
        SET
            nome_agenda = COALESCE(NULLIF(nome_agenda, ''), UPPER(COALESCE(nome, usuario, ''))),
            agenda_disponivel = COALESCE(
                agenda_disponivel,
                CASE
                    WHEN COALESCE(cargo, '') IN ('Profissional', 'Administrador') THEN 1
                    ELSE 0
                END
            ),
            modulos_json = COALESCE(NULLIF(modulos_json, ''), '{}'),
            pacientes_abas_json = COALESCE(NULLIF(pacientes_abas_json, ''), '{}')
        """
    )


def garantir_metas_vendas_iniciais(conn, ano=None):
    ano_referencia = int(ano or datetime.now().year)
    row = conn.execute("SELECT id FROM metas_vendas WHERE ano=? LIMIT 1", (ano_referencia,)).fetchone()
    if row is not None:
        return
    conn.execute(
        """
        INSERT INTO metas_vendas
        (ano, meta, supermeta, hipermeta, data_atualizacao)
        VALUES (?, ?, ?, ?, ?)
        """,
        (ano_referencia, 100000.0, 150000.0, 200000.0, agora_str()),
    )


def garantir_meta_mensal_inicial(conn, ano=None, mes=None):
    ano_referencia = int(ano or datetime.now().year)
    mes_referencia = int(mes or datetime.now().month)
    row = conn.execute(
        "SELECT id FROM metas_mensais WHERE ano=? AND mes=? LIMIT 1",
        (ano_referencia, mes_referencia),
    ).fetchone()
    if row is not None:
        return
    base_row = conn.execute(
        """
        SELECT meta, supermeta, hipermeta
        FROM metas_vendas
        WHERE ano=?
        LIMIT 1
        """,
        (ano_referencia,),
    ).fetchone()
    meta = float(base_row["meta"] or 100000.0) if base_row else 100000.0
    supermeta = float(base_row["supermeta"] or 150000.0) if base_row else 150000.0
    hipermeta = float(base_row["hipermeta"] or 200000.0) if base_row else 200000.0
    conn.execute(
        """
        INSERT INTO metas_mensais
        (ano, mes, meta, supermeta, hipermeta, data_atualizacao)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (ano_referencia, mes_referencia, meta, supermeta, hipermeta, agora_str()),
    )


def garantir_procedimentos_padrao(conn):
    row = conn.execute("SELECT COUNT(1) AS total FROM procedimentos").fetchone()
    if row is not None and int(row["total"] or 0) > 0:
        return
    for procedimento in PROCEDIMENTOS_PADRAO:
        nome = corrigir_texto_importado(procedimento["nome"]).strip()
        if not nome:
            continue
        conn.execute(
            """
            INSERT INTO procedimentos
            (nome, categoria, valor_padrao, duracao_padrao_minutos, descricao, etapas_json, cor_opcional, ativo, criado_em, atualizado_em)
            VALUES (?, ?, ?, 60, '', ?, '', 1, ?, ?)
            """,
            (
                nome,
                categoria_procedimento_padrao(nome),
                float(procedimento["valor"] or 0),
                json.dumps(etapas_padrao_procedimento(nome), ensure_ascii=False),
                agora_str(),
                agora_str(),
            ),
        )


def inicializar_banco():
    conn = conectar()

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pacientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            prontuario TEXT,
            cpf TEXT,
            data_nascimento TEXT,
            telefone TEXT,
            cep TEXT,
            endereco TEXT,
            numero TEXT,
            bairro TEXT,
            cidade TEXT,
            estado TEXT,
            menor_idade INTEGER DEFAULT 0,
            responsavel TEXT,
            cpf_responsavel TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contratos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER,
            valor_total REAL DEFAULT 0,
            entrada REAL DEFAULT 0,
            parcelas INTEGER DEFAULT 1,
            primeiro_vencimento TEXT,
            data_pagamento_entrada TEXT,
            forma_pagamento TEXT,
            hash_importacao TEXT,
            data_criacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS procedimentos_contrato (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contrato_id INTEGER,
            procedimento TEXT,
            valor REAL DEFAULT 0
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS procedimentos_dente (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER,
            contrato_id INTEGER,
            grupo_item INTEGER,
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

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS financeiro (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            origem TEXT,
            descricao TEXT,
            valor REAL DEFAULT 0,
            data TEXT,
            tipo TEXT,
            contrato_id INTEGER,
            recebivel_id INTEGER,
            prontuario TEXT,
            forma_pagamento TEXT,
            observacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS agendamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            hora_inicio TEXT,
            hora_fim TEXT,
            paciente_id INTEGER,
            paciente_nome TEXT,
            profissional TEXT,
            procedimento TEXT,
            status TEXT DEFAULT 'Agendado',
            observacao TEXT,
            data_criacao TEXT,
            nome_paciente_snapshot TEXT,
            telefone_snapshot TEXT,
            email_snapshot TEXT,
            profissional_id INTEGER,
            tipo_atendimento_id INTEGER,
            procedimento_id INTEGER,
            procedimento_nome_snapshot TEXT,
            contrato_id INTEGER,
            origem_contrato INTEGER DEFAULT 0,
            data_agendamento TEXT,
            duracao_minutos INTEGER,
            observacoes TEXT,
            criado_por TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS profissionais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            especialidade TEXT,
            cor TEXT,
            dias_atendimento TEXT,
            hora_inicio TEXT,
            hora_fim TEXT,
            ativo INTEGER DEFAULT 1,
            observacao TEXT,
            data_criacao TEXT,
            ordem_exibicao INTEGER,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS tipos_atendimento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            cor TEXT,
            ativo INTEGER DEFAULT 1,
            ordem_exibicao INTEGER,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS procedimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            categoria TEXT,
            valor_padrao REAL DEFAULT 0,
            duracao_padrao_minutos INTEGER DEFAULT 60,
            descricao TEXT,
            etapas_json TEXT,
            cor_opcional TEXT,
            ativo INTEGER DEFAULT 1,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS agendamento_procedimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agendamento_id INTEGER,
            procedimento_id INTEGER,
            procedimento_nome_snapshot TEXT,
            valor_snapshot REAL DEFAULT 0,
            duracao_snapshot_minutos INTEGER,
            origem_contrato INTEGER DEFAULT 0,
            contrato_id INTEGER
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS agendamento_historico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agendamento_id INTEGER,
            acao TEXT,
            descricao TEXT,
            criado_por TEXT,
            criado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ordens_servico_protetico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER,
            procedimento_id INTEGER,
            procedimento_nome_snapshot TEXT,
            material TEXT,
            material_outro TEXT,
            cor TEXT,
            escala TEXT,
            elemento_arcada TEXT,
            carga_imediata INTEGER DEFAULT 0,
            retorno_solicitado TEXT,
            documento_nome TEXT,
            observacao TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ordem_servico_protetico_etapas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordem_servico_id INTEGER,
            etapa TEXT,
            descricao_outro TEXT,
            criado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS lembretes_agendamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agendamento_id INTEGER,
            tipo_lembrete TEXT,
            canal TEXT,
            mensagem TEXT,
            status_envio TEXT,
            criado_em TEXT,
            enviado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pacientes_rapidos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            telefone TEXT,
            email TEXT,
            criado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS recebiveis (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            contrato_id INTEGER,
            paciente_id INTEGER,
            paciente_nome TEXT,
            prontuario TEXT,
            parcela_numero INTEGER,
            vencimento TEXT,
            valor REAL DEFAULT 0,
            forma_pagamento TEXT,
            status TEXT DEFAULT 'Aberto',
            observacao TEXT,
            data_criacao TEXT,
            hash_importacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS contas_pagar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_vencimento TEXT,
            descricao TEXT,
            fornecedor TEXT,
            valor REAL DEFAULT 0,
            pago TEXT,
            valor_pago REAL DEFAULT 0,
            status TEXT DEFAULT 'A vencer',
            observacao TEXT,
            data_criacao TEXT,
            hash_importacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data_venda TEXT,
            paciente_nome TEXT,
            valor_total REAL DEFAULT 0,
            valor_a_vista REAL DEFAULT 0,
            valor_cartao REAL DEFAULT 0,
            valor_boleto REAL DEFAULT 0,
            saldo REAL DEFAULT 0,
            data_a_pagar TEXT,
            avaliador TEXT,
            vendedor TEXT,
            nf TEXT,
            contrato_id INTEGER,
            hash_importacao TEXT,
            data_criacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS metas_vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ano INTEGER,
            meta REAL DEFAULT 100000,
            supermeta REAL DEFAULT 150000,
            hipermeta REAL DEFAULT 200000,
            data_atualizacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS metas_mensais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ano INTEGER,
            mes INTEGER,
            meta REAL DEFAULT 100000,
            supermeta REAL DEFAULT 150000,
            hipermeta REAL DEFAULT 200000,
            data_atualizacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT,
            usuario TEXT,
            nome_agenda TEXT,
            senha_hash TEXT,
            perfil TEXT DEFAULT 'Administrador',
            cargo TEXT DEFAULT 'Administrador',
            agenda_escopo TEXT DEFAULT 'TODA_CLINICA',
            agenda_disponivel INTEGER DEFAULT 0,
            senha_temporaria INTEGER DEFAULT 1,
            precisa_trocar_senha INTEGER DEFAULT 1,
            ultimo_login TEXT,
            ativo INTEGER DEFAULT 1,
            acesso_dashboard INTEGER DEFAULT 1,
            acesso_pacientes INTEGER DEFAULT 1,
            acesso_contratos INTEGER DEFAULT 1,
            acesso_financeiro INTEGER DEFAULT 1,
            acesso_usuarios INTEGER DEFAULT 0,
            modulos_json TEXT DEFAULT '{}',
            pacientes_abas_json TEXT DEFAULT '{}',
            data_criacao TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS agenda_configuracao (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            ordem_profissionais_json TEXT DEFAULT '[]',
            config_clinica_dias_json TEXT DEFAULT '{}',
            config_profissionais_json TEXT DEFAULT '{}',
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS logs_acesso (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            usuario TEXT,
            evento TEXT,
            data_hora TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS acoes_usuario (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER,
            usuario TEXT,
            acao TEXT,
            tipo TEXT,
            info TEXT,
            metodo_http TEXT,
            rota TEXT,
            data_hora TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS recibos_manuais (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero INTEGER,
            valor REAL DEFAULT 0,
            pagador TEXT,
            recebedor TEXT,
            data_pagamento TEXT,
            referente TEXT,
            observacao TEXT,
            cidade TEXT,
            criado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS notas_fiscais_emitidas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            competencia TEXT,
            data_emissao TEXT,
            data_recebimento TEXT,
            numero_nf TEXT,
            serie TEXT,
            cliente TEXT,
            descricao TEXT,
            conta_destino TEXT,
            valor_nf REAL DEFAULT 0,
            valor_recebido REAL DEFAULT 0,
            status TEXT DEFAULT 'Pendente',
            observacao TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    garantir_coluna(conn, "financeiro", "origem TEXT")
    garantir_coluna(conn, "financeiro", "contrato_id INTEGER")
    garantir_coluna(conn, "financeiro", "recebivel_id INTEGER")
    garantir_coluna(conn, "financeiro", "prontuario TEXT")
    garantir_coluna(conn, "financeiro", "forma_pagamento TEXT")
    garantir_coluna(conn, "financeiro", "observacao TEXT")
    garantir_coluna(conn, "financeiro", "conta_caixa TEXT")
    garantir_coluna(conn, "agendamentos", "data TEXT")
    garantir_coluna(conn, "agendamentos", "hora_inicio TEXT")
    garantir_coluna(conn, "agendamentos", "hora_fim TEXT")
    garantir_coluna(conn, "agendamentos", "paciente_id INTEGER")
    garantir_coluna(conn, "agendamentos", "paciente_nome TEXT")
    garantir_coluna(conn, "agendamentos", "profissional TEXT")
    garantir_coluna(conn, "agendamentos", "procedimento TEXT")
    garantir_coluna(conn, "agendamentos", "status TEXT DEFAULT 'Agendado'")
    garantir_coluna(conn, "agendamentos", "observacao TEXT")
    garantir_coluna(conn, "agendamentos", "data_criacao TEXT")
    garantir_coluna(conn, "agendamentos", "nome_paciente_snapshot TEXT")
    garantir_coluna(conn, "agendamentos", "telefone_snapshot TEXT")
    garantir_coluna(conn, "agendamentos", "email_snapshot TEXT")
    garantir_coluna(conn, "agendamentos", "profissional_id INTEGER")
    garantir_coluna(conn, "agendamentos", "tipo_atendimento_id INTEGER")
    garantir_coluna(conn, "agendamentos", "procedimento_id INTEGER")
    garantir_coluna(conn, "agendamentos", "procedimento_nome_snapshot TEXT")
    garantir_coluna(conn, "agendamentos", "contrato_id INTEGER")
    garantir_coluna(conn, "agendamentos", "origem_contrato INTEGER DEFAULT 0")
    garantir_coluna(conn, "agendamentos", "data_agendamento TEXT")
    garantir_coluna(conn, "agendamentos", "duracao_minutos INTEGER")
    garantir_coluna(conn, "agendamentos", "observacoes TEXT")
    garantir_coluna(conn, "agendamentos", "criado_por TEXT")
    garantir_coluna(conn, "agendamentos", "criado_em TEXT")
    garantir_coluna(conn, "agendamentos", "atualizado_em TEXT")
    garantir_coluna(conn, "agendamentos", "atualizado_por TEXT")
    garantir_coluna(conn, "profissionais", "nome TEXT")
    garantir_coluna(conn, "profissionais", "especialidade TEXT")
    garantir_coluna(conn, "profissionais", "cor TEXT")
    garantir_coluna(conn, "profissionais", "dias_atendimento TEXT")
    garantir_coluna(conn, "profissionais", "hora_inicio TEXT")
    garantir_coluna(conn, "profissionais", "hora_fim TEXT")
    garantir_coluna(conn, "profissionais", "ativo INTEGER DEFAULT 1")
    garantir_coluna(conn, "profissionais", "observacao TEXT")
    garantir_coluna(conn, "profissionais", "data_criacao TEXT")
    garantir_coluna(conn, "profissionais", "ordem_exibicao INTEGER")
    garantir_coluna(conn, "profissionais", "criado_em TEXT")
    garantir_coluna(conn, "profissionais", "atualizado_em TEXT")
    garantir_coluna(conn, "tipos_atendimento", "nome TEXT")
    garantir_coluna(conn, "tipos_atendimento", "cor TEXT")
    garantir_coluna(conn, "tipos_atendimento", "ativo INTEGER DEFAULT 1")
    garantir_coluna(conn, "tipos_atendimento", "ordem_exibicao INTEGER")
    garantir_coluna(conn, "tipos_atendimento", "criado_em TEXT")
    garantir_coluna(conn, "tipos_atendimento", "atualizado_em TEXT")
    garantir_coluna(conn, "procedimentos", "nome TEXT")
    garantir_coluna(conn, "procedimentos", "categoria TEXT")
    garantir_coluna(conn, "procedimentos", "valor_padrao REAL DEFAULT 0")
    garantir_coluna(conn, "procedimentos", "duracao_padrao_minutos INTEGER DEFAULT 60")
    garantir_coluna(conn, "procedimentos", "descricao TEXT")
    garantir_coluna(conn, "procedimentos", "etapas_json TEXT")
    garantir_coluna(conn, "procedimentos", "cor_opcional TEXT")
    garantir_coluna(conn, "procedimentos", "ativo INTEGER DEFAULT 1")
    garantir_coluna(conn, "procedimentos", "criado_em TEXT")
    garantir_coluna(conn, "procedimentos", "atualizado_em TEXT")
    garantir_coluna(conn, "agendamento_procedimentos", "agendamento_id INTEGER")
    garantir_coluna(conn, "agendamento_procedimentos", "procedimento_id INTEGER")
    garantir_coluna(conn, "agendamento_procedimentos", "procedimento_nome_snapshot TEXT")
    garantir_coluna(conn, "agendamento_procedimentos", "valor_snapshot REAL DEFAULT 0")
    garantir_coluna(conn, "agendamento_procedimentos", "duracao_snapshot_minutos INTEGER")
    garantir_coluna(conn, "agendamento_procedimentos", "origem_contrato INTEGER DEFAULT 0")
    garantir_coluna(conn, "agendamento_procedimentos", "contrato_id INTEGER")
    garantir_coluna(conn, "agendamento_historico", "agendamento_id INTEGER")
    garantir_coluna(conn, "agendamento_historico", "acao TEXT")
    garantir_coluna(conn, "agendamento_historico", "descricao TEXT")
    garantir_coluna(conn, "agendamento_historico", "criado_por TEXT")
    garantir_coluna(conn, "agendamento_historico", "criado_em TEXT")
    garantir_coluna(conn, "procedimentos_dente", "grupo_item INTEGER")
    garantir_coluna(conn, "lembretes_agendamento", "agendamento_id INTEGER")
    garantir_coluna(conn, "lembretes_agendamento", "tipo_lembrete TEXT")
    garantir_coluna(conn, "lembretes_agendamento", "canal TEXT")
    garantir_coluna(conn, "lembretes_agendamento", "mensagem TEXT")
    garantir_coluna(conn, "lembretes_agendamento", "status_envio TEXT")
    garantir_coluna(conn, "lembretes_agendamento", "criado_em TEXT")
    garantir_coluna(conn, "lembretes_agendamento", "enviado_em TEXT")
    garantir_coluna(conn, "pacientes_rapidos", "nome TEXT")
    garantir_coluna(conn, "pacientes_rapidos", "telefone TEXT")
    garantir_coluna(conn, "pacientes_rapidos", "email TEXT")
    garantir_coluna(conn, "pacientes_rapidos", "criado_em TEXT")
    garantir_coluna(conn, "recebiveis", "paciente_id INTEGER")
    garantir_coluna(conn, "recebiveis", "paciente_nome TEXT")
    garantir_coluna(conn, "recebiveis", "prontuario TEXT")
    garantir_coluna(conn, "recebiveis", "parcela_numero INTEGER")
    garantir_coluna(conn, "recebiveis", "vencimento TEXT")
    garantir_coluna(conn, "recebiveis", "valor REAL DEFAULT 0")
    garantir_coluna(conn, "recebiveis", "forma_pagamento TEXT")
    garantir_coluna(conn, "recebiveis", "status TEXT DEFAULT 'Aberto'")
    garantir_coluna(conn, "recebiveis", "observacao TEXT")
    garantir_coluna(conn, "recebiveis", "data_criacao TEXT")
    garantir_coluna(conn, "recebiveis", "data_pagamento TEXT")
    garantir_coluna(conn, "recebiveis", "hash_importacao TEXT")
    garantir_coluna(conn, "contas_pagar", "data_vencimento TEXT")
    garantir_coluna(conn, "contas_pagar", "descricao TEXT")
    garantir_coluna(conn, "contas_pagar", "fornecedor TEXT")
    garantir_coluna(conn, "contas_pagar", "valor REAL DEFAULT 0")
    garantir_coluna(conn, "contas_pagar", "pago TEXT")
    garantir_coluna(conn, "contas_pagar", "valor_pago REAL DEFAULT 0")
    garantir_coluna(conn, "contas_pagar", "status TEXT DEFAULT 'A vencer'")
    garantir_coluna(conn, "contas_pagar", "observacao TEXT")
    garantir_coluna(conn, "contas_pagar", "data_criacao TEXT")
    garantir_coluna(conn, "contas_pagar", "hash_importacao TEXT")
    garantir_coluna(conn, "vendas", "data_venda TEXT")
    garantir_coluna(conn, "vendas", "paciente_nome TEXT")
    garantir_coluna(conn, "vendas", "valor_total REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "valor_a_vista REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "valor_cartao REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "valor_boleto REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "saldo REAL DEFAULT 0")
    garantir_coluna(conn, "vendas", "data_a_pagar TEXT")
    garantir_coluna(conn, "vendas", "avaliador TEXT")
    garantir_coluna(conn, "vendas", "vendedor TEXT")
    garantir_coluna(conn, "vendas", "nf TEXT")
    garantir_coluna(conn, "vendas", "contrato_id INTEGER")
    garantir_coluna(conn, "vendas", "hash_importacao TEXT")
    garantir_coluna(conn, "vendas", "data_criacao TEXT")
    garantir_coluna(conn, "metas_vendas", "ano INTEGER")
    garantir_coluna(conn, "metas_vendas", "meta REAL DEFAULT 100000")
    garantir_coluna(conn, "metas_vendas", "supermeta REAL DEFAULT 150000")
    garantir_coluna(conn, "metas_vendas", "hipermeta REAL DEFAULT 200000")
    garantir_coluna(conn, "metas_vendas", "data_atualizacao TEXT")
    garantir_coluna(conn, "metas_mensais", "ano INTEGER")
    garantir_coluna(conn, "metas_mensais", "mes INTEGER")
    garantir_coluna(conn, "metas_mensais", "meta REAL DEFAULT 100000")
    garantir_coluna(conn, "metas_mensais", "supermeta REAL DEFAULT 150000")
    garantir_coluna(conn, "metas_mensais", "hipermeta REAL DEFAULT 200000")
    garantir_coluna(conn, "metas_mensais", "data_atualizacao TEXT")
    garantir_coluna(conn, "usuarios", "nome TEXT")
    garantir_coluna(conn, "usuarios", "usuario TEXT")
    garantir_coluna(conn, "usuarios", "nome_agenda TEXT")
    garantir_coluna(conn, "usuarios", "senha_hash TEXT")
    garantir_coluna(conn, "usuarios", "perfil TEXT DEFAULT 'Administrador'")
    garantir_coluna(conn, "usuarios", "cargo TEXT DEFAULT 'Administrador'")
    garantir_coluna(conn, "usuarios", "agenda_escopo TEXT DEFAULT 'TODA_CLINICA'")
    garantir_coluna(conn, "usuarios", "agenda_disponivel INTEGER DEFAULT 0")
    garantir_coluna(conn, "usuarios", "senha_temporaria INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "precisa_trocar_senha INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "ultimo_login TEXT")
    garantir_coluna(conn, "usuarios", "ativo INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_dashboard INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_pacientes INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_contratos INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_financeiro INTEGER DEFAULT 1")
    garantir_coluna(conn, "usuarios", "acesso_usuarios INTEGER DEFAULT 0")
    garantir_coluna(conn, "usuarios", "modulos_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "usuarios", "pacientes_abas_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "usuarios", "data_criacao TEXT")
    garantir_coluna(conn, "agenda_configuracao", "ordem_profissionais_json TEXT DEFAULT '[]'")
    garantir_coluna(conn, "agenda_configuracao", "config_clinica_dias_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "agenda_configuracao", "config_profissionais_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "agenda_configuracao", "atualizado_em TEXT")
    garantir_coluna(conn, "logs_acesso", "usuario_id INTEGER")
    garantir_coluna(conn, "logs_acesso", "usuario TEXT")
    garantir_coluna(conn, "logs_acesso", "evento TEXT")
    garantir_coluna(conn, "logs_acesso", "data_hora TEXT")
    garantir_coluna(conn, "acoes_usuario", "usuario_id INTEGER")
    garantir_coluna(conn, "acoes_usuario", "usuario TEXT")
    garantir_coluna(conn, "acoes_usuario", "acao TEXT")
    garantir_coluna(conn, "acoes_usuario", "tipo TEXT")
    garantir_coluna(conn, "acoes_usuario", "info TEXT")
    garantir_coluna(conn, "acoes_usuario", "metodo_http TEXT")
    garantir_coluna(conn, "acoes_usuario", "rota TEXT")
    garantir_coluna(conn, "acoes_usuario", "data_hora TEXT")
    garantir_coluna(conn, "recibos_manuais", "numero INTEGER DEFAULT 0")
    garantir_coluna(conn, "recibos_manuais", "valor REAL DEFAULT 0")
    garantir_coluna(conn, "recibos_manuais", "pagador TEXT")
    garantir_coluna(conn, "recibos_manuais", "recebedor TEXT")
    garantir_coluna(conn, "recibos_manuais", "data_pagamento TEXT")
    garantir_coluna(conn, "recibos_manuais", "referente TEXT")
    garantir_coluna(conn, "recibos_manuais", "observacao TEXT")
    garantir_coluna(conn, "recibos_manuais", "cidade TEXT")
    garantir_coluna(conn, "recibos_manuais", "criado_em TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "competencia TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "data_emissao TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "data_recebimento TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "numero_nf TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "serie TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "cliente TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "descricao TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "conta_destino TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "valor_nf REAL DEFAULT 0")
    garantir_coluna(conn, "notas_fiscais_emitidas", "valor_recebido REAL DEFAULT 0")
    garantir_coluna(conn, "notas_fiscais_emitidas", "status TEXT DEFAULT 'Pendente'")
    garantir_coluna(conn, "notas_fiscais_emitidas", "observacao TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "criado_em TEXT")
    garantir_coluna(conn, "notas_fiscais_emitidas", "atualizado_em TEXT")
    garantir_coluna(conn, "contratos", "data_criacao TEXT")
    garantir_coluna(conn, "contratos", "data_pagamento_entrada TEXT")
    garantir_coluna(conn, "contratos", "hash_importacao TEXT")
    garantir_coluna(conn, "pacientes", "numero TEXT")
    garantir_coluna(conn, "pacientes", "bairro TEXT")
    garantir_coluna(conn, "pacientes", "cidade TEXT")
    garantir_coluna(conn, "pacientes", "estado TEXT")
    garantir_coluna(conn, "pacientes", "responsavel TEXT")
    garantir_coluna(conn, "pacientes", "cpf_responsavel TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "paciente_id INTEGER")
    garantir_coluna(conn, "ordens_servico_protetico", "procedimento_id INTEGER")
    garantir_coluna(conn, "ordens_servico_protetico", "procedimento_nome_snapshot TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "material TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "material_outro TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "cor TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "escala TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "elemento_arcada TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "carga_imediata INTEGER DEFAULT 0")
    garantir_coluna(conn, "ordens_servico_protetico", "retorno_solicitado TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "documento_nome TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "observacao TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "criado_em TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "atualizado_em TEXT")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "ordem_servico_id INTEGER")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "etapa TEXT")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "descricao_outro TEXT")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "criado_em TEXT")
    conn.execute(
        """
        UPDATE agendamentos
        SET
            data_agendamento = COALESCE(NULLIF(data_agendamento, ''), NULLIF(data, '')),
            nome_paciente_snapshot = COALESCE(NULLIF(nome_paciente_snapshot, ''), NULLIF(paciente_nome, '')),
            procedimento_nome_snapshot = COALESCE(NULLIF(procedimento_nome_snapshot, ''), NULLIF(procedimento, '')),
            observacoes = COALESCE(NULLIF(observacoes, ''), NULLIF(observacao, '')),
            criado_em = COALESCE(NULLIF(criado_em, ''), NULLIF(data_criacao, ''), ?),
            atualizado_em = COALESCE(NULLIF(atualizado_em, ''), NULLIF(criado_em, ''), NULLIF(data_criacao, ''), ?)
        """,
        (agora_str(), agora_str()),
    )
    conn.execute(
        """
        UPDATE profissionais
        SET
            ordem_exibicao = COALESCE(ordem_exibicao, id),
            criado_em = COALESCE(NULLIF(criado_em, ''), NULLIF(data_criacao, ''), ?),
            atualizado_em = COALESCE(NULLIF(atualizado_em, ''), NULLIF(criado_em, ''), NULLIF(data_criacao, ''), ?)
        """,
        (agora_str(), agora_str()),
    )
    conn.execute(
        """
        UPDATE tipos_atendimento
        SET
            ordem_exibicao = COALESCE(ordem_exibicao, id),
            criado_em = COALESCE(NULLIF(criado_em, ''), ?),
            atualizado_em = COALESCE(NULLIF(atualizado_em, ''), NULLIF(criado_em, ''), ?)
        """,
        (agora_str(), agora_str()),
    )
    conn.execute(
        """
        UPDATE procedimentos
        SET
            criado_em = COALESCE(NULLIF(criado_em, ''), ?),
            atualizado_em = COALESCE(NULLIF(atualizado_em, ''), NULLIF(criado_em, ''), ?),
            etapas_json = COALESCE(NULLIF(etapas_json, ''), '[]')
        """,
        (agora_str(), agora_str()),
    )
    for nome, etapas in ETAPAS_PADRAO_POR_NOME.items():
        conn.execute(
            """
            UPDATE procedimentos
            SET etapas_json=?
            WHERE lower(COALESCE(nome, ''))=lower(?) AND (etapas_json IS NULL OR trim(etapas_json)='' OR trim(etapas_json)='[]')
            """,
            (json.dumps(etapas, ensure_ascii=False), nome),
        )
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agendamentos_data_agendamento ON agendamentos(data_agendamento)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agendamentos_profissional_id ON agendamentos(profissional_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agendamentos_paciente_id ON agendamentos(paciente_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agendamento_procedimentos_agendamento_id ON agendamento_procedimentos(agendamento_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agendamento_historico_agendamento_id ON agendamento_historico(agendamento_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_lembretes_agendamento_id ON lembretes_agendamento(agendamento_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_ordens_servico_paciente_id ON ordens_servico_protetico(paciente_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_ordem_servico_etapas_ordem_id ON ordem_servico_protetico_etapas(ordem_servico_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(usuario)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_acoes_usuario_data_hora ON acoes_usuario(data_hora)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_acoes_usuario_usuario ON acoes_usuario(usuario)")
    garantir_usuario_admin_inicial(conn)
    garantir_usuarios_padrao(conn)
    garantir_configuracao_usuarios_agenda(conn)
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_profissionais_ativo_ordem ON profissionais(ativo, ordem_exibicao)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_tipos_atendimento_ativo_ordem ON tipos_atendimento(ativo, ordem_exibicao)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_procedimentos_ativo_categoria ON procedimentos(ativo, categoria)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_mensais_ano_mes ON metas_mensais(ano, mes)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_notas_fiscais_competencia ON notas_fiscais_emitidas(competencia, data_emissao)")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS saldos_conta (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT,
            conta TEXT,
            saldo REAL DEFAULT 0,
            observacao TEXT
        )
        """
    )
    garantir_coluna(conn, "saldos_conta", "data TEXT")
    garantir_coluna(conn, "saldos_conta", "conta TEXT")
    garantir_coluna(conn, "saldos_conta", "saldo REAL DEFAULT 0")
    garantir_coluna(conn, "saldos_conta", "observacao TEXT")

    garantir_procedimentos_padrao(conn)
    garantir_metas_vendas_iniciais(conn)
    garantir_meta_mensal_inicial(conn)
    conn.commit()
    conn.close()


if __name__ == "__main__":
    inicializar_banco()
    print("Banco alinhado com o aplicativo principal.")
