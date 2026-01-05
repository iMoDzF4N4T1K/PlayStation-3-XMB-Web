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
    <div class="hl-maintenance-card">
      <div class="hl-maintenance-title">${title}</div>
      <div class="hl-maintenance-msg">${message}</div>
      <div class="hl-maintenance-sub">Merci de revenir un peu plus tard.</div>
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
