# WhatsApp Business Platform / Meta Cloud API

Webhook público: `https://soulsul-production.up.railway.app/api/meta/webhook`.

Preencha no backend as variáveis de `.env.example`, informe o mesmo `META_WHATSAPP_VERIFY_TOKEN` na validação da Meta e assine o campo `messages`.

Em desenvolvimento, simule uma entrada com `POST /api/dev/whatsapp/simular?telefone=5511999999999&nome=Contato%20Teste`, corpo `{"conteudo":"Mensagem recebida de teste"}` e o header `X-Usuario`. A rota retorna 404 em produção.

Se o mesmo número continuar no WhatsApp Business App, o onboarding de Coexistence precisa ser concluído manualmente no WhatsApp Manager/Embedded Signup quando estiver disponível para a conta.
