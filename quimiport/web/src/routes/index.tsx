import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Search,
  Bell,
  FileText,
  Lock,
  ScanSearch,
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  FileCheck2,
  Truck,
  Flag,
  Info,
  RefreshCw,
  ExternalLink,
  Ban,
  Minus,
  type LucideIcon,
} from "lucide-react";
import portHero from "@/assets/port-hero.jpg";
import {
  API_URL,
  ROTULO_DOCUMENTO,
  ROTULO_STATUS,
  api,
  type Carga,
  type Pendencia,
  type StatusCarga,
} from "@/lib/api";

export const Route = createFileRoute("/")({
  component: Dashboard,
});

// ------------------------------------------------------------------ estilos

const STATUS_BADGE: Record<StatusCarga, string> = {
  REGISTRADA: "bg-qp-blue-soft text-qp-blue",
  EM_ANALISE: "bg-qp-amber-soft text-qp-amber",
  EM_INSPECAO: "bg-qp-purple-soft text-qp-purple",
  LIBERADA: "bg-qp-green-soft text-qp-green",
  BLOQUEADA: "bg-qp-red-soft text-qp-red",
  EM_MOVIMENTACAO: "bg-accent text-foreground",
  FINALIZADA: "bg-accent text-muted-foreground",
  CANCELADA: "bg-secondary text-muted-foreground line-through",
};

const STATUS_ICONE: Record<StatusCarga, LucideIcon> = {
  REGISTRADA: FileText,
  EM_ANALISE: FileCheck2,
  EM_INSPECAO: ScanSearch,
  LIBERADA: ShieldCheck,
  BLOQUEADA: Lock,
  EM_MOVIMENTACAO: Truck,
  FINALIZADA: Flag,
  CANCELADA: Ban,
};

const FLUXO_PRINCIPAL: { status: StatusCarga; tone: string }[] = [
  { status: "REGISTRADA", tone: "bg-qp-blue-soft text-qp-blue" },
  { status: "EM_ANALISE", tone: "bg-qp-amber-soft text-qp-amber" },
  { status: "EM_INSPECAO", tone: "bg-qp-purple-soft text-qp-purple" },
  { status: "LIBERADA", tone: "bg-qp-green-soft text-qp-green" },
  { status: "EM_MOVIMENTACAO", tone: "bg-accent text-muted-foreground" },
  { status: "FINALIZADA", tone: "bg-accent text-muted-foreground" },
];

const ENCERRADAS: StatusCarga[] = ["FINALIZADA", "CANCELADA"];

/** Nível de risco derivado da classe ONU do produto. */
function nivelRisco(classe?: string): "green" | "amber" | "orange" | "red" {
  if (!classe) return "green";
  if (
    classe.startsWith("1") ||
    classe === "2.3" ||
    classe === "6.1" ||
    classe === "6.2" ||
    classe === "7"
  )
    return "red";
  if (classe === "8" || classe.startsWith("5")) return "orange";
  if (classe === "3" || classe.startsWith("4") || classe === "2.1") return "amber";
  return "green";
}

const DIAMANTE: Record<ReturnType<typeof nivelRisco>, string> = {
  red: "bg-qp-red text-white",
  orange: "bg-orange-500 text-white",
  amber: "bg-qp-amber text-white",
  green: "bg-qp-green text-white",
};

