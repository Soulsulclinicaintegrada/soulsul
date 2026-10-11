import {
  buscarRecursoEducacaoApi,
  criarRecursoEducacaoApi,
  atualizarRecursoEducacaoApi,
  listarGuiasEducacaoApi,
  type GuiaEducacaoApi,
  type PacienteApiPayload,
  type UsuarioResumoApi
} from "./pacientesApi";
import type {
  AgendaApiAgendamento, AgendaConfiguracaoApi, AgendaDetalheResponse,
  AgendaDisponibilidadeResponse, AgendaPacienteBuscaItem, AgendaPacienteContexto,
  AgendaSalvarPayload
} from "./agendaApi";

export type { AgendaApiAgendamento, AgendaConfiguracaoApi, AgendaPacienteBuscaItem, AgendaProcedimentoContrato, AgendaProcedimentoPayload, AgendaSalvarPayload } from "./agendaApi";
export type { PacienteApiPayload, UsuarioResumoApi } from "./pacientesApi";
export { adicionarMinutos, gerarSlotsQuinzeMinutos, paraMinutos } from "./agendaApi";

type RegistroAgendaEducacao={id:number;data:string;hora_inicio:string;hora_fim:string;paciente_modelo_id?:number;procedimento_id?:number;guia_id?:number;titulo?:string;tipo_atendimento?:string;responsavel?:string;local?:string;status?:string;observacoes?:string;criado_por?:string;criado_em?:string;atualizado_em?:string};
type PacienteEducacao={id:number;nome:string;prontuario?:string;telefone?:string;cpf?:string};
type ProcedimentoEducacao={id:number;nome:string;duracao_minutos?:number;ativo?:boolean};

const isoParaBr=(iso:string)=>/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.split("-").reverse().join("/"):iso;
const brParaIso=(br:string)=>/^\d{2}\/\d{2}\/\d{4}$/.test(br)?br.split("/").reverse().join("-"):br;
async function baseContexto(){const [pacientes,procedimentos]=await Promise.all([buscarRecursoEducacaoApi<PacienteEducacao[]>("pacientes-modelo"),buscarRecursoEducacaoApi<ProcedimentoEducacao[]>("procedimentos")]);return {pacientes,procedimentos};}
async function mapear(reg:RegistroAgendaEducacao):Promise<AgendaApiAgendamento>{const {pacientes,procedimentos}=await baseContexto();const p=pacientes.find(x=>x.id===Number(reg.paciente_modelo_id));const proc=procedimentos.find(x=>x.id===Number(reg.procedimento_id));return {id:reg.id,pacienteId:p?.id??null,paciente:p?.nome||reg.titulo||"Compromisso",prontuario:p?.prontuario||"",telefone:p?.telefone||"",profissionalId:Math.abs(hash(reg.responsavel||"Profissional")),profissional:reg.responsavel||"Profissional",tipoAtendimentoId:1,tipoAtendimento:reg.tipo_atendimento||"Atendimento",procedimentos:proc?[proc.nome]:[],status:reg.status||"Agendado",data:isoParaBr(reg.data),inicio:reg.hora_inicio||"08:00",fim:reg.hora_fim||"08:45",consultorio:reg.local||"",observacoes:reg.observacoes||"",agendadoPor:reg.criado_por||"",agendadoEm:reg.criado_em||"",atualizadoEm:reg.atualizado_em||"",ordemServicoId:reg.guia_id||null};}
function hash(s:string){let h=0;for(const c of s)h=((h<<5)-h)+c.charCodeAt(0);return h||1;}
async function payloadBackend(p:AgendaSalvarPayload){const procedimentos=await buscarRecursoEducacaoApi<ProcedimentoEducacao[]>("procedimentos");const proc=procedimentos.find(x=>p.procedimentos.some(y=>y.nome.toLowerCase()===x.nome.toLowerCase()));return {data:brParaIso(p.data),hora_inicio:p.horaInicio,hora_fim:p.horaFim,paciente_modelo_id:p.pacienteId||null,procedimento_id:proc?.id||null,guia_id:p.ordemServicoId||null,titulo:p.nomePaciente||p.tipoAtendimentoNome,tipo_atendimento:p.tipoAtendimentoNome,responsavel:p.profissionalNome,local:"",status:p.status||"Agendado",observacoes:p.observacoes||""};}

