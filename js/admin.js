(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    userPill: $("hlUserPill"),
    btnSignOut: $("btnSignOut"),
    btnLoginGithub: $("btnLoginGithub"),
    btnLoginDiscord: $("btnLoginDiscord"),
    btnReload: $("btnReload"),

    statusText: $("hlStatusText"),
    statusBadge: $("hlStatusBadge"),

    toggleMaintenance: $("toggleMaintenance"),
    toggleShowHome: $("toggleShowHome"),
    inputTitle: $("inputTitle"),
    inputMessage: $("inputMessage"),
    btnSave: $("btnSave"),
    btnRefreshCfg: $("btnRefreshCfg"),
    writeHint: $("hlWriteHint"),
  };

  function setBadge(kind, text) {
    const b = els.statusBadge;
    b.classList.remove("ok", "ko");
    if (kind) b.classList.add(kind);
    b.innerHTML = `<span class="led"></span> ${text}`;
  }

  function adminUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function makeClient() {
    if (!window.HL_SUPABASE_URL || !window.HL_SUPABASE_ANON_KEY) {
      console.warn("[Admin] Missing Supabase config. Load ./js/supabaseConfig.js first.");
      return null;
    }

    return supabase.createClient(window.HL_SUPABASE_URL, window.HL_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  const sb = makeClient();
  if (!sb) return;

  let lastSession = null;

  // ✅ Provider fiable (sinon Supabase peut afficher "email" même si tu viens de GitHub)
  function getProviderFromSession(session) {
    const user = session?.user;
    if (!user) return "—";

    // ordre de priorité :
    // 1) identities[0].provider (le plus fiable)
    // 2) app_metadata.provider
    // 3) provider/role fallback
    return (
      user.identities?.[0]?.provider ||
      user.app_metadata?.provider ||
      user.app_metadata?.providers?.[0] ||
      "oauth"
    );
  }

  function setConnectedUI(session) {
    lastSession = session;

    if (session?.user) {
      const provider = getProviderFromSession(session);
      const uid = session.user.id;

      els.userPill.textContent = `Connecté • ${provider}`;
      els.userPill.title = `uid: ${uid}`;

      // Logs utiles pour debug (tu peux laisser)
      console.info("[Admin] Connected:", { provider, uid });

      els.btnSignOut.style.display = "inline-flex";
      els.btnRefreshCfg.disabled = false;
      els.btnSave.disabled = false;
    } else {
      els.userPill.textContent = "Non connecté";
      els.userPill.removeAttribute("title");
      els.btnSignOut.style.display = "none";
      els.btnRefreshCfg.disabled = true;
      els.btnSave.disabled = true;
    }
  }

  async function refreshSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn("[Admin] getSession error:", error);
    setConnectedUI(data?.session ?? null);
  }

  async function fetchCfg() {
    if (els.writeHint) els.writeHint.style.display = "none";
    els.statusText.textContent = "Chargement…";
    setBadge("", "Chargement");

    const { data, error } = await sb
      .from("site_settings")
      .select("id, maintenance, title, message, show_home_content, updated_at")
      .eq("id", 1)
      .single();

    if (error) {
      console.warn("[Admin] Read error:", error);
      els.statusText.textContent = "Erreur lecture (voir console).";
      setBadge("ko", "Erreur");
      els.btnSave.disabled = true;
      return;
    }

    els.toggleMaintenance.checked = !!data.maintenance;
    els.toggleShowHome.checked = !!data.show_home_content;
    els.inputTitle.value = data.title ?? "";
    els.inputMessage.value = data.message ?? "";

    els.statusText.textContent = data.maintenance ? "Maintenance activée" : "Maintenance désactivée";
    setBadge(data.maintenance ? "ko" : "ok", data.maintenance ? "ON" : "OFF");
    els.btnSave.disabled = !lastSession?.user;
  }

  function buildUpdatePayload() {
    return {
      maintenance: !!els.toggleMaintenance.checked,
      show_home_content: !!els.toggleShowHome.checked,
      title: (els.inputTitle.value || "").trim() || "Maintenance",
      message: (els.inputMessage.value || "").trim() || "Maintenance en cours. Retour bientôt !",
      // pas obligatoire si tu as un trigger, mais ok de le garder
      updated_at: new Date().toISOString(),
    };
  }

  async function saveCfg() {
    if (!lastSession?.user) return;

    els.btnSave.disabled = true;
    els.btnRefreshCfg.disabled = true;
    if (els.writeHint) els.writeHint.style.display = "none";
    els.statusText.textContent = "Enregistrement…";
    setBadge("", "…");

    const payload = buildUpdatePayload();

    const { error } = await sb.from("site_settings").update(payload).eq("id", 1);

    if (error) {
      console.warn("[Admin] Update error:", error);

      // ✅ message plus clair si RLS refuse
      const isRls =
        error?.code === "42501" ||
        String(error?.message || "").toLowerCase().includes("row level security");

      els.statusText.textContent = isRls
        ? "Refusé (RLS) : ton UID n'est pas admin_users"
        : "Échec écriture (voir console)";

      setBadge("ko", "Refusé");
      if (els.writeHint) els.writeHint.style.display = "block";

      els.btnRefreshCfg.disabled = false;
      await fetchCfg();
      return;
    }

    els.statusText.textContent = "Enregistré ✅";
    setBadge(payload.maintenance ? "ko" : "ok", payload.maintenance ? "ON" : "OFF");

    els.btnRefreshCfg.disabled = false;
    els.btnSave.disabled = false;
    await fetchCfg();
  }

  async function signIn(provider) {
    const redirectTo = adminUrl();
    console.info("[Admin] OAuth signIn:", { provider, redirectTo });

    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) {
      console.warn("[Admin] OAuth error:", error);
      alert("Erreur OAuth. Regarde la console.");
    }
  }

  async function signOut() {
    await sb.auth.signOut();
    await refreshSession();
    await fetchCfg();
  }

  function wire() {
    // ✅ safe addEventListener (au cas où tu supprimes Discord du HTML)
    if (els.btnLoginGithub) els.btnLoginGithub.addEventListener("click", () => signIn("github"));
    if (els.btnLoginDiscord) els.btnLoginDiscord.addEventListener("click", () => signIn("discord"));

    if (els.btnSignOut) els.btnSignOut.addEventListener("click", () => signOut());
    if (els.btnReload) els.btnReload.addEventListener("click", () => window.location.reload());
    if (els.btnRefreshCfg) els.btnRefreshCfg.addEventListener("click", () => fetchCfg());
    if (els.btnSave) els.btnSave.addEventListener("click", () => saveCfg());

    els.toggleMaintenance.addEventListener("change", () => {
      const on = els.toggleMaintenance.checked;
      els.statusText.textContent = on
        ? "Maintenance activée (non enregistré)"
        : "Maintenance désactivée (non enregistré)";
      setBadge(on ? "ko" : "ok", on ? "ON" : "OFF");
      if (lastSession?.user) els.btnSave.disabled = false;
    });

    ["input", "change"].forEach((evt) => {
      els.inputTitle.addEventListener(evt, () => {
        if (lastSession?.user) els.btnSave.disabled = false;
      });
      els.inputMessage.addEventListener(evt, () => {
        if (lastSession?.user) els.btnSave.disabled = false;
      });
      els.toggleShowHome.addEventListener(evt, () => {
        if (lastSession?.user) els.btnSave.disabled = false;
      });
    });

    sb.auth.onAuthStateChange((_event, session) => {
      setConnectedUI(session);
      fetchCfg();
    });
  }

  (async () => {
    wire();
    await refreshSession();
    await fetchCfg();
  })();
})();
