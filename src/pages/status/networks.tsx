import { CheckCircle2, Globe, MinusCircle, ExternalLink, Droplets, AlertTriangle } from "lucide-react";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { NetworkSelector } from "@/components/NetworkSelector";
import { Badge } from "@/components/ui/badge";
import { useNetworkState } from "@/hooks/useNetworkState";
import {
  SUPPORT_FEATURES,
  NETWORK_SUPPORT_MATRIX,
  supportLevelLabel,
  summarizeNetworkSupport,
  type NetworkSupportEntry,
  type SupportLevel,
} from "@/lib/stellar/networkSupport";
import {
  getAppNetworkId,
  getNetworkDescriptor,
} from "@/lib/stellar/networks";

function levelClasses(level: SupportLevel): string {
  if (level === "supported") {
    return "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  }
  if (level === "beta") {
    return "border-amber-300/30 bg-amber-300/10 text-amber-100";
  }
  return "border-slate-500/30 bg-slate-500/10 text-slate-300";
}

function LevelIcon({ level }: { level: SupportLevel }) {
  if (level === "supported") {
    return <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden="true" />;
  }
  if (level === "beta") {
    return <AlertTriangle className="h-4 w-4 text-amber-400" aria-hidden="true" />;
  }
  return <MinusCircle className="h-4 w-4 text-slate-500" aria-hidden="true" />;
}

function SupportCard({ entry, isActive }: { entry: NetworkSupportEntry; isActive: boolean }) {
  const descriptor = getNetworkDescriptor(entry.networkId);

  return (
    <section
      data-testid={`network-support-${entry.networkId}`}
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
    >
      <div className="flex flex-wrap items-center gap-3">
        <Globe className="h-5 w-5 text-cyan-200" aria-hidden="true" />
        <h3 className="text-base font-semibold text-white">{entry.label}</h3>
        {isActive && (
          <Badge className="border-cyan-300/30 bg-cyan-300/10 text-cyan-100">
            Active build
          </Badge>
        )}
        <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
          <a
            href={descriptor.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            Explorer <ExternalLink className="h-3 w-3" />
          </a>
          {descriptor.faucetUrl && (
            <a
              href={descriptor.faucetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 hover:text-white"
            >
              <Droplets className="h-3 w-3" /> Faucet
            </a>
          )}
        </div>
      </div>

      <p className="mt-2 text-sm text-slate-400">{entry.notes}</p>

      <dl className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {SUPPORT_FEATURES.map((feature) => {
          const level = entry[feature.key];
          return (
            <div
              key={feature.key}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2"
            >
              <LevelIcon level={level} />
              <div className="min-w-0 flex-1">
                <dt className="text-sm text-white">{feature.label}</dt>
                <dd className="text-xs text-slate-500">{feature.description}</dd>
              </div>
              <Badge className={levelClasses(level)}>{supportLevelLabel(level)}</Badge>
            </div>
          );
        })}
      </dl>

      <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
        <span className="truncate">RPC: {descriptor.rpcUrl}</span>
        <span className="truncate">Horizon: {descriptor.horizonUrl}</span>
      </div>
    </section>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4">
      <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}

/**
 * Multi-network support status page (#695).
 *
 * Surfaces which Stellar networks this build supports and to what degree,
 * alongside a live connection indicator and the shared footer network
 * selector.
 */
export default function MultiNetworkStatusPage() {
  const activeNetwork = getAppNetworkId();
  const summary = summarizeNetworkSupport();
  const networkState = useNetworkState();
  const activeDescriptor = getNetworkDescriptor(activeNetwork);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_60%_40%_at_0%_0%,rgba(34,211,238,0.08),transparent),linear-gradient(180deg,#080b0f_0%,#0d1117_50%,#080b0f_100%)] text-white">
      <Navigation />
      <main
        data-testid="multi-network-status-page"
        className="mx-auto max-w-4xl px-4 py-10 sm:px-6"
      >
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-200/10 text-cyan-100">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-white">Multi-network support</h1>
            <p className="text-xs text-slate-400">
              Which Stellar networks PromptHash supports, and how.
            </p>
          </div>
        </div>

        <div
          data-testid="active-network-summary"
          className="mt-6 flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 sm:flex-row sm:items-center"
        >
          <div className="flex-1">
            <p className="text-sm text-slate-300">
              This build is configured for{" "}
              <span className="font-semibold text-white">{activeDescriptor.label}</span>.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Connection:{" "}
              {networkState.isDown
                ? "unavailable"
                : networkState.isDegraded
                  ? "degraded"
                  : "healthy"}
            </p>
          </div>
          <NetworkSelector />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Fully supported" value={summary.fullySupported} tone="text-emerald-300" />
          <StatCard label="Partial / beta" value={summary.partial} tone="text-amber-300" />
          <StatCard label="Unsupported" value={summary.unsupported} tone="text-slate-300" />
        </div>

        <div className="mt-8 space-y-4">
          {NETWORK_SUPPORT_MATRIX.map((entry) => (
            <SupportCard
              key={entry.networkId}
              entry={entry}
              isActive={entry.networkId === activeNetwork}
            />
          ))}
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Support levels describe this app build, not the Stellar network itself.
          Switch networks from the footer or the selector above; changes apply on
          your next session.
        </p>
      </main>
      <Footer />
    </div>
  );
}
