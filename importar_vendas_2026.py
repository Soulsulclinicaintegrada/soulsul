import csv
import hashlib
import io
import re
import sqlite3
from datetime import datetime


DB_PATH = r"C:\Users\jusgo\Documents\sistema_clinica\clinica.db"


DADOS_BRUTOS = """DATA\tNOME PACIENTE\tVALOR TOTAL\tÁ VISTA\tCARTÃO\tBOLETO
05/01/2026\tKAUANY DIAS OLIVEIRA SILVA\tR$2.190,00\t\tR$2.190,00\t
05/01/2026\tDANIELLA AZEVEDO DE FREITAS RANGEL\tR$3.241,88\t\t\tR$3.241,88
06/01/2026\tROSEMERY MONTEIRO MOÇO\tR$1.000,00\t\tR$1.000,00\t
07/01/2026\tROSANGELA DA SILVA SOBRINHO GOMES\tR$322,50\t\tR$322,50\t
07/01/2026\tADIERSON DE OLIVEIRA CALDAS\tR$6.075,00\t\tR$6.075,00\t
07/01/2026\tMARIA NILDA RIBEIRO\tR$400,00\t\tR$400,00\t
07/01/2026\tADALBERTO DIAS DE AZEVEDO\tR$1.000,00\t\tR$1.000,00\t
07/01/2026\tGABRIEL ALVES ANDRADE\tR$1.130,00\t\tR$1.130,00\t
07/01/2026\tRAQUEL LEMOS PINTO\tR$680,00\t\tR$680,00\t
09/01/2026\tNATANIEL DE JESUS DE SOUZA BARCELOS\tR$500,00\tR$500,00\t\t
09/01/2026\tRENATA MOREIRA NOVAES\tR$1.071,00\tR$371,00\t\tR$700,00
09/01/2026\tLYNDARA SILVA LOURENÇO\tR$591,25\t\t\tR$591,25
12/01/2026\tMARIZA CORREIA DEFAVERI\tR$13.000,00\t\t\tR$13.000,00
12/01/2026\tGILBERTO FIRMINO ALVES\tR$1.000,00\t\tR$1.000,00\t
13/01/2026\tSANDRA DA SILVA\tR$7.400,00\t\t\tR$7.400,00
13/01/2026\tALUISIO DA SILVA GOMES\tR$490,00\t\t\tR$490,00
13/01/2026\tISABELA IZIDÓRIO OLIVEIRA\tR$290,25\t\tR$290,25\t
14/01/2026\tMARIA CECÍLIA DE CARVALHO\tR$2.437,50\t\tR$731,25\tR$1.706,25
14/01/2026\tMARIA NILZA GOMES DE CARVALHO\tR$400,00\t\tR$400,00\t
15/01/2026\tLETICIANE RANGEL DE SOUZA\tR$3.380,00\t\tR$3.380,00\t
16/01/2026\tLIVIA DE OLIVEIRA PEREIRA\tR$1.500,00\t\t\tR$1.500,00
16/01/2026\tYOHANA ALVES DE BARROS E SILVA\tR$1.560,00\tR$240,00\t\tR$1.320,00
16/01/2026\tJAQUELINE PEREIRA RIBEIRO\tR$3.450,00\t\t\tR$3.450,00
16/01/2026\tJULIMARA COUTINHO LIMA\tR$2.600,00\t\t\tR$2.600,00
16/01/2026\tJOÃO CARLOS OLIVEIRA DA SILVA GONÇALVES\tR$3.600,00\tR$100,00\t\tR$3.500,00
16/01/2026\tKAROLAINE FERREIRA DE OLIVEIRA\tR$4.900,00\tR$100,00\t\tR$4.800,00
16/01/2026\tKEZIA DE OLIVEIRA GAMA RIBEIRO\tR$2.400,00\tR$300,00\t\tR$2.100,00
16/01/2026\tMARCOS ANTONIO RIBEIRO DE SOUZA\tR$6.130,00\t\t\tR$6.130,00
16/01/2026\tELIANE DA CRUZ SANTOS\tR$2.700,00\t\t\tR$2.700,00
16/01/2026\tGREYSON CAETANO DIAS\tR$1.364,38\t\tR$1.364,38\t
16/01/2026\tCARLOS ADRYAN DA SILVA ALVES\tR$790,00\t\t\tR$790,00
19/01/2026\tCLAUDIA LUCIA GOMES DA SILVA OLIVEIRA\tR$6.854,76\tR$3.000,00\tR$3.854,76\t
19/01/2026\tNAYANNY MONTEIRO DOS SANTOS\tR$6.693,14\t\t\tR$6.693,14
19/01/2026\tJOCIMARA AZEREDO DOS SANTOS\tR$5.180,00\t\t\tR$5.180,00
19/01/2026\tCRISTIANO DE SOUZA DA PAIXÃO\tR$7.500,00\t\t\tR$7.500,00
20/01/2026\tSALEM MIRANDA FRANCA\tR$3.266,13\t\tR$272,18\tR$2.993,95
20/01/2026\tROSIANE BARBOSA TEIXEIRA\tR$9.600,00\t\t\tR$9.600,00
20/01/2026\tDANILO BATISTA DA SILVA\tR$268,75\t\tR$268,75\t
21/01/2026\tMARIA JULIA AVILA\tR$700,00\t\tR$210,00\tR$490,00
21/01/2026\tHELENA BEATRIZ BARROSO\tR$900,00\tR$900,00\t\t
22/01/2026\tFIDELIS NUNES DE OLIVEIRA\tR$5.000,00\tR$2.000,00\t\tR$3.000,00
22/01/2026\tBENEDITO MARCOS DE CASTRO OLIVEIRA\tR$1.000,00\t\tR$1.000,00\t
23/01/2026\tFLAVIA DOS SANTOS NASCIMENTO\tR$1.667,52\t\t\tR$1.667,52
23/01/2026\tKAUA ANJO ROSA\tR$3.765,01\t\t\tR$3.765,01
26/01/2026\tISABELA PESSANHA DA SILVA\tR$2.800,00\t\t\tR$2.800,00
26/01/2026\tRUANA TAVARES PESSANHA\tR$2.809,25\t\t\tR$2.809,25
26/01/2026\tEDINALVA LEANDRO DIAS\t\t\t\t
26/01/2026\tLUDIMILA DA SILVA CONCEICAO\t\t\t\t
26/01/2026\tMIRIAM DE LIMA E SILVA\tR$3.949,70\tR$50,00\t\tR$3.899,70
26/01/2026\tNATANIEL DE JESUS DE SOUZA BARCELOS\tR$3.338,00\tR$338,00\t\tR$3.000,00
26/01/2026\tDANILO BATISTA DA SILVA\tR$3.391,00\tR$391,00\t\tR$3.000,00
27/01/2026\tCARLOS EDUARDO DO ROSARIO DIAS\tR$15.000,00\t\t\tR$15.000,00
29/01/2026\tVANESSA GOMES DA SILVA\tR$2.740,00\t\t\tR$2.740,00
26/01/2026\tMARIA DAS GRAÇAS RANGEL VIANA\tR$200,00\t\tR$200,00\t
30/01/2026\tMARCOS CAROLINO GAMA\tR$3.300,00\tR$1.000,00\t\tR$2.300,00
30/01/2026\tRICARDO DE FREITAS PAIXÃO\tR$7.015,25\t\tR$7.015,25\t
30/01/2026\tDANIELA GOMES HENRIQUES\tR$6.990,00\t\t\tR$6.990,00
28/01/2026\tJOYCE MESQUITA TERRA\tR$4.353,77\tPERMUTA\t\t
21/01/2026\tALEXANDRE CORREA NUNES\tR$5.286,75\tPERMUTA\t\t
30/01/2026\tCECILIA STAEL\tR$1.047,20\tR$523,60\t\tR$523,60
30/01/2026\tISABELLA DE MELO PACHECO\tR$5.100,00\t\t\t
02/02/2026\tDANILO BATISTA DA SILVA\tR$1.343,75\t\t\tR$1.343,75
03/02/2026\tBRYAN SANTOS MADUREIRA OLEGARIO\tR$4.900,00\tR$400,00\t\tR$4.500,00
05/02/2026\tJULIANA DA SILVA CINDRA\tR$3.721,25\t\tR$3.721,25\t
10/02/2026\tMARCO ANTÔNIO PESSANHA EDWIGES\tR$6.772,00\t\t\tR$6.772,00
10/02/2026\tJOCILÉA DOS ANJOS\tR$16.500,00\t\t\tR$16.500,00
13/02/2026\tGUILHERME CELESTINO SOUZA SANTOS\tR$3.560,00\t\tR$1.560,00\tR$2.000,00
13/02/2026\tGLEYCA HELLEN DA SILVA GOMES\tR$15.500,00\t\t\tR$15.500,00
11/02/2026\tFLAVIA DIAS MOREIRA MULINARI\tR$620,00\t\tR$620,00\t
13/02/2026\tSIRLEI VIEIRA TAVARES PESSANHA\tR$500,00\t\tR$500,00\t
12/02/2026\tTANIA VALENTIM DE SOUZA\tR$400,00\tR$133,33\t\tR$266,67
19/02/2026\tCLAUDIA LUCIA GOMES DA SILVA OLIVEIRA\tR$2.290,00\tR$1.000,00\t\tR$1.290,00
20/02/2026\tLAYLLA TAVARES DE SILVA\tR$806,25\t\t\tR$806,25
24/02/2026\tILMA MENDONÇA DA SILVA\tR$1.183,36\t\t\tR$1.183,36
25/02/2026\tLEANDRO DO NASCIMENTO VALENTIM\tR$1.330,00\t\tR$1.330,00\t
27/02/2026\tTAISSA ARAUJO PEREIRA\tR$4.474,00\t\t\tR$4.474,00
27/02/2026\tROSIMERY DOS SANTOS CRESPO\tR$600,00\t\tR$600,00\t
27/02/2026\tFELIPE GABRIEL LEANDRO SABINO\tR$2.268,00\tR$461,00\t\tR$1.807,00
02/03/2026\tEVERALDO REIS TAVARES RANGEL\tR$975,00\t\tR$975,00\t
02/03/2026\tALAN PEREIRA VELOSO\tR$4.482,55\tR$500,00\t\tR$3.982,55
02/03/2026\tRAFAEL CORREA PAIXÃO\tR$5.478,63\t\tR$5.478,63\t
03/03/2026\tVITOR GOMES DE SOUZA\tR$4.080,00\t\t\tR$4.080,00
03/03/2026\tANTONIO MOTTA\tR$3.050,00\tR$460,00\t\tR$2.590,00
04/03/2026\tRACKEL ERNESTO ALVES DE MELO GOMES\tR$8.549,77\t\tR$1.200,00\tR$7.349,77
05/03/2026\tMARILANE FERREIRA DO AMARAL\tR$3.934,86\tR$3.934,86\t\t
05/03/2026\tYASMIN DE BARCELOS ASSIS\tR$12.512,13\tR$500,00\tR$600,00\tR$11.412,13
05/03/2026\tSANDRA MARIA RIBEIRO DA SILVA GOMES\tR$20.697,50\tR$20.697,50\t\t
05/03/2026\tMARCOS AURELIO DA SILVA RIBEIRO\tR$500,00\tR$500,00\t\t
05/03/2026\tCLAUDIO DA SILVA AMARAL JUNIOR\tR$27.310,00\tR$4.000,00\t\tR$23.310,00
06/03/2026\tAUREA MERINA FERREIRA ROSA\tR$400,00\tR$400,00\t\t
06/03/2026\tSWELLANE VIEIRA SOARES\tR$750,00\t\tR$750,00\t
10/03/2026\tJOCIENE DE MATOS DAS CHAGAS MENDONCA\tR$6.000,00\tR$200,00\t\tR$5.800,00
10/03/2026\tLEANDRO SANTOS MATA\tR$3.174,88\tR$317,49\t\tR$2.857,39
10/03/2026\tJANE ALMEIDA PASSOS\tR$7.140,00\tR$250,00\t\tR$6.890,00
12/03/2026\tRICARDO RIBEIRO JACINTO\tR$2.148,13\tR$2.148,13\t\t
16/03/2026\tDAVI SANTOS DA SILVA\tR$3.190,00\t\tR$3.190,00\t
16/03/2026\tANA MARIA GOMES SANTOS RIBEIRO\tR$2.131,41\tR$1.000,00\tR$1.131,41\t
17/03/2026\tLAYLLA TAVARES DE SILVA\tR$1.101,88\t\t\tR$1.101,88
17/03/2026\tREGINA CELIA RIBEIRO DA SILVA\tR$500,00\t\tR$500,00\t
18/03/2026\tMARTA VALÉRIA DA CONCEIÇÃO SANTOS\tR$4.756,88\t\t\tR$4.756,88
18/03/2026\tFLAVIA CRISTINA DE SOUSA PESSANHA\tR$19.410,88\t\t\tR$19.410,88
20/03/2026\tDIEGO LUIZ GONÇALVES TEIXEIRA CABRAL\tR$1.000,00\t\t\tR$1.000,00
23/03/2026\tJONAS MANHÃES FERREIRA DE SOUZA\tR$5.069,37\t\t\tR$5.069,37
23/03/2026\tALUISIO DA SILVA GOMES\tR$1.326,25\t\t\tR$1.326,25
23/03/2026\tLETICIA SOARES DE OLIVEIRA\tR$9.499,00\t\t\tR$9.499,00
24/03/2026\tELANI ALMEIDA MACIEL GOMES\tR$3.714,25\t\tR$3.714,25\t
24/03/2026\tMARCO ANTONIO DE SOUZA GOMES\tR$1.000,00\t\tR$1.000,00\t
25/03/2026\tHELOÍSA CINDRA CELESTINO\tR$1.579,00\t\tR$1.579,00\t
25/03/2026\tUMBELINA MARIA DE FATIMA RIBEIRO\tR$550,00\t\tR$550,00\t
26/03/2026\tMIRIAM LOBO DA SILVA\tR$5.019,38\t\tR$5.019,38\t
"""


