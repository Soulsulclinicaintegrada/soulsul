from __future__ import annotations

import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from urllib import error as urllib_error
from urllib import request as urllib_request


class WhatsAppConfigurationError(RuntimeError):
    pass


class WhatsAppAPIError(RuntimeError):
    pass


@dataclass(frozen=True)
class WhatsAppConfig:
    access_token: str = ""
    phone_number_id: str = ""
    waba_id: str = ""
    verify_token: str = ""
    app_secret: str = ""
    graph_api_version: str = "v21.0"

    @classmethod
    def from_env(cls) -> "WhatsAppConfig":
        return cls(
            access_token=os.getenv("META_WHATSAPP_ACCESS_TOKEN", "").strip(),
            phone_number_id=os.getenv("META_WHATSAPP_PHONE_NUMBER_ID", "").strip(),
            waba_id=os.getenv("META_WHATSAPP_WABA_ID", "").strip(),
            verify_token=os.getenv("META_WHATSAPP_VERIFY_TOKEN", "").strip() or os.getenv("META_WEBHOOK_VERIFY_TOKEN", "").strip(),
            app_secret=os.getenv("META_APP_SECRET", "").strip(),
            graph_api_version=os.getenv("META_GRAPH_API_VERSION", "v21.0").strip() or "v21.0",
        )


class WhatsAppService:
    def __init__(self, config: WhatsAppConfig | None = None):
        self.config = config or WhatsAppConfig.from_env()

    @staticmethod
    def normalize_phone(value: object) -> str:
        return "".join(char for char in str(value or "") if char.isdigit())

    def verify_challenge(self, mode: str, token: str, challenge: str) -> str:
        if mode != "subscribe":
            raise ValueError("Modo de webhook inválido.")
        if not self.config.verify_token:
            raise WhatsAppConfigurationError("META_WHATSAPP_VERIFY_TOKEN não configurado.")
        if not hmac.compare_digest(str(token or ""), self.config.verify_token):
            raise PermissionError("Token de verificação inválido.")
        return str(challenge or "")

    def validate_signature(self, body: bytes, signature: str) -> bool:
        if not self.config.app_secret:
            return True
        signature = str(signature or "").strip()
        if not signature.startswith("sha256="):
            return False
        expected = hmac.new(self.config.app_secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature.split("=", 1)[1].lower())

    def send_text(self, destination: str, content: str) -> dict:
        destination, content = self.normalize_phone(destination), str(content or "").strip()
        if not self.config.phone_number_id or not self.config.access_token:
            raise WhatsAppConfigurationError("Credenciais do WhatsApp Cloud API não configuradas.")
        if not destination or not content:
            raise ValueError("Destino e conteúdo são obrigatórios.")
        payload = {"messaging_product": "whatsapp", "recipient_type": "individual", "to": destination, "type": "text", "text": {"body": content}}
        req = urllib_request.Request(
            f"https://graph.facebook.com/{self.config.graph_api_version}/{self.config.phone_number_id}/messages",
            data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Authorization": f"Bearer {self.config.access_token}"}, method="POST",
        )
        try:
            with urllib_request.urlopen(req, timeout=20) as response:
                raw = response.read().decode()
        except urllib_error.HTTPError as exc:
            raise WhatsAppAPIError(f"Meta Graph API respondeu HTTP {exc.code}.") from exc
        except urllib_error.URLError as exc:
            raise WhatsAppAPIError("Não foi possível conectar à Meta Graph API.") from exc
        try:
            return json.loads(raw) if raw else {}
        except json.JSONDecodeError as exc:
            raise WhatsAppAPIError("Resposta inválida da Meta Graph API.") from exc

    def build_template_payload(self, destination: str, name: str, language: str = "pt_BR") -> dict:
        return {"messaging_product": "whatsapp", "to": self.normalize_phone(destination), "type": "template", "template": {"name": name, "language": {"code": language}}}
