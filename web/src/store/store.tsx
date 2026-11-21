import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { defaults, type FormatKind, type Product, type Format, type SiteData } from "./data";
import { fetchBackend } from "./backend";

const KEY = "nocturne.site.v1";
const CART = "nocturne.cart.v1";

function isObj(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}
function merge<T>(base: T, over: unknown): T {
  if (!isObj(base) || !isObj(over)) return (over === undefined ? base : (over as T)) as T;
  const out: Record<string, unknown> = { ...base };
  for (const k of Object.keys(over)) out[k] = k in base ? merge((base as Record<string, unknown>)[k], over[k]) : over[k];
  return out as T;
}

function load(): SiteData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(defaults, JSON.parse(raw));
  } catch {
    /* ignore */
  }
  return defaults;
}

/* ------------------------------ site data ------------------------------ */
interface Ctx {
  data: SiteData;
  update: (fn: (d: SiteData) => SiteData) => void;
  replaceAll: (d: SiteData) => void;
  reset: () => void;
}
const SiteCtx = createContext<Ctx>(null!);
export const useSite = () => useContext(SiteCtx);

const ACCENTS = {
  amber: { a: "#e0a24a", b: "#b5651d", c: "#f3d9a4" },
  copper: { a: "#e0703a", b: "#9c3f1a", c: "#f4b48a" },
  oxide: { a: "#b9a35a", b: "#6f7a45", c: "#e6dcae" },
};

/* ------------------------------ cart ------------------------------ */
export interface CartItem {
  productId: string;
  formatId: string;
  qty: number;
  price: number; // chosen unit price (pwyw aware)
}
interface CartCtx {
  items: CartItem[];
  add: (i: CartItem) => void;
  remove: (productId: string, formatId: string) => void;
  setQty: (productId: string, formatId: string, qty: number) => void;
  clear: () => void;
  open: boolean;
  setOpen: (b: boolean) => void;
}
const CartContext = createContext<CartCtx>(null!);
export const useCart = () => useContext(CartContext);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SiteData>(load);
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(CART) || "[]");
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  const persist = useCallback((d: SiteData) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(d));
    } catch (e) {
      console.warn("Storage full", e);
    }
  }, []);

  const update = useCallback(
    (fn: (d: SiteData) => SiteData) =>
      setData((prev) => {
        const next = fn(prev);
        persist(next);
        return next;
      }),
    [persist]
  );
  const replaceAll = useCallback(
    (d: SiteData) => {
      const m = merge(defaults, d);
      persist(m);
      setData(m);
    },
    [persist]
  );
  const reset = useCallback(() => {
    localStorage.removeItem(KEY);
    setData(defaults);
  }, []);

  // Visitors (no local admin draft) receive data from the site backend
  // (database reale via API Next) with the static ./site-data.json as
  // fallback when the API isn't reachable. See store/backend.ts.
  useEffect(() => {
    if (localStorage.getItem(KEY)) return;
    let alive = true;
    (async () => {
      try {
        const remote = await fetchBackend();
        if (!alive || localStorage.getItem(KEY)) return;
        if (remote && Object.keys(remote).length > 0) {
          setData((prev) => merge(prev, remote));
          return;
        }
      } catch {
        /* backend non raggiungibile → fallback statico qui sotto */
      }
      try {
        const r = await fetch("./site-data.json", { cache: "no-cache" });
        const j = r.ok ? await r.json() : null;
        if (alive && j && !localStorage.getItem(KEY)) setData((prev) => merge(prev, j));
      } catch {
        /* nessuna sorgente disponibile: restano i default demo */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // sync across tabs (admin in one tab, site in another)
  useEffect(() => {
    const h = (e: StorageEvent) => {
      if (e.key === KEY) setData(load());
      if (e.key === CART) setItems(JSON.parse(e.newValue || "[]"));
    };
    window.addEventListener("storage", h);
    return () => window.removeEventListener("storage", h);
  }, []);

  // accent theme + SEO
  useEffect(() => {
    const t = ACCENTS[data.settings.accent] || ACCENTS.amber;
    const r = document.documentElement.style;
    r.setProperty("--accent", t.a);
    r.setProperty("--accent-2", t.b);
    r.setProperty("--accent-3", t.c);
    document.title = data.settings.seoTitle;
    let m = document.querySelector('meta[name="description"]');
    if (!m) {
      m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
    }
    m.setAttribute("content", data.settings.seoDescription);
  }, [data.settings.accent, data.settings.seoTitle, data.settings.seoDescription]);

  useEffect(() => {
    localStorage.setItem(CART, JSON.stringify(items));
  }, [items]);

  const cart = useMemo<CartCtx>(
    () => ({
      items,
      open,
      setOpen,
      add: (i) =>
        setItems((p) => {
          const ex = p.find((x) => x.productId === i.productId && x.formatId === i.formatId);
          if (ex) return p.map((x) => (x === ex ? { ...x, qty: x.qty + i.qty, price: i.price } : x));
          return [...p, i];
        }),
      remove: (pid, fid) => setItems((p) => p.filter((x) => !(x.productId === pid && x.formatId === fid))),
      setQty: (pid, fid, qty) =>
        setItems((p) => p.map((x) => (x.productId === pid && x.formatId === fid ? { ...x, qty: Math.max(1, qty) } : x))),
      clear: () => setItems([]),
    }),
    [items, open]
  );

  const value = useMemo(() => ({ data, update, replaceAll, reset }), [data, update, replaceAll, reset]);
  return (
    <SiteCtx.Provider value={value}>
      <CartContext.Provider value={cart}>{children}</CartContext.Provider>
    </SiteCtx.Provider>
  );
}

/* ------------------------------ helpers ------------------------------ */
export const isPhysical = (k: FormatKind) => k === "cd" || k === "vinyl" || k === "cassette";
export const fmtMoney = (n: number, cur = "€") => `${cur}${n.toFixed(2).replace(".", ",")}`;
export const fmtTime = (s: number) => {
  if (!isFinite(s)) return "0:00";
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
};
export function findFormat(products: Product[], pid: string, fid: string): { p: Product; f: Format } | null {
  const p = products.find((x) => x.id === pid);
  // I formati disattivati dal pannello admin non sono acquistabili:
  // se il carrello li contiene (cambiamento dall'admin), non si risolvono.
  const f = p?.formats.find((x) => x.id === fid && x.enabled !== false);
  return p && f ? { p, f } : null;
}
export const formatIcon: Record<FormatKind, string> = {
  digital: "MP3",
  flac: "FLAC",
  cd: "CD",
  vinyl: "LP",
  cassette: "MC",
};
