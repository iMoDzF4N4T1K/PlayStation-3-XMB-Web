(function () {
  const $ = (id) => document.getElementById(id);

  const els = {
    // header
    userPill: $("hlUserPill"),
    btnSignOut: $("btnSignOut"),
    btnCopyUid: $("btnCopyUid"),

    // auth
    btnLoginGithub: $("btnLoginGithub"),
    btnReload: $("btnReload"),
    authEmail: $("authEmail"),
    authPassword: $("authPassword"),
    btnEmailLogin: $("btnEmailLogin"),
    btnEmailSignup: $("btnEmailSignup"),
    authMsg: $("authMsg"),

    // status
    statusText: $("hlStatusText"),
    statusBadge: $("hlStatusBadge"),

    // maintenance form
    toggleMaintenance: $("toggleMaintenance"),
    toggleShowHome: $("toggleShowHome"),
    inputTitle: $("inputTitle"),
    inputMessage: $("inputMessage"),
    btnSave: $("btnSave"),
    btnRefreshCfg: $("btnRefreshCfg"),
    writeHint: $("hlWriteHint"),
  };

  const on = (el, evt, fn) => { if (el) el.addEventListener(evt, fn); };

  function setBadge(kind, text) {
    const b = els.statusBadge;
    if (!b) return;
    b.classList.remove("ok", "ko");
    if (kind) b.classList.add(kind);
    b.innerHTML = `<span class="led"></span> ${text}`;
  }

  function setAuthMsg(text, kind = "") {
    if (!els.authMsg) return;
    els.authMsg.style.display = text ? "block" : "none";
    els.authMsg.classList.remove("ok", "ko");
    if (kind) els.authMsg.classList.add(kind);
    els.authMsg.textContent = text || "";
  }

  function adminUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  function makeStorage() {
    // évite les crash si un navigateur bloque localStorage
    const ok = (s) => {
      try {
        const k = "__sb_test__";
        s.setItem(k, "1");
        s.removeItem(k);
        return true;
      } catch {
        return false;
      }
    };

    if (typeof localStorage !== "undefined" && ok(localStorage)) return localStorage;
    if (typeof sessionStorage !== "undefined" && ok(sessionStorage)) return sessionStorage;
    return undefined; // fallback mémoire (=> perd la session au refresh)
  }

  function makeClient() {
    if (!window.HL_SUPABASE_URL || !window.HL_SUPABASE_ANON_KEY) {
      console.warn("[Admin] Missing Supabase config. Load ./js/supabaseConfig.js first.");
      return null;
    }

    const storage = makeStorage();

    return supabase.createClient(window.HL_SUPABASE_URL, window.HL_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage,
      },
    });
  }

  const sb = makeClient();
  if (!sb) return;

  let lastSession = null;

  function setConnectedUI(session) {
    lastSession = session;

    const isConnected = !!session?.user;
    const provider = session?.user?.app_metadata?.provider || "oauth";
    const email = session?.user?.email;

    if (els.userPill) {
      els.userPill.textContent = isConnected
        ? `Connecté • ${provider}${email ? ` • ${email}` : ""}`
        : "Non connecté";
      if (isConnected) els.userPill.title = `uid: ${session.user.id}`;
      else els.userPill.removeAttribute("title");
    }

    if (els.btnSignOut) els.btnSignOut.style.display = isConnected ? "inline-flex" : "none";
    if (els.btnCopyUid) els.btnCopyUid.style.display = isConnected ? "inline-flex" : "none";

    // boutons maintenance
    if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = !isConnected;
    if (els.btnSave) els.btnSave.disabled = !isConnected;
  }

  async function refreshSession() {
    const { data, error } = await sb.auth.getSession();
    if (error) console.warn("[Admin] getSession error:", error);
    setConnectedUI(data?.session ?? null);
  }

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

    if (els.statusText) {
      els.statusText.textContent = data.maintenance ? "Maintenance activée" : "Maintenance désactivée";
    }
    setBadge(data.maintenance ? "ko" : "ok", data.maintenance ? "ON" : "OFF");
    if (els.btnSave) els.btnSave.disabled = !lastSession?.user;
  }

  function buildUpdatePayload() {
    return {
      maintenance: !!els.toggleMaintenance?.checked,
      show_home_content: !!els.toggleShowHome?.checked,
      title: (els.inputTitle?.value || "").trim() || "Maintenance",
      message: (els.inputMessage?.value || "").trim() || "Maintenance en cours. Retour bientôt !",
      // updated_at géré par trigger côté DB (mieux)
    };
  }

  async function saveCfg() {
    if (!lastSession?.user) return;

    if (els.btnSave) els.btnSave.disabled = true;
    if (els.btnRefreshCfg) els.btnRefreshCfg.disabled = true;
    if (els.writeHint) els.writeHint.style.display = "none";
    if (els.statusText) els.statusText.textContent = "Enregistrement…";
    setBadge("", "…");

    const payload = buildUpdatePayload();
    const { error } = await sb.from("site_settings").update(payload).eq("id", 1);

    if (error) {
      console.warn("[Admin] Update error:", error);
      if (els.statusText) els.statusText.textContent = "Échec écriture (RLS?)";
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

  async function signInGithub() {
    setAuthMsg("");
    const redirectTo = adminUrl();
    const { error } = await sb.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo },
    });
    if (error) {
      console.warn("[Admin] OAuth error:", error);
      setAuthMsg("Erreur OAuth GitHub. Regarde la console.", "ko");
      alert("Erreur OAuth GitHub. Regarde la console.");
    }
  }

  async function emailLogin() {
    setAuthMsg("");
    const email = (els.authEmail?.value || "").trim();
    const password = els.authPassword?.value || "";
    if (!email || !password) return setAuthMsg("Email et mot de passe requis.", "ko");

    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      console.warn("[Admin] Email login error:", error);
      return setAuthMsg(error.message || "Login impossible.", "ko");
    }

    setAuthMsg("Connecté ✅", "ok");
    await refreshSession();
    await fetchCfg();
  }

  async function emailSignup() {
    setAuthMsg("");
    const email = (els.authEmail?.value || "").trim();
    const password = els.authPassword?.value || "";
    if (!email || !password) return setAuthMsg("Email et mot de passe requis.", "ko");

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: adminUrl(),
      },
    });

    if (error) {
      console.warn("[Admin] Signup error:", error);
      return setAuthMsg(error.message || "Inscription impossible.", "ko");
    }

    // Selon ton réglage "Confirm email", il peut demander validation
    if (!data?.session) {
      setAuthMsg("Inscription OK ✅ Vérifie tes emails pour confirmer.", "ok");
    } else {
      setAuthMsg("Inscription + connexion OK ✅", "ok");
      await refreshSession();
      await fetchCfg();
    }
  }

  async function signOut() {
    setAuthMsg("");
    const { error } = await sb.auth.signOut();
    if (error) console.warn("[Admin] signOut error:", error);
    await refreshSession();
    await fetchCfg();
  }

  async function copyUid() {
    const uid = lastSession?.user?.id;
    if (!uid) return;
    try {
      await navigator.clipboard.writeText(uid);
      setAuthMsg("UID copié ✅", "ok");
    } catch {
      // fallback
      prompt("Copie ton UID :", uid);
    }
  }

  function wire() {
    on(els.btnLoginGithub, "click", () => signInGithub());
    on(els.btnReload, "click", () => window.location.reload());
    on(els.btnSignOut, "click", () => signOut());
    on(els.btnCopyUid, "click", () => copyUid());

    on(els.btnEmailLogin, "click", () => emailLogin());
    on(els.btnEmailSignup, "click", () => emailSignup());

    on(els.btnRefreshCfg, "click", () => fetchCfg());
    on(els.btnSave, "click", () => saveCfg());

    on(els.toggleMaintenance, "change", () => {
      const onVal = !!els.toggleMaintenance?.checked;
      if (els.statusText) {
        els.statusText.textContent = onVal
          ? "Maintenance activée (non enregistré)"
          : "Maintenance désactivée (non enregistré)";
      }
      setBadge(onVal ? "ko" : "ok", onVal ? "ON" : "OFF");
      if (lastSession?.user && els.btnSave) els.btnSave.disabled = false;
    });

    ["input", "change"].forEach((evt) => {
      on(els.inputTitle, evt, () => { if (lastSession?.user && els.btnSave) els.btnSave.disabled = false; });
      on(els.inputMessage, evt, () => { if (lastSession?.user && els.btnSave) els.btnSave.disabled = false; });
      on(els.toggleShowHome, evt, () => { if (lastSession?.user && els.btnSave) els.btnSave.disabled = false; });
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
