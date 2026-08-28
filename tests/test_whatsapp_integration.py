import os
import tempfile
import unittest

import database
import whatsapp_integration as integration
from whatsapp_service import WhatsAppConfig, WhatsAppService


def event(message_id="wamid.test", phone="5511999999999", name="Maria WhatsApp"):
    return {"entry":[{"changes":[{"value":{"contacts":[{"profile":{"name":name},"wa_id":phone}],"messages":[{"from":phone,"id":message_id,"timestamp":"1787803200","type":"text","text":{"body":"Olá"}}]}}]}]}


class WhatsAppIntegrationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(); cls.old=database.DB_PATH; database.DB_PATH=os.path.join(cls.tmp.name,"test.db"); database.inicializar_banco()

    @classmethod
    def tearDownClass(cls):
        database.DB_PATH=cls.old; cls.tmp.cleanup()

    def setUp(self):
        conn=database.conectar(); integration.ensure_schema(conn)
        for table in ("crm_webhook_eventos","crm_mensagens","crm_conversas","crm_pacientes","pacientes_rapidos","pacientes"): conn.execute(f"DELETE FROM {table}")
        conn.commit(); conn.close()

    def test_get_verification(self):
        service=WhatsAppService(WhatsAppConfig(verify_token="secret")); self.assertEqual(service.verify_challenge("subscribe","secret","123"),"123")

    def test_receive_creates_contact_conversation_and_kanban(self):
        self.assertEqual(integration.process_webhook(event()),1); conn=database.conectar(); patient=conn.execute("SELECT * FROM pacientes").fetchone(); crm=conn.execute("SELECT * FROM crm_pacientes").fetchone(); conversation=conn.execute("SELECT * FROM crm_conversas").fetchone(); conn.close()
        self.assertEqual(patient["telefone"],"5511999999999"); self.assertEqual(crm["etapa_funil"],"Novo lead"); self.assertEqual(crm["canal"],"WhatsApp"); self.assertEqual(conversation["nao_lidas"],1)

    def test_idempotency(self):
        self.assertEqual(integration.process_webhook(event("wamid.same")),1); self.assertEqual(integration.process_webhook(event("wamid.same")),0); conn=database.conectar(); count=conn.execute("SELECT COUNT(*) FROM crm_mensagens").fetchone()[0]; conn.close(); self.assertEqual(count,1)

    def test_existing_contact_preserves_stage(self):
        conn=database.conectar(); conn.execute("INSERT INTO pacientes(nome,telefone) VALUES('Existente','11999999999')"); patient_id=conn.execute("SELECT last_insert_rowid()").fetchone()[0]; conn.execute("INSERT INTO crm_pacientes(paciente_id,etapa_funil,canal) VALUES(?,'Em negociação','Facebook')",(patient_id,)); conn.commit(); conn.close()
        integration.process_webhook(event("wamid.existing","551199999999")); conn=database.conectar(); stage=conn.execute("SELECT etapa_funil FROM crm_pacientes WHERE paciente_id=?",(patient_id,)).fetchone()[0]; conn.close(); self.assertEqual(stage,"Em negociação")

    def test_status_update(self):
        integration.process_webhook(event("wamid.status")); integration.process_webhook({"entry":[{"changes":[{"value":{"statuses":[{"id":"wamid.status","status":"read"}]}}]}]}); conn=database.conectar(); status=conn.execute("SELECT status_envio FROM crm_mensagens WHERE mensagem_externa_id='wamid.status'").fetchone()[0]; conn.close(); self.assertEqual(status,"read")


if __name__ == "__main__": unittest.main()
