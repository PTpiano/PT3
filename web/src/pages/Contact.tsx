import { useEffect, useState } from "react";
import { setMood, Reveal, Parallax } from "@/motion";
import { useSite } from "@/store/store";
import { uid } from "@/store/data";
import { Img, PageHero, Btn, fmtDate } from "@/components/ui";

const TOPICS = ["Concerto / Booking", "Collaborazione", "Colonna sonora / Progetto", "Lezioni / Masterclass", "Stampa", "Altro"];

export default function Contact() {
  const { data, update } = useSite();
  const s = data.settings;
  const [f, setF] = useState({ name: "", email: "", topic: TOPICS[0], eventDate: "", body: "", hp: "" });
  const [state, setState] = useState<"idle" | "sending" | "ok" | "err">("idle");
  useEffect(() => setMood("amber"), []);
  const today = new Date().toISOString().slice(0, 10);
  const events = data.events.filter((e) => e.published && e.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.hp) return; // honeypot
    setState("sending");
    update((d) => ({ ...d, messages: [{ id: uid("m"), date: new Date().toISOString(), name: f.name, email: f.email, topic: f.topic, eventDate: f.eventDate, body: f.body, read: false }, ...d.messages] }));
    if (s.formEndpoint) {
      try {
        const r = await fetch(s.formEndpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify({ name: f.name, email: f.email, topic: f.topic, eventDate: f.eventDate, message: f.body }) });
        if (!r.ok) throw new Error();
      } catch {
        setState("err");
        return;
      }
    }
    setState("ok");
  };
  const mailto = `mailto:${s.bookingEmail}?subject=${encodeURIComponent(f.topic + " — " + f.name)}&body=${encodeURIComponent(f.body)}`;

  return (
    <>
      <PageHero kicker="Contatti" title={"Resta ancora\nun brano"} sub="Per un concerto, una collaborazione, una colonna sonora o per parlare di musica: scrivimi. Rispondo di notte, di solito." />
      <section className="relative px-6 md:px-14 pb-32 grid lg:grid-cols-12 gap-16">
        <div className="lg:col-span-7">
          {state === "ok" ? (
            <Reveal y={30}>
              <div className="rounded-3xl border border-amber/40 bg-amber/5 p-10 md:p-14">
                <div className="label mb-4">Messaggio ricevuto</div>
                <div className="font-display text-4xl md:text-5xl leading-tight">Grazie, {f.name.split(" ")[0]}. Ti rispondo presto.</div>
                <p className="text-bone-dim mt-5">Una copia è arrivata nell'archivio del pannello admin{s.formEndpoint ? " e alla casella di posta collegata" : ""}.</p>
                <div className="mt-8">
                  <Btn onClick={() => (setState("idle"), setF({ name: "", email: "", topic: TOPICS[0], eventDate: "", body: "", hp: "" }))}>Scrivi un altro messaggio</Btn>
                </div>
              </div>
            </Reveal>
          ) : (
            <form onSubmit={submit} className="space-y-10">
              <div className="grid md:grid-cols-2 gap-10">
                <label className="block">
                  <span className="label !text-[0.58rem]">Nome</span>
                  <input required className="field" placeholder="Come ti chiami" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" />
                </label>
                <label className="block">
                  <span className="label !text-[0.58rem]">Email</span>
                  <input required type="email" className="field" placeholder="la tua@email.it" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" />
                </label>
              </div>
              <div className="grid md:grid-cols-2 gap-10">
                <label className="block">
                  <span className="label !text-[0.58rem]">Motivo</span>
                  <select className="field" value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })}>
                    {TOPICS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="label !text-[0.58rem]">Data (se serve)</span>
                  <input type="date" className="field" value={f.eventDate} onChange={(e) => setF({ ...f, eventDate: e.target.value })} style={{ colorScheme: "dark" }} />
                </label>
              </div>
              <label className="block">
                <span className="label !text-[0.58rem]">Messaggio</span>
                <textarea required rows={5} className="field resize-none" placeholder="Raccontami la serata che hai in mente…" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
              </label>
              <input tabIndex={-1} autoComplete="off" className="hidden" value={f.hp} onChange={(e) => setF({ ...f, hp: e.target.value })} aria-hidden />
              {state === "err" && (
                <div className="text-amber text-sm border border-amber/30 rounded-xl p-4">
                  Invio non riuscito, ma il messaggio è stato salvato. Puoi anche scrivere direttamente via{" "}
                  <a className="underline" href={mailto}>
                    email
                  </a>
                  .
                </div>
              )}
              <div className="flex flex-wrap items-center gap-6">
                <Btn solid type="submit" disabled={state === "sending"}>
                  {state === "sending" ? "Invio…" : "Invia messaggio"}
                </Btn>
                <a href={mailto} className="label !text-bone-dim hover:!text-amber transition">
                  oppure apri la tua email ↗
                </a>
              </div>
            </form>
          )}
        </div>

        <aside className="lg:col-span-5 space-y-12">
          <Parallax speed={0.1}>
            <div className="relative rounded-3xl overflow-hidden aspect-[4/5] border border-white/10">
              <Img src={data.content.about.image} className="absolute inset-0 w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />
              <div className="absolute bottom-0 p-7">
                <div className="label mb-2">{data.content.about.title}</div>
                <p className="text-bone/85 leading-relaxed">{data.content.about.text}</p>
              </div>
            </div>
          </Parallax>
          <div className="space-y-5">
            {[
              ["Booking", s.bookingEmail, `mailto:${s.bookingEmail}`],
              ["Info", s.email, `mailto:${s.email}`],
              ["Telefono", s.phone, `tel:${s.phone.replace(/\s/g, "")}`],
              ["Base", s.location, ""],
            ].map(([k, v, h]) => (
              <div key={k} className="flex justify-between items-baseline border-b border-white/10 pb-4">
                <span className="label !text-[0.6rem]">{k}</span>
                {h ? (
                  <a href={h} className="font-display text-xl hover:text-amber transition">
                    {v}
                  </a>
                ) : (
                  <span className="font-display text-xl">{v}</span>
                )}
              </div>
            ))}
          </div>
          {events.length > 0 && (
            <div>
              <div className="label mb-5">Prossime date</div>
              {events.map((e) => (
                <div key={e.id} className="flex justify-between gap-4 py-3 border-b border-white/10 text-sm">
                  <span className="text-bone-dim">{fmtDate(e.date, { day: "2-digit", month: "short" })}</span>
                  <span className="flex-1 text-bone/90">{e.title}</span>
                  <span className="text-bone-dim">{e.city}</span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </section>
    </>
  );
}
