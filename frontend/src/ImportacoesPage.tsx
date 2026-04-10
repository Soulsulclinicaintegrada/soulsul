import { ClipboardList, Plus, Save, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  atualizarProcedimentoApi,
  criarProcedimentoApi,
  excluirProcedimentoApi,
  listarProcedimentosApi,
  urlExportarSistemaExcel,
  type ProcedimentoPayload,
  type ProcedimentoResumoApi
} from "./pacientesApi";

type ProcedimentoForm = {
  nome: string;
  categoria: string;
  valorPadrao: string;
  duracaoPadraoMinutos: string;
  descricao: string;
  etapasPadrao: string;
  materiaisPadrao: string;
  ativo: boolean;
};

const FORM_INICIAL: ProcedimentoForm = {
  nome: "",
  categoria: "",
  valorPadrao: "",
  duracaoPadraoMinutos: "60",
  descricao: "",
  etapasPadrao: "",
  materiaisPadrao: "",
  ativo: true
};

function formatarMoeda(valor: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL"
  }).format(Number.isFinite(valor) ? valor : 0);
}

function parseMoeda(valor: string) {
  const limpo = String(valor || "").replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const numero = Number(limpo);
  return Number.isFinite(numero) ? numero : 0;
}

function mapProcedimentoParaForm(item?: ProcedimentoResumoApi | null): ProcedimentoForm {
  if (!item) return FORM_INICIAL;
  return {
    nome: item.nome || "",
    categoria: item.categoria || "",
    valorPadrao: item.valorPadrao ? String(item.valorPadrao).replace(".", ",") : "",
    duracaoPadraoMinutos: String(item.duracaoPadraoMinutos || 60),
    descricao: item.descricao || "",
    etapasPadrao: (item.etapasPadrao || []).join("\n"),
    materiaisPadrao: (item.materiaisPadrao || []).join("\n"),
    ativo: item.ativo
  };
}

