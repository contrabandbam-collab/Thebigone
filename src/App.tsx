import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowRight, BriefcaseBusiness, Clock3, MapPin, Mic, Search, Sparkles, X } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import type { PublicBusiness } from "./lib/supabase";

const sampleBusinesses: PublicBusiness[] = [
  { id: "sample-1", public_id: "sample-a1", name: "Sunday Table", slug: "sunday-table", description: "Neighborhood brunch, fresh pastries, and a little extra time around the table.", business_type: "Storefront", category: "Food & Drink", subcategory: "Cafe", custom_category: null, keywords: ["brunch", "pastries", "coffee"], services: [], products: ["pastries", "brunch"], city: "Miami", state: "FL", public_postal_code: null, service_area: null, is_mobile: false, public_phone: null, public_email: null, website_url: null, profile_image_url: null, rating_average: 4.9, rating_count: 38 },
  { id: "sample-2", public_id: "sample-b2", name: "Green Corner Plants", slug: "green-corner-plants", description: "Friendly plant advice, gifts, and easy-care favorites for your home.", business_type: "Storefront", category: "Shopping", subcategory: "Plants & Gifts", custom_category: null, keywords: ["plants", "gifts", "garden"], services: [], products: ["house plants", "gifts"], city: "Miami", state: "FL", public_postal_code: null, service_area: null, is_mobile: false, public_phone: null, public_email: null, website_url: null, profile_image_url: null, rating_average: 4.8, rating_count: 21 },
  { id: "sample-3", public_id: "sample-c3", name: "Brightside Bike Repair", slug: "brightside-bike-repair", description: "Quick tune-ups and repairs from a local bike mechanic.", business_type: "Mobile", category: "Services", subcategory: "Bike Repair", custom_category: null, keywords: ["repair", "mobile mechanic", "bike"], services: ["bike repair", "tune-up"], products: [], city: "Miami", state: "FL", public_postal_code: null, service_area: "Miami", is_mobile: true, public_phone: null, public_email: null, website_url: null, profile_image_url: null, rating_average: 5, rating_count: 14 },
];

type Promotion = { id: string; business_name: string; title: string; description: string | null };

function Brand() {
  return <a className="brand" href="/" aria-label="ShortStack home"><span><strong>ShortStack</strong><small>Small Businesses. Big Deal.</small></span></a>;
}

function searchComment(query: string) {
  const serious = /\b(doctor|medical|lawyer|legal|emergency|urgent|danger|safety|police|fire|abuse|crisis|accident|hospital|therapist|poison|weapon|violence|crash|injury|ambulance|overdose|suicide)\b/i.test(query);
  if (!query.trim()) return "Tell us what you’re looking for and we’ll help you find a local business.";
  if (serious) return /\b(emergency|immediate danger|ambulance|overdose|suicide|violence)\b/i.test(query)
    ? "Showing relevant local results. If someone is in immediate danger, contact local emergency services."
    : "Showing relevant local results.";
  return ["Let’s find your people nearby.", "Local search, coming right up.", "A good neighborhood find is close."][query.trim().length % 3];
}

function safeImageUrl(value: string | null) {
  if (!value) return null;
  try { const parsed = new URL(value); return parsed.protocol === "https:" ? parsed.href : null; }
  catch { return null; }
}

