import os
import sqlite3
from datetime import datetime
import hashlib
import hmac
import secrets
import json
import re
from pathlib import Path


DB_PATH = os.getenv("DB_PATH", "clinica.db")
USUARIO_ADMIN_INICIAL = os.getenv("ADMIN_INICIAL_USUARIO", "admin")
SENHA_ADMIN_INICIAL = os.getenv("ADMIN_INICIAL_SENHA", "admin123")
SENHA_PADRAO_USUARIOS = os.getenv("SENHA_PADRAO_USUARIOS", "soulsuledu")
CRIAR_USUARIOS_PADRAO = os.getenv("CRIAR_USUARIOS_PADRAO", "1").strip().lower() in {"1", "true", "sim", "yes"}
EDUCACAO_ADMIN_USUARIO = os.getenv("EDUCACAO_ADMIN_USUARIO", "").strip()
EDUCACAO_ADMIN_SENHA = os.getenv("EDUCACAO_ADMIN_SENHA", "").strip()

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
    senha = str(senha or "").upper()
    salt_bytes = salt or secrets.token_bytes(16)
    hash_bytes = hashlib.pbkdf2_hmac("sha256", str(senha or "").encode("utf-8"), salt_bytes, 100000)
    return f"{salt_bytes.hex()}${hash_bytes.hex()}"


