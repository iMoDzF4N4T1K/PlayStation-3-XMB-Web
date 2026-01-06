(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    userPill: $("hlUserPill"),
    btnSignOut: $("btnSignOut"),
    btnLoginGithub: $("btnLoginGithub"),
    btnReload: $("btnReload"),

    authEmail: $("authEmail"),
    authPassword: $("authPassword"),
    btnEmailLogin: $("btnEmailLogin"),
    btnEmailSignup: $("btnEmailSignup"),
    authMsg: $("authMsg"),

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

  function showAuthMsg(kind, text) {
    if (!els.authMsg) return;
    els.authMsg.classList.remove("ok", "ko");
    els.authMsg.style.display = "block";
    if (kind) els.authMsg.classList.add(kind);
    els.authMsg.textContent = text;
  }

  function hideAuthMsg() {
    if (!els.authMsg) return;
    els.authMsg.style.display = "none";
    els.authMsg.textContent = "";
    els.authMsg.classList.remove("ok", "ko");
  }

  function adminUrl() {
    // URL propre (sans query/hash) pour redirect OAuth
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function makeClient() {
    if (!window.HL_SUPABASE_URL || !window.HL_SUPABASE_ANON_KEY) {
      console.warn("[Admin] Missing Supabase config. Load ./js/supabaseConfig.js first.");
      showAuthMsg("ko", "Config Supabase manquante (supabaseConfig.js).");
      return null;
    }

    return supabase.createClient(window.HL_SUPABASE_URL, window.HL_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true, // important pour OAuth callback
      },
    });
  }

  const sb = makeClient();
  if (!sb) return;

  let lastSession = null;

  function setConnectedUI(session) {
    lastSession = session;

    if (session?.user) {
      const provider = session.user.app_metadata?.provider || "email";
      const email = session.user.email ? ` • ${session.user.email}` : "";
      els.userPill.textContent = `Connecté • ${provider}${email}`;
      els.userPill.title = `uid: ${session.user.id}`;
      els.btnSignOut.style.display = "inline-flex";

      els.btnRefreshCfg.disabled = false;
      els.btnSave.disabled = false;

      // On masque le message d'auth si connecté
      hideAuthMsg();
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
    els.writeHint.style.display = "none";
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
      // updated_at est géré aussi par ton trigger, mais on le laisse : pas grave.
      updated_at: new Date().toISOString(),
    };
  }

  async function saveCfg() {
    if (!lastSession?.user) return;

    els.btnSave.disabled = true;
    els.btnRefreshCfg.disabled = true;
    els.writeHint.style.display = "none";
    els.statusText.textContent = "Enregistrement…";
    setBadge("", "…");

    const payload = buildUpdatePayload();
    const { error } = await sb.from("site_settings").update(payload).eq("id", 1);

    if (error) {
      console.warn("[Admin] Update error:", error);
      els.statusText.textContent = "Échec écriture (RLS / pas admin)";
      setBadge("ko", "Refusé");
      els.writeHint.style.display = "block";

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

  async function signInGithub() {
    const redirectTo = adminUrl();

    const { error } = await sb.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });

    if (error) {
      console.warn("[Admin] OAuth error:", error);
      showAuthMsg("ko", "Erreur OAuth GitHub. Regarde la console.");
    }
  }

  async function signInEmail() {
    hideAuthMsg();
    const email = (els.authEmail.value || "").trim();
    const password = els.authPassword.value || "";

    if (!email || !password) {
      showAuthMsg("ko", "Email et mot de passe requis.");
      return;
    }

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn("[Admin] Email login error:", error);
      showAuthMsg("ko", `Login impossible: ${error.message}`);
      return;
    }

    showAuthMsg("ok", "Connecté ✅");
    await refreshSession();
    await fetchCfg();
  }

  async function signUpEmail() {
    hideAuthMsg();
    const email = (els.authEmail.value || "").trim();
    const password = els.authPassword.value || "";

    if (!email || !password) {
      showAuthMsg("ko", "Email et mot de passe requis.");
      return;
    }

    // Sur GitHub Pages, on peut laisser Supabase gérer la confirmation email.
    // Si Confirm Email est activé, l’utilisateur devra valider l’email.
    const { error } = await sb.auth.signUp({ email, password });

    if (error) {
      console.warn("[Admin] Email signup error:", error);
      showAuthMsg("ko", `Inscription impossible: ${error.message}`);
      return;
    }

    showAuthMsg("ok", "Compte créé ✅ (si confirmation email activée: vérifie ta boîte mail).");
  }

  async function signOut() {
    await sb.auth.signOut();
    await refreshSession();
    await fetchCfg();
  }

  function wire() {
    els.btnLoginGithub?.addEventListener("click", () => signInGithub());
    els.btnReload?.addEventListener("click", () => window.location.reload());
    els.btnSignOut?.addEventListener("click", () => signOut());

    els.btnEmailLogin?.addEventListener("click", () => signInEmail());
    els.btnEmailSignup?.addEventListener("click", () => signUpEmail());

    els.btnRefreshCfg?.addEventListener("click", () => fetchCfg());
    els.btnSave?.addEventListener("click", () => saveCfg());

    els.toggleMaintenance?.addEventListener("change", () => {
      const on = els.toggleMaintenance.checked;
      els.statusText.textContent = on
        ? "Maintenance activée (non enregistré)"
        : "Maintenance désactivée (non enregistré)";
      setBadge(on ? "ko" : "ok", on ? "ON" : "OFF");
      if (lastSession?.user) els.btnSave.disabled = false;
    });

    ["input", "change"].forEach((evt) => {
      els.inputTitle?.addEventListener(evt, () => { if (lastSession?.user) els.btnSave.disabled = false; });
      els.inputMessage?.addEventListener(evt, () => { if (lastSession?.user) els.btnSave.disabled = false; });
      els.toggleShowHome?.addEventListener(evt, () => { if (lastSession?.user) els.btnSave.disabled = false; });

      els.authEmail?.addEventListener(evt, hideAuthMsg);
      els.authPassword?.addEventListener(evt, hideAuthMsg);
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
