import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { StoreProvider } from "@/store/store";
import { PlayerProvider } from "@/audio/PlayerContext";
import { Cursor, SmoothScroll, TransitionProvider, TLink } from "@/motion";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Music from "@/pages/Music";
import Gallery from "@/pages/Gallery";
import Social from "@/pages/Social";
import Shop from "@/pages/Shop";
import Contact from "@/pages/Contact";
import Admin from "@/admin/Admin";

function NotFound() {
  return (
    <div className="min-h-[80vh] grid place-items-center text-center px-6">
      <div>
        <div className="label mb-6">404</div>
        <div className="font-display display-it text-[clamp(3rem,10vw,8rem)] leading-none">Questa sala è vuota.</div>
        <TLink to="/" label="Ingresso" className="btn mt-10 inline-flex">
          <span>Torna all'ingresso</span>
        </TLink>
      </div>
    </div>
  );
}

function Shell() {
  const { pathname } = useLocation();
  if (pathname.startsWith("/admin")) return <Admin />;
  return (
    <>
      <Cursor />
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/musica" element={<Music />} />
          <Route path="/gallery" element={<Gallery />} />
          <Route path="/social" element={<Social />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/contatti" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Layout>
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <StoreProvider>
        <PlayerProvider>
          <SmoothScroll>
            <TransitionProvider>
              <Shell />
            </TransitionProvider>
          </SmoothScroll>
        </PlayerProvider>
      </StoreProvider>
    </HashRouter>
  );
}
