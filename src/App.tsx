import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Clock3, MapPin, Mic, Search, Sparkles, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { PublicBusiness } from "./lib/supabase";

const sampleBusinesses: PublicBusiness[] = [
  { id: "sample-1", public_id: "sample-a1", name: "Sunday Table", slug: "sunday-table", description: "Neighborhood brunch, fresh pastries, and a little extra time around the table.", category: "Food & Drink", subcategory: "Cafe", city: "Miami", state: "FL", service_area: null, public_phone: null, public_email: null, website_url: null, profile_image_url: null, rating_average: 4.9, rating_count: 38 },
  { id: "sample-2", public_id: "sample-b2", name: "Green Corner Plants", slug: "green-corner-plants", description: "Friendly plant advice, gifts, and easy-care favorites for your home.", category: "Shopping", subcategory: "Plants & Gifts", city: "Miami", state: "FL", service_area: null, public_phone: null, public_email: null, website_url: null, profile_image_url: null, rating_average: 4.8, rating_count: 21 },
  { id: "sample-3", public_id: "sample-c3", name: "Brightside Bike Repair", slug: "brightside-bike-repair", description: "Quick tune-ups and repairs from a local bike mechanic.", category: "Services", subcategory: "Bike Repair", city: "Miami", state: "FL", service_area: "Miami", public_phone: null, public_email: null, website_url: null, profile_image_url: null, rating_average: 5, rating_count: 14 },
];

type Promotion = { id: string; business_name: string; title: string; description: string | null };

function Brand() {
  return <a className="brand" href="/" aria-label="ShortStack home"><span className="brand-icon"><img src="/shortstack-logo.svg" alt="" /></span><span><strong>ShortStack</strong><small>Small Businesses. Big Deal.</small></span></a>;
}