def normalizar_nome(nome):
    texto = re.sub(r"\s+", " ", str(nome or "").replace("\r", " ").replace("\n", " ")).strip()
    return texto.title()


def parse_data(valor):
    texto = str(valor or "").strip()
    if not texto:
        return ""
    dia, mes, ano = texto.split("/")
    ano_int = int(ano)
    if ano_int < 100:
        ano_int += 2000
    if ano_int != 2026:
        ano_int = 2026
    return f"{ano_int:04d}-{int(mes):02d}-{int(dia):02d}"


def parse_moeda(valor):
    texto = str(valor or "").strip().upper()
    if not texto or texto == "NAN":
        return 0.0
    if "PERMUTA" in texto:
        return 0.0
    texto = texto.replace("R$", "").replace(".", "").replace(",", ".").strip()
    return float(texto) if texto else 0.0


def eh_permuta(*campos):
    return any("PERMUTA" in str(campo or "").strip().upper() for campo in campos)


def montar_hash(data_venda, paciente_nome, valor_total):
    base = f"{data_venda}|{paciente_nome.upper()}|{valor_total:.2f}"
    return hashlib.sha256(base.encode("utf-8")).hexdigest()


def carregar_linhas():
    reader = csv.DictReader(io.StringIO(DADOS_BRUTOS), delimiter="\t")
    for row in reader:
        data_venda = parse_data(row["DATA"])
        paciente_nome = normalizar_nome(row["NOME PACIENTE"])
        valor_total = parse_moeda(row["VALOR TOTAL"])
        valor_a_vista = parse_moeda(row["Á VISTA"])
        valor_cartao = parse_moeda(row["CARTÃO"])
        valor_boleto = parse_moeda(row["BOLETO"])
        permuta = eh_permuta(row["Á VISTA"], row["CARTÃO"], row["BOLETO"])

        if not data_venda or not paciente_nome or valor_total <= 0:
            continue

        if permuta:
            saldo = 0.0
            nf = "PERMUTA"
        else:
            saldo = round(valor_total - valor_a_vista - valor_cartao - valor_boleto, 2)
            nf = ""

        yield {
            "data_venda": data_venda,
            "paciente_nome": paciente_nome,
            "valor_total": valor_total,
            "valor_a_vista": valor_a_vista,
            "valor_cartao": valor_cartao,
            "valor_boleto": valor_boleto,
            "saldo": saldo,
            "data_a_pagar": "",
            "avaliador": "",
            "vendedor": "",
            "nf": nf,
            "contrato_id": None,
            "hash_importacao": montar_hash(data_venda, paciente_nome, valor_total),
            "data_criacao": datetime.now().isoformat(sep=" ", timespec="seconds"),
        }