export async function listarUsuariosApi():Promise<UsuarioResumoApi[]>{const u=await buscarRecursoEducacaoApi<any[]>("usuarios");return u.filter(x=>x.ativo&&x.agendaAtiva).map(x=>({id:Math.abs(hash(x.nomeAgenda||x.nome)),nome:x.nome,nomeAgenda:x.nomeAgenda||x.nome,usuario:x.usuario,perfil:x.perfil==="ADMINISTRADOR"?"Administrador":"Usuario",cargo:x.perfil==="ADMINISTRADOR"?"Administrador":"Profissional",agendaEscopo:"Toda a clinica",agendaDisponivel:true,status:"Ativo",ultimoAcesso:x.ultimoLogin||"-",modulos:{},pacientesAbas:{}} as UsuarioResumoApi));}
export async function listarPacientesApi(busca:string){const ps=await buscarRecursoEducacaoApi<PacienteEducacao[]>("pacientes-modelo");const q=busca.toLowerCase();return ps.filter(p=>`${p.nome} ${p.prontuario||""} ${p.telefone||""}`.toLowerCase().includes(q)).slice(0,20).map(p=>({id:p.id,nome:p.nome,prontuario:p.prontuario||"",telefone:p.telefone||""}));}
export async function criarPacienteApi(payload:PacienteApiPayload){return criarRecursoEducacaoApi<any>("pacientes-modelo/cadastro-rapido",{nome:payload.nome,telefone:payload.telefone});}
export async function listarAgendamentosAgenda(inicio:string,fim=inicio,incluirOcultos=false){void incluirOcultos;const regs=await buscarRecursoEducacaoApi<RegistroAgendaEducacao[]>("agenda");const a=brParaIso(inicio),b=brParaIso(fim);return Promise.all(regs.filter(r=>r.data>=a&&r.data<=b).map(mapear));}
export async function buscarDisponibilidadeAgenda(profissionalId:number,data:string,excluir?:number|null):Promise<AgendaDisponibilidadeResponse>{const eventos=(await listarAgendamentosAgenda(data)).filter(e=>e.profissionalId===profissionalId&&e.id!==excluir);const ocupados:string[]=[];for(const e of eventos){let [h,m]=e.inicio.split(":").map(Number),[fh,fm]=e.fim.split(":").map(Number);for(let n=h*60+m;n<fh*60+fm;n+=15)ocupados.push(`${String(Math.floor(n/60)).padStart(2,"0")}:${String(n%60).padStart(2,"0")}`)}return {ocupados:[...new Set(ocupados)],ocupadosConsultorio:[],agendamentos:eventos};}
export async function buscarConfiguracaoAgendaApi():Promise<AgendaConfiguracaoApi>{const salvo=localStorage.getItem("soulsul.educacao.agenda.config");if(salvo)return JSON.parse(salvo);throw new Error("Configuração inicial");}
export async function salvarConfiguracaoAgendaApi(payload:AgendaConfiguracaoApi){localStorage.setItem("soulsul.educacao.agenda.config",JSON.stringify(payload));return payload;}
export async function buscarContextoPacienteAgenda(id:number,dataAgendamento?:string):Promise<AgendaPacienteContexto>{void dataAgendamento;const ficha=await buscarRecursoEducacaoApi<any>(`pacientes-modelo/${id}/ficha`);const guias=await listarGuiasEducacaoApi(id);return {id,nome:ficha.paciente.nome,prontuario:ficha.paciente.prontuario||"",celular:ficha.paciente.telefone||"",procedimentosContratados:(ficha.orcamentos||[]).filter((o:any)=>o.status==="APROVADO").flatMap((o:any)=>(o.itens||[]).map((x:any)=>({chave:`${o.id}-${x.id}`,contratoId:o.id,nome:x.procedimento||x.nome,sessoesTotal:1,sessoesRestantes:1,duracaoMinutos:45}))),guiasEmitidas:guias.map((g:GuiaEducacaoApi)=>({id:g.id,procedimentoNome:g.procedimento_nome_snapshot,retornoSolicitado:g.retorno_solicitado,documentoNome:g.documento_nome||`Guia ${g.id}`,elementoArcada:g.elemento_arcada,dataEmissao:g.criado_em,etapasResumo:(g.etapas||[]).map(e=>e.etapa).join(" | ")}))};}
export async function salvarAgendamentoAgenda(payload:AgendaSalvarPayload){return mapear(await criarRecursoEducacaoApi<RegistroAgendaEducacao>("agenda",await payloadBackend(payload)));}
export async function atualizarAgendamentoAgenda(id:number,payload:AgendaSalvarPayload){return mapear(await atualizarRecursoEducacaoApi<RegistroAgendaEducacao>("agenda",id,await payloadBackend(payload)));}
export async function atualizarSerieAgendamentoAgenda(id:number,payload:AgendaSalvarPayload){return [await atualizarAgendamentoAgenda(id,payload)];}
export async function buscarDetalhesAgendamentoAgenda(id:number):Promise<AgendaDetalheResponse>{const regs=await buscarRecursoEducacaoApi<RegistroAgendaEducacao[]>("agenda");const r=regs.find(x=>x.id===id);if(!r)throw new Error("Agendamento não encontrado.");return mapear(r);}
