from database import conectar, inicializar_banco
from api_pacientes import gerar_documento_contrato

inicializar_banco()
conn = conectar()
try:
    paciente = conn.execute("SELECT * FROM pacientes WHERE id=?", (3779,)).fetchone()
    contrato = conn.execute("SELECT * FROM contratos WHERE id=?", (6753358793211906,)).fetchone()
    print('PACIENTE', None if paciente is None else (paciente['id'], paciente['nome'], paciente['prontuario']))
    print('CONTRATO', None if contrato is None else (contrato['id'], contrato['status'], contrato['data_criacao']))
    if paciente and contrato:
        caminho = gerar_documento_contrato(conn, paciente, contrato, int(contrato['id']))
        print('CAMINHO', caminho)
finally:
    conn.close()