function App() {
  const [businesses, setBusinesses] = useState<PublicBusiness[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [highlight, setHighlight] = useState<PublicBusiness | null>(null);
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
      setNotice("Preview mode — these sample listings aren’t saved. Connect Supabase to load live businesses.");
      return () => { mounted = false; };
    }
    // ShortStack starts signed out on a fresh app launch. Protected pages are never restored from cached state.
    void supabase.auth.signOut();
    const load = async () => {
      setLoading(true);
      const [businessResult, promoResult, highlightResult] = await Promise.all([
        supabase.from("public_businesses").select("*").order("created_at", { ascending: false }).limit(24),
        supabase.from("public_promotions").select("id,title,description,business_name").limit(4),
        supabase.from("public_business_highlight").select("*").maybeSingle(),
      ]);
      if (!mounted) return;
      if (businessResult.error) setNotice("We couldn’t load local businesses right now. Please try again.");
      else setBusinesses((businessResult.data ?? []) as PublicBusiness[]);
      if (!promoResult.error) setPromotions((promoResult.data ?? []) as Promotion[]);
      if (!highlightResult.error) setHighlight((highlightResult.data ?? null) as PublicBusiness | null);
      setLoading(false);
    };
    void load();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!supabase) return;
    let timer: number;
    const refresh = async () => {
      const { data, error } = await supabase.from("public_business_highlight").select("*").maybeSingle();
      if (!error) setHighlight((data ?? null) as PublicBusiness | null);
      timer = window.setTimeout(refresh, 24 * 60 * 60 * 1000);
    };
    const day = 24 * 60 * 60 * 1000;
    timer = window.setTimeout(refresh, day - (Date.now() % day) + 1000);
    return () => window.clearTimeout(timer);
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
    if (supabase) return businesses;
    const q = query.trim().toLowerCase();
    const loc = location.trim().toLowerCase();
    return businesses.filter((business) => {
      const searchable = [business.name, business.description, business.category, business.subcategory, business.custom_category, business.city, business.state, business.public_postal_code, business.service_area, ...business.keywords, ...business.services, ...business.products].filter(Boolean).join(" ").toLowerCase();
      const locationText = [business.city, business.state, business.public_postal_code, business.service_area].filter(Boolean).join(" ").toLowerCase();
      return (!q || searchable.includes(q)) && (!loc || locationText.includes(loc));
    });
  }, [businesses, query, location]);

  const voiceSearch = () => {
    const SpeechRecognition = (window as Window & { SpeechRecognition?: new () => { lang: string; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void }; webkitSpeechRecognition?: new () => { lang: string; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void } }).SpeechRecognition
      ?? (window as Window & { webkitSpeechRecognition?: new () => { lang: string; onresult: (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onerror: () => void; start: () => void } }).webkitSpeechRecognition;
    if (!SpeechRecognition) { setNotice("Voice search isn’t available here. You can still type what you need."); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = navigator.language || "en-US";
    recognition.onresult = (event) => { const spoken = event.results[0][0].transcript; setQuery(spoken); void runSearch(spoken); };
    recognition.onerror = () => setNotice("Microphone access wasn’t available. Try typing your search instead.");
    try { recognition.start(); }
    catch { setNotice("Microphone access wasn’t available. Try typing your search instead."); return; }
    setNotice("Listening…");
  };

  const runSearch = async (term = query, place = location) => {
    setQuery(term);
    setLocation(place);
    setNotice(searchComment(term));
    if (!supabase) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("search_public_businesses", {
      query_text: term.trim(), location_text: place.trim(), result_limit: 48,
    });
    if (error) setNotice("Search is temporarily unavailable. Try again or enter a city or ZIP.");
    else setBusinesses((data ?? []) as PublicBusiness[]);
    setLoading(false);
  };

  const handleSearch = (event: FormEvent) => { event.preventDefault(); void runSearch(); };

  const useLocation = () => {
    if (!navigator.geolocation) { setNotice("Location isn’t available on this device. Enter a city or ZIP instead."); return; }
    navigator.geolocation.getCurrentPosition(
      () => setNotice("Location permission granted. Enter a city or ZIP to narrow results. We don’t guess your location."),
      () => setNotice("Location permission wasn’t granted. Enter a city or ZIP instead."),
      { timeout: 8000, maximumAge: 60000 },
    );
  };

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
          <button onClick={() => void runSearch("food & drink")}><span className="tile-icon tile-coral">🍓</span><span>Food & drink</span></button>
          <button onClick={() => void runSearch("home services")}><span className="tile-icon tile-blue">🪴</span><span>Home & garden</span></button>
          <button onClick={() => void runSearch("beauty care")}><span className="tile-icon tile-gold">✨</span><span>Beauty & care</span></button>
          <button onClick={() => void runSearch("repair")}><span className="tile-icon tile-lilac">🚲</span><span>Repairs & services</span></button>
        </section>

        <section className="content-section" aria-labelledby="highlight-heading">
          <div className="section-head"><div><div className="section-kicker">PICKED FOR YOUR COMMUNITY</div><h2 id="highlight-heading">Business Highlight <span className="free-tag">FREE · 24 HOURS</span></h2><p>A fresh local business takes the spotlight every day.</p></div><span className="rotation"><Clock3 size={15} /> Rotates every 24 hours</span></div>
          {highlight ? <div className="business-grid"><BusinessCard business={highlight} index={0} onOpen={() => setSelected(highlight)} /></div> : <div className="empty-state highlight-empty"><Sparkles size={22} /><strong>No eligible highlight right now</strong><span>Approved, active, paid businesses take turns here. Sample listings aren’t featured.</span></div>}
        </section>

        <section className="content-section search-results" aria-labelledby="results-heading">
          <div className="section-head"><div><div className="section-kicker">NEIGHBORHOOD BUSINESSES</div><h2 id="results-heading">Find your local favorite</h2><p>Search by what you need, where you need it, or a business name.</p></div></div>
          <div className="business-grid">
            {filtered.slice(0, 12).map((business, index) => <BusinessCard key={business.id} business={business} index={index} onOpen={() => setSelected(business)} />)}
            {!filtered.length && !loading && <div className="empty-state"><Search size={22} /><strong>No matches yet</strong><span>Try another service, keyword, city, or ZIP code.</span></div>}
            {loading && <div className="empty-state"><span className="spinner" />Finding neighborhood favorites…</div>}
          </div>
          <div className="all-businesses"><button className="text-button" onClick={() => { setQuery(""); setLocation(""); void runSearch("", ""); }}>Clear search <ArrowRight size={16} /></button></div>
        </section>

        <section className="promo-section" id="promotions">
          <div className="promo-intro"><span className="promo-spark">✳</span><div className="section-kicker">GOOD THINGS NEARBY</div><h2>Local promotions</h2><p>Little reasons to visit the businesses around you.</p></div>
          <div className="promo-list">{promotions.length ? promotions.map((promo) => <article className="promo-card" key={promo.id}><span className="promo-pill">LOCAL OFFER</span><h3>{promo.title}</h3><p>{promo.description || "A special offer from your neighborhood."}</p><small>{promo.business_name}</small></article>) : <article className="promo-card promo-placeholder"><span className="promo-pill">COMING UP LOCAL</span><h3>Discover a little something nearby.</h3><p>Published offers from eligible neighborhood businesses will show here.</p></article>}</div>
        </section>

        <section className="policy-section" id="terms"><div className="section-kicker">SHORTSTACK TERMS</div><h2>Terms & Conditions</h2><p>Businesses are responsible for their own listings, advertisements, pricing, services, availability, claims, transactions, refunds, disputes, and conduct. A listing on ShortStack is not an endorsement. Please verify important details directly with the business.</p><p>Owners must provide truthful, accurate, current, lawful, and non-misleading information and promotional content. ShortStack may review, restrict, suspend, hide, reject, or remove listings involving fraud, misleading or unlawful content, stolen material, manipulation, policy violations, or safety, legal, or security risks.</p></section>
        <section className="policy-section" id="privacy"><div className="section-kicker">YOUR PRIVACY</div><h2>Privacy Policy</h2><p>Public discovery shows only business information selected for public display. Owner login details, private addresses, staff assignments, payment references, and internal moderation records are not part of public business profiles.</p><p>This preview does not connect to a production privacy or account-deletion service. A reviewed Privacy Policy and tested deletion process are required before public launch.</p></section>

        <footer><Brand /><div className="footer-links"><a href="#terms">Terms & Conditions</a><a href="#privacy">Privacy Policy</a><span>© {new Date().getFullYear()} ShortStack</span></div></footer>
      </main>
      {showOwner && <OwnerDialog session={session} setSession={setSession} onClose={() => setShowOwner(false)} setNotice={setNotice} />}
      {selected && <BusinessDialog business={selected} onClose={() => setSelected(null)} onNewSearch={(term) => { setSelected(null); void runSearch(term); }} />}
    </div>
  );
}

