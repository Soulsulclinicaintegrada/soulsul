import { FileText, PenSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { contratosMock } from "./mockData";

type ContratosPageProps = {
  modo?: "lista" | "edicao";
};

export function ContratosPage({ modo = "lista" }: ContratosPageProps) {
  const [contratoAtivoId, setContratoAtivoId] = useState<number>(contratosMock[0]?.id ?? 0);
  const contratoAtivo = useMemo(
    () => contratosMock.find((item) => item.id === contratoAtivoId) ?? contratosMock[0],
    [contratoAtivoId]
  );

  return (
    <section className="module-shell">
      <section className="module-kpis">
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Contratos</span>
          <strong>{contratosMock.length}</strong>
          <span>ativos no pipeline</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Aprovados</span>
          <strong>{contratosMock.filter((item) => item.status === "Aprovado").length}</strong>
          <span>prontos para execucao</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Em revisao</span>
          <strong>{contratosMock.filter((item) => item.status === "Em revisao").length}</strong>
          <span>aguardando ajuste</span>
        </article>
      </section>

      <section className="module-content-grid">
        <article className="panel module-list-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">{modo === "edicao" ? "Edicao" : "Lista executiva"}</span>
              <h2>{modo === "edicao" ? "Selecionar contrato para editar" : "Contratos recentes"}</h2>
            </div>
          </div>
          <div className="module-card-stack">
            {contratosMock.map((contrato) => (
              <button
                key={contrato.id}
                type="button"
                className={`module-list-card${contrato.id === contratoAtivoId ? " active" : ""}`}
                onClick={() => setContratoAtivoId(contrato.id)}
              >
                <div className="module-list-card-head">
                  <strong>{contrato.paciente}</strong>
                  <span className={`module-status-badge ${contrato.status.toLowerCase().replace(/\s+/g, "-")}`}>{contrato.status}</span>
                </div>
                <span>Prontuario {contrato.prontuario} · {contrato.formaPagamento}</span>
                <div className="module-list-card-meta">
                  <strong>{contrato.valorTotal}</strong>
                  <span>{contrato.data}</span>
                </div>
              </button>
            ))}
          </div>
        </article>

        <article className="panel module-detail-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Detalhe</span>
              <h2>{modo === "edicao" ? "Edicao estruturada" : "Resumo do contrato"}</h2>
            </div>
            {modo === "edicao" ? <PenSquare size={18} /> : <FileText size={18} />}
          </div>
          {contratoAtivo ? (
            <>
              <div className="module-detail-hero">
                <div>
                  <strong>{contratoAtivo.paciente}</strong>
                  <span>Prontuario {contratoAtivo.prontuario} · Responsavel {contratoAtivo.responsavel}</span>
                </div>
                <div className="module-detail-value">{contratoAtivo.valorTotal}</div>
              </div>
              <div className="module-inline-metrics">
                <div><span>Status</span><strong>{contratoAtivo.status}</strong></div>
                <div><span>Pagamento</span><strong>{contratoAtivo.formaPagamento}</strong></div>
                <div><span>Data</span><strong>{contratoAtivo.data}</strong></div>
              </div>
              <div className="module-sublist">
                {contratoAtivo.procedimentos.map((procedimento) => (
                  <div className="module-subitem" key={`${contratoAtivo.id}-${procedimento.nome}`}>
                    <div>
                      <strong>{procedimento.nome}</strong>
                      <span>Procedimento contratado</span>
                    </div>
                    <strong>{procedimento.valor}</strong>
                  </div>
                ))}
              </div>
              {modo === "edicao" ? (
                <div className="module-actions-row">
                  <button type="button" className="ghost-action">Gerar documento</button>
                  <button type="button" className="primary-action">Salvar alteracoes</button>
                </div>
              ) : null}
            </>
          ) : null}
        </article>
      </section>
    </section>
  );
}
