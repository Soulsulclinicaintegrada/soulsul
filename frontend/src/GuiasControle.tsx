import { Clock3, FlaskConical, History, Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  atualizarLaboratorioGuiasApi,
  criarLaboratorioGuiasApi,
  listarControleGuiasApi,
  listarLaboratoriosGuiasApi,
  movimentarGuiaApi,
  type GuiaLaboratorioApi,
  type OrdemServicoResumoApi
} from "./pacientesApi";

const STATUS = ["Emitida", "Escaneado", "Enviado ao laboratório", "Pronto e na clínica"] as const;
const exigeDestino = (status: string) => status === "Escaneado" || status === "Enviado ao laboratório";

function formatarData(valor?: string) {
  if (!valor) return "Agora";
  const data = new Date(valor.replace(" ", "T"));
  return Number.isNaN(data.getTime()) ? valor : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export function GuiasControle() {
  const [guias, setGuias] = useState<OrdemServicoResumoApi[]>([]);
  const [laboratorios, setLaboratorios] = useState<GuiaLaboratorioApi[]>([]);
  const [agrupamento, setAgrupamento] = useState<"status" | "laboratorio">("status");
  const [configurando, setConfigurando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [feedback, setFeedback] = useState("");
  const [novoLaboratorio, setNovoLaboratorio] = useState("");
  const [nomes, setNomes] = useState<Record<number, string>>({});
  const [movendo, setMovendo] = useState<number | null>(null);
  const [historico, setHistorico] = useState<number | null>(null);
  const [movimento, setMovimento] = useState({ status: "Enviado ao laboratório", laboratorioId: "", observacao: "" });

  async function carregar() {
    setCarregando(true);
    try {
      const [listaGuias, listaLabs] = await Promise.all([listarControleGuiasApi(), listarLaboratoriosGuiasApi()]);
      setGuias(listaGuias);
      setLaboratorios(listaLabs);
      setNomes(Object.fromEntries(listaLabs.map((item) => [item.id, item.nome])));
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Não foi possível carregar o controle de guias.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => { carregar(); }, []);

  const colunas = useMemo(() => agrupamento === "status"
    ? STATUS.map((nome) => ({ chave: nome, nome, itens: guias.filter((guia) => (guia.status || "Emitida") === nome) }))
    : [...laboratorios.filter((lab) => lab.ativo).map((lab) => ({ chave: String(lab.id), nome: lab.nome, itens: guias.filter((guia) => guia.laboratorioId === lab.id) })),
      { chave: "sem", nome: "Sem laboratório", itens: guias.filter((guia) => !guia.laboratorioId) }],
  [agrupamento, guias, laboratorios]);

  function abrirMovimento(guia: OrdemServicoResumoApi) {
    setMovendo(guia.id);
    setMovimento({ status: guia.status === "Emitida" ? "Enviado ao laboratório" : (guia.status || "Emitida"), laboratorioId: guia.laboratorioId ? String(guia.laboratorioId) : "", observacao: "" });
  }

  async function salvarMovimento(guiaId: number) {
    if (exigeDestino(movimento.status) && !movimento.laboratorioId) {
      setErro("Selecione o laboratório de destino.");
      return;
    }
    try {
      const atualizada = await movimentarGuiaApi(guiaId, { status: movimento.status, laboratorio_id: Number(movimento.laboratorioId || 0), observacao: movimento.observacao });
      setGuias((atuais) => atuais.map((item) => item.id === guiaId ? atualizada : item));
      setMovendo(null);
      setErro("");
      setFeedback("Movimentação registrada no histórico.");
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao movimentar a guia."); }
  }

  async function adicionarLaboratorio() {
    if (!novoLaboratorio.trim()) return;
    try {
      const criado = await criarLaboratorioGuiasApi(novoLaboratorio.trim());
      setLaboratorios((atuais) => [...atuais, criado]);
      setNomes((atuais) => ({ ...atuais, [criado.id]: criado.nome }));
      setNovoLaboratorio("");
      setFeedback("Laboratório adicionado.");
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao adicionar laboratório."); }
  }

  async function salvarLaboratorio(item: GuiaLaboratorioApi, ativo = item.ativo) {
    try {
      const atualizado = await atualizarLaboratorioGuiasApi(item.id, (nomes[item.id] || item.nome).trim(), ativo);
      setLaboratorios((atuais) => atuais.map((lab) => lab.id === item.id ? atualizado : lab));
      setFeedback("Laboratórios atualizados.");
    } catch (error) { setErro(error instanceof Error ? error.message : "Falha ao atualizar laboratório."); }
  }

  return <div className="guide-control">
    <header className="guide-control-header panel">
      <div><span className="panel-kicker">Fluxo protético</span><h2>Controle de guias</h2><p>Acompanhe cada guia da emissão ao retorno para a clínica.</p></div>
      <div className="guide-control-actions">
        <div className="guide-segmented"><button className={agrupamento === "status" ? "active" : ""} onClick={() => setAgrupamento("status")}>Por status</button><button className={agrupamento === "laboratorio" ? "active" : ""} onClick={() => setAgrupamento("laboratorio")}>Por laboratório</button></div>
        <button className="ghost-action" onClick={() => setConfigurando((valor) => !valor)}><Settings2 size={16}/> Laboratórios</button>
      </div>
    </header>
    {erro ? <div className="crm-inline-alert">{erro}</div> : null}
    {feedback ? <div className="dashboard-note success">{feedback}</div> : null}
    {configurando ? <section className="panel guide-labs-panel">
      <div className="clinical-panel-header"><div><strong>Laboratórios</strong><span>Renomeie, desative ou inclua novos destinos.</span></div></div>
      <div className="guide-lab-add"><input value={novoLaboratorio} onChange={(e) => setNovoLaboratorio(e.target.value)} placeholder="Nome do novo laboratório"/><button className="primary-action" onClick={adicionarLaboratorio}><Plus size={16}/> Adicionar</button></div>
      <div className="guide-lab-list">{laboratorios.map((lab) => <div className="guide-lab-row" key={lab.id}><input value={nomes[lab.id] ?? lab.nome} onChange={(e) => setNomes((atuais) => ({ ...atuais, [lab.id]: e.target.value }))}/><span className={`guide-status-dot ${lab.ativo ? "active" : "inactive"}`}>{lab.ativo ? "Ativo" : "Inativo"}</span><button className="ghost-action" onClick={() => salvarLaboratorio(lab)}>Salvar</button><button className="ghost-action" onClick={() => salvarLaboratorio(lab, !lab.ativo)}>{lab.ativo ? "Desativar" : "Ativar"}</button></div>)}</div>
    </section> : null}
    {carregando ? <div className="panel empty-inline">Carregando guias...</div> : <div className="guide-kanban">{colunas.map((coluna) => <section className="guide-kanban-column" key={coluna.chave}>
      <header><div><span>{agrupamento === "status" ? "ETAPA" : "DESTINO"}</span><strong>{coluna.nome}</strong></div><b>{coluna.itens.length}</b></header>
      <div className="guide-kanban-list">{coluna.itens.length ? coluna.itens.map((guia) => <article className="guide-card" key={guia.id}>
        <div className="guide-card-top"><span className="guide-id">GUIA #{guia.id}</span><span className="guide-current-status">{guia.status || "Emitida"}</span></div>
        <h3>{guia.pacienteNome || "Paciente"}</h3><p className="guide-record">Prontuário {guia.prontuario || "não informado"}</p>
        <div className="guide-procedure"><strong>{guia.procedimentoNome}</strong><span>{guia.elementoArcada || "Elemento não informado"}</span></div>
        {guia.laboratorioNome ? <div className="guide-meta"><FlaskConical size={15}/><span>{guia.laboratorioNome}</span></div> : null}
        <div className="guide-meta"><Clock3 size={15}/><span>{formatarData(guia.statusAtualizadoEm || guia.criadoEm)}{guia.statusAtualizadoPor ? ` · ${guia.statusAtualizadoPor}` : ""}</span></div>
        <div className="guide-card-buttons"><button className="primary-action" onClick={() => abrirMovimento(guia)}>Movimentar</button><button className="ghost-action" onClick={() => setHistorico(historico === guia.id ? null : guia.id)}><History size={15}/> Histórico</button></div>
        {movendo === guia.id ? <div className="guide-move-form"><label><span>Novo status</span><select value={movimento.status} onChange={(e) => setMovimento((atual) => ({ ...atual, status: e.target.value }))}>{STATUS.map((status) => <option key={status}>{status}</option>)}</select></label>{exigeDestino(movimento.status) ? <label><span>Laboratório de destino *</span><select value={movimento.laboratorioId} onChange={(e) => setMovimento((atual) => ({ ...atual, laboratorioId: e.target.value }))}><option value="">Selecione</option>{laboratorios.filter((lab) => lab.ativo).map((lab) => <option key={lab.id} value={lab.id}>{lab.nome}</option>)}</select></label> : null}<label><span>Observação</span><textarea rows={2} value={movimento.observacao} onChange={(e) => setMovimento((atual) => ({ ...atual, observacao: e.target.value }))}/></label><div><button className="primary-action" onClick={() => salvarMovimento(guia.id)}>Registrar</button><button className="ghost-action" onClick={() => setMovendo(null)}>Cancelar</button></div></div> : null}
        {historico === guia.id ? <div className="guide-history">{guia.movimentacoes?.length ? guia.movimentacoes.map((item) => <div key={item.id}><i/><p><strong>{item.statusNovo}</strong>{item.laboratorioNome ? ` · ${item.laboratorioNome}` : ""}<small>{formatarData(item.criadoEm)}{item.criadoPor ? ` · ${item.criadoPor}` : ""}{item.observacao ? ` · ${item.observacao}` : ""}</small></p></div>) : <span className="empty-inline">Sem movimentações registradas.</span>}</div> : null}
      </article>) : <div className="guide-column-empty">Nenhuma guia nesta etapa.</div>}</div>
    </section>)}</div>}
  </div>;
}