def verificar_senha(senha, senha_hash):
    senha = str(senha or "").upper()
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
        VALUES (?, ?, ?, ?, ?, ?, 1, 1, 1, ?, ?, ?, ?, ?, ?)
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
    if not CRIAR_USUARIOS_PADRAO:
        return
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
        CREATE TABLE IF NOT EXISTS treinamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            categoria TEXT,
            descricao TEXT,
            carga_horaria REAL DEFAULT 0,
            valor REAL DEFAULT 0,
            ativo INTEGER DEFAULT 1,
            quantidade_turmas INTEGER DEFAULT 1,
            max_alunos_por_turma INTEGER DEFAULT 0,
            data_inicio TEXT,
            horario_inicio TEXT,
            periodicidade TEXT,
            dias_horarios_json TEXT DEFAULT '{}',
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS turmas_treinamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            treinamento_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            instrutor TEXT,
            data_inicio TEXT,
            data_fim TEXT,
            horario TEXT,
            local TEXT,
            vagas INTEGER DEFAULT 0,
            status TEXT DEFAULT 'Turma confirmada',
            criado_em TEXT,
            atualizado_em TEXT,
            FOREIGN KEY (treinamento_id) REFERENCES treinamentos(id)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS alunos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT,
            nome TEXT NOT NULL,
            sexo TEXT,
            cpf TEXT,
            rg TEXT,
            data_nascimento TEXT,
            telefone TEXT,
            email TEXT,
            cep TEXT,
            endereco TEXT,
            complemento TEXT,
            numero TEXT,
            bairro TEXT,
            cidade TEXT,
            estado TEXT,
            estado_civil TEXT,
            cro TEXT,
            profissao TEXT,
            origem TEXT,
            menor_idade INTEGER DEFAULT 0,
            responsavel TEXT,
            cpf_responsavel TEXT,
            indicado_por_aluno TEXT,
            indicado_clinica INTEGER DEFAULT 0,
            observacoes TEXT,
            ativo INTEGER DEFAULT 1,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS matriculas_treinamento (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            aluno_id INTEGER NOT NULL,
            turma_id INTEGER NOT NULL,
            data_matricula TEXT,
            status TEXT DEFAULT 'Matriculado',
            valor_curso REAL DEFAULT 0,
            desconto_percentual REAL DEFAULT 0,
            desconto_valor REAL DEFAULT 0,
            entrada REAL DEFAULT 0,
            parcelas INTEGER DEFAULT 1,
            forma_pagamento TEXT,
            plano_pagamento_json TEXT DEFAULT '[]',
            contrato_path TEXT,
            observacoes TEXT,
            criado_em TEXT,
            atualizado_em TEXT,
            FOREIGN KEY (aluno_id) REFERENCES alunos(id),
            FOREIGN KEY (turma_id) REFERENCES turmas_treinamento(id),
            UNIQUE(aluno_id, turma_id)
        )
        """
    )
    conn.execute("""CREATE TABLE IF NOT EXISTS usuarios_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE,
        senha_hash TEXT NOT NULL, ativo INTEGER DEFAULT 1, precisa_trocar_senha INTEGER DEFAULT 1,
        ultimo_login TEXT, criado_em TEXT, atualizado_em TEXT
    )""")
    garantir_coluna(conn, "usuarios_educacao", "perfil TEXT DEFAULT 'USUARIO'")
    garantir_coluna(conn, "usuarios_educacao", "permissoes_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "usuarios_educacao", "agenda_ativa INTEGER DEFAULT 0")
    garantir_coluna(conn, "usuarios_educacao", "nome_agenda TEXT")
    conn.execute("UPDATE usuarios_educacao SET perfil='ADMINISTRADOR' WHERE lower(usuario)=lower(?)", (EDUCACAO_ADMIN_USUARIO,))
    if int(conn.execute("SELECT COUNT(*) FROM usuarios_educacao WHERE upper(perfil)='ADMINISTRADOR'").fetchone()[0] or 0)==0:
        primeiro_admin=conn.execute("SELECT id FROM usuarios_educacao ORDER BY id LIMIT 1").fetchone()
        if primeiro_admin is not None: conn.execute("UPDATE usuarios_educacao SET perfil='ADMINISTRADOR' WHERE id=?",(int(primeiro_admin["id"]),))
    conn.execute("""CREATE TABLE IF NOT EXISTS sessoes_educacao (
        token TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL, criado_em TEXT, expira_em TEXT,
        FOREIGN KEY (usuario_id) REFERENCES usuarios_educacao(id)
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS pacientes_modelo_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, aluno_id INTEGER, nome TEXT NOT NULL, prontuario TEXT,
        apelido TEXT, sexo TEXT, cpf TEXT, rg TEXT, data_nascimento TEXT, telefone TEXT, email TEXT,
        cep TEXT, endereco TEXT, complemento TEXT, numero TEXT, bairro TEXT, cidade TEXT, estado TEXT,
        estado_civil TEXT, profissao TEXT, origem TEXT, menor_idade INTEGER DEFAULT 0,
        responsavel TEXT, cpf_responsavel TEXT, indicado_aluno_id INTEGER, indicado_por_aluno TEXT, indicado_clinica INTEGER DEFAULT 0,
        procedimento TEXT, observacoes TEXT, ativo INTEGER DEFAULT 1,
        criado_em TEXT, atualizado_em TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS contratos_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, aluno_id INTEGER, paciente_modelo_id INTEGER,
        treinamento_id INTEGER, descricao TEXT, valor REAL DEFAULT 0, valor_total REAL DEFAULT 0,
        entrada REAL DEFAULT 0, parcelas INTEGER DEFAULT 1, forma_pagamento TEXT,
        plano_pagamento_json TEXT, desconto_percentual REAL DEFAULT 0, desconto_valor REAL DEFAULT 0,
        validade_orcamento TEXT, status TEXT DEFAULT 'EM_ABERTO', aprovado_por TEXT, data_aprovacao TEXT,
        data_contrato TEXT, documento_path TEXT, criado_em TEXT, atualizado_em TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS procedimentos_contrato_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, contrato_id INTEGER NOT NULL, procedimento_id INTEGER,
        procedimento TEXT NOT NULL, profissional_snapshot TEXT, denticao_snapshot TEXT,
        valor REAL DEFAULT 0, regioes_json TEXT DEFAULT '[]', ativo INTEGER DEFAULT 1, criado_em TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS financeiro_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, aluno_id INTEGER, contrato_educacao_id INTEGER, matricula_id INTEGER,
        descricao TEXT, tipo TEXT, categoria TEXT, valor REAL DEFAULT 0, data_vencimento TEXT,
        data_pagamento TEXT, status TEXT DEFAULT 'Em aberto', forma_pagamento TEXT,
        criado_em TEXT, atualizado_em TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS configuracoes_financeiro_educacao (
        id INTEGER PRIMARY KEY CHECK (id=1), contas_json TEXT DEFAULT '[]',
        maquinas_json TEXT DEFAULT '[]', taxas_json TEXT DEFAULT '{}',
        parcelas_maximas INTEGER DEFAULT 12, descontos_json TEXT DEFAULT '{}',
        atualizado_em TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS procedimentos_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL, categoria TEXT,
        descricao TEXT, valor REAL DEFAULT 0, duracao_minutos INTEGER DEFAULT 60,
        ativo INTEGER DEFAULT 1, criado_em TEXT, atualizado_em TEXT
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS agenda_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, data TEXT NOT NULL, hora_inicio TEXT,
        hora_fim TEXT, aluno_id INTEGER, paciente_modelo_id INTEGER, turma_id INTEGER,
        titulo TEXT NOT NULL, responsavel TEXT, local TEXT, status TEXT DEFAULT 'Agendado',
        observacoes TEXT, criado_em TEXT, atualizado_em TEXT
    )""")
    for definicao in (
        "procedimento_id INTEGER", "guia_id INTEGER", "tipo_atendimento TEXT",
        "criado_por TEXT", "cancelado_motivo TEXT",
    ):
        garantir_coluna(conn, "agenda_educacao", definicao)
    conn.execute("""CREATE TABLE IF NOT EXISTS guias_educacao (
        id INTEGER PRIMARY KEY AUTOINCREMENT, paciente_modelo_id INTEGER,
        aluno_id INTEGER, turma_id INTEGER, procedimento_id INTEGER,
        descricao TEXT, status TEXT DEFAULT 'Pendente', data_solicitacao TEXT,
        data_conclusao TEXT, responsavel TEXT, observacoes TEXT,
        criado_em TEXT, atualizado_em TEXT
    )""")
    for definicao in (
        "procedimento_nome_snapshot TEXT", "material TEXT", "material_outro TEXT",
        "cor TEXT", "escala TEXT", "elemento_arcada TEXT",
        "carga_imediata INTEGER DEFAULT 0", "retorno_solicitado TEXT",
        "documento_nome TEXT", "criado_por TEXT",
    ):
        garantir_coluna(conn, "guias_educacao", definicao)
    conn.execute("""CREATE TABLE IF NOT EXISTS guia_educacao_etapas (
        id INTEGER PRIMARY KEY AUTOINCREMENT, guia_id INTEGER NOT NULL,
        etapa TEXT, descricao_outro TEXT, criado_em TEXT
    )""")
    for definicao in (
        "prontuario TEXT", "apelido TEXT", "sexo TEXT", "rg TEXT", "data_nascimento TEXT",
        "email TEXT", "cep TEXT", "endereco TEXT", "complemento TEXT", "numero TEXT",
        "bairro TEXT", "cidade TEXT", "estado TEXT", "estado_civil TEXT", "profissao TEXT",
        "origem TEXT", "menor_idade INTEGER DEFAULT 0", "responsavel TEXT", "cpf_responsavel TEXT",
        "indicado_aluno_id INTEGER", "indicado_por_aluno TEXT", "indicado_clinica INTEGER DEFAULT 0",
    ):
        garantir_coluna(conn, "pacientes_modelo_educacao", definicao)
    usados_educacao = set()
    for row in conn.execute("SELECT id, prontuario FROM pacientes_modelo_educacao ORDER BY id").fetchall():
        prontuario_atual = str(row["prontuario"] or "").strip().upper()
        if re.fullmatch(r"T\d+", prontuario_atual):
            prontuario_atual = f"P{int(prontuario_atual[1:]):03d}"
        if prontuario_atual and prontuario_atual not in usados_educacao:
            conn.execute("UPDATE pacientes_modelo_educacao SET prontuario=? WHERE id=?", (prontuario_atual, int(row["id"])))
            usados_educacao.add(prontuario_atual)
            continue
        numero_educacao = 1
        while f"P{numero_educacao:03d}" in usados_educacao:
            numero_educacao += 1
        novo_prontuario = f"P{numero_educacao:03d}"
        conn.execute("UPDATE pacientes_modelo_educacao SET prontuario=? WHERE id=?", (novo_prontuario, int(row["id"])))
        usados_educacao.add(novo_prontuario)
    for definicao in (
        "valor_total REAL DEFAULT 0", "entrada REAL DEFAULT 0", "parcelas INTEGER DEFAULT 1",
        "forma_pagamento TEXT", "plano_pagamento_json TEXT", "desconto_percentual REAL DEFAULT 0",
        "desconto_valor REAL DEFAULT 0", "validade_orcamento TEXT", "aprovado_por TEXT",
        "data_aprovacao TEXT", "documento_path TEXT",
    ):
        garantir_coluna(conn, "contratos_educacao", definicao)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_modelo_educacao_prontuario ON pacientes_modelo_educacao(prontuario)")
    garantir_coluna(conn, "alunos", "ativo INTEGER DEFAULT 1")
    for definicao in (
        "quantidade_turmas INTEGER DEFAULT 1", "max_alunos_por_turma INTEGER DEFAULT 0",
        "data_inicio TEXT", "horario_inicio TEXT", "periodicidade TEXT", "dias_horarios_json TEXT DEFAULT '{}'",
    ):
        garantir_coluna(conn, "treinamentos", definicao)
    for treinamento in conn.execute("SELECT * FROM treinamentos WHERE ativo=1 ORDER BY id").fetchall():
        existentes = int(conn.execute("SELECT COUNT(*) FROM turmas_treinamento WHERE treinamento_id=?", (int(treinamento["id"]),)).fetchone()[0] or 0)
        desejadas = max(1, int(treinamento["quantidade_turmas"] or 1))
        if existentes >= desejadas:
            continue
        try:
            dias = json.loads(treinamento["dias_horarios_json"] or "{}")
        except (TypeError, ValueError, json.JSONDecodeError):
            dias = {}
        horarios = "; ".join(
            f"{dia}: {dados.get('inicio', '')}–{dados.get('fim', '')}"
            for dia, dados in dias.items() if isinstance(dados, dict)
        )
        agora_turmas = agora_str()
        for indice in range(existentes + 1, desejadas + 1):
            conn.execute(
                """INSERT INTO turmas_treinamento
                (treinamento_id,nome,instrutor,data_inicio,data_fim,horario,local,vagas,status,criado_em,atualizado_em)
                VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
                (int(treinamento["id"]), f"Turma {indice}", "", treinamento["data_inicio"] or "", "",
                 f"{treinamento['periodicidade'] or 'Semanal'}: {horarios}".strip(": "), "",
                 max(0, int(treinamento["max_alunos_por_turma"] or 0)), "Turma confirmada", agora_turmas, agora_turmas),
            )
    conn.execute("""UPDATE turmas_treinamento SET status='Turma confirmada'
        WHERE COALESCE(status,'')='' OR status IN ('Planejada','Inscrições abertas','Confirmada')""")
    conn.execute("UPDATE turmas_treinamento SET status='Turma em andamento' WHERE status='Em andamento'")
    conn.execute("UPDATE turmas_treinamento SET status='Turma encerrada' WHERE status='Concluída'")
    conn.execute("UPDATE turmas_treinamento SET status='Turma cancelada' WHERE status='Cancelada'")
    garantir_coluna(conn, "alunos", "observacoes TEXT")
    garantir_coluna(conn, "alunos", "criado_em TEXT")
    garantir_coluna(conn, "alunos", "atualizado_em TEXT")
    for definicao in (
        "codigo TEXT", "sexo TEXT", "rg TEXT", "data_nascimento TEXT", "cep TEXT", "endereco TEXT",
        "complemento TEXT", "numero TEXT", "bairro TEXT", "cidade TEXT", "estado TEXT", "estado_civil TEXT", "cro TEXT",
        "profissao TEXT", "origem TEXT", "menor_idade INTEGER DEFAULT 0", "responsavel TEXT",
        "cpf_responsavel TEXT", "indicado_por_aluno TEXT", "indicado_clinica INTEGER DEFAULT 0",
    ):
        garantir_coluna(conn, "alunos", definicao)
    codigos_alunos = set()
    for row in conn.execute("SELECT id, codigo FROM alunos ORDER BY id").fetchall():
        codigo = str(row["codigo"] or "").strip().upper()
        if not re.fullmatch(r"A\d+", codigo) or codigo in codigos_alunos:
            numero_aluno = 1
            while f"A{numero_aluno:03d}" in codigos_alunos:
                numero_aluno += 1
            codigo = f"A{numero_aluno:03d}"
            conn.execute("UPDATE alunos SET codigo=? WHERE id=?", (codigo, int(row["id"])))
        codigos_alunos.add(codigo)
    conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_alunos_codigo ON alunos(codigo)")
    for definicao in (
        "valor_curso REAL DEFAULT 0", "desconto_percentual REAL DEFAULT 0", "desconto_valor REAL DEFAULT 0",
        "entrada REAL DEFAULT 0", "parcelas INTEGER DEFAULT 1", "forma_pagamento TEXT",
        "plano_pagamento_json TEXT DEFAULT '[]'", "contrato_path TEXT",
    ):
        garantir_coluna(conn, "matriculas_treinamento", definicao)
    for tabela in ("alunos", "pacientes_modelo_educacao"):
        garantir_coluna(conn, tabela, "excluido_em TEXT")
        garantir_coluna(conn, tabela, "excluido_motivo TEXT")
        garantir_coluna(conn, tabela, "excluido_por TEXT")
    garantir_coluna(conn, "financeiro_educacao", "matricula_id INTEGER")
    for definicao in (
        "paciente_modelo_id INTEGER", "origem TEXT", "parcela TEXT", "conta_caixa TEXT",
        "operadora_cartao TEXT", "bandeira_cartao TEXT", "valor_bruto REAL DEFAULT 0",
        "taxa_valor REAL DEFAULT 0", "valor_liquido REAL DEFAULT 0", "observacoes TEXT",
    ):
        garantir_coluna(conn, "financeiro_educacao", definicao)
    garantir_coluna(conn, "configuracoes_financeiro_educacao", "parcelas_boleto INTEGER DEFAULT 1")
    garantir_coluna(conn, "configuracoes_financeiro_educacao", "parcelas_cartao INTEGER DEFAULT 12")
    ambiente_producao = os.getenv("APP_ENV", "development").strip().lower() in {"production", "producao", "prod"}
    usuario_admin_educacao = EDUCACAO_ADMIN_USUARIO or ("educacao.admin" if not ambiente_producao else "")
    senha_admin_educacao = EDUCACAO_ADMIN_SENHA or (SENHA_ADMIN_INICIAL if not ambiente_producao else "")
    if usuario_admin_educacao and senha_admin_educacao:
        existente_educacao = conn.execute(
            "SELECT id FROM usuarios_educacao WHERE lower(usuario)=lower(?)", (usuario_admin_educacao,)
        ).fetchone()
        if existente_educacao is None:
            agora = agora_str()
            conn.execute(
                "INSERT INTO usuarios_educacao (nome,usuario,senha_hash,ativo,precisa_trocar_senha,perfil,permissoes_json,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?)",
                ("Administrador Educação", usuario_admin_educacao, gerar_hash_senha(senha_admin_educacao), 1, 1, "ADMINISTRADOR", "{}", agora, agora),
            )

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
            data_criacao TEXT,
            status TEXT DEFAULT 'EM_ABERTO',
            aprovado_por TEXT,
            data_aprovacao TEXT,
            observacoes TEXT,
            clinica_snapshot TEXT,
            criado_por_snapshot TEXT,
            tabela_snapshot TEXT,
            plano_pagamento_json TEXT,
            desconto_percentual REAL DEFAULT 0,
            desconto_valor REAL DEFAULT 0,
            validade_orcamento TEXT,
            data_retorno_crm TEXT,
            crm_status TEXT,
            crm_observacao_contato TEXT,
            crm_ultimo_contato_em TEXT,
            crm_ultimo_contato_por TEXT
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
            status_origem TEXT,
            status_motivo TEXT,
            status_usuario TEXT,
            consultorio TEXT,
            trabalho_tipo TEXT,
            ordem_servico_id INTEGER,
            ordem_servico_documento_nome TEXT,
            recorrencia_grupo TEXT,
            recorrencia_intervalo_dias INTEGER,
            recorrencia_total INTEGER,
            recorrencia_indice INTEGER,
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
            materiais_json TEXT,
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
            status TEXT DEFAULT 'Emitida',
            laboratorio_id INTEGER,
            status_atualizado_por TEXT,
            status_atualizado_em TEXT,
            criado_por TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS guia_laboratorios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            ativo INTEGER DEFAULT 1,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS ordem_servico_movimentacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ordem_servico_id INTEGER NOT NULL,
            status_anterior TEXT,
            status_novo TEXT NOT NULL,
            laboratorio_id INTEGER,
            laboratorio_nome_snapshot TEXT,
            observacao TEXT,
            criado_por TEXT,
            criado_em TEXT
        )
        """
    )
    for laboratorio_nome in ("Armação Metálica", "Labsul", "Jeferson", "Zlab"):
        conn.execute(
            "INSERT OR IGNORE INTO guia_laboratorios (nome, ativo, criado_em, atualizado_em) VALUES (?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            (laboratorio_nome,),
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
        CREATE TABLE IF NOT EXISTS crm_pacientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER UNIQUE,
            origem_finalizado INTEGER DEFAULT 0,
            origem_cancelado INTEGER DEFAULT 0,
            origem_avaliacao INTEGER DEFAULT 0,
            etapa_funil TEXT DEFAULT 'Novo lead',
            canal TEXT DEFAULT 'Facebook',
            campanha TEXT,
            conjunto_anuncio TEXT,
            anuncio TEXT,
            responsavel TEXT,
            proximo_contato TEXT,
            observacao TEXT,
            ultima_interacao TEXT,
            ultima_avaliacao_em TEXT,
            finalizado_em TEXT,
            cancelado_em TEXT,
            criado_por TEXT,
            atualizado_por TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_contatos_historico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            crm_id INTEGER,
            paciente_id INTEGER NOT NULL,
            contrato_id INTEGER,
            status TEXT,
            observacao TEXT,
            proximo_contato TEXT,
            criado_por TEXT,
            criado_em TEXT,
            automatico INTEGER DEFAULT 0
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS plano_tratamento_procedimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            contrato_id INTEGER,
            procedimento_contrato_id INTEGER,
            procedimento_id INTEGER,
            procedimento_nome TEXT NOT NULL,
            status TEXT DEFAULT 'Planejado',
            observacao TEXT,
            criado_por TEXT,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS plano_tratamento_passos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plano_procedimento_id INTEGER NOT NULL,
            titulo TEXT NOT NULL,
            ordem INTEGER DEFAULT 1,
            status TEXT DEFAULT 'Pendente',
            data_prevista TEXT,
            data_realizacao TEXT,
            observacao TEXT,
            criado_por TEXT,
            criado_em TEXT,
            atualizado_em TEXT,
            FOREIGN KEY (plano_procedimento_id) REFERENCES plano_tratamento_procedimentos(id) ON DELETE CASCADE
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_conversas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            crm_id INTEGER,
            paciente_id INTEGER,
            canal TEXT NOT NULL,
            contato_nome TEXT,
            contato_telefone TEXT,
            contato_instagram TEXT,
            externo_usuario_id TEXT,
            externo_conversa_id TEXT,
            etapa_funil TEXT DEFAULT 'Novo lead',
            responsavel TEXT,
            ultima_mensagem TEXT,
            ultima_mensagem_em TEXT,
            ultima_mensagem_sentido TEXT,
            nao_lidas INTEGER DEFAULT 0,
            status TEXT DEFAULT 'aberta',
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_mensagens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversa_id INTEGER NOT NULL,
            crm_id INTEGER,
            paciente_id INTEGER,
            canal TEXT NOT NULL,
            mensagem_externa_id TEXT,
            status_externo_id TEXT,
            remetente_externo_id TEXT,
            direcao TEXT NOT NULL,
            remetente_tipo TEXT NOT NULL,
            tipo_mensagem TEXT DEFAULT 'text',
            conteudo TEXT,
            midia_url TEXT,
            status_envio TEXT DEFAULT 'received',
            erro_envio TEXT,
            metadata_json TEXT DEFAULT '{}',
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS crm_webhook_eventos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            canal TEXT NOT NULL,
            evento_externo_id TEXT NOT NULL,
            tipo_evento TEXT,
            payload_json TEXT,
            processado_em TEXT
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
            atividades_acesso INTEGER DEFAULT 0,
            atividades_agenda_disponivel INTEGER DEFAULT 0,
            atividades_escopo TEXT DEFAULT 'PROPRIAS',
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
        CREATE TABLE IF NOT EXISTS agenda_atividades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            descricao TEXT DEFAULT '',
            responsavel_id INTEGER NOT NULL,
            data_atividade TEXT NOT NULL,
            hora_inicio TEXT DEFAULT '',
            hora_fim TEXT DEFAULT '',
            prioridade TEXT DEFAULT 'Normal',
            status TEXT DEFAULT 'Pendente',
            criado_por_id INTEGER,
            criado_por TEXT DEFAULT '',
            criado_em TEXT,
            atualizado_por TEXT DEFAULT '',
            atualizado_em TEXT,
            cor TEXT DEFAULT '#c7aa78',
            secreta INTEGER DEFAULT 0,
            FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
            FOREIGN KEY (criado_por_id) REFERENCES usuarios(id)
        )
        """
    )
    garantir_coluna(conn, "agenda_atividades", "cor TEXT DEFAULT '#c7aa78'")
    garantir_coluna(conn, "agenda_atividades", "secreta INTEGER DEFAULT 0")

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS agenda_atividade_responsaveis (
            atividade_id INTEGER NOT NULL,
            usuario_id INTEGER NOT NULL,
            PRIMARY KEY (atividade_id, usuario_id),
            FOREIGN KEY (atividade_id) REFERENCES agenda_atividades(id),
            FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
        )
        """
    )
    conn.execute(
        """CREATE TABLE IF NOT EXISTS agenda_atividade_notificacoes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            atividade_id INTEGER,
            tipo TEXT NOT NULL,
            mensagem TEXT NOT NULL,
            chave TEXT NOT NULL UNIQUE,
            lida INTEGER DEFAULT 0,
            criado_em TEXT,
            lida_em TEXT
        )"""
    )
    garantir_coluna(conn, "agenda_atividade_notificacoes", "lida_em TEXT")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS sistema_migracoes (
            chave TEXT PRIMARY KEY,
            aplicado_em TEXT
        )
        """
    )
    conn.execute(
        """
        INSERT OR IGNORE INTO agenda_atividade_responsaveis (atividade_id, usuario_id)
        SELECT id, responsavel_id FROM agenda_atividades
        WHERE responsavel_id IS NOT NULL
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
        CREATE TABLE IF NOT EXISTS checklist_usuario_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            titulo TEXT NOT NULL,
            descricao TEXT,
            tipo_meta TEXT DEFAULT 'manual',
            meta_diaria INTEGER DEFAULT 1,
            ativo INTEGER DEFAULT 1,
            ordem INTEGER DEFAULT 0,
            criado_em TEXT,
            atualizado_em TEXT
        )
        """
    )

    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS checklist_usuario_registros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            checklist_id INTEGER NOT NULL,
            data_referencia TEXT NOT NULL,
            progresso_manual INTEGER DEFAULT 0,
            concluido_manual INTEGER DEFAULT 0,
            atualizado_em TEXT
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
    garantir_coluna(conn, "agendamentos", "tipo_atendimento_nome_snapshot TEXT")
    garantir_coluna(conn, "agendamentos", "procedimento_id INTEGER")
    garantir_coluna(conn, "agendamentos", "procedimento_nome_snapshot TEXT")
    garantir_coluna(conn, "agendamentos", "contrato_id INTEGER")
    garantir_coluna(conn, "agendamentos", "origem_contrato INTEGER DEFAULT 0")
    garantir_coluna(conn, "agendamentos", "data_agendamento TEXT")
    garantir_coluna(conn, "agendamentos", "duracao_minutos INTEGER")
    garantir_coluna(conn, "agendamentos", "observacoes TEXT")
    garantir_coluna(conn, "agendamentos", "status_origem TEXT")
    garantir_coluna(conn, "agendamentos", "status_motivo TEXT")
    garantir_coluna(conn, "agendamentos", "status_usuario TEXT")
    garantir_coluna(conn, "agendamentos", "consultorio TEXT")
    garantir_coluna(conn, "agendamentos", "trabalho_tipo TEXT")
    garantir_coluna(conn, "agendamentos", "ordem_servico_id INTEGER")
    garantir_coluna(conn, "agendamentos", "ordem_servico_documento_nome TEXT")
    garantir_coluna(conn, "agendamentos", "elemento_arcada TEXT")
    garantir_coluna(conn, "agendamentos", "criado_por TEXT")
    garantir_coluna(conn, "agendamentos", "criado_em TEXT")
    garantir_coluna(conn, "agendamentos", "atualizado_em TEXT")
    garantir_coluna(conn, "agendamentos", "atualizado_por TEXT")
    garantir_coluna(conn, "agendamentos", "recorrencia_grupo TEXT")
    garantir_coluna(conn, "agendamentos", "recorrencia_intervalo_dias INTEGER")
    garantir_coluna(conn, "agendamentos", "recorrencia_total INTEGER")
    garantir_coluna(conn, "agendamentos", "recorrencia_indice INTEGER")
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
    garantir_coluna(conn, "procedimentos", "materiais_json TEXT")
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
    garantir_coluna(conn, "usuarios", "atividades_acesso INTEGER DEFAULT 0")
    garantir_coluna(conn, "usuarios", "atividades_agenda_disponivel INTEGER DEFAULT 0")
    garantir_coluna(conn, "usuarios", "atividades_escopo TEXT DEFAULT 'PROPRIAS'")
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
    garantir_coluna(conn, "checklist_usuario_itens", "usuario_id INTEGER")
    garantir_coluna(conn, "checklist_usuario_itens", "titulo TEXT")
    garantir_coluna(conn, "checklist_usuario_itens", "descricao TEXT")
    garantir_coluna(conn, "checklist_usuario_itens", "tipo_meta TEXT DEFAULT 'manual'")
    garantir_coluna(conn, "checklist_usuario_itens", "meta_diaria INTEGER DEFAULT 1")
    garantir_coluna(conn, "checklist_usuario_itens", "ativo INTEGER DEFAULT 1")
    garantir_coluna(conn, "checklist_usuario_itens", "ordem INTEGER DEFAULT 0")
    garantir_coluna(conn, "checklist_usuario_itens", "criado_em TEXT")
    garantir_coluna(conn, "checklist_usuario_itens", "atualizado_em TEXT")
    garantir_coluna(conn, "checklist_usuario_registros", "checklist_id INTEGER")
    garantir_coluna(conn, "checklist_usuario_registros", "data_referencia TEXT")
    garantir_coluna(conn, "checklist_usuario_registros", "progresso_manual INTEGER DEFAULT 0")
    garantir_coluna(conn, "checklist_usuario_registros", "concluido_manual INTEGER DEFAULT 0")
    garantir_coluna(conn, "checklist_usuario_registros", "atualizado_em TEXT")
    garantir_coluna(conn, "agenda_configuracao", "ordem_profissionais_json TEXT DEFAULT '[]'")
    garantir_coluna(conn, "agenda_configuracao", "config_clinica_dias_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "agenda_configuracao", "config_profissionais_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "agenda_configuracao", "salas_json TEXT DEFAULT '[]'")
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
    garantir_coluna(conn, "contratos", "status TEXT DEFAULT 'EM_ABERTO'")
    garantir_coluna(conn, "contratos", "aprovado_por TEXT")
    garantir_coluna(conn, "contratos", "data_aprovacao TEXT")
    garantir_coluna(conn, "contratos", "observacoes TEXT")
    garantir_coluna(conn, "contratos", "clinica_snapshot TEXT")
    garantir_coluna(conn, "contratos", "criado_por_snapshot TEXT")
    garantir_coluna(conn, "contratos", "tabela_snapshot TEXT")
    garantir_coluna(conn, "contratos", "plano_pagamento_json TEXT")
    garantir_coluna(conn, "contratos", "desconto_percentual REAL DEFAULT 0")
    garantir_coluna(conn, "contratos", "desconto_valor REAL DEFAULT 0")
    garantir_coluna(conn, "contratos", "validade_orcamento TEXT")
    garantir_coluna(conn, "contratos", "data_retorno_crm TEXT")
    garantir_coluna(conn, "contratos", "crm_status TEXT")
    garantir_coluna(conn, "contratos", "crm_observacao_contato TEXT")
    garantir_coluna(conn, "contratos", "crm_ultimo_contato_em TEXT")
    garantir_coluna(conn, "contratos", "crm_ultimo_contato_por TEXT")
    garantir_coluna(conn, "contratos", "incluir_total_vendido INTEGER DEFAULT 1")
    garantir_coluna(conn, "contratos", "ja_foi_aprovado INTEGER DEFAULT 0")
    garantir_coluna(conn, "contratos", "tipo_movimento_venda TEXT DEFAULT 'NOVA'")
    garantir_coluna(conn, "contratos", "valor_venda_considerado REAL")
    garantir_coluna(conn, "contratos", "contar_quantidade_venda INTEGER DEFAULT 1")
    conn.execute(
        """UPDATE contratos SET ja_foi_aprovado=1
           WHERE lower(COALESCE(status,'')) IN ('aprovado','aprovada','convertido')"""
    )
    garantir_coluna(conn, "pacientes", "criado_em TEXT")
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
    garantir_coluna(conn, "ordens_servico_protetico", "status TEXT DEFAULT 'Emitida'")
    garantir_coluna(conn, "ordens_servico_protetico", "laboratorio_id INTEGER")
    garantir_coluna(conn, "ordens_servico_protetico", "status_atualizado_por TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "status_atualizado_em TEXT")
    conn.execute("UPDATE ordens_servico_protetico SET status='Emitida' WHERE COALESCE(status, '')=''")
    garantir_coluna(conn, "ordens_servico_protetico", "criado_por TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "criado_em TEXT")
    garantir_coluna(conn, "ordens_servico_protetico", "atualizado_em TEXT")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "ordem_servico_id INTEGER")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "etapa TEXT")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "descricao_outro TEXT")
    garantir_coluna(conn, "ordem_servico_protetico_etapas", "criado_em TEXT")
    garantir_coluna(conn, "crm_pacientes", "paciente_id INTEGER UNIQUE")
    garantir_coluna(conn, "crm_pacientes", "origem_finalizado INTEGER DEFAULT 0")
    garantir_coluna(conn, "crm_pacientes", "origem_avaliacao INTEGER DEFAULT 0")
    garantir_coluna(conn, "crm_pacientes", "etapa_funil TEXT DEFAULT 'Novo lead'")
    garantir_coluna(conn, "crm_pacientes", "canal TEXT DEFAULT 'Facebook'")
    garantir_coluna(conn, "crm_pacientes", "campanha TEXT")
    garantir_coluna(conn, "crm_pacientes", "conjunto_anuncio TEXT")
    garantir_coluna(conn, "crm_pacientes", "anuncio TEXT")
    garantir_coluna(conn, "crm_pacientes", "responsavel TEXT")
    garantir_coluna(conn, "crm_pacientes", "proximo_contato TEXT")
    garantir_coluna(conn, "crm_pacientes", "observacao TEXT")
    garantir_coluna(conn, "crm_pacientes", "ultima_interacao TEXT")
    garantir_coluna(conn, "crm_pacientes", "ultima_avaliacao_em TEXT")
    garantir_coluna(conn, "crm_pacientes", "finalizado_em TEXT")
    garantir_coluna(conn, "crm_pacientes", "criado_por TEXT")
    garantir_coluna(conn, "crm_pacientes", "atualizado_por TEXT")
    garantir_coluna(conn, "crm_pacientes", "criado_em TEXT")
    garantir_coluna(conn, "crm_pacientes", "atualizado_em TEXT")
    garantir_coluna(conn, "crm_contatos_historico", "crm_id INTEGER")
    garantir_coluna(conn, "crm_contatos_historico", "paciente_id INTEGER")
    garantir_coluna(conn, "crm_contatos_historico", "contrato_id INTEGER")
    garantir_coluna(conn, "crm_contatos_historico", "status TEXT")
    garantir_coluna(conn, "crm_contatos_historico", "observacao TEXT")
    garantir_coluna(conn, "crm_contatos_historico", "proximo_contato TEXT")
    garantir_coluna(conn, "crm_contatos_historico", "criado_por TEXT")
    garantir_coluna(conn, "crm_contatos_historico", "criado_em TEXT")
    garantir_coluna(conn, "crm_contatos_historico", "automatico INTEGER DEFAULT 0")
    garantir_coluna(conn, "crm_conversas", "crm_id INTEGER")
    garantir_coluna(conn, "crm_conversas", "paciente_id INTEGER")
    garantir_coluna(conn, "crm_conversas", "canal TEXT")
    garantir_coluna(conn, "crm_conversas", "contato_nome TEXT")
    garantir_coluna(conn, "crm_conversas", "contato_telefone TEXT")
    garantir_coluna(conn, "crm_conversas", "contato_instagram TEXT")
    garantir_coluna(conn, "crm_conversas", "externo_usuario_id TEXT")
    garantir_coluna(conn, "crm_conversas", "externo_conversa_id TEXT")
    garantir_coluna(conn, "crm_conversas", "etapa_funil TEXT DEFAULT 'Novo lead'")
    garantir_coluna(conn, "crm_conversas", "responsavel TEXT")
    garantir_coluna(conn, "crm_conversas", "ultima_mensagem TEXT")
    garantir_coluna(conn, "crm_conversas", "ultima_mensagem_em TEXT")
    garantir_coluna(conn, "crm_conversas", "ultima_mensagem_sentido TEXT")
    garantir_coluna(conn, "crm_conversas", "nao_lidas INTEGER DEFAULT 0")
    garantir_coluna(conn, "crm_conversas", "status TEXT DEFAULT 'aberta'")
    garantir_coluna(conn, "crm_conversas", "criado_em TEXT")
    garantir_coluna(conn, "crm_conversas", "atualizado_em TEXT")
    garantir_coluna(conn, "crm_mensagens", "conversa_id INTEGER")
    garantir_coluna(conn, "crm_mensagens", "crm_id INTEGER")
    garantir_coluna(conn, "crm_mensagens", "paciente_id INTEGER")
    garantir_coluna(conn, "crm_mensagens", "canal TEXT")
    garantir_coluna(conn, "crm_mensagens", "mensagem_externa_id TEXT")
    garantir_coluna(conn, "crm_mensagens", "status_externo_id TEXT")
    garantir_coluna(conn, "crm_mensagens", "remetente_externo_id TEXT")
    garantir_coluna(conn, "crm_mensagens", "direcao TEXT")
    garantir_coluna(conn, "crm_mensagens", "remetente_tipo TEXT")
    garantir_coluna(conn, "crm_mensagens", "tipo_mensagem TEXT DEFAULT 'text'")
    garantir_coluna(conn, "crm_mensagens", "conteudo TEXT")
    garantir_coluna(conn, "crm_mensagens", "midia_url TEXT")
    garantir_coluna(conn, "crm_mensagens", "status_envio TEXT DEFAULT 'received'")
    garantir_coluna(conn, "crm_mensagens", "erro_envio TEXT")
    garantir_coluna(conn, "crm_mensagens", "metadata_json TEXT DEFAULT '{}'")
    garantir_coluna(conn, "crm_mensagens", "criado_em TEXT")
    garantir_coluna(conn, "crm_mensagens", "atualizado_em TEXT")
    garantir_coluna(conn, "crm_webhook_eventos", "canal TEXT")
    garantir_coluna(conn, "crm_webhook_eventos", "evento_externo_id TEXT")
    garantir_coluna(conn, "crm_webhook_eventos", "tipo_evento TEXT")
    garantir_coluna(conn, "crm_webhook_eventos", "payload_json TEXT")
    garantir_coluna(conn, "crm_webhook_eventos", "processado_em TEXT")
    conn.execute(
        """
        UPDATE agendamentos
        SET
            data = CASE
                WHEN length(COALESCE(data, '')) = 10 AND substr(data, 5, 1) = '-' AND substr(data, 8, 1) = '-'
                    THEN substr(data, 9, 2) || '/' || substr(data, 6, 2) || '/' || substr(data, 1, 4)
                ELSE COALESCE(data, '')
            END,
            data_agendamento = CASE
                WHEN length(COALESCE(data_agendamento, '')) = 10 AND substr(data_agendamento, 5, 1) = '-' AND substr(data_agendamento, 8, 1) = '-'
                    THEN substr(data_agendamento, 9, 2) || '/' || substr(data_agendamento, 6, 2) || '/' || substr(data_agendamento, 1, 4)
                WHEN length(COALESCE(data, '')) = 10 AND substr(data, 5, 1) = '-' AND substr(data, 8, 1) = '-'
                    THEN substr(data, 9, 2) || '/' || substr(data, 6, 2) || '/' || substr(data, 1, 4)
                ELSE COALESCE(NULLIF(data_agendamento, ''), NULLIF(data, ''))
            END,
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
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_checklist_usuario_itens_usuario ON checklist_usuario_itens(usuario_id, ativo, ordem)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_checklist_usuario_registros_dia ON checklist_usuario_registros(checklist_id, data_referencia)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_ordens_servico_paciente_id ON ordens_servico_protetico(paciente_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_ordem_servico_etapas_ordem_id ON ordem_servico_protetico_etapas(ordem_servico_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_ordens_servico_status ON ordens_servico_protetico(status)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_ordens_servico_laboratorio ON ordens_servico_protetico(laboratorio_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_ordem_servico_movimentacoes_ordem ON ordem_servico_movimentacoes(ordem_servico_id)")
    migracao_historico_guias = conn.execute(
        "SELECT chave FROM sistema_migracoes WHERE chave='historico_emissao_guias_v1' LIMIT 1"
    ).fetchone()
    if migracao_historico_guias is None:
        conn.execute(
            """INSERT INTO ordem_servico_movimentacoes
               (ordem_servico_id, status_anterior, status_novo, observacao, criado_por, criado_em)
               SELECT os.id, '', 'Emitida', 'Guia emitida', COALESCE(os.criado_por, ''), COALESCE(os.criado_em, os.atualizado_em, ?)
               FROM ordens_servico_protetico os
               WHERE NOT EXISTS (
                   SELECT 1 FROM ordem_servico_movimentacoes m WHERE m.ordem_servico_id=os.id
               )""",
            (agora_str(),),
        )
        conn.execute(
            "INSERT INTO sistema_migracoes (chave, aplicado_em) VALUES ('historico_emissao_guias_v1', ?)",
            (agora_str(),),
        )
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_pacientes_paciente_id ON crm_pacientes(paciente_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_crm_conversas_paciente_id ON crm_conversas(paciente_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_crm_conversas_crm_id ON crm_conversas(crm_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_crm_conversas_canal ON crm_conversas(canal)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_conversas_externo_usuario ON crm_conversas(canal, externo_usuario_id)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_conversas_externo_conversa ON crm_conversas(canal, externo_conversa_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_crm_mensagens_conversa_id ON crm_mensagens(conversa_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_crm_mensagens_criado_em ON crm_mensagens(criado_em)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_mensagens_externa_id ON crm_mensagens(canal, mensagem_externa_id)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_crm_webhook_eventos_externo_id ON crm_webhook_eventos(canal, evento_externo_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_contratos_retorno_crm ON contratos(data_retorno_crm)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_contratos_crm_status ON contratos(crm_status)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_crm_contatos_historico_contrato_id ON crm_contatos_historico(contrato_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_crm_contatos_historico_paciente_id ON crm_contatos_historico(paciente_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_usuarios_usuario ON usuarios(usuario)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agenda_atividades_data ON agenda_atividades(data_atividade, hora_inicio)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agenda_atividades_responsavel ON agenda_atividades(responsavel_id, data_atividade)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_agenda_atividade_responsaveis_usuario ON agenda_atividade_responsaveis(usuario_id, atividade_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_atividade_notificacoes_usuario ON agenda_atividade_notificacoes(usuario_id, lida, criado_em)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_acoes_usuario_data_hora ON acoes_usuario(data_hora)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_acoes_usuario_usuario ON acoes_usuario(usuario)")
    garantir_usuario_admin_inicial(conn)
    garantir_usuarios_padrao(conn)
    migracao_atividades_administrativo = conn.execute(
        "SELECT chave FROM sistema_migracoes WHERE chave='atividades_equipe_administrativa_v1' LIMIT 1"
    ).fetchone()
    if migracao_atividades_administrativo is None:
        conn.execute("UPDATE usuarios SET atividades_acesso=0, atividades_escopo='PROPRIAS'")
        conn.execute(
            """UPDATE usuarios SET atividades_acesso=1, atividades_escopo='EQUIPE'
               WHERE lower(trim(COALESCE(nome, ''))) IN ('camila', 'maria', 'juliana', 'eliane')
                  OR lower(trim(COALESCE(usuario, ''))) IN ('camila', 'maria', 'juliana', 'eliane')"""
        )
        conn.execute(
            "INSERT INTO sistema_migracoes (chave, aplicado_em) VALUES ('atividades_equipe_administrativa_v1', ?)",
            (agora_str(),),
        )
    migracao_agenda_atividades = conn.execute(
        "SELECT chave FROM sistema_migracoes WHERE chave='agenda_atividades_responsaveis_v1' LIMIT 1"
    ).fetchone()
    if migracao_agenda_atividades is None:
        conn.execute("UPDATE usuarios SET atividades_agenda_disponivel=atividades_acesso WHERE ativo=1")
        conn.execute(
            "INSERT INTO sistema_migracoes (chave, aplicado_em) VALUES ('agenda_atividades_responsaveis_v1', ?)",
            (agora_str(),),
        )
    garantir_configuracao_usuarios_agenda(conn)
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_profissionais_ativo_ordem ON profissionais(ativo, ordem_exibicao)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_tipos_atendimento_ativo_ordem ON tipos_atendimento(ativo, ordem_exibicao)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_procedimentos_ativo_categoria ON procedimentos(ativo, categoria)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_plano_tratamento_paciente ON plano_tratamento_procedimentos(paciente_id, id)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_plano_tratamento_proc_contrato ON plano_tratamento_procedimentos(procedimento_contrato_id) WHERE procedimento_contrato_id IS NOT NULL")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_plano_tratamento_passos_procedimento ON plano_tratamento_passos(plano_procedimento_id, ordem, id)")
    garantir_indice(conn, "CREATE UNIQUE INDEX IF NOT EXISTS idx_metas_mensais_ano_mes ON metas_mensais(ano, mes)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_notas_fiscais_competencia ON notas_fiscais_emitidas(competencia, data_emissao)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_turmas_treinamento ON turmas_treinamento(treinamento_id, data_inicio)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_matriculas_aluno ON matriculas_treinamento(aluno_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_matriculas_turma ON matriculas_treinamento(turma_id)")
    garantir_indice(conn, "CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome)")

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