def main():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    linhas = list(carregar_linhas())

    cur.execute("DELETE FROM vendas")
    cur.executemany(
        """
        INSERT INTO vendas
        (
            data_venda,
            paciente_nome,
            valor_total,
            valor_a_vista,
            valor_cartao,
            valor_boleto,
            saldo,
            data_a_pagar,
            avaliador,
            vendedor,
            nf,
            contrato_id,
            hash_importacao,
            data_criacao
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        [
            (
                item["data_venda"],
                item["paciente_nome"],
                item["valor_total"],
                item["valor_a_vista"],
                item["valor_cartao"],
                item["valor_boleto"],
                item["saldo"],
                item["data_a_pagar"],
                item["avaliador"],
                item["vendedor"],
                item["nf"],
                item["contrato_id"],
                item["hash_importacao"],
                item["data_criacao"],
            )
            for item in linhas
        ],
    )
    conn.commit()

    total = cur.execute("SELECT COUNT(*) FROM vendas").fetchone()[0]
    soma = cur.execute("SELECT ROUND(COALESCE(SUM(valor_total),0),2) FROM vendas").fetchone()[0]
    permutas = cur.execute("SELECT COUNT(*) FROM vendas WHERE nf='PERMUTA'").fetchone()[0]
    print(f"VENDAS_IMPORTADAS={total}")
    print(f"TOTAL_GERAL={soma}")
    print(f"PERMUTAS={permutas}")

    conn.close()


if __name__ == "__main__":
    main()
