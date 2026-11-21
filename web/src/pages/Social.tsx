import { useEffect, useState } from "react";
import { setMood, Reveal, MaskText } from "@/motion";
import { useSite } from "@/store/store";
import type { SiteData, SocialPost } from "@/store/data";
import { Img, PageHero, fmtDate } from "@/components/ui";

interface FeedState {
  posts: SocialPost[];
  live: string[];
  errors: string[];
  stats: Record<string, string>;
  loading: boolean;
}

const nf = (n: string | number) => new Intl.NumberFormat("it-IT", { notation: "compact", maximumFractionDigits: 1 }).format(+n);

async function fetchJson(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
  return r.json();
}

/** Pulls live content from the configured APIs; each source fails independently. */
async function loadFeeds(api: SiteData["api"]) {
  const posts: SocialPost[] = [];
  const live: string[] = [];
  const errors: string[] = [];
  const stats: Record<string, string> = {};
  const jobs: Promise<void>[] = [];

  if (api.youtubeKey && api.youtubeChannelId) {
    jobs.push(
      (async () => {
        try {
          const [s, c] = await Promise.all([
            fetchJson(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${api.youtubeChannelId}&order=date&maxResults=8&type=video&key=${api.youtubeKey}`),
            fetchJson(`https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${api.youtubeChannelId}&key=${api.youtubeKey}`).catch(() => null),
          ]);
          (s.items || []).forEach((v: { id: { videoId: string }; snippet: { title: string; publishedAt: string; thumbnails: { high?: { url: string }; medium?: { url: string } } } }) =>
            posts.push({ id: "yt" + v.id.videoId, platform: "YouTube", image: v.snippet.thumbnails.high?.url || v.snippet.thumbnails.medium?.url || "", text: v.snippet.title, url: `https://www.youtube.com/watch?v=${v.id.videoId}`, date: v.snippet.publishedAt })
          );
          const subs = c?.items?.[0]?.statistics?.subscriberCount;
          if (subs) stats.YouTube = `${nf(subs)} iscritti`;
          live.push("YouTube");
        } catch (e) {
          errors.push(`YouTube: ${(e as Error).message}`);
        }
      })()
    );
  }
  if (api.instagramToken) {
    jobs.push(
      (async () => {
        try {
          const j = await fetchJson(`https://graph.instagram.com/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp&limit=9&access_token=${api.instagramToken}`);
          (j.data || []).forEach((m: { id: string; caption?: string; media_type: string; media_url: string; thumbnail_url?: string; permalink: string; timestamp: string }) =>
            posts.push({ id: "ig" + m.id, platform: "Instagram", image: m.media_type === "VIDEO" ? m.thumbnail_url || "" : m.media_url, text: m.caption || "", url: m.permalink, date: m.timestamp })
          );
          live.push("Instagram");
        } catch (e) {
          errors.push(`Instagram: ${(e as Error).message}`);
        }
      })()
    );
  }
  if (api.feedUrl) {
    jobs.push(
      (async () => {
        try {
          const j = await fetchJson(api.feedUrl);
          const arr = Array.isArray(j) ? j : j.items || j.posts || [];
          arr.forEach((m: Partial<SocialPost>, i: number) => posts.push({ id: "cf" + i, platform: m.platform || "Feed", image: m.image || "", text: m.text || "", url: m.url || "", date: m.date || new Date().toISOString() }));
          live.push("Feed JSON");
        } catch (e) {
          errors.push(`Feed JSON: ${(e as Error).message}`);
        }
      })()
    );
  }
  await Promise.all(jobs);
  posts.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  return { posts, live, errors, stats };
}

function useFeeds(): FeedState {
  const { data } = useSite();
  const key = JSON.stringify(data.api);
  const hasApi = !!((data.api.youtubeKey && data.api.youtubeChannelId) || data.api.instagramToken || data.api.feedUrl);
  const [s, setS] = useState<FeedState>({ posts: [], live: [], errors: [], stats: {}, loading: hasApi });
  useEffect(() => {
    if (!hasApi) return setS({ posts: [], live: [], errors: [], stats: {}, loading: false });
    const ck = "nocturne.feed." + key;
    try {
      const c = JSON.parse(sessionStorage.getItem(ck) || "null");
      if (c && Date.now() - c.t < 10 * 60 * 1000) return setS({ ...c.v, loading: false });
    } catch {
      /* noop */
    }
    let live = true;
    setS((x) => ({ ...x, loading: true }));
    loadFeeds(data.api).then((v) => {
      if (!live) return;
      if (v.live.length) sessionStorage.setItem(ck, JSON.stringify({ t: Date.now(), v }));
      setS({ ...v, loading: false });
    });
    return () => {
      live = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return s;
}

export default function Social() {
  const { data } = useSite();
  const feed = useFeeds();
  useEffect(() => setMood("green"), []);
  const posts = feed.live.length ? feed.posts : data.posts;
  const profiles = data.socials.filter((s) => s.enabled);

  return (
    <>
      <PageHero kicker="Social" title={"Seguimi\nnella notte"} sub="Profili, video e frammenti di backstage. Il feed si aggiorna in tempo reale dalle piattaforme collegate." />

      <section className="relative px-6 md:px-14 pb-20">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {profiles.map((p, i) => (
            <Reveal key={p.id} y={40} delay={i * 0.07}>
              <a href={p.url} target="_blank" rel="noreferrer noopener" data-cursor="Segui" className="group relative block rounded-2xl border border-white/10 p-7 overflow-hidden bg-ink-2/60 backdrop-blur-sm hover:border-amber/60 transition-colors duration-700">
                <span className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-amber/10 blur-2xl group-hover:bg-amber/25 transition-colors duration-700" />
                <div className="relative flex items-start justify-between">
                  <span className="w-12 h-12 rounded-full border border-amber/50 grid place-items-center font-display display-it text-2xl text-amber group-hover:bg-amber group-hover:text-ink transition-colors duration-500">{p.platform[0]}</span>
                  <span className="label !text-[0.58rem] opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-500">Apri ↗</span>
                </div>
                <div className="relative mt-10">
                  <div className="font-display text-3xl">{p.platform}</div>
                  <div className="text-bone-dim mt-1">{p.handle}</div>
                  {(feed.stats[p.platform] || p.followers) && <div className="label mt-5 !text-[0.6rem]">{feed.stats[p.platform] || p.followers}</div>}
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="relative px-6 md:px-14 py-20 pb-32">
        <div className="flex flex-wrap items-end justify-between gap-6 mb-12">
          <MaskText as="h2" text={"Dal feed"} className="font-display text-[clamp(2.6rem,6vw,5.5rem)] leading-none" />
          <div className="label !text-bone-dim flex items-center gap-3">
            <span className={`w-2 h-2 rounded-full ${feed.live.length ? "bg-emerald-400 animate-pulse" : "bg-bone/30"}`} />
            {feed.loading ? "Connessione alle piattaforme…" : feed.live.length ? `Live · ${feed.live.join(" + ")}` : "Selezione curata · collega le API dal pannello admin"}
          </div>
        </div>
        {feed.errors.length > 0 && <div className="mb-8 text-sm text-amber/90 border border-amber/30 rounded-xl p-4">Alcune fonti non rispondono ({feed.errors.join(" · ")}). Mostro ciò che è disponibile.</div>}
        <div className="columns-1 sm:columns-2 lg:columns-3 gap-5 [&>*]:mb-5">
          {posts.map((p, i) => {
            const Tag = p.url ? "a" : "div";
            return (
              <Reveal key={p.id} y={40} delay={(i % 3) * 0.08} className="break-inside-avoid">
                <Tag {...(p.url ? { href: p.url, target: "_blank", rel: "noreferrer noopener" } : {})} data-cursor={p.url ? "Apri" : undefined} className="group block rounded-2xl overflow-hidden border border-white/10 bg-ink-2/70 hover:border-amber/50 transition-colors duration-700">
                  {p.image && (
                    <div className="overflow-hidden">
                      <Img src={p.image} className="w-full object-cover transition-transform duration-[1400ms] group-hover:scale-105" />
                    </div>
                  )}
                  <div className="p-5">
                    <div className="flex justify-between label !text-[0.58rem] mb-3">
                      <span>{p.platform}</span>
                      <span className="!text-bone-dim">{fmtDate(p.date, { day: "2-digit", month: "short" })}</span>
                    </div>
                    <p className="text-bone/85 leading-relaxed line-clamp-4">{p.text}</p>
                  </div>
                </Tag>
              </Reveal>
            );
          })}
        </div>
      </section>
    </>
  );
}
