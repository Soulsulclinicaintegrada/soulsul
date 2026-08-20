import { useEffect, useMemo, useState } from "react";
import { atualizarResponsaveisComissaoApi, relatorioComissoesApi, urlExportarRelatorioComissoes, type RelatorioComissoesApi } from "./pacientesApi";

type Visualizacao = "vendas" | "avaliacoes";
function isoHoje() { return new Date().toISOString().slice(0, 10); }
function inicioMes() { const hoje = isoHoje(); return `${hoje.slice(0, 8)}01`; }
function moeda(valor: number) { return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }
function normalizar(valor: string) { return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }

export function ComissoesPage() {
  const [inicio, setInicio] = useState(inicioMes());
  const [fim, setFim] = useState(isoHoje());
  const [dados, setDados] = useState<RelatorioComissoesApi | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [visualizacao, setVisualizacao] = useState<Visualizacao>("vendas");
  const [busca, setBusca] = useState("");
  const [colaborador, setColaborador] = useState("");
  const [status, setStatus] = useState("");
  const [pagamento, setPagamento] = useState("");
  const [responsaveisEdicao, setResponsaveisEdicao] = useState<Record<number, { agendador: string; fechamento: string }>>({});
  const [salvandoContrato, setSalvandoContrato] = useState<number | null>(null);
  const [mensagem, setMensagem] = useState("");

  async function carregar() {
    if (!inicio || !fim) return;
    setCarregando(true); setErro("");
    try { setDados(await relatorioComissoesApi(inicio, fim)); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível carregar o relatório."); }
    finally { setCarregando(false); }
  }
  useEffect(() => { void carregar(); }, []);

  const colaboradores = useMemo(() => {
    if (!dados) return [];
    const nomes = visualizacao === "vendas"
      ? dados.vendas.flatMap((item) => [item.primeiroAgendador, item.agendadorAvaliacao, item.agendadorFechamento])
      : dados.avaliacoes.map((item) => item.agendadoPor);
    return [...new Set(nomes.filter((nome) => nome && !normalizar(nome).startsWith("nao ")))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [dados, visualizacao]);

  const vendas = useMemo(() => (dados?.vendas || []).filter((item) => {
    const termo = normalizar(busca);
    const correspondeBusca = !termo || normalizar(`${item.paciente} ${item.contratoId} ${item.formaPagamento}`).includes(termo);
    const correspondeColaborador = !colaborador || [item.primeiroAgendador, item.agendadorAvaliacao, item.agendadorFechamento].includes(colaborador);
    const correspondeStatus = !status || item.status === status;
    const correspondePagamento = !pagamento || (pagamento === "confirmado" ? item.pagamentoConfirmado : !item.pagamentoConfirmado);
    return correspondeBusca && correspondeColaborador && correspondeStatus && correspondePagamento;
  }), [busca, colaborador, dados, pagamento, status]);

  const avaliacoes = useMemo(() => (dados?.avaliacoes || []).filter((item) => {
    const termo = normalizar(busca);
    return (!termo || normalizar(`${item.paciente} ${item.procedimentos}`).includes(termo)) && (!colaborador || item.agendadoPor === colaborador);
  }), [busca, colaborador, dados]);

  const totalFiltrado = vendas.reduce((soma, item) => soma + item.valorContrato, 0);
  const comissaoVendasFiltrada = vendas.reduce((soma, item) => soma + item.comissaoTotal, 0);
  const primeirasAvaliacoes = avaliacoes.filter((item) => item.primeiraAvaliacao);
  const comissaoComparecimentosFiltrada = primeirasAvaliacoes.length * 1.90;
  const comissoesPorPessoa = useMemo(() => {
    const resumo = new Map<string, { captacao: number; resgate: number; comparecimentos: number; total: number; vendas: number }>();
    const obter = (nome: string) => {
      if (!nome || normalizar(nome).startsWith("nao ")) return null;
      const atual = resumo.get(nome) || { captacao: 0, resgate: 0, comparecimentos: 0, total: 0, vendas: 0 };
      resumo.set(nome, atual);
      return atual;
    };
    const adicionar = (nome: string, captacao: number, resgate: number) => {
      if (captacao + resgate <= 0) return;
      const atual = obter(nome); if (!atual) return;
      atual.captacao += captacao; atual.resgate += resgate; atual.total += captacao + resgate; atual.vendas += 1;
    };
    vendas.forEach((item) => {
      adicionar(item.agendadorAvaliacao, item.comissaoCaptacao, 0);
      adicionar(item.agendadorFechamento, 0, item.comissaoResgate);
    });
    avaliacoes.filter((item) => item.primeiraAvaliacao).forEach((item) => {
      const atual = obter(item.agendadoPor); if (!atual) return;
      atual.comparecimentos += 1; atual.total += 1.90;
    });
    return [...resumo.entries()].map(([nome, valores]) => ({ nome, ...valores })).sort((a, b) => b.total - a.total);
  }, [avaliacoes, vendas]);
  function limparFiltros() { setBusca(""); setColaborador(""); setStatus(""); setPagamento(""); }
  async function salvarResponsaveis(contratoId: number, agendadorAtual: string, fechamentoAtual: string) {
    const edicao = responsaveisEdicao[contratoId] || { agendador: agendadorAtual, fechamento: fechamentoAtual };
    if (!edicao.agendador.trim() || !edicao.fechamento.trim()) { setMensagem("Informe os dois responsáveis."); return; }
    setSalvandoContrato(contratoId); setMensagem("");
    try {
      await atualizarResponsaveisComissaoApi(contratoId, edicao.agendador, edicao.fechamento);
      setMensagem("Responsáveis atualizados. As comissões foram recalculadas.");
      setResponsaveisEdicao((atual) => { const copia = { ...atual }; delete copia[contratoId]; return copia; });
      await carregar();
    } catch (e) { setMensagem(e instanceof Error ? e.message : "Não foi possível salvar os responsáveis."); }
    finally { setSalvandoContrato(null); }
  }

  return <div className="commission-page">
    <section className="module-panel commission-header-panel">
      <div className="module-panel-heading">
        <div><span className="eyebrow">Política de comissionamento</span><h2>Vendas, avaliações e comissões</h2><p>Escolha o período, refine os resultados e exporte o relatório completo.</p></div>
        <a className="primary-action" href={urlExportarRelatorioComissoes(inicio, fim)} target="_blank" rel="noreferrer">Exportar Excel</a>
      </div>
      <div className="commission-period-grid">
        <label><span>Data inicial</span><input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
        <label><span>Data final</span><input type="date" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
        <button className="primary-action" type="button" onClick={() => void carregar()} disabled={carregando}>{carregando ? "Carregando..." : "Atualizar período"}</button>
      </div>
      {erro ? <div className="form-feedback error">{erro}</div> : null}
    </section>

    {dados ? <>
      <section className="commission-metrics">
        <article><span>Vendas exibidas</span><strong>{vendas.length}</strong><small>de {dados.vendas.length} no período</small></article>
        <article><span>Valor filtrado</span><strong>{moeda(totalFiltrado)}</strong><small>Permutas excluídas</small></article>
        <article><span>Comissão total</span><strong>{moeda(comissaoVendasFiltrada + comissaoComparecimentosFiltrada)}</strong><small>Vendas + R$ 1,90 por primeira avaliação</small></article>
        <article><span>Primeiras avaliações</span><strong>{primeirasAvaliacoes.length}</strong><small>{avaliacoes.length} avaliações comparecidas exibidas</small></article>
      </section>

      <section className="module-panel commission-results-panel">
        <datalist id="commission-collaborators">{colaboradores.map((nome) => <option key={nome} value={nome} />)}</datalist>
        <div className="commission-view-tabs">
          <button type="button" className={visualizacao === "vendas" ? "active" : ""} onClick={() => { setVisualizacao("vendas"); limparFiltros(); }}>Vendas e comissões</button>
          <button type="button" className={visualizacao === "avaliacoes" ? "active" : ""} onClick={() => { setVisualizacao("avaliacoes"); limparFiltros(); }}>Avaliações comparecidas</button>
        </div>
        {mensagem ? <div className="commission-save-feedback">{mensagem}</div> : null}
        <div className="commission-filters">
          <label className="commission-search"><span>Buscar</span><input type="search" placeholder={visualizacao === "vendas" ? "Paciente, contrato ou pagamento" : "Paciente ou procedimento"} value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
          <label><span>Colaborador</span><select value={colaborador} onChange={(e) => setColaborador(e.target.value)}><option value="">Todos</option>{colaboradores.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select></label>
          {visualizacao === "vendas" ? <>
            <label><span>Status</span><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Todos</option><option value="Completo">Completo</option><option value="Revisar dados ausentes">Revisar dados</option><option value="Aguardando confirmação do pagamento">Aguardando pagamento</option></select></label>
            <label><span>Pagamento</span><select value={pagamento} onChange={(e) => setPagamento(e.target.value)}><option value="">Todos</option><option value="confirmado">Confirmado</option><option value="pendente">Não confirmado</option></select></label>
          </> : null}
          <button type="button" className="ghost-action compact" onClick={limparFiltros}>Limpar filtros</button>
        </div>

        {visualizacao === "vendas" ? <div className="commission-table-wrap"><table className="finance-table commission-table"><thead><tr>
          <th>Paciente</th><th>Venda</th><th>Origem</th><th>Avaliação</th><th>Fechamento</th><th>Comissão</th><th>Status</th>
        </tr></thead><tbody>{vendas.map((item) => <tr key={item.contratoId}>
          <td><strong>{item.paciente}</strong><small>Contrato #{item.contratoId}</small></td>
          <td><strong>{moeda(item.valorContrato)}</strong><small>{item.dataFechamento} · {item.formaPagamento || "Forma não informada"}</small></td>
          <td><strong>{item.primeiroAgendador}</strong><small>Primeiro contato: {item.primeiroAgendamento || "-"}</small></td>
          <td><input className="commission-owner-input" list="commission-collaborators" aria-label={`Responsável pelo agendamento de ${item.paciente}`} value={responsaveisEdicao[item.contratoId]?.agendador ?? item.agendadorAvaliacao} onChange={(e) => setResponsaveisEdicao((atual) => ({ ...atual, [item.contratoId]: { agendador: e.target.value, fechamento: atual[item.contratoId]?.fechamento ?? item.agendadorFechamento } }))} /><small>Compareceu: {item.avaliacaoComparecida || "-"}</small></td>
          <td><input className="commission-owner-input" list="commission-collaborators" aria-label={`Responsável pelo fechamento de ${item.paciente}`} value={responsaveisEdicao[item.contratoId]?.fechamento ?? item.agendadorFechamento} onChange={(e) => setResponsaveisEdicao((atual) => ({ ...atual, [item.contratoId]: { agendador: atual[item.contratoId]?.agendador ?? item.agendadorAvaliacao, fechamento: e.target.value } }))} /><small>{item.comissaoResgate ? "Resgate 70%" : "Responsável integral"}</small></td>
          <td><strong>{moeda(item.comissaoTotal)}</strong><small>{item.comissaoResgate ? `Captação ${moeda(item.comissaoCaptacao)} · Resgate ${moeda(item.comissaoResgate)}` : item.pagamentoConfirmado ? "Pagamento confirmado" : "Aguardando pagamento"}</small></td>
          <td><span className={`commission-status ${item.status === "Completo" ? "complete" : "review"}`}>{item.status}</span>{responsaveisEdicao[item.contratoId] ? <button type="button" className="primary-action compact commission-save-owner" disabled={salvandoContrato === item.contratoId} onClick={() => void salvarResponsaveis(item.contratoId, item.agendadorAvaliacao, item.agendadorFechamento)}>{salvandoContrato === item.contratoId ? "Salvando..." : "Salvar responsáveis"}</button> : null}</td>
        </tr>)}</tbody></table>{!vendas.length ? <div className="empty-inline">Nenhuma venda encontrada com esses filtros.</div> : null}</div>
        : <div className="commission-table-wrap"><table className="finance-table commission-table"><thead><tr><th>Paciente</th><th>Comparecimento</th><th>Quem agendou</th><th>Agendado em</th><th>Procedimentos</th></tr></thead><tbody>
          {avaliacoes.map((item) => <tr key={item.agendamentoId}><td><strong>{item.paciente}</strong>{item.primeiraAvaliacao ? <span className="commission-first-evaluation">Primeira avaliação · R$ 1,90</span> : <small>Retorno/avaliação posterior · sem comissão fixa</small>}</td><td><strong>{item.data}</strong><small>{item.hora} · {item.status}</small></td><td><strong>{item.agendadoPor}</strong></td><td>{item.agendadoEm || "-"}</td><td>{item.procedimentos || "-"}</td></tr>)}
        </tbody></table>{!avaliacoes.length ? <div className="empty-inline">Nenhuma avaliação encontrada com esses filtros.</div> : null}</div>}

        {visualizacao === "vendas" ? <div className="commission-person-summary">
          <div className="commission-summary-heading"><div><span className="eyebrow">Fechamento do relatório</span><h3>Comissão por pessoa</h3></div><strong>{moeda(comissoesPorPessoa.reduce((soma, item) => soma + item.total, 0))}</strong></div>
          <div className="commission-person-grid">{comissoesPorPessoa.map((item) => <article key={item.nome}>
            <div><strong>{item.nome}</strong><small>{item.vendas} participação(ões)</small></div>
            <dl><div><dt>Captação</dt><dd>{moeda(item.captacao)}</dd></div><div><dt>Resgate</dt><dd>{moeda(item.resgate)}</dd></div><div><dt>Primeiras avaliações ({item.comparecimentos})</dt><dd>{moeda(item.comparecimentos * 1.90)}</dd></div><div className="total"><dt>Total</dt><dd>{moeda(item.total)}</dd></div></dl>
          </article>)}</div>
          {!comissoesPorPessoa.length ? <div className="empty-inline">Nenhuma comissão liberada nos resultados filtrados.</div> : null}
        </div> : null}
      </section>
    </> : null}
  </div>;
}
