import { useState } from "react";
import { Link } from "react-router-dom";
import { useSite } from "@/store/store";
import { Dashboard, HomeContent } from "./panels1";
import { OrdersPanel, ProductsPanel, TracksPanel } from "./panels2";
import { EventsPanel, GalleryPanel, MessagesPanel, SettingsPanel, SocialPanel } from "./panels3";
import { Btn, inputCls } from "./ui";

const TABS: { id: string; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "◐" },
  { id: "home", label: "Home & contenuti", icon: "✦" },
  { id: "tracks", label: "Brani", icon: "♪" },
  { id: "products", label: "Shop · prodotti", icon: "◍" },
  { id: "orders", label: "Ordini", icon: "▤" },
  { id: "gallery", label: "Gallery", icon: "▣" },
  { id: "events", label: "Eventi", icon: "◷" },
  { id: "social", label: "Social & API", icon: "◎" },
  { id: "messages", label: "Messaggi", icon: "✉" },
  { id: "settings", label: "Impostazioni", icon: "⚙" },
];

const KEY = "nocturne.admin.session";

function Login({ onOk }: { onOk: () => void }) {
  const { data } = useSite();
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div className="adm min-h-screen grid place-items-center bg-ink px-6" style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(181,101,29,.25), #0a0705 60%)" }}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (pw === data.settings.adminPassword) {
            sessionStorage.setItem(KEY, "1");
            onOk();
          } else setErr(true);
        }}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-ink-2/80 backdrop-blur p-8 space-y-6"
      >
        <div>
          <div className="text-[11px] uppercase tracking-[0.3em] text-amber">Area riservata</div>
          <h1 className="font-display italic text-4xl mt-2">{data.settings.artistName}</h1>
        </div>
        <input autoFocus type="password" value={pw} onChange={(e) => (setPw(e.target.value), setErr(false))} placeholder="Password" className={inputCls} />
        {err && <div className="text-sm text-red-300">Password non corretta.</div>}
        <div className="flex items-center justify-between">
          <Btn type="submit" tone="primary">
            Entra
          </Btn>
          <Link to="/" className="text-sm text-bone-dim hover:text-amber">
            ← al sito
          </Link>
        </div>
        <p className="text-xs text-bone-dim/60">Password iniziale: <code>taglieri2025</code> — cambiala subito da Impostazioni.</p>
      </form>
    </div>
  );
}

export default function Admin() {
  const { data } = useSite();
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(KEY) === "1");
  const [tab, setTab] = useState("dashboard");
  const [menu, setMenu] = useState(false);
  if (!authed) return <Login onOk={() => setAuthed(true)} />;

  const unread = data.messages.filter((m) => !m.read).length;
  const pending = data.orders.filter((o) => o.status === "nuovo").length;
  const badge: Record<string, number> = { messages: unread, orders: pending };
  const go = (t: string) => {
    setTab(t);
    setMenu(false);
    window.scrollTo(0, 0);
  };

  return (
    <div className="adm min-h-screen bg-[#0c0806] text-bone flex">
      <aside className={`fixed lg:sticky top-0 z-40 h-screen w-64 shrink-0 border-r border-white/10 bg-[#0c0806] p-5 flex flex-col transition-transform ${menu ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}>
        <div className="mb-8">
          <div className="text-[10px] uppercase tracking-[0.3em] text-amber">Pannello</div>
          <div className="font-display italic text-2xl leading-tight">{data.settings.artistName}</div>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => go(t.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-left transition ${tab === t.id ? "bg-amber/15 text-amber" : "text-bone-dim hover:bg-white/5 hover:text-bone"}`}>
              <span className="w-5 text-center">{t.icon}</span>
              <span className="flex-1">{t.label}</span>
              {!!badge[t.id] && <span className="text-[10px] bg-amber text-ink rounded-full px-1.5 py-0.5 font-bold">{badge[t.id]}</span>}
            </button>
          ))}
        </nav>
        <div className="pt-4 border-t border-white/10 space-y-2 text-sm">
          <Link to="/" target="_blank" className="block text-bone-dim hover:text-amber">
            Apri il sito ↗
          </Link>
          <button
            onClick={() => {
              sessionStorage.removeItem(KEY);
              setAuthed(false);
            }}
            className="text-bone-dim hover:text-red-300"
          >
            Esci
          </button>
        </div>
      </aside>
      {menu && <div className="fixed inset-0 z-30 bg-black/60 lg:hidden" onClick={() => setMenu(false)} />}

      <div className="flex-1 min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 px-5 md:px-10 py-4 border-b border-white/10 bg-[#0c0806]/90 backdrop-blur">
          <button className="lg:hidden rounded-lg border border-white/15 px-3 py-1.5 text-sm" onClick={() => setMenu(true)}>
            ☰ Menu
          </button>
          <div className="text-xs text-bone-dim flex items-center gap-2 ml-auto">
            <span className="w-2 h-2 rounded-full bg-emerald-400" /> Salvataggio automatico attivo
          </div>
        </header>
        <main className="p-5 md:p-10 max-w-5xl pb-32">
          {tab === "dashboard" && <Dashboard go={go} />}
          {tab === "home" && <HomeContent />}
          {tab === "tracks" && <TracksPanel />}
          {tab === "products" && <ProductsPanel />}
          {tab === "orders" && <OrdersPanel />}
          {tab === "gallery" && <GalleryPanel />}
          {tab === "events" && <EventsPanel />}
          {tab === "social" && <SocialPanel />}
          {tab === "messages" && <MessagesPanel />}
          {tab === "settings" && <SettingsPanel />}
        </main>
      </div>
    </div>
  );
}
