import { useEffect, useState } from "react";
import { nomeUsuarioCabecalho } from "./auth";
import "./whatsapp-conversations.css";

type Message = { id:number; direcao:string; tipoMensagem:string; conteudo:string; midiaUrl:string; statusEnvio:string; criadoEm:string };
type Conversation = { id:number; contatoNome:string; contatoTelefone:string; ultimaMensagem:string; ultimaMensagemEm:string; naoLidas:number; mensagens?:Message[] };

function apiBase() {
  const configured=String(import.meta.env.VITE_API_BASE_URL||"").trim();
  if(configured) return configured;
  return ["localhost","127.0.0.1"].includes(window.location.hostname)?`${window.location.protocol}//${window.location.hostname}:8001`:"https://soulsul-production.up.railway.app";
}
async function request<T>(path:string, init?:RequestInit):Promise<T>{
  const headers=new Headers(init?.headers); headers.set("Content-Type","application/json"); const user=nomeUsuarioCabecalho(); if(user) headers.set("x-usuario",user);
  const response=await fetch(`${apiBase()}${path}`,{...init,headers}); if(!response.ok){let detail="Falha na operação.";try{detail=(await response.json()).detail||detail}catch{}throw new Error(detail)} return response.json();
}

export function WhatsAppConversations(){
  const [items,setItems]=useState<Conversation[]>([]),[selected,setSelected]=useState<Conversation|null>(null),[search,setSearch]=useState(""),[reply,setReply]=useState(""),[error,setError]=useState(""),[sending,setSending]=useState(false);
  async function load(){try{setItems(await request(`/api/crm/conversas?canal=whatsapp&busca=${encodeURIComponent(search)}`));setError("")}catch(e){setError(e instanceof Error?e.message:"Falha ao carregar.")}}
  async function open(id:number){try{const detail=await request<Conversation>(`/api/crm/conversas/${id}`);setSelected(detail);setItems(old=>old.map(i=>i.id===id?{...i,naoLidas:0}:i))}catch(e){setError(e instanceof Error?e.message:"Falha ao abrir.")}}
  async function send(){if(!selected||!reply.trim())return;setSending(true);try{await request(`/api/crm/conversas/${selected.id}/mensagens`,{method:"POST",body:JSON.stringify({conteudo:reply.trim()})});setReply("");await open(selected.id);await load()}catch(e){setError(e instanceof Error?e.message:"Falha ao enviar.")}finally{setSending(false)}}
  useEffect(()=>{void load()},[]);
  return <section className="wa-panel">
    <div className="wa-toolbar"><div><span>WhatsApp</span><h2>Conversas</h2></div><div className="wa-search"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome, telefone ou mensagem"/><button onClick={()=>void load()}>Buscar</button></div></div>
    {error?<p className="wa-error">{error}</p>:null}
    <div className="wa-layout"><div className="wa-list">{items.map(item=><button key={item.id} className={selected?.id===item.id?"active":""} onClick={()=>void open(item.id)}><span><strong>{item.contatoNome||item.contatoTelefone||"Contato WhatsApp"}</strong><small>{item.ultimaMensagem||"Sem mensagens"}</small><small>{item.ultimaMensagemEm||item.contatoTelefone}</small></span>{item.naoLidas>0?<b>{item.naoLidas}</b>:null}</button>)}{!items.length?<p>Nenhuma conversa do WhatsApp.</p>:null}</div>
      <div className="wa-detail">{selected?<><header><strong>{selected.contatoNome||"Contato WhatsApp"}</strong><span>{selected.contatoTelefone}</span></header><div className="wa-history">{(selected.mensagens||[]).map(message=><article key={message.id} className={message.direcao==="saida"?"outgoing":"incoming"}><p>{message.conteudo||`[${message.tipoMensagem}]`}</p>{message.midiaUrl?<small>Anexo: {message.tipoMensagem}</small>:null}<small>{message.criadoEm}{message.direcao==="saida"?` · ${message.statusEnvio}`:""}</small></article>)}</div><form onSubmit={e=>{e.preventDefault();void send()}}><textarea rows={2} value={reply} onChange={e=>setReply(e.target.value)} placeholder="Digite uma resposta..."/><button disabled={sending||!reply.trim()}>{sending?"Enviando...":"Enviar"}</button></form></>:<p>Selecione uma conversa para ver o histórico.</p>}</div>
    </div>
  </section>;
}