export function ImportacoesPage() {
  const [procedimentos, setProcedimentos] = useState<ProcedimentoResumoApi[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [procedimentoSelecionadoId, setProcedimentoSelecionadoId] = useState<number | null>(null);
  const [form, setForm] = useState<ProcedimentoForm>(FORM_INICIAL);

  const procedimentoSelecionado = useMemo(
    () => procedimentos.find((item) => item.id === procedimentoSelecionadoId) || null,
    [procedimentoSelecionadoId, procedimentos]
  );

  async function carregarProcedimentos(termo = busca) {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await listarProcedimentosApi(termo, false);
      setProcedimentos(lista);
      if (!lista.length) {
        setProcedimentoSelecionadoId(null);
        setForm(FORM_INICIAL);
      } else if (procedimentoSelecionadoId != null) {
        const atual = lista.find((item) => item.id === procedimentoSelecionadoId) || null;
        if (!atual) {
          setProcedimentoSelecionadoId(lista[0].id);
          setForm(mapProcedimentoParaForm(lista[0]));
        } else {
          setForm(mapProcedimentoParaForm(atual));
        }
      } else {
        setProcedimentoSelecionadoId(lista[0].id);
        setForm(mapProcedimentoParaForm(lista[0]));
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao carregar procedimentos.");
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregarProcedimentos("");
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 3000);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  function novoProcedimento() {
    setProcedimentoSelecionadoId(null);
    setForm(FORM_INICIAL);
    setErro(null);
    setFeedback(null);
  }

  function selecionarProcedimento(item: ProcedimentoResumoApi) {
    setProcedimentoSelecionadoId(item.id);
    setForm(mapProcedimentoParaForm(item));
    setErro(null);
    setFeedback(null);
  }

  async function salvarProcedimento() {
    const payload: ProcedimentoPayload = {
      nome: form.nome.trim(),
      categoria: form.categoria.trim(),
      valor_padrao: parseMoeda(form.valorPadrao),
      duracao_padrao_minutos: Number(form.duracaoPadraoMinutos || 60),
      descricao: form.descricao.trim(),
      etapas_padrao: form.etapasPadrao.split("\n").map((item) => item.trim()).filter(Boolean),
      materiais_padrao: form.materiaisPadrao.split("\n").map((item) => item.trim()).filter(Boolean),
      ativo: form.ativo
    };
    if (!payload.nome) {
      setErro("Informe o nome do procedimento.");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      if (procedimentoSelecionadoId == null) {
        const criado = await criarProcedimentoApi(payload);
        setFeedback("Procedimento criado.");
        await carregarProcedimentos(busca);
        setProcedimentoSelecionadoId(criado.id);
      } else {
        const atualizado = await atualizarProcedimentoApi(procedimentoSelecionadoId, payload);
        setFeedback("Procedimento atualizado.");
        await carregarProcedimentos(busca);
        setProcedimentoSelecionadoId(atualizado.id);
      }
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao salvar procedimento.");
    } finally {
      setSalvando(false);
    }
  }

  async function excluirProcedimento() {
    if (!procedimentoSelecionadoId || !procedimentoSelecionado) return;
    const confirmar = window.confirm(`Excluir o procedimento "${procedimentoSelecionado.nome}"?`);
    if (!confirmar) return;
    setExcluindo(true);
    setErro(null);
    try {
      await excluirProcedimentoApi(procedimentoSelecionadoId);
      setFeedback("Procedimento excluído.");
      setProcedimentoSelecionadoId(null);
      setForm(FORM_INICIAL);
      await carregarProcedimentos(busca);
    } catch (error) {
      setErro(error instanceof Error ? error.message : "Falha ao excluir procedimento.");
    } finally {
      setExcluindo(false);
    }
  }

  const totalAtivos = procedimentos.filter((item) => item.ativo).length;
  const totalInativos = procedimentos.filter((item) => !item.ativo).length;

  return (
    <section className="module-shell">
      <section className="module-kpis">
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Tabela</span>
          <strong>{procedimentos.length}</strong>
          <span>procedimentos cadastrados</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Ativos</span>
          <strong>{totalAtivos}</strong>
          <span>disponíveis para orçamento</span>
        </article>
        <article className="panel module-kpi-card">
          <span className="panel-kicker">Inativos</span>
          <strong>{totalInativos}</strong>
          <span>fora de uso</span>
        </article>
      </section>

      <section className="module-content-grid procedures-grid">
        <article className="panel module-list-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Tabela de procedimentos</span>
              <h2>Lista editável</h2>
            </div>
            <ClipboardList size={18} />
          </div>
          <div className="procedures-toolbar">
            <label className="procedures-search">
              <Search size={16} />
              <input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar procedimento ou categoria" />
            </label>
            <a className="ghost-action" href={urlExportarSistemaExcel()} target="_blank" rel="noreferrer">
              Exportar sistema
            </a>
            <button type="button" className="ghost-action" onClick={() => carregarProcedimentos(busca)} disabled={carregando}>
              Buscar
            </button>
            <button type="button" className="primary-action" onClick={novoProcedimento}>
              <Plus size={15} />
              Novo procedimento
            </button>
          </div>
          <div className="module-sublist procedures-list">
            {carregando ? <div className="module-subitem"><strong>Carregando procedimentos...</strong></div> : null}
            {!carregando && procedimentos.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`module-subitem procedures-list-item${procedimentoSelecionadoId === item.id ? " active" : ""}`}
                onClick={() => selecionarProcedimento(item)}
              >
                <div>
                  <strong>{item.nome}</strong>
                  <span>{item.categoria || "Sem categoria"}</span>
                </div>
                <div className="module-subitem-right">
                  <strong>{formatarMoeda(item.valorPadrao)}</strong>
                  <span className={`module-status-badge ${item.ativo ? "ativo" : "inativo"}`}>{item.ativo ? "Ativo" : "Inativo"}</span>
                </div>
              </button>
            ))}
            {!carregando && !procedimentos.length ? <div className="module-subitem"><strong>Nenhum procedimento encontrado.</strong></div> : null}
          </div>
        </article>

        <article className="panel module-detail-panel">
          <div className="section-title-row">
            <div>
              <span className="panel-kicker">Cadastro</span>
              <h2>{procedimentoSelecionadoId ? "Editar procedimento" : "Novo procedimento"}</h2>
            </div>
            <ClipboardList size={18} />
          </div>

          <div className="procedures-editor-shell">
            <div className="users-template-actions procedures-editor-actions">
              <button type="button" className="ghost-action" onClick={novoProcedimento}>
                <Plus size={15} />
                Limpar
              </button>
              {procedimentoSelecionadoId ? (
                <button type="button" className="ghost-action danger" onClick={excluirProcedimento} disabled={excluindo}>
                  <Trash2 size={15} />
                  Excluir
                </button>
              ) : null}
              <button type="button" className="primary-action" onClick={salvarProcedimento} disabled={salvando}>
                <Save size={15} />
                {procedimentoSelecionadoId ? "Salvar alterações" : "Criar procedimento"}
              </button>
            </div>

            <div className="users-create-grid procedures-form-grid procedures-editor-grid">
              <label>
                <span>Nome</span>
                <input value={form.nome} onChange={(event) => setForm((atual) => ({ ...atual, nome: event.target.value }))} />
              </label>
              <label>
                <span>Categoria</span>
                <input value={form.categoria} onChange={(event) => setForm((atual) => ({ ...atual, categoria: event.target.value }))} />
              </label>
              <label>
                <span>Valor</span>
                <input value={form.valorPadrao} onChange={(event) => setForm((atual) => ({ ...atual, valorPadrao: event.target.value }))} />
              </label>
              <label>
                <span>Duração padrão (min)</span>
                <input value={form.duracaoPadraoMinutos} onChange={(event) => setForm((atual) => ({ ...atual, duracaoPadraoMinutos: event.target.value }))} />
              </label>
              <label className="procedures-form-wide">
                <span>Descrição</span>
                <textarea value={form.descricao} onChange={(event) => setForm((atual) => ({ ...atual, descricao: event.target.value }))} rows={4} />
              </label>
              <label className="procedures-form-wide">
                <span>Etapas de laboratório (uma por linha)</span>
                <textarea value={form.etapasPadrao} onChange={(event) => setForm((atual) => ({ ...atual, etapasPadrao: event.target.value }))} rows={6} />
              </label>
              <label className="procedures-form-wide">
                <span>Materiais permitidos na ordem de serviço (um por linha)</span>
                <textarea value={form.materiaisPadrao} onChange={(event) => setForm((atual) => ({ ...atual, materiaisPadrao: event.target.value }))} rows={6} />
              </label>
              <label className="procedures-inline-check">
                <input type="checkbox" checked={form.ativo} onChange={(event) => setForm((atual) => ({ ...atual, ativo: event.target.checked }))} />
                <span>Procedimento ativo</span>
              </label>
            </div>

            {erro ? <p className="users-password-feedback error">{erro}</p> : null}
            {feedback ? <p className="users-password-feedback success">{feedback}</p> : null}
          </div>
        </article>
      </section>
    </section>
  );
}

