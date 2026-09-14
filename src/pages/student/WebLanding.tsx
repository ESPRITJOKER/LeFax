import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { markUrl } from "../../components/BrandLogo";
import "./webLanding.css";

import heroImg from "../../assets/landing/hero.png";
import learnImg from "../../assets/landing/learn-different.png";
import docsImg from "../../assets/landing/docs.png";
import cardArtsImg from "../../assets/landing/card-arts.png";
import cardSciencesImg from "../../assets/landing/card-sciences.png";
import cardExamensImg from "../../assets/landing/card-examens.png";
import examsVisualImg from "../../assets/landing/exams-visual.png";
import mobileImg from "../../assets/landing/mobile.png";

/**
 * WebLanding — pixel-exact reproduction of the marketing landing page from
 * `lefax_complete_clickable_reproduction.html` (#home). Markup and copy are
 * verbatim; styling lives in ./webLanding.css scoped under `.lefax-web`.
 *
 * Interactivity differs from the static prototype only where it must: the
 * EXAMENS/CONCOURS dropdowns keep their click-to-open behaviour, real
 * auth/CTA links route into the app (login/register), and catalog/course
 * links that have no real destination yet are inert.
 */
export default function WebLanding() {
  const navigate = useNavigate();
  const [openMenu, setOpenMenu] = useState<null | "examens" | "concours">(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  // Click outside closes any open dropdown — mirrors the prototype's
  // document-level hideMenus() listener.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  const go = (path: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    navigate(path);
  };
  const inert = (e: React.MouseEvent) => e.preventDefault();

  const toggleMenu = (which: "examens" | "concours") => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setOpenMenu((cur) => (cur === which ? null : which));
  };

  return (
    <div className="lefax-web">
      <header className="nav" ref={navRef}>
        <a className="logo" href="/" onClick={go("/")}>
          <img className="logo-img" src={markUrl} alt="" />
          LeFax
        </a>
        <nav className={`navlinks${mobileOpen ? " showMobile" : ""}`}>
          <div className={`dropdown${openMenu === "examens" ? " open" : ""}`}>
            <button className="dropbtn" onClick={toggleMenu("examens")}>
              EXAMENS⌄
            </button>
            <div className="menu">
              <div>
                <h4>Administratifs</h4>
                <a href="#" onClick={inert}>BEPC</a>
                <a href="#" onClick={inert}>BAC</a>
                <a href="#" onClick={inert}>BTS</a>
                <a href="#" onClick={inert}>ENS de Yaoundé</a>
                <a href="#" onClick={inert}>ENS de Maroua</a>
                <a href="#" onClick={inert}>ENSET de Bambili</a>
                <a href="#" onClick={inert}>ENSET de Yaoundé</a>
              </div>
              <div>
                <h4>Ingénieurs</h4>
                <a href="#" onClick={inert}>ENSP</a>
                <a href="#" onClick={inert}>ESSTIC</a>
                <a href="#" onClick={inert}>IUT</a>
                <a href="#" onClick={inert}>ENSET de Douala</a>
                <a href="#" onClick={inert}>ENSET de Kumba</a>
                <a href="#" onClick={inert}>FASA</a>
              </div>
              <div>
                <h4>Autres</h4>
                <a href="#" onClick={inert}>IUT de Douala</a>
                <a href="#" onClick={inert}>IUT de Bandjoun</a>
                <a href="#" onClick={inert}>IUT de Ngaoundéré</a>
                <a href="#" onClick={inert}>HGD</a>
                <a href="#" onClick={inert}>IRIC</a>
                <a href="#" onClick={inert}>Faculté de médecine</a>
                <a href="#" onClick={inert}>IFORD</a>
                <a href="#" onClick={inert}>ISMP</a>
              </div>
            </div>
          </div>
          <div className={`dropdown${openMenu === "concours" ? " open" : ""}`}>
            <button className="dropbtn" onClick={toggleMenu("concours")}>
              CONCOURS⌄
            </button>
            <div className="menu">
              <div>
                <h4>Concours</h4>
                <a href="#" onClick={inert}>ENAM</a>
                <a href="#" onClick={inert}>ENS</a>
                <a href="#" onClick={inert}>ENSP</a>
                <a href="#" onClick={inert}>ESSTIC</a>
              </div>
              <div>
                <h4>Instituts</h4>
                <a href="#" onClick={inert}>IRIC</a>
                <a href="#" onClick={inert}>IUT</a>
                <a href="#" onClick={inert}>ISMP</a>
                <a href="#" onClick={inert}>IFORD</a>
              </div>
              <div>
                <h4>Préparation</h4>
                <a href="#" onClick={inert}>Mini-cours</a>
                <a href="#" onClick={inert}>Ressources</a>
                <a href="#" onClick={inert}>Premium</a>
              </div>
            </div>
          </div>
          <a href="/register" onClick={go("/register")}>
            COURS
          </a>
          <a href="/register" onClick={go("/register")}>
            RESSOURCES
          </a>
        </nav>
        <div className="actions">
          <a href="/register" onClick={go("/register")}>
            S’ABONNER
          </a>
          <a href="/login" onClick={go("/login")}>
            CONNEXION
          </a>
          <a className="signup" href="/register" onClick={go("/register")}>
            INSCRIPTION
          </a>
        </div>
        <button className="mobile-menu" onClick={() => setMobileOpen((v) => !v)}>
          ☰
        </button>
      </header>

      <main>
        <section id="home" className="page active">
          <section className="hero">
            <div className="hero-copy">
              <div className="kicker">
                Prépare tes examens et
                <br />
                concours en ligne
              </div>
              <p>anciennes épreuves, mini-cours, exercices interactif et super quiz</p>
              <a className="cta" href="/register" onClick={go("/register")}>
                COMMENCE MAINTENANT
              </a>
            </div>
            <div className="hero-art">
              <img src={heroImg} alt="Illustration LeFax" />
            </div>
          </section>

          <section className="section">
            <div className="split">
              <div>
                <h2 className="title">Learn different</h2>
                <p className="muted">
                  Préparez gratuitement vos examens et concours grâce à des ressources simples,
                  accessibles et pensées pour une réussite facile.
                </p>
                <a className="cta" href="/register" onClick={go("/register")}>
                  DÉCOUVRIR
                </a>
              </div>
              <div className="media">
                <img src={learnImg} alt="" />
              </div>
            </div>
          </section>

          <section className="section docs">
            <div className="split">
              <div className="media">
                <img src={docsImg} alt="" />
              </div>
              <div>
                <h2 className="title">Ajouter des documents</h2>
                <p className="muted">
                  Vous avez des documents à partager ? Partagez-les pour enrichir la plateforme et
                  aider les autres apprenants à progresser.
                </p>
                <a className="cta" href="/register" onClick={go("/register")}>
                  AJOUTER UN DOCUMENT
                </a>
              </div>
            </div>
          </section>

          <section className="section">
            <div className="center">
              <div className="rule"></div>
              <h2 className="title">Découvrez nos cours</h2>
              <p className="muted">
                Des contenus courts et pratiques pour mieux comprendre et mieux réviser.
              </p>
            </div>
            <div className="cards">
              <a className="card" href="#" onClick={inert}>
                <div className="pic">
                  <img src={cardArtsImg} alt="" />
                </div>
                <div className="card-body">
                  <h3>Arts &amp; sciences</h3>
                  <p>Cours, fiches et exercices pour progresser.</p>
                </div>
              </a>
              <a className="card" href="#" onClick={inert}>
                <div className="pic">
                  <img src={cardSciencesImg} alt="" />
                </div>
                <div className="card-body">
                  <h3>Sciences et technologies</h3>
                  <p>Des ressources claires et pratiques.</p>
                </div>
              </a>
              <a className="card" href="#" onClick={inert}>
                <div className="pic">
                  <img src={cardExamensImg} alt="" />
                </div>
                <div className="card-body">
                  <h3>Examens &amp; concours</h3>
                  <p>Annales et corrections à portée de main.</p>
                </div>
              </a>
            </div>
          </section>

          <section className="teacher">
            <div className="teacher-box">
              <div className="teacher-copy">
                <h2 className="title">Vous êtes enseignant?</h2>
                <p className="muted">
                  Rejoignez notre communauté et contribuez à l'élaboration de contenus utiles aux
                  apprenants.
                </p>
                <a className="cta" href="/register" onClick={go("/register")}>
                  REJOIGNEZ NOUS !!
                </a>
              </div>
              <div className="teacher-badge">
                LeFax
                <br />
                enseignant
              </div>
            </div>
          </section>

          <section className="join">
            <div className="rule"></div>
            <h2 className="title">Rejoignez nous !!</h2>
            <div className="fb-card">
              <div className="fb-head">
                <div className="fb-avatar"></div>
                <div>
                  <b style={{ fontSize: 11 }}>LeFax</b>
                  <div style={{ fontSize: 8, color: "#888" }}>Communauté éducative</div>
                </div>
              </div>
              <div className="fb-content">
                Retrouve les actualités, conseils de préparation et contenus de la communauté LeFax.
                Partage, échange et progresse avec d'autres candidats.
              </div>
            </div>
          </section>

          <section id="resources-preview" className="section">
            <div className="center">
              <div className="rule"></div>
              <h2 className="title">
                Des ressources taillées pour
                <br />
                une réussite facile
              </h2>
            </div>
            <div className="resource-grid">
              <a className="resource" href="#" onClick={inert}>
                <h4>Mini cours</h4>
                <p>Des explications courtes pour aller directement à l'essentiel.</p>
              </a>
              <a className="resource" href="#" onClick={inert}>
                <h4>Anciennes épreuves + Corrections</h4>
                <p>Travaille sur des sujets et vérifie tes réponses.</p>
              </a>
              <a className="resource" href="#" onClick={inert}>
                <h4>Quiz en ligne</h4>
                <p>Teste rapidement tes connaissances.</p>
              </a>
            </div>
          </section>

          <section className="blueband">
            <div className="band-inner">
              <div className="band-copy">
                <h2>Tous tes examens et concours sont sur LeFax</h2>
                <p>
                  Retrouve au même endroit les ressources dont tu as besoin pour préparer
                  efficacement tes examens et concours.
                </p>
                <a className="cta" href="/register" onClick={go("/register")}>
                  TROUVER TES EXAMENS ET CONCOURS
                </a>
              </div>
              <div className="exams-visual">
                <img src={examsVisualImg} alt="" />
              </div>
            </div>
          </section>

          <section className="section">
            <div className="center">
              <div className="rule"></div>
              <h2 className="title">
                Ce que nos utilisateurs
                <br />
                disent de nous.
              </h2>
            </div>
            <div className="test-grid">
              <div className="test feature">
                <div className="photo"></div>
                <div style={{ padding: 18 }}>
                  <h4>Armand Nd</h4>
                  <p>Une plateforme pratique pour retrouver les sujets et réviser plus facilement.</p>
                </div>
              </div>
              <div className="test">
                <h4>Orédine Merveille</h4>
                <p>Les cours et quiz m'aident à organiser mes révisions.</p>
              </div>
              <div className="test">
                <h4>Lucie Nkem</h4>
                <p>Simple, accessible et utile pour préparer les examens.</p>
              </div>
            </div>
          </section>

          <section className="mobile-section">
            <div className="mobile-grid">
              <div>
                <h2 className="title">
                  Lefax dans ta poche,
                  <br />
                  au lit et partout
                </h2>
                <p className="muted">
                  Apprends où tu veux grâce à une expérience pensée pour mobile. Accède rapidement à
                  tes cours, sujets et quiz.
                </p>
                <div className="store-row">
                  <span className="store">▶ Google Play</span>
                  <span className="store">● App Store</span>
                </div>
              </div>
              <div>
                <img src={mobileImg} alt="Aperçu mobile" />
              </div>
            </div>
          </section>
        </section>
      </main>

      <footer>
        <div className="footer-grid">
          <div>
            <div className="logo">
              <img className="logo-img" src={markUrl} alt="" />
              LeFax
            </div>
            <div className="footer-link">Prépare tes examens en ligne.</div>
          </div>
          <div>
            <h4>Examens</h4>
            <a className="footer-link" href="#" onClick={inert}>BEPC</a>
            <a className="footer-link" href="#" onClick={inert}>BAC</a>
            <a className="footer-link" href="#" onClick={inert}>BTS</a>
            <a className="footer-link" href="#" onClick={inert}>ENS</a>
          </div>
          <div>
            <h4>Concours</h4>
            <a className="footer-link" href="#" onClick={inert}>ENAM</a>
            <a className="footer-link" href="#" onClick={inert}>ENS</a>
            <a className="footer-link" href="#" onClick={inert}>ENSP</a>
            <a className="footer-link" href="#" onClick={inert}>IRIC</a>
          </div>
          <div>
            <h4>Plus</h4>
            <a className="footer-link" href="#" onClick={inert}>Ressources</a>
            <a className="footer-link" href="#" onClick={inert}>Cours</a>
            <a className="footer-link" href="#" onClick={inert}>Premium</a>
            <a className="footer-link" href="/register" onClick={go("/register")}>
              Créer un compte
            </a>
          </div>
        </div>
        <div className="copyright">
          <span>© 2026 LeFax. Tous droits réservés.</span>
          <span>Facebook · Instagram · YouTube</span>
        </div>
      </footer>
    </div>
  );
}
