(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    // header
    userPill: $("hlUserPill"),
    btnSignOut: $("btnSignOut"),
    btnReload: $("btnReload"),

    // oauth
    btnLoginGithub: $("btnLoginGithub"),

    // email/password
    inputEmail: $("inputEmail"),
    inputPassword: $("inputPassword"),
    btnLogin: $("btnLogin"),
    btnSignup: $("btnSignup"),

    // status
    statusText: $("hlStatusText"),
    statusBadge: $("hlStatusBadge"),
    writeHint: $("hlWriteHint"),

    // maintenance form
    toggleMaintenance: $("toggleMaintenance"),
    toggleShowHome: $("toggleShowHome"),
    inputTitle: $("inputTitle"),
    inputMessage: $("inputMessage"),
    btnSave: $("btnSave"),
    btnRefreshCfg: $("btnRefreshCfg"),
  };

  // ---------- UI helpers ----------
  function setBadge(kind, text) {
    if (!els.statusBadge) return;
    const b = els.statusBadge;
    b.classList.remove("ok", "ko");
    if (kind) b.classList.add(kind);
    b.innerHTML = `<span class="led"></span> ${text}`;
  }

  function adminUrl() {
    // Important: supprime hash + query pour éviter les URL bizarres après OAuth
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function ensureSupabase() {
    if (!window.HL_SUPABASE_URL || !window.HL_SUPABASE_ANON_KEY) {
      console.warn("[Admin] Missing Supabase config. Load ./js/supabaseConfig.js first.");
      alert("Supabase config manquante (HL_SUPABASE_URL / HL_SUPABASE_ANON_KEY).");
      return null;
    }
    if (!window.supabase?.createClient) {
      console.warn("[Admin] Supabase JS SDK not loaded.");
      alert("Supabase SDK manquante. Vérifie le script supabase-js.");
      return null;
    }
    return supabase.createClient(window.HL_SUPABASE_URL, window.HL_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce", // + robuste pour OAuth
      },
    });
  }

  const sb = ensureSupabase();
  if (!sb) return;

  let lastSession = null;

  function setConnectedUI(session) {
    lastSession = session;

    const isConnected = !!session?.user;
    const provider = session?.user?.app_metadata?.provider || "email";

    if (els.userPill) {
      if (isConnected) {
        const mail = session.user.email || "";
        els.userPill.textContent = mail ? `Connecté • ${provider} • ${mail}` : `Connecté • ${provider}`;
        els.userPill.title = `uid: ${session.user.id}`;
      } else {
        els.userPill.textContent = "Non connecté";
        els.userPill.removeAttribute("title");
      }
    }

    if (els.btnSignOut) els.btnSignOut.style.display = isConnected ? "inline-flex" : "none";
    if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = !isConnected;
    if (els.btnSave) els.btnSave.disabled = !isConnected;

    // Active/désactive login form (optionnel)
    if (els.btnLogin) els.btnLogin.disabled = isConnected;
    if (els.btnSignup) els.btnSignup.disabled = isConnected;
    if (els.inputEmail) els.inputEmail.disabled = isConnected;
    if (els.inputPassword) els.inputPassword.disabled = isConnected;
    if (els.btnLoginGithub) els.btnLoginGithub.disabled = isConnected;
  }

  async function refreshSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn("[Admin] getSession error:", error);
    setConnectedUI(data?.session ?? null);
  }

  // ---------- data ----------
  async function fetchCfg() {
    if (els.writeHint) els.writeHint.style.display = "none";
    if (els.statusText) els.statusText.textContent = "Chargement…";
    setBadge("", "Chargement");

    const { data, error } = await sb
      .from("site_settings")
      .select("id, maintenance, title, message, show_home_content, updated_at")
      .eq("id", 1)
      .single();

    if (error) {
      console.warn("[Admin] Read error:", error);
      if (els.statusText) els.statusText.textContent = "Erreur lecture (voir console).";
      setBadge("ko", "Erreur");
      if (els.btnSave) els.btnSave.disabled = true;
      return;
    }

    if (els.toggleMaintenance) els.toggleMaintenance.checked = !!data.maintenance;
    if (els.toggleShowHome) els.toggleShowHome.checked = !!data.show_home_content;
    if (els.inputTitle) els.inputTitle.value = data.title ?? "";
    if (els.inputMessage) els.inputMessage.value = data.message ?? "";

    if (els.statusText) els.statusText.textContent = data.maintenance ? "Maintenance activée" : "Maintenance désactivée";
    setBadge(data.maintenance ? "ko" : "ok", data.maintenance ? "ON" : "OFF");

    if (els.btnSave) els.btnSave.disabled = !lastSession?.user;
  }

  function buildUpdatePayload() {
    return {
      maintenance: !!els.toggleMaintenance?.checked,
      show_home_content: !!els.toggleShowHome?.checked,
      title: (els.inputTitle?.value || "").trim() || "Maintenance",
      message: (els.inputMessage?.value || "").trim() || "Maintenance en cours. Retour bientôt !",
      // updated_at est géré par trigger côté DB, pas besoin de l’envoyer
    };
  }

  async function saveCfg() {
    if (!lastSession?.user) {
      alert("Tu dois être connecté pour enregistrer.");
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

      // Message clair selon cas fréquent
      const msg =
        error?.code === "42501" || (error?.message || "").toLowerCase().includes("permission")
          ? "Refusé : tu n’es pas admin (RLS)."
          : "Échec écriture (voir console).";

      if (els.statusText) els.statusText.textContent = msg;
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

  // ---------- auth ----------
  async function signInOAuth(provider) {
    const redirectTo = adminUrl();
    const { error } = await sb.auth.signInWithOAuth({ provider, options: { redirectTo } });
    if (error) {
      console.warn("[Admin] OAuth error:", error);
      alert("Erreur OAuth. Regarde la console.");
    }
  }

  async function signInEmail() {
    const email = (els.inputEmail?.value || "").trim();
    const password = els.inputPassword?.value || "";

    if (!email || !password) {
      alert("Email + mot de passe requis.");
      return;
    }

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn("[Admin] signInWithPassword error:", error);
      alert("Login refusé : " + (error.message || "Erreur inconnue"));
      return;
    }

    await refreshSession();
    await fetchCfg();
  }

  async function signUpEmail() {
    const email = (els.inputEmail?.value || "").trim();
    const password = els.inputPassword?.value || "";

    if (!email || !password) {
      alert("Email + mot de passe requis.");
      return;
    }

    // IMPORTANT: selon ton réglage "Confirm email", il faudra valider le mail
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: adminUrl() },
    });

    if (error) {
      console.warn("[Admin] signUp error:", error);
      alert("Inscription refusée : " + (error.message || "Erreur inconnue"));
      return;
    }

    alert("Inscription OK. Si la confirmation email est activée, vérifie ta boîte mail.");
    await refreshSession();
    await fetchCfg();
  }

  async function signOut() {
    const { error } = await sb.auth.signOut();
    if (error) console.warn("[Admin] signOut error:", error);
    await refreshSession();
    await fetchCfg();
  }

  // ---------- wiring ----------
  function wire() {
    // Buttons safe (si un élément n’existe pas dans ton HTML, ça ne casse pas)
    els.btnLoginGithub?.addEventListener("click", () => signInOAuth("github"));
    els.btnLogin?.addEventListener("click", () => signInEmail());
    els.btnSignup?.addEventListener("click", () => signUpEmail());

    els.btnSignOut?.addEventListener("click", () => signOut());
    els.btnReload?.addEventListener("click", () => window.location.reload());
    els.btnRefreshCfg?.addEventListener("click", () => fetchCfg());
    els.btnSave?.addEventListener("click", () => saveCfg());

    els.toggleMaintenance?.addEventListener("change", () => {
      const on = !!els.toggleMaintenance.checked;
      if (els.statusText) {
        els.statusText.textContent = on
          ? "Maintenance activée (non enregistré)"
          : "Maintenance désactivée (non enregistré)";
      }
      setBadge(on ? "ko" : "ok", on ? "ON" : "OFF");
      if (lastSession?.user && els.btnSave) els.btnSave.disabled = false;
    });

    ["input", "change"].forEach((evt) => {
      els.inputTitle?.addEventListener(evt, () => { if (lastSession?.user && els.btnSave) els.btnSave.disabled = false; });
      els.inputMessage?.addEventListener(evt, () => { if (lastSession?.user && els.btnSave) els.btnSave.disabled = false; });
      els.toggleShowHome?.addEventListener(evt, () => { if (lastSession?.user && els.btnSave) els.btnSave.disabled = false; });
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