function App() {
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showOwner, setShowOwner] = useState(false);
  const [selected, setSelected] = useState<PublicBusiness | null>(null);

  useEffect(() => {
    let mounted = true;
    if (!supabase) {
      setBusinesses(sampleBusinesses);
      setNotice("Preview mode — sample listings aren’t saved. Connect Supabase to load live businesses.");
      return () => { mounted = false; };
    }
    // ShortStack starts signed out on a fresh app launch. Protected pages are never restored from cached state.
    void supabase.auth.signOut();
    const load = async () => {
      setLoading(true);
      const [businessResult, promoResult] = await Promise.all([
        supabase.from("public_businesses").select("*").order("created_at", { ascending: false }).limit(24),
        supabase.from("public_promotions").select("id,title,description,business_name").limit(4),
      ]);
      if (!mounted) return;
      if (businessResult.error) setNotice("We couldn’t load local businesses right now. Please try again.");
      else setBusinesses((businessResult.data ?? []) as PublicBusiness[]);
      if (!promoResult.error) setPromotions((promoResult.data ?? []) as Promotion[]);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!session) return;
    let timer: number;
    const logout = () => { void supabase?.auth.signOut(); setSession(null); setShowOwner(false); setNotice("You were signed out after five minutes of inactivity."); };
    const reset = () => { window.clearTimeout(timer); timer = window.setTimeout(logout, 5 * 60 * 1000); };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "touchstart", "scroll"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    reset();
    return () => { window.clearTimeout(timer); events.forEach((event) => window.removeEventListener(event, reset)); };
  }, [session]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    return businesses.filter((business) => {
      const searchable = [business.name, business.description, business.category, business.subcategory, business.city, business.state, business.service_area].filter(Boolean).join(" ").toLowerCase();
      const locationText = [business.city, business.state, business.service_area].filter(Boolean).join(" ").toLowerCase();
      return (!q || searchable.includes(q)) && (!loc || locationText.includes(loc));
    });
  }, [businesses, query, location]);

  const voiceSearch = () => {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: new () => { lang: string; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void }; webkitSpeechRecognition?: new () => { lang: string; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void } }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: new () => { lang: string; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setNotice("Voice search isn’t available here. You can still type what you need."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => setQuery(event.results[0][0].transcript);
    recognition.onerror = () => setNotice("Microphone access wasn’t available. Try typing your search instead.");
    recognition.start();
    setNotice("Listening…");
  };

  const useLocation = () => {
    if (!navigator.geolocation) { setNotice("Location isn’t available on this device. Enter a city or ZIP instead."); return; }
    navigator.geolocation.getCurrentPosition(
      () => setNotice("Location permission granted. Enter a city or ZIP to narrow results."),
      () => setNotice("Location permission wasn’t granted. Enter a city or ZIP instead."),
      { timeout: 8000, maximumAge: 60000 },
    );
  };

  const handleSearch = (event: FormEvent) => { event.preventDefault(); setNotice(""); };

  return (
    <div className="app-shell">
      <header className="topbar"><Brand /><nav><a href="#discover">Discover</a><a href="#promotions">Local Promotions</a><button className="owner-entry" onClick={() => setShowOwner(true)}><BriefcaseBusiness size={16} /> Your Stacks</button></nav></header>
      <main>
        <section className="hero" id="discover">
          <div className="hero-backdrop" aria-hidden="true"><div className="sun" /><div className="skyline skyline-one" /><div className="skyline skyline-two" /></div>
          <div className="hero-content">
            <span className="eyebrow"><Sparkles size={15} /> LOCAL LOOKS GOOD ON YOU</span>
            <h1>Find your next<br /><em>local favorite.</em></h1>
            <p>Good food, great services, neighborhood shops — all one search away.</p>
            <form className="search-panel" onSubmit={handleSearch}>
              <label className="search-input"><Search size={20} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Tell me what you need" aria-label="Tell me what you need" /><button type="button" className="icon-button" onClick={voiceSearch} aria-label="Search by voice"><Mic size={19} /></button></label>
              <span className="search-divider" />
              <label className="location-input"><MapPin size={18} /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City or ZIP" aria-label="City or ZIP" /></label>
              <button type="button" className="location-button" onClick={useLocation}>Use my location</button>
              <button type="submit" className="search-button">Search <ArrowRight size={16} /></button>
            </form>
            <div className="search-hint"><span>Try “mobile mechanic”</span><span>“custom birthday cake”</span><span>“dog groomer”</span></div>
          </div>
        </section>

        {notice && <div className="notice" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16} /></button></div>}

        <section className="quick-links" aria-label="Popular local services">
          <div className="section-kicker">A GOOD PLACE TO START</div>
          <button onClick={() => setQuery("food")}><span className="tile-icon tile-coral">🍓</span><span>Food & drink</span></button>
          <button onClick={() => setQuery("home services")}><span className="tile-icon tile-blue">🪴</span><span>Home & garden</span></button>
          <button onClick={() => setQuery("beauty")}><span className="tile-icon tile-gold">✨</span><span>Beauty & care</span></button>
          <button onClick={() => setQuery("repair")}><span className="tile-icon tile-lilac">🚲</span><span>Repairs & services</span></button>
        </section>

        <section className="content-section">
          <div className="section-head"><div><div className="section-kicker">PICKED FOR YOUR COMMUNITY</div><h2>Business Highlight <span className="free-tag">FREE · 24 HOURS</span></h2><p>A fresh local business takes the spotlight every day.</p></div><span className="rotation"><Clock3 size={15} /> Rotates daily</span></div>
          <div className="business-grid">
            {(filtered.length ? filtered.slice(0, 3) : []).map((business, index) => <BusinessCard key={business.id} business={business} index={index} onOpen={() => setSelected(business)} />)}
            {!filtered.length && !loading && <div className="empty-state"><Search size={22} /><strong>No matches yet</strong><span>Try another search or a nearby city.</span></div>}
            {loading && <div className="empty-state"><span className="spinner" />Finding neighborhood favorites…</div>}
          </div>
          <div className="all-businesses"><button className="text-button" onClick={() => { setQuery(""); setLocation(""); }}>See all local businesses <ArrowRight size={16} /></button></div>
        </section>

        <section className="promo-section" id="promotions">
          <div className="promo-intro"><span className="promo-spark">✳</span><div className="section-kicker">GOOD THINGS NEARBY</div><h2>Local promotions</h2><p>Little reasons to visit the businesses around you.</p></div>
          <div className="promo-list">{promotions.length ? promotions.map((promo) => <article className="promo-card" key={promo.id}><span className="promo-pill">LOCAL OFFER</span><h3>{promo.title}</h3><p>{promo.description || "A special offer from your neighborhood."}</p><small>{promo.business_name}</small></article>) : <article className="promo-card promo-placeholder"><span className="promo-pill">COMING UP LOCAL</span><h3>Discover a little something nearby.</h3><p>Published offers from eligible neighborhood businesses will show here.</p></article>}</div>
        </section>

        <footer><Brand /><div className="footer-links"><a href="/terms">Terms & Conditions</a><a href="/privacy">Privacy Policy</a><span>© {new Date().getFullYear()} ShortStack</span></div></footer>
      </main>
      {showOwner && <OwnerDialog session={session} setSession={setSession} onClose={() => setShowOwner(false)} setNotice={setNotice} />}
      {selected && <BusinessDialog business={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function BusinessCard({ business, index, onOpen }: { business: PublicBusiness; index: number; onOpen: () => void }) {
  const palettes = ["card-mint", "card-peach", "card-lavender"];
  return <article className={`business-card ${palettes[index % palettes.length]}`}>
    <button className="business-open" onClick={onOpen} aria-label={`View ${business.name}`}>
      <div className="business-card-top"><span className="business-avatar">{business.name.slice(0, 1).toUpperCase()}</span><span className="verified">LOCAL FAVORITE</span></div>
      <span className="business-category">{business.category || "Independent business"}{business.subcategory ? ` · ${business.subcategory}` : ""}</span>
      <h3>{business.name}</h3><p>{business.description || "A neighborhood business ready to meet you."}</p>
      <div className="card-meta"><span><MapPin size={14} /> {[business.city, business.state].filter(Boolean).join(", ") || business.service_area || "Local"}</span><span>★ {business.rating_average?.toFixed(1) ?? "New"} <small>({business.rating_count})</small></span></div>
    </button>
    <button className="card-cta" onClick={onOpen}>Explore business <ArrowRight size={15} /></button>
  </article>;
}

function BusinessDialog({ business, onClose }: { business: PublicBusiness; onClose: () => void }) {
  const [reviews, setReviews] = useState<Array<{ rating: number; comment: string; created_at: string }>>([]);
  useEffect(() => {
    let alive = true;
    if (supabase) void supabase.from("public_reviews").select("rating,comment,created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(5).then(({ data }) => { if (alive) setReviews(data ?? []); });
    return () => { alive = false; };
  }, [business.id]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="business-dialog" role="dialog" aria-modal="true" aria-labelledby="business-title"><button className="close-button" onClick={onClose} aria-label="Close"><X /></button><span className="dialog-avatar">{business.name.slice(0, 1)}</span><div className="section-kicker">{business.category || "LOCAL BUSINESS"}</div><h2 id="business-title">{business.name}</h2><p>{business.description}</p><div className="dialog-location"><MapPin size={16} /> {[business.city, business.state].filter(Boolean).join(", ") || business.service_area || "Local"}</div><div className="contact-actions"><a className={!business.public_phone ? "disabled" : ""} href={business.public_phone ? `tel:${business.public_phone}` : undefined}>CALL</a><a className={!business.public_email ? "disabled" : ""} href={business.public_email ? `mailto:${business.public_email}` : undefined}>EMAIL</a></div><h3 className="review-title">Reviews <span>★ {business.rating_average?.toFixed(1) ?? "New"} · {business.rating_count}</span></h3>{reviews.length ? reviews.map((review, i) => <div className="review-row" key={i}><strong>{"★".repeat(review.rating)}</strong><p>{review.comment}</p></div>) : <p className="muted">No reviews yet.</p>}</section></div>;
}

function OwnerDialog({ session, setSession, onClose, setNotice }: { session: Session | null; setSession: (session: Session | null) => void; onClose: () => void; setNotice: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string; city: string | null; state: string | null }>>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    if (!session || !supabase) return;
    void supabase.from("businesses").select("id,name,city,state").order("created_at", { ascending: false }).then(({ data, error: queryError }) => {
      if (queryError) setError("Couldn’t load your businesses. Check the database setup and try again.");
      else setBusinesses(data ?? []);
    });
  }, [session]);

  const authenticate = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!supabase) { setError("Connect Supabase before using owner accounts."); return; }
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError(authError.message); return; }
    setSession(data.session);
  };

  const createBusiness = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (!supabase || !session) return;
    if (!name.trim() || !city.trim() || !stateName.trim()) { setError("Enter a business name, city, and state."); return; }
    const { data, error: insertError } = await supabase.from("businesses").insert({
      name: name.trim(), city: city.trim(), state: stateName.trim().toUpperCase(), category: category.trim() || null,
    }).select("id,name,city,state").single();
    if (insertError) { setError("We couldn’t save the listing. Confirm the database migration is installed and try again."); return; }
    setBusinesses((current) => [data, ...current]); setCreating(false); setName(""); setCity(""); setStateName(""); setCategory("");
    setNotice("Draft saved. Payment and publication stay pending until verified through a configured payment provider.");
  };

  const signOut = async () => { await supabase?.auth.signOut(); setSession(null); };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="owner-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-title"><button className="close-button" onClick={onClose} aria-label="Close"><X /></button><div className="section-kicker">YOUR STACKS</div><h2 id="owner-title">Manage your business</h2>{!isSupabaseConfigured && <div className="setup-warning">Supabase isn’t connected yet. Owner sign-in and saved listings are disabled.</div>}{error && <div className="form-error" role="alert">{error}</div>}
    {!session ? <form className="owner-form" onSubmit={authenticate}><label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary-button" disabled={!supabase}>Sign in</button><p className="muted">Owner accounts are created through the configured Supabase Auth flow. Public visitors don’t need an account.</p></form> : <><div className="owner-toolbar"><span>Signed in as {session.user.email}</span><button className="text-button" onClick={() => void signOut()}>Log out</button></div><div className="owner-businesses"><div className="section-kicker">MY BUSINESSES</div>{businesses.length ? businesses.map((b) => <div className="owner-business-row" key={b.id}><strong>{b.name}</strong><span>{[b.city, b.state].filter(Boolean).join(", ")}</span><em>Draft</em></div>) : <p className="muted">No listings yet. Start with your first business.</p>}{creating ? <form className="owner-form create-form" onSubmit={createBusiness}><label>Business name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><label>Category or service<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Choose any business type" /></label><div className="form-pair"><label>City<input value={city} onChange={(e) => setCity(e.target.value)} required /></label><label>State<input value={stateName} onChange={(e) => setStateName(e.target.value)} maxLength={2} required /></label></div><button className="primary-button">Save draft</button><small>Enrollment is $19.99 after payment setup. Listings stay private until payment and approval are verified.</small></form> : <button className="primary-button" onClick={() => setCreating(true)}>Create business listing</button>}</div></>}</section></div>;
}

export default App;
