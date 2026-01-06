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
  let isAdmin = false;

  function setConnectedUI(session) {
    lastSession = session;

    if (session?.user) {
      const provider = session.user.app_metadata?.provider || "oauth";
      els.userPill.textContent = `Connecté • ${provider}`;
      els.userPill.title = `uid: ${session.user.id}`;
      els.btnSignOut.style.display = "inline-flex";
      // l'activation des boutons dépend de isAdmin (check après)
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

  async function checkAdmin() {
    isAdmin = false;

    if (!lastSession?.user) {
      els.btnRefreshCfg.disabled = true;
      els.btnSave.disabled = true;
      return;
    }

    // Vérifie si l'utilisateur est présent dans public.admin_users
    const { data, error } = await sb
      .from("admin_users")
      .select("uid")
      .eq("uid", lastSession.user.id)
      .maybeSingle();

    if (error) {
      console.warn("[Admin] admin check error:", error);
      // Si tu n'es pas admin, RLS peut aussi refuser le SELECT sur admin_users
      // Mais dans notre setup, un admin peut lire, un non-admin non.
      // Donc erreur ici = très probablement pas admin.
      isAdmin = false;
    } else {
      isAdmin = !!data?.uid;
    }

    els.btnRefreshCfg.disabled = false;
    els.btnSave.disabled = !isAdmin;

    if (!isAdmin) {
      els.writeHint.style.display = "block";
      els.writeHint.textContent =
        "Tu es connecté mais tu n’es pas dans la liste admin (public.admin_users). Ajoute ton UID via SQL Editor.";
    } else {
      els.writeHint.style.display = "none";
    }
  }

  async function fetchCfg() {
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

    // Save seulement si admin
    els.btnSave.disabled = !isAdmin;
  }

  function buildUpdatePayload() {
    return {
      maintenance: !!els.toggleMaintenance.checked,
      show_home_content: !!els.toggleShowHome.checked,
      title: (els.inputTitle.value || "").trim() || "Maintenance",
      message: (els.inputMessage.value || "").trim() || "Maintenance en cours. Retour bientôt !",
      // PAS de updated_at : c’est le trigger serveur
    };
  }

  async function saveCfg() {
    if (!lastSession?.user || !isAdmin) return;

    els.btnSave.disabled = true;
    els.btnRefreshCfg.disabled = true;
    els.writeHint.style.display = "none";
    els.statusText.textContent = "Enregistrement…";
    setBadge("", "…");

    const payload = buildUpdatePayload();

    const { error } = await sb.from("site_settings").update(payload).eq("id", 1);

    if (error) {
      // Affiche l’erreur exacte
      console.warn("[Admin] Update error:", error);
      const details = [
        `message: ${error.message || "?"}`,
        `code: ${error.code || "?"}`,
        `hint: ${error.hint || "?"}`,
        `details: ${error.details || "?"}`,
        `status: ${error.status || "?"}`,
      ].join("\n");

      els.statusText.textContent = "Échec écriture (voir console)";
      setBadge("ko", "Refusé");
      els.writeHint.style.display = "block";
      els.writeHint.textContent = "Update refusé. Ouvre la console (F12) pour voir l’erreur exacte.\n" + details;

      els.btnRefreshCfg.disabled = false;
      await fetchCfg();
      els.btnSave.disabled = !isAdmin;
      return;
    }

    els.statusText.textContent = "Enregistré ✅";
    setBadge(payload.maintenance ? "ko" : "ok", payload.maintenance ? "ON" : "OFF");

    els.btnRefreshCfg.disabled = false;
    els.btnSave.disabled = !isAdmin;
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
    isAdmin = false;
    await refreshSession();
    await fetchCfg();
  }

  function wire() {
    // Si tu n’utilises plus Discord, tu peux supprimer ce bouton dans le HTML
    if (els.btnLoginGithub) els.btnLoginGithub.addEventListener("click", () => signIn("github"));
    if (els.btnLoginDiscord) els.btnLoginDiscord.addEventListener("click", () => signIn("discord"));

    els.btnSignOut.addEventListener("click", () => signOut());
    els.btnReload.addEventListener("click", () => window.location.reload());
    els.btnRefreshCfg.addEventListener("click", () => fetchCfg());
    els.btnSave.addEventListener("click", () => saveCfg());

    els.toggleMaintenance.addEventListener("change", () => {
      const on = els.toggleMaintenance.checked;
      els.statusText.textContent = on ? "Maintenance activée (non enregistré)" : "Maintenance désactivée (non enregistré)";
      setBadge(on ? "ko" : "ok", on ? "ON" : "OFF");
      if (isAdmin) els.btnSave.disabled = false;
    });

    ["input", "change"].forEach((evt) => {
      els.inputTitle.addEventListener(evt, () => { if (isAdmin) els.btnSave.disabled = false; });
      els.inputMessage.addEventListener(evt, () => { if (isAdmin) els.btnSave.disabled = false; });
      els.toggleShowHome.addEventListener(evt, () => { if (isAdmin) els.btnSave.disabled = false; });
    });

    sb.auth.onAuthStateChange(async (_event, session) => {
      setConnectedUI(session);
      await refreshSession();
      await checkAdmin();
      await fetchCfg();
    });
  }

  (async () => {
    wire();
    await refreshSession();
    await checkAdmin();
    await fetchCfg();
  })();
})();
