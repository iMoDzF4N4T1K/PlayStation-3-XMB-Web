/*
  HybrideLabs / PS3-XMB-Web - Supabase Maintenance Loader
  Reads `public.site_settings` (id=1) via Supabase REST and shows an overlay if maintenance=true.

  Required globals:
    - window.HL_SUPABASE_URL
    - window.HL_SUPABASE_ANON_KEY (publishable/public key)
*/

async function hlFetchSiteSettings() {
  try {
    const url = `${window.HL_SUPABASE_URL}/rest/v1/site_settings?id=eq.1&select=maintenance,title,message,show_home_content`;

    const res = await fetch(url, {
      headers: {
        apikey: window.HL_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${window.HL_SUPABASE_ANON_KEY}`,
      },
      cache: "no-store",
    });

    if (!res.ok) {
      console.warn("[Maintenance] Supabase fetch failed:", res.status, res.statusText);
      return null;
    }

    const data = await res.json();
    return data?.[0] ?? null;
  } catch (err) {
    console.warn("[Maintenance] Supabase fetch error:", err);
    return null;
  }
}

function hlShowMaintenance(cfg) {
  // Avoid duplicates
  if (document.getElementById("hlMaintenance")) return;

  const overlay = document.createElement("div");
  overlay.id = "hlMaintenance";

  const title = cfg?.title ?? "Maintenance";
  const message = cfg?.message ?? "Maintenance en cours. Retour bientôt !";

overlay.innerHTML = `
  <div class="hl-maintenance-card" role="dialog" aria-label="Maintenance">
    <div class="hl-maintenance-bar">
      <div style="display:flex; align-items:center; gap:10px;">
        <span class="hl-maintenance-dot"></span>
        <span style="opacity:.75; font-size:13px;">System message</span>
      </div>
      <span style="opacity:.6; font-size:12px;">XMB</span>
    </div>

    <div class="hl-maintenance-title">${cfg?.title ?? "Maintenance"}</div>
    <div class="hl-maintenance-msg">${cfg?.message ?? "Maintenance en cours."}</div>
    <div class="hl-maintenance-sub">Merci de revenir un peu plus tard.</div>

    <div class="hl-maintenance-actions">
      <button class="hl-maintenance-btn" type="button" onclick="location.reload()">Recharger</button>
    </div>
  </div>
`;


  document.body.appendChild(overlay);

  if (cfg?.show_home_content === false) {
    const app = document.getElementById("hybridelabs");
    if (app) app.style.display = "none";
  }
}

(async () => {
  if (!window.HL_SUPABASE_URL || !window.HL_SUPABASE_ANON_KEY) {
    console.warn("[Maintenance] Missing Supabase config. Did you load supabaseConfig.js?");
    return;
  }

  const cfg = await hlFetchSiteSettings();
  if (cfg?.maintenance === true) hlShowMaintenance(cfg);
})();