function BusinessCard({ business, index, onOpen }: { business: PublicBusiness; index: number; onOpen: () => void }) {
  const palettes = ["card-mint", "card-peach", "card-lavender"];
  const imageUrl = safeImageUrl(business.profile_image_url);
  return <article className={`business-card ${palettes[index % palettes.length]}`}>
    <button className="business-open" onClick={onOpen} aria-label={`View ${business.name}`}>
      <div className="business-card-top"><span className="business-avatar">{imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : business.name.slice(0, 1).toUpperCase()}</span><span className="verified">LOCAL BUSINESS</span></div>
      <span className="business-category">{business.category || "Independent business"}{business.subcategory ? ` · ${business.subcategory}` : ""}</span>
      <h3>{business.name}</h3><p>{business.description || "A neighborhood business ready to meet you."}</p>
      <div className="card-meta"><span><MapPin size={14} /> {[business.city, business.state].filter(Boolean).join(", ") || business.service_area || "Local"}</span><span>★ {business.rating_count ? business.rating_average?.toFixed(1) : "New"} <small>({business.rating_count})</small></span></div>
    </button>
    <button className="card-cta" onClick={onOpen}>Explore business <ArrowRight size={15} /></button>
  </article>;
}

function BusinessDialog({ business, onClose, onNewSearch }: { business: PublicBusiness; onClose: () => void; onNewSearch: (term: string) => void }) {
  const [reviews, setReviews] = useState<Array<{ rating: number; comment: string; created_at: string }>>([]);
  const [profileSearch, setProfileSearch] = useState("");
  useEffect(() => {
    let alive = true;
    if (supabase) void supabase.from("public_reviews").select("rating,comment,created_at").eq("business_id", business.id).order("created_at", { ascending: false }).limit(5).then(({ data }) => { if (alive) setReviews(data ?? []); });
    return () => { alive = false; };
  }, [business.id]);
  const imageUrl = safeImageUrl(business.profile_image_url);
  const phone = business.public_phone?.replace(/[^+\d*#().-]/g, "");
  const email = business.public_email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(business.public_email) ? business.public_email : null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="business-dialog" role="dialog" aria-modal="true" aria-labelledby="business-title"><button className="close-button" onClick={onClose} aria-label="Close"><X /></button>{imageUrl ? <img className="dialog-avatar dialog-photo" src={imageUrl} alt={`${business.name} profile`} /> : <span className="dialog-avatar">{business.name.slice(0, 1)}</span>}<div className="section-kicker">{business.category || "LOCAL BUSINESS"}</div><h2 id="business-title">{business.name}</h2><p>{business.description}</p><div className="dialog-location"><MapPin size={16} /> {[business.city, business.state].filter(Boolean).join(", ") || business.service_area || "Local"}</div>{business.is_mobile && <p className="muted">Mobile business · {business.service_area || "Ask the business about its service area."}</p>}<form className="profile-search" onSubmit={(e) => { e.preventDefault(); if (profileSearch.trim()) onNewSearch(profileSearch.trim()); }}><label htmlFor="profile-search-input">Looking for something else nearby?</label><div><input id="profile-search-input" value={profileSearch} onChange={(e) => setProfileSearch(e.target.value)} placeholder="Search another service" /><button className="primary-button" type="submit">Search</button></div></form><div className="contact-actions"><a className={!phone ? "disabled" : ""} href={phone ? `tel:${phone}` : undefined} aria-disabled={!phone}>CALL</a><a className={!email ? "disabled" : ""} href={email ? `mailto:${email}` : undefined} aria-disabled={!email}>EMAIL</a></div><h3 className="review-title">Reviews <span>★ {business.rating_count ? business.rating_average?.toFixed(1) : "New"} · {business.rating_count}</span></h3>{reviews.length ? reviews.map((review, i) => <div className="review-row" key={i}><strong>{"★".repeat(review.rating)}</strong><p>{review.comment}</p></div>) : <p className="muted">No reviews yet.</p>}</section></div>;
}

function OwnerDialog({ session, setSession, onClose, setNotice }: { session: Session | null; setSession: (session: Session | null) => void; onClose: () => void; setNotice: (message: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState<Array<{ id: string; name: string; city: string | null; state: string | null; status: string; payment_status: string; paid_through: string | null }>>([]);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [category, setCategory] = useState("");
  const [businessType, setBusinessType] = useState("storefront");
  const [entityType, setEntityType] = useState("sole_proprietor");
  const [description, setDescription] = useState("");
  const [serviceArea, setServiceArea] = useState("");
  const [publicPhone, setPublicPhone] = useState("");
  const [publicEmail, setPublicEmail] = useState("");
  const [keywordText, setKeywordText] = useState("");

  useEffect(() => {
    if (!session || !supabase) return;
    void supabase.from("owner_business_dashboard").select("id,name,city,state,status,payment_status,paid_through").order("created_at", { ascending: false }).then(({ data, error: queryError }) => {
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
      name: name.trim(), description: description.trim() || null, entity_type: entityType,
      business_type: businessType, is_mobile: businessType === "mobile", city: city.trim(),
      state: stateName.trim().toUpperCase(), service_area: serviceArea.trim() || null,
      category: category.trim() || null, public_phone: publicPhone.trim() || null,
      public_email: publicEmail.trim() || null,
      keywords: [...new Set(keywordText.split(",").map((word) => word.trim().toLowerCase()).filter(Boolean))],
    }).select("id,name,city,state").single();
    if (insertError) { setError("We couldn’t save the listing. Confirm the database migration is installed and try again."); return; }
    setBusinesses((current) => [{ ...data, status: "draft", payment_status: "unpaid", paid_through: null }, ...current]); setCreating(false); setName(""); setCity(""); setStateName(""); setCategory(""); setDescription(""); setServiceArea(""); setPublicPhone(""); setPublicEmail(""); setKeywordText("");
    setNotice("Draft saved. Payment isn’t connected; the listing stays private until a verified payment and approval.");
  };

  const signOut = async () => { await supabase?.auth.signOut(); setSession(null); };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="owner-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-title"><button className="close-button" onClick={onClose} aria-label="Close"><X /></button><div className="section-kicker">YOUR STACKS</div><h2 id="owner-title">Manage your business</h2>{!isSupabaseConfigured && <div className="setup-warning">Supabase isn’t connected yet. Owner sign-in and saved listings are disabled.</div>}{error && <div className="form-error" role="alert">{error}</div>}
    {!session ? <form className="owner-form" onSubmit={authenticate}><label>Email<input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label><button className="primary-button" disabled={!supabase}>Sign in</button><p className="muted">Owner accounts are created through the configured Supabase Auth flow. Public visitors don’t need an account.</p></form> : <><div className="owner-toolbar"><span>Signed in as {session.user.email}</span><button className="text-button" onClick={() => void signOut()}>Log out</button></div><div className="owner-businesses"><div className="section-kicker">MY BUSINESSES</div>{businesses.length ? businesses.map((b) => <div className="owner-business-row" key={b.id}><strong>{b.name}</strong><span>{[b.city, b.state].filter(Boolean).join(", ")}</span><em>{b.status.replaceAll("_", " ")} · {b.payment_status.replaceAll("_", " ")}{b.paid_through ? ` · through ${new Date(b.paid_through).toLocaleDateString()}` : ""}</em></div>) : <p className="muted">No listings yet. Start with your first business.</p>}{creating ? <form className="owner-form create-form" onSubmit={createBusiness}><label>Business name<input value={name} onChange={(e) => setName(e.target.value)} required /></label><div className="form-pair"><label>Business/entity type<select value={entityType} onChange={(e) => setEntityType(e.target.value)}><option value="sole_proprietor">Sole proprietor</option><option value="llc">LLC</option><option value="corporation">Corporation</option><option value="partnership">Partnership</option><option value="other">Other</option></select></label><label>Listing type<select value={businessType} onChange={(e) => setBusinessType(e.target.value)}><option value="storefront">Storefront</option><option value="service_area">Service area</option><option value="mobile">Mobile business</option></select></label></div><label>Category or service<input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Choose any business type" /></label><label>Description<textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} /></label><div className="section-kicker">City and State</div><div className="form-pair"><label>City<input value={city} onChange={(e) => setCity(e.target.value)} required /></label><label>State<input value={stateName} onChange={(e) => setStateName(e.target.value)} maxLength={2} required /></label></div><label>Service area (optional)<input value={serviceArea} onChange={(e) => setServiceArea(e.target.value)} placeholder="City, neighborhood, or ZIP codes" /></label><div className="form-pair"><label>Public business phone (optional)<input type="tel" value={publicPhone} onChange={(e) => setPublicPhone(e.target.value)} /></label><label>Public business email (optional)<input type="email" value={publicEmail} onChange={(e) => setPublicEmail(e.target.value)} /></label></div><label>Search keywords (comma-separated)<input value={keywordText} onChange={(e) => setKeywordText(e.target.value)} placeholder="services, products, specialties" /></label><button className="primary-button">Save draft</button><small>$19.99 initial enrollment. Renewals are $25 every 2 months and must be paid manually. No automatic renewal or saved-card charges. Payment setup is still required before this listing can be published.</small></form> : <button className="primary-button" onClick={() => setCreating(true)}>Create Another Business Listing</button>}<p className="pricing-note">$19.99 initial enrollment · $25 every 2 months · manual renewal · no automatic charges.</p></div></>}</section></div>;
}

export default App;
