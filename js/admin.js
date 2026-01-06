(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    userPill: $("hlUserPill"),
    btnSignOut: $("btnSignOut"),
    btnLoginGithub: $("btnLoginGithub"),
    btnLoginDiscord: $("btnLoginDiscord"), // peut être null si supprimé
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

  const on = (el, ev, fn) => { if (el) el.addEventListener(ev, fn); };

  function setBadge(kind, text) {
    const b = els.statusBadge;
    if (!b) return;
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
  let canWrite = false;

  function setConnectedUI(session) {
    lastSession = session;

    const pill = els.userPill;
    if (!pill) return;

    if (session?.user) {
      const provider = session.user.app_metadata?.provider || "oauth";
      const email = session.user.email ? ` • ${session.user.email}` : "";
      pill.textContent = `Connecté • ${provider}${email}`;
      pill.title = `uid: ${session.user.id}`;

      if (els.btnSignOut) els.btnSignOut.style.display = "inline-flex";
      if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = false;

      // Save dépend de canWrite (admin)
      if (els.btnSave) els.btnSave.disabled = !canWrite;
    } else {
      pill.textContent = "Non connecté";
      pill.removeAttribute("title");

      if (els.btnSignOut) els.btnSignOut.style.display = "none";
      if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = true;
      if (els.btnSave) els.btnSave.disabled = true;
    }

    if (els.writeHint) {
      els.writeHint.style.display = session?.user && !canWrite ? "block" : "none";
    }
  }

  async function refreshSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn("[Admin] getSession error:", error);
    lastSession = data?.session ?? null;
  }

  async function refreshAdminFlag() {
    canWrite = false;

    if (!lastSession?.user) {
      setConnectedUI(null);
      return;
    }

    // check admin via RPC
    const { data, error } = await sb.rpc("is_admin");
    if (error) {
      console.warn("[Admin] is_admin() error:", error);
      canWrite = false;
    } else {
      canWrite = !!data;
    }

    setConnectedUI(lastSession);
  }

  async function fetchCfg() {
    if (!els.statusText) return;

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
      if (els.btnSave) els.btnSave.disabled = true;
      return;
    }

    if (els.toggleMaintenance) els.toggleMaintenance.checked = !!data.maintenance;
    if (els.toggleShowHome) els.toggleShowHome.checked = !!data.show_home_content;
    if (els.inputTitle) els.inputTitle.value = data.title ?? "";
    if (els.inputMessage) els.inputMessage.value = data.message ?? "";

    els.statusText.textContent = data.maintenance ? "Maintenance activée" : "Maintenance désactivée";
    setBadge(data.maintenance ? "ko" : "ok", data.maintenance ? "ON" : "OFF");

    if (els.btnSave) els.btnSave.disabled = !(lastSession?.user && canWrite);
    if (els.writeHint) els.writeHint.style.display = lastSession?.user && !canWrite ? "block" : "none";
  }

  function buildUpdatePayload() {
    return {
      maintenance: !!els.toggleMaintenance?.checked,
      show_home_content: !!els.toggleShowHome?.checked,
      title: (els.inputTitle?.value || "").trim() || "Maintenance",
      message: (els.inputMessage?.value || "").trim() || "Maintenance en cours. Retour bientôt !",
      // updated_at géré côté DB (trigger)
    };
  }

  async function saveCfg() {
    if (!lastSession?.user) return;
    if (!canWrite) {
      if (els.writeHint) els.writeHint.style.display = "block";
      return;
    }

    if (els.btnSave) els.btnSave.disabled = true;
    if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = true;
    if (els.writeHint) els.writeHint.style.display = "none";
    if (els.statusText) els.statusText.textContent = "Enregistrement…";
    setBadge("", "…");

    const payload = buildUpdatePayload();

    const { error } = await sb.from("site_settings").update(payload).eq("id", 1);

    if (error) {
      console.warn("[Admin] Update error:", error);
      if (els.statusText) els.statusText.textContent = "Échec écriture (RLS / pas admin)";
      setBadge("ko", "Refusé");
      if (els.writeHint) els.writeHint.style.display = "block";
      if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = false;
      await fetchCfg();
      return;
    }

    if (els.statusText) els.statusText.textContent = "Enregistré ✅";
    setBadge(payload.maintenance ? "ko" : "ok", payload.maintenance ? "ON" : "OFF");

    if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = false;
    if (els.btnSave) els.btnSave.disabled = false;

    await fetchCfg();
  }

  async function signIn(provider) {
    const redirectTo = adminUrl();
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) {
      console.warn("[Admin] OAuth error:", error);
      alert("Erreur OAuth. Regarde la console.");
    }
  }

  async function signOut() {
    await sb.auth.signOut();
    await boot();
  }

  async function boot() {
    await refreshSession();
    await refreshAdminFlag();
    await fetchCfg();
  }

  function wire() {
    on(els.btnLoginGithub, "click", () => signIn("github"));
    on(els.btnLoginDiscord, "click", () => signIn("discord"));
    on(els.btnSignOut, "click", () => signOut());
    on(els.btnReload, "click", () => window.location.reload());
    on(els.btnRefreshCfg, "click", () => fetchCfg());
    on(els.btnSave, "click", () => saveCfg());

    on(els.toggleMaintenance, "change", () => {
      const onState = !!els.toggleMaintenance?.checked;
      if (els.statusText) {
        els.statusText.textContent = onState
          ? "Maintenance activée (non enregistré)"
          : "Maintenance désactivée (non enregistré)";
      }
      setBadge(onState ? "ko" : "ok", onState ? "ON" : "OFF");
      if (lastSession?.user && canWrite && els.btnSave) els.btnSave.disabled = false;
    });

    ["input", "change"].forEach((evt) => {
      on(els.inputTitle, evt, () => { if (lastSession?.user && canWrite && els.btnSave) els.btnSave.disabled = false; });
      on(els.inputMessage, evt, () => { if (lastSession?.user && canWrite && els.btnSave) els.btnSave.disabled = false; });
      on(els.toggleShowHome, evt, () => { if (lastSession?.user && canWrite && els.btnSave) els.btnSave.disabled = false; });
    });

    sb.auth.onAuthStateChange(async (_event, session) => {
      lastSession = session;
      await refreshAdminFlag();
      await fetchCfg();
    });
  }

  (async () => {
    wire();
    await boot();
  })();
})();