const hora = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const dataHora = (iso: string) => {
  const d = new Date(iso);
  const hoje = new Date();
  const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia
    ? `Hoje, ${hora(iso)}`
    : d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const saudacao = () => {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
};

// ---------------------------------------------------------------- página

function Dashboard() {
  const queryClient = useQueryClient();
  const [busca, setBusca] = useState("");

  const resumo = useQuery({ queryKey: ["resumo"], queryFn: api.resumo, refetchInterval: 30_000 });
  const cargas = useQuery({ queryKey: ["cargas"], queryFn: api.cargas, refetchInterval: 30_000 });

  const alterarStatus = useMutation({
    mutationFn: ({ id, status, motivo }: { id: string; status: StatusCarga; motivo?: string }) =>
      api.alterarStatus(id, status, motivo),
    onSuccess: (carga) => {
      toast.success(`Carga ${carga.codigo} agora está ${carga.statusDescricao.toLowerCase()}.`);
      queryClient.invalidateQueries();
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const porStatus = resumo.data?.cargasPorStatus;
  const pendencias = resumo.data?.pendenciasDocumentacao ?? [];

  const ativas = useMemo(
    () => (cargas.data ?? []).filter((c) => !ENCERRADAS.includes(c.status)),
    [cargas.data],
  );

  const conformidade = useMemo(() => {
    if (!ativas.length) return null;
    const completas = ativas.filter((c) => c.documentacaoCompleta).length;
    return { pct: (completas / ativas.length) * 100, completas, total: ativas.length };
  }, [ativas]);

  const atencao = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return ativas
      .filter(
        (c) =>
          !termo ||
          [c.codigo, c.produto?.nome ?? "", c.destino, c.responsavelTecnico.nome].some((v) =>
            v.toLowerCase().includes(termo),
          ),
      )
      .sort((a, b) => Number(a.documentacaoCompleta) - Number(b.documentacaoCompleta));
  }, [ativas, busca]);

  const offline = resumo.isError || cargas.isError;

  const stats: {
    icon: LucideIcon;
    value: number | string;
    label: string;
    sub: string;
    tone: string;
  }[] = [
    {
      icon: FileCheck2,
      value: porStatus?.EM_ANALISE ?? "–",
      label: "Em análise",
      sub: "aguardando inspeção",
      tone: "bg-qp-amber-soft text-qp-amber",
    },
    {
      icon: Lock,
      value: porStatus?.BLOQUEADA ?? "–",
      label: "Bloqueadas",
      sub: "não podem movimentar",
      tone: "bg-qp-red-soft text-qp-red",
    },
    {
      icon: ScanSearch,
      value: porStatus?.EM_INSPECAO ?? "–",
      label: "Em inspeção",
      sub: "verificação técnica",
      tone: "bg-qp-blue-soft text-qp-blue",
    },
    {
      icon: ShieldCheck,
      value: porStatus?.LIBERADA ?? "–",
      label: "Liberadas",
      sub: "prontas p/ movimentação",
      tone: "bg-qp-green-soft text-qp-green",
    },
    {
      icon: AlertTriangle,
      value: resumo.data ? pendencias.length : "–",
      label: "Pendências documentais",
      sub: "impedem a liberação",
      tone: "border border-qp-red/60 text-qp-red",
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground font-sans">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center gap-6 px-6">
          <div className="flex items-center gap-2">
            <div className="grid h-8 w-8 place-items-center rounded-md bg-qp-navy">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                className="text-qp-green"
              >
                <path d="M12 2 3 7v10l9 5 9-5V7z" />
                <path d="M12 12 3 7" />
                <path d="m12 12 9-5" />
                <path d="M12 12v10" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight text-foreground">QuimiPort</span>
          </div>

          <nav className="hidden flex-1 justify-center lg:flex">
            <ul className="flex items-center gap-1">
              <li>
                <span className="relative px-3 py-2 text-sm font-medium text-qp-navy">
                  Visão geral
                  <span className="absolute -bottom-[17px] left-2 right-2 h-[2px] rounded-full bg-qp-green" />
                </span>
              </li>
              <li>
                <a
                  href={`${API_URL}/docs`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  API (Swagger) <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
              <li>
                <a
                  href={`${API_URL}/meta/status-carga`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Regras de status <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </li>
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="relative hidden md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar carga, produto, destino..."
                className="h-10 w-80 rounded-full border border-border bg-secondary/60 pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-qp-green focus:outline-none focus:ring-2 focus:ring-qp-green/20"
              />
            </div>

            <button
              onClick={() => queryClient.invalidateQueries()}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-qp-green px-4 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
            >
              <RefreshCw className={`h-4 w-4 ${resumo.isFetching ? "animate-spin" : ""}`} />
              Atualizar
            </button>

            <div
              className="relative grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground"
              title="Pendências documentais"
            >
              <Bell className="h-5 w-5" />
              {pendencias.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-items-center rounded-full bg-qp-red px-1 text-[10px] font-bold text-white">
                  {pendencias.length}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-6 py-6">
        {offline && (
          <div className="rounded-xl border border-qp-red/40 bg-qp-red-soft px-4 py-3 text-sm text-qp-red">
            Não foi possível conectar à API em <strong>{API_URL}</strong>. Verifique se ela está no
            ar (<code>docker compose up</code>) e se <code>VITE_API_URL</code> aponta para o
            endereço certo.
          </div>
        )}

        {/* Linha 1: banner + conformidade */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <section className="relative overflow-hidden rounded-2xl bg-qp-navy text-qp-navy-foreground">
            <img
              src={portHero}
              alt=""
              width={1600}
              height={600}
              className="absolute inset-0 h-full w-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-qp-navy via-qp-navy/85 to-qp-navy/40" />
            <div className="relative p-8">
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-xl">
                  <h1 className="text-3xl font-bold tracking-tight">
                    {saudacao()}, equipe de operações!
                  </h1>
                  <div className="mt-3 flex items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium">
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${offline ? "bg-qp-red" : "bg-qp-green"}`}
                      />
                      {offline ? "API indisponível" : "Dados em tempo real"}
                    </span>
                    {resumo.data && (
                      <span className="text-white/70">
                        Atualizado às {hora(resumo.data.geradoEm)}
                      </span>
                    )}
                  </div>
                  <p className="mt-4 max-w-md text-sm text-white/70">
                    {resumo.data
                      ? `${resumo.data.totalCargas} cargas registradas e ${resumo.data.totalProdutosAtivos} produtos químicos ativos no porto.`
                      : "Carregando panorama operacional..."}
                  </p>
                </div>
                <a
                  href={`${API_URL}/docs#/Cargas%20qu%C3%ADmicas/post_cargas_quimicas`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-qp-green px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-qp-green/30 transition hover:opacity-95"
                >
                  <ExternalLink className="h-4 w-4" />
                  Registrar carga pela API
                </a>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-start gap-3">
                    <div
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${s.tone}`}
                    >
                      <s.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-2xl font-bold leading-none">{s.value}</div>
                      <div className="mt-1 text-xs font-medium text-white/85">{s.label}</div>
                      <div className="mt-0.5 text-[11px] text-white/55">{s.sub}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Conformidade documental</h2>
              <span title="Percentual de cargas em andamento com toda a documentação obrigatória válida.">
                <Info className="h-4 w-4 text-muted-foreground" />
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-3">
              <div
                className={`text-5xl font-bold ${conformidade && conformidade.pct >= 90 ? "text-qp-green" : "text-qp-amber"}`}
              >
                {conformidade ? `${conformidade.pct.toFixed(1).replace(".", ",")}%` : "–"}
              </div>
              <div className="flex flex-col text-xs">
                <span className="font-semibold text-foreground">
                  {conformidade
                    ? `${conformidade.completas} de ${conformidade.total}`
                    : "sem cargas ativas"}
                </span>
                <span className="text-muted-foreground">cargas em andamento</span>
              </div>
            </div>

            <div className="mt-5">
              <div className="relative h-2 rounded-full bg-secondary">
                <div
                  className="absolute inset-y-0 left-0 rounded-full bg-qp-green"
                  style={{ width: `${conformidade?.pct ?? 0}%` }}
                />
                <div
                  className="absolute -top-1 h-4 w-[2px] bg-qp-navy/40"
                  style={{ left: "90%" }}
                />
              </div>
              <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
                <span>0%</span>
                <span>Meta: 90%</span>
                <span>100%</span>
              </div>
            </div>

            <div className="mt-4 rounded-xl bg-qp-green-soft p-3 text-xs leading-relaxed text-foreground/80">
              <span className="font-semibold text-foreground">Regra aplicada pela API:</span>{" "}
              nenhuma carga é liberada sem documentação obrigatória completa e dentro da validade.
            </div>
          </section>
        </div>

        {/* Linha 2: fluxo + linha do tempo */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,480px)]">
          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Fluxo de status das cargas</h2>
            <ol className="mt-6 flex items-start gap-2 overflow-x-auto">
              {FLUXO_PRINCIPAL.map(({ status, tone }, i) => {
                const Icone = STATUS_ICONE[status];
                return (
                  <li key={status} className="flex min-w-0 flex-1 items-start gap-2">
                    <div className="flex min-w-[100px] flex-col items-start gap-2 text-left">
                      <div className={`grid h-11 w-11 place-items-center rounded-full ${tone}`}>
                        <Icone className="h-5 w-5" />
                      </div>
                      <div className="text-[11px] font-medium leading-tight text-muted-foreground">
                        {ROTULO_STATUS[status]}
                      </div>
                      <div className="text-xl font-bold text-foreground">
                        {porStatus?.[status] ?? "–"}
                      </div>
                    </div>
                    {i < FLUXO_PRINCIPAL.length - 1 && (
                      <ArrowRight className="mt-3 h-4 w-4 shrink-0 text-muted-foreground/40" />
                    )}
                  </li>
                );
              })}
            </ol>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4 text-xs">
              <span className="text-muted-foreground">Fora do fluxo principal:</span>
              <span className="rounded-full bg-qp-red-soft px-2.5 py-1 font-semibold text-qp-red">
                Bloqueadas: {porStatus?.BLOQUEADA ?? "–"}
              </span>
              <span className="rounded-full bg-secondary px-2.5 py-1 font-semibold text-muted-foreground">
                Canceladas: {porStatus?.CANCELADA ?? "–"}
              </span>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">Linha do tempo operacional</h2>
            <ol className="mt-4 space-y-3">
              {(resumo.data?.ultimasMovimentacoes ?? []).slice(0, 6).map((m) => {
                const Icone = STATUS_ICONE[m.statusNovo];
                return (
                  <li key={m.id} className="flex items-center gap-3">
                    <div className="w-10 text-xs font-medium text-muted-foreground">
                      {hora(m.ocorridoEm)}
                    </div>
                    <div
                      className={`grid h-8 w-8 place-items-center rounded-full ${STATUS_BADGE[m.statusNovo]}`}
                    >
                      <Icone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-semibold text-foreground">
                        {m.statusAnterior
                          ? `${ROTULO_STATUS[m.statusAnterior]} → ${ROTULO_STATUS[m.statusNovo]}`
                          : "Carga registrada"}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {m.codigoCarga} · {m.produtoNome}
                        {m.motivo ? ` · ${m.motivo}` : ""}
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[m.statusNovo]}`}
                    >
                      {ROTULO_STATUS[m.statusNovo]}
                    </span>
                  </li>
                );
              })}
              {resumo.data && resumo.data.ultimasMovimentacoes.length === 0 && (
                <li className="text-sm text-muted-foreground">
                  Nenhuma movimentação registrada ainda.
                </li>
              )}
            </ol>
          </section>
        </div>

        {/* Linha 3: mapa de risco + pendências */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground">Mapa de risco por área</h2>
              <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                <LegendDot color="bg-qp-green" label="Baixo" />
                <LegendDot color="bg-qp-amber" label="Moderado" />
                <LegendDot color="bg-orange-500" label="Alto" />
                <LegendDot color="bg-qp-red" label="Crítico" />
                <span className="flex items-center gap-1.5">
                  <span className="grid h-3 w-3 place-items-center rounded-full bg-qp-red text-[8px] font-bold text-white">
                    !
                  </span>
                  Pendência documental
                </span>
              </div>
            </div>
            <RiskMap cargas={ativas} />
          </section>

          <section className="rounded-2xl border border-border bg-card p-6">
            <h2 className="text-base font-semibold text-foreground">
              Central de pendências documentais
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="pb-3 pr-3 font-medium">Carga</th>
                    <th className="pb-3 pr-3 font-medium">Pendência</th>
                    <th className="pb-3 pr-3 font-medium">Prioridade</th>
                    <th className="pb-3 pr-3 font-medium">Status</th>
                    <th className="pb-3 pr-3 font-medium">Responsável</th>
                  </tr>
                </thead>
                <tbody className="text-foreground">
                  {pendencias.map((p) => {
                    const prioridade = prioridadeDe(p);
                    return (
                      <tr key={p.cargaId} className="border-t border-border">
                        <td className="py-3 pr-3">
                          <div className="whitespace-nowrap font-medium">{p.codigoCarga}</div>
                          <div className="text-xs text-muted-foreground">{p.produtoNome}</div>
                        </td>
                        <td className="py-3 pr-3">
                          {p.tiposPendentes.map((t) => ROTULO_DOCUMENTO[t] ?? t).join(", ")}
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${prioridade.classe}`}
                          >
                            {prioridade.rotulo}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <span
                            className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE[p.status]}`}
                          >
                            {ROTULO_STATUS[p.status]}
                          </span>
                        </td>
                        <td className="py-3 pr-3 text-muted-foreground">{p.responsavelTecnico}</td>
                      </tr>
                    );
                  })}
                  {resumo.data && pendencias.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                        Nenhuma pendência documental. 🎉
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Linha 4: cargas em andamento */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-foreground">Cargas em andamento</h2>
              <span className="grid h-5 min-w-[20px] place-items-center rounded-full bg-secondary px-1.5 text-[11px] font-semibold text-muted-foreground">
                {atencao.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              As ações respeitam a máquina de estados da API — transições proibidas são recusadas.
            </p>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="pb-3 pr-4 font-medium">Carga</th>
                  <th className="pb-3 pr-4 font-medium">Produto químico</th>
                  <th className="pb-3 pr-4 font-medium">Classe de risco</th>
                  <th className="pb-3 pr-4 font-medium">Destino</th>
                  <th className="pb-3 pr-4 font-medium">Responsável técnico</th>
                  <th className="pb-3 pr-4 font-medium">Documentação</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                  <th className="pb-3 pr-4 font-medium">Atualização</th>
                  <th className="pb-3 font-medium">Próximo passo</th>
                </tr>
              </thead>
              <tbody className="text-foreground">
                {atencao.map((c) => (
                  <LinhaCarga
                    key={c.id}
                    carga={c}
                    ocupado={alterarStatus.isPending && alterarStatus.variables?.id === c.id}
                    onAlterar={(status) => {
                      let motivo: string | undefined;
                      if (status === "BLOQUEADA" || status === "CANCELADA") {
                        motivo =
                          window.prompt(
                            `Motivo para ${status === "BLOQUEADA" ? "bloquear" : "cancelar"} a carga ${c.codigo}:`,
                          ) ?? undefined;
                        if (motivo === undefined) return;
                      }
                      alterarStatus.mutate({ id: c.id, status, motivo });
                    }}
                  />
                ))}
                {cargas.data && atencao.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-6 text-center text-sm text-muted-foreground">
                      Nenhuma carga em andamento{busca ? " para essa busca" : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function prioridadeDe(p: Pendencia) {
  if (p.documentosTotal === 0 || p.status === "EM_INSPECAO")
    return { rotulo: "Alta", classe: "bg-qp-red-soft text-qp-red" };
  if (p.status === "EM_ANALISE")
    return { rotulo: "Média", classe: "bg-qp-amber-soft text-qp-amber" };
  return { rotulo: "Baixa", classe: "bg-qp-blue-soft text-qp-blue" };
}

function LinhaCarga({
  carga: c,
  ocupado,
  onAlterar,
}: {
  carga: Carga;
  ocupado: boolean;
  onAlterar: (status: StatusCarga) => void;
}) {
  const validos = c.documentos.filter((d) => d.valido).length;
  const total = c.documentos.length;
  const pct = total ? (validos / total) * 100 : 0;
  const ok = c.documentacaoCompleta;
  const risco = nivelRisco(c.produto?.classeRisco);

  return (
    <tr className="border-t border-border">
      <td className="whitespace-nowrap py-4 pr-4 font-medium">{c.codigo}</td>
      <td className="py-4 pr-4">{c.produto?.nome ?? "—"}</td>
      <td className="py-4 pr-4">
        <div className="flex items-center gap-2">
          <Diamond className={DIAMANTE[risco]} label={c.produto?.classeRisco ?? "–"} />
          <span className="text-muted-foreground">{c.produto?.numeroOnu}</span>
        </div>
      </td>
      <td className="whitespace-nowrap py-4 pr-4 text-muted-foreground">{c.destino}</td>
      <td className="py-4 pr-4 text-muted-foreground">{c.responsavelTecnico.nome}</td>
      <td className="py-4 pr-4">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 text-xs font-semibold ${ok ? "text-qp-green" : "text-qp-red"}`}
          >
            <span
              className={`grid h-4 w-4 place-items-center rounded-full ${ok ? "bg-qp-green-soft" : "bg-qp-red-soft"}`}
            >
              {ok ? "✓" : "!"}
            </span>
            {validos}/{total}
          </span>
          <div className="relative h-1.5 w-24 overflow-hidden rounded-full bg-secondary">
            <div
              className={`absolute inset-y-0 left-0 ${ok ? "bg-qp-green" : "bg-qp-red"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </td>
      <td className="py-4 pr-4">
        <span
          className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ${STATUS_BADGE[c.status]}`}
        >
          {c.statusDescricao}
        </span>
      </td>
      <td className="py-4 pr-4 text-muted-foreground">{dataHora(c.updatedAt)}</td>
      <td className="py-4">
        <select
          aria-label={`Alterar status da carga ${c.codigo}`}
          disabled={ocupado || c.transicoesPermitidas.length === 0}
          value=""
          onChange={(e) => e.target.value && onAlterar(e.target.value as StatusCarga)}
          className="h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-50"
        >
          <option value="">{ocupado ? "Salvando..." : "Mover para..."}</option>
          {c.transicoesPermitidas.map((s) => (
            <option key={s} value={s}>
              {ROTULO_STATUS[s]}
            </option>
          ))}
        </select>
      </td>
    </tr>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-3 w-3 rounded-sm ${color}`} />
      {label}
    </span>
  );
}

function Diamond({ className, label }: { className: string; label: string }) {
  return (
    <span className={`grid h-7 w-7 rotate-45 place-items-center rounded-md ${className}`}>
      <span className="-rotate-45 text-[10px] font-bold">
        {label === "–" ? <Minus className="h-3 w-3" /> : label}
      </span>
    </span>
  );
}

// ------------------------------------------------------------ mapa de risco

const AREAS: {
  prefixo: string;
  label: string;
  variant: "tanks" | "crates" | "warehouse";
  spanCol?: boolean;
}[] = [
  { prefixo: "tanques a", label: "Tanques A", variant: "tanks" },
  { prefixo: "tanques b", label: "Tanques B", variant: "tanks" },
  { prefixo: "pátio 1", label: "Pátio 1", variant: "crates" },
  { prefixo: "armazém 1", label: "Armazém 1", variant: "warehouse" },
  { prefixo: "pátio 2", label: "Pátio 2", variant: "crates" },
  { prefixo: "tanques c", label: "Tanques C", variant: "tanks", spanCol: true },
  { prefixo: "armazém 2", label: "Armazém 2", variant: "warehouse" },
];

const ORDEM_RISCO = ["green", "amber", "orange", "red"] as const;
const ROTULO_RISCO = {
  green: "Baixo risco",
  amber: "Moderado",
  orange: "Alto risco",
  red: "Crítico",
} as const;

function RiskMap({ cargas }: { cargas: Carga[] }) {
  return (
    <div className="mt-4 grid grid-cols-[80px_1fr] gap-3">
      <div className="relative rounded-xl bg-qp-blue-soft/40 p-2">
        <svg viewBox="0 0 60 220" className="h-full w-full text-qp-blue">
          <rect x="10" y="10" width="40" height="200" rx="8" fill="currentColor" opacity="0.15" />
          <rect x="18" y="30" width="24" height="10" rx="2" fill="currentColor" opacity="0.5" />
          <rect x="18" y="50" width="24" height="10" rx="2" fill="currentColor" opacity="0.5" />
          <rect x="18" y="70" width="24" height="10" rx="2" fill="currentColor" opacity="0.5" />
          <rect x="18" y="90" width="24" height="10" rx="2" fill="currentColor" opacity="0.5" />
          <path d="M8 210 Q30 195 52 210 L52 218 L8 218 Z" fill="currentColor" opacity="0.6" />
        </svg>
      </div>

      <div className="grid grid-cols-4 grid-rows-2 gap-3">
        {AREAS.map((area) => {
          const naArea = cargas.filter((c) => c.destino.toLowerCase().startsWith(area.prefixo));
          const tone = naArea.reduce<(typeof ORDEM_RISCO)[number]>((max, c) => {
            const r = nivelRisco(c.produto?.classeRisco);
            return ORDEM_RISCO.indexOf(r) > ORDEM_RISCO.indexOf(max) ? r : max;
          }, "green");
          return (
            <RiskCell
              key={area.label}
              label={area.label}
              sub={
                naArea.length
                  ? `${ROTULO_RISCO[tone]} · ${naArea.length} carga${naArea.length > 1 ? "s" : ""}`
                  : "Livre"
              }
              tone={tone}
              variant={area.variant}
              alert={naArea.some((c) => !c.documentacaoCompleta)}
              spanCol={area.spanCol}
            />
          );
        })}
      </div>
    </div>
  );
}

function RiskCell({
  label,
  sub,
  tone,
  variant,
  alert,
  spanCol,
}: {
  label: string;
  sub: string;
  tone: "green" | "amber" | "orange" | "red";
  variant: "tanks" | "crates" | "warehouse";
  alert?: boolean;
  spanCol?: boolean;
}) {
  const toneMap = {
    green: "border-qp-green/50 bg-qp-green-soft/50",
    amber: "border-qp-amber/60 bg-qp-amber-soft/60",
    orange: "border-orange-400/60 bg-orange-50",
    red: "border-qp-red/60 bg-qp-red-soft/60",
  } as const;
  const iconTint = {
    green: "text-qp-green",
    amber: "text-qp-amber",
    orange: "text-orange-500",
    red: "text-qp-red",
  }[tone];

  return (
    <div
      className={`relative rounded-xl border border-dashed p-3 ${toneMap[tone]} ${spanCol ? "col-span-2" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-foreground">{label}</div>
          <div className="text-[10px] text-muted-foreground">{sub}</div>
        </div>
        {alert && (
          <span className="grid h-4 w-4 place-items-center rounded-full bg-qp-red text-[9px] font-bold text-white">
            !
          </span>
        )}
      </div>
      <div className={`mt-2 flex h-10 items-end justify-around gap-1 ${iconTint}`}>
        {variant === "tanks" &&
          Array.from({ length: 3 }).map((_, i) => (
            <span key={i} className="h-8 w-4 rounded-full border-2 border-current opacity-70" />
          ))}
        {variant === "crates" &&
          Array.from({ length: spanCol ? 5 : 3 }).map((_, i) => (
            <span key={i} className="h-6 w-6 rounded-sm border-2 border-current opacity-70" />
          ))}
        {variant === "warehouse" && (
          <span className="h-8 w-full rounded-sm border-2 border-current opacity-70" />
        )}
      </div>
    </div>
  );
}
