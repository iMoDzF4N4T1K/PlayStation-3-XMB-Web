/* HybrideLabs Settings (Option A) - localStorage backed
   Controls: Dark mode, Gaussian blur, Pulsate, Language
*/
(() => {
  const STORAGE = {
    theme: "hl_theme",      // "dark" | "light"
    blur: "hl_blur",        // "on" | "off"
    pulsate: "hl_pulsate",  // "on" | "off"
    lang: "hl_lang",        // "fr" | "en" | "de"
    tab: "hl_settings_tab" // "general" | "waves"
  };

  const DEFAULTS = { theme: "dark", blur: "on", pulsate: "off", lang: "fr", tab: "general" };

  const I18N = {
    fr: {
      "nav.home": "Home",
      "nav.projects": "Projects",
      "nav.contact": "Contact",
      "nav.settings": "Settings",
      "settings.title": "Settings",
      "settings.dark": "Dark mode",
      "settings.blur": "Gaussian blur",
      "settings.pulsate": "Pulsate",
      "settings.language": "Langue",
      "settings.tab.general": "Général",
      "settings.tab.waves": "Waves",
      "waves.title": "Wave Configuration",
      "home.subtitle": "Base propre: le background PS3-XMB tourne derrière, et ton contenu vit au-dessus. Remplace ce contenu par ton site quand tu veux.",
      "home.todo.title": "À brancher ensuite",
      "home.todo.1": "Ton layout HybrideLabs complet",
      "home.todo.2": "Tes settings (dark / blur / pulsate / langues)",
      "home.todo.3": "Ton contenu, tes pages, tes assets",
      "projects.title": "Projects",
      "projects.subtitle": "Placeholder — remplace par ta vraie page Projects.",
      "contact.title": "Contact",
      "contact.subtitle": "Placeholder — remplace par ta vraie page Contact."
    },
    en: {
      "nav.home": "Home",
      "nav.projects": "Projects",
      "nav.contact": "Contact",
      "nav.settings": "Settings",
      "settings.title": "Settings",
      "settings.dark": "Dark mode",
      "settings.blur": "Gaussian blur",
      "settings.pulsate": "Pulsate",
      "settings.language": "Language",
      "settings.tab.general": "General",
      "settings.tab.waves": "Waves",
      "waves.title": "Wave Configuration",
      "home.subtitle": "Clean base: the PS3-XMB background runs behind, and your content sits on top. Replace this content with your site whenever you want.",
      "home.todo.title": "Next to plug in",
      "home.todo.1": "Your full HybrideLabs layout",
      "home.todo.2": "Your settings (dark / blur / pulsate / languages)",
      "home.todo.3": "Your content, pages, assets",
      "projects.title": "Projects",
      "projects.subtitle": "Placeholder — replace with your real Projects page.",
      "contact.title": "Contact",
      "contact.subtitle": "Placeholder — replace with your real Contact page."
    },
    de: {
      "nav.home": "Home",
      "nav.projects": "Projekte",
      "nav.contact": "Kontakt",
      "nav.settings": "Einstellungen",
      "settings.title": "Einstellungen",
      "settings.dark": "Dunkelmodus",
      "settings.blur": "Gaussian Blur",
      "settings.pulsate": "Pulsieren",
      "settings.language": "Sprache",
      "settings.tab.general": "Allgemein",
      "settings.tab.waves": "Waves",
      "waves.title": "Wave Configuration",
      "home.subtitle": "Saubere Basis: Der PS3-XMB-Hintergrund läuft im Hintergrund, dein Inhalt liegt darüber. Ersetze diesen Inhalt später durch deine Website.",
      "home.todo.title": "Als Nächstes",
      "home.todo.1": "Dein komplettes HybrideLabs-Layout",
      "home.todo.2": "Deine Settings (dark / blur / pulsate / Sprachen)",
      "home.todo.3": "Dein Inhalt, Seiten, Assets",
      "projects.title": "Projekte",
      "projects.subtitle": "Platzhalter — ersetze durch deine echte Projekte-Seite.",
      "contact.title": "Kontakt",
      "contact.subtitle": "Platzhalter — ersetze durch deine echte Kontakt-Seite."
    }
  };

  function read(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function write(key, value) {
    try { localStorage.setItem(key, value); } catch {}
  }

  function getSettings() {
    return {
      theme: read(STORAGE.theme) || DEFAULTS.theme,
      blur: read(STORAGE.blur) || DEFAULTS.blur,
      pulsate: read(STORAGE.pulsate) || DEFAULTS.pulsate,
      lang: read(STORAGE.lang) || DEFAULTS.lang,
      tab: read(STORAGE.tab) || DEFAULTS.tab
    };
  }

  function applyTheme(theme) {
    document.body.classList.toggle("theme-light", theme === "light");
    document.body.classList.toggle("theme-dark", theme !== "light");
  }

  function applyBlur(blur) {
    document.body.classList.toggle("gaussian-off", blur === "off");
  }

  function applyPulsate(pulsate) {
    document.body.classList.toggle("pulsate-on", pulsate === "on");
  }

  function applyLanguage(lang) {
    const dict = I18N[lang] || I18N[DEFAULTS.lang];
    document.documentElement.lang = lang;

    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key && dict[key]) el.textContent = dict[key];
    });
  // --- Language flag (PNG) -------------------------------------------------
  // Displays a flag next to the language select. Uses the flags pack:
  //   img/graphics/flags/<name>.png
  // Works on GitHub Pages project pages and local dev.
  function hlBasePrefix() {
    // index.html => "img/..."
    // pages/*.html => "../img/..."
    return window.location.pathname.includes("/pages/") ? "../" : "";
  }

  function hlUpdateLangFlag(lang) {
    const img = document.getElementById("hlLangFlag");
    if (!img) return;

    // Adjust names here if your flags pack uses different filenames.
    const fileMap = {
      fr: "france.png",
      en: "united-kingdom.png",
      de: "germany.png"
    };

    const file = fileMap[lang] || fileMap.fr;
    img.src = `${hlBasePrefix()}img/graphics/flags/${file}`;
    img.alt = lang || "fr";
  }

  }

  function applyAll(s) {
    applyTheme(s.theme);
    applyBlur(s.blur);
    applyPulsate(s.pulsate);
    applyLanguage(s.lang);
    hlUpdateLangFlag(s.lang);
  }

  function setupUI() {
    const btn = document.getElementById("hlSettingsBtn");
    const panel = document.getElementById("hlSettingsPanel");
    const backdrop = document.getElementById("hlSettingsBackdrop");
    const closeBtn = panel?.querySelector("[data-action='close-settings']");
    const tDark = document.getElementById("hlToggleDark");
    const tBlur = document.getElementById("hlToggleBlur");
    const tPulsate = document.getElementById("hlTogglePulsate");
    const selLang = document.getElementById("hlSelectLang");

    const tabButtons = panel.querySelectorAll("[data-hl-tab]");
    const tabPanels = panel.querySelectorAll("[data-hl-tabpanel]");

    if (!btn || !panel || !backdrop) return;

    const open = () => {
      panel.classList.add("open");
      backdrop.hidden = false;
      backdrop.classList.add("open");
      // Ensure last selected tab is visible
      setTab(getSettings().tab || DEFAULTS.tab);
      btn.setAttribute("aria-expanded", "true");
      panel.setAttribute("aria-hidden", "false");
    };
    const close = () => {
      panel.classList.remove("open");
      backdrop.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      panel.setAttribute("aria-hidden", "true");
      // wait for opacity transition
      setTimeout(() => { backdrop.hidden = true; }, 180);
    };
    const toggle = () => (panel.classList.contains("open") ? close() : open());

    const setTab = (name) => {
      const tabName = (name === "waves" ? "waves" : "general");
      tabButtons.forEach((b) => {
        const active = b.getAttribute("data-hl-tab") === tabName;
        b.setAttribute("aria-selected", active ? "true" : "false");
      });
      tabPanels.forEach((p) => {
        const active = p.getAttribute("data-hl-tabpanel") === tabName;
        p.hidden = !active;
      });
      write(STORAGE.tab, tabName);
    };

    btn.addEventListener("click", toggle);

    // Optional: open settings from a CTA button in the page
    const heroOpen = document.getElementById("hlOpenSettingsFromHero");
    heroOpen?.addEventListener("click", open);

    tabButtons.forEach((b) => {
      b.addEventListener("click", () => setTab(b.getAttribute("data-hl-tab")));
    });
    closeBtn?.addEventListener("click", close);
    backdrop.addEventListener("click", close);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && panel.classList.contains("open")) close();
    });

    const s = getSettings();
    // UI initial state
    if (tDark) tDark.checked = s.theme === "dark";
    if (tBlur) tBlur.checked = s.blur === "on";
    if (tPulsate) tPulsate.checked = s.pulsate === "on";
    if (selLang) selLang.value = s.lang;
    hlUpdateLangFlag(s.lang);

    // Tabs initial state
    setTab(s.tab || DEFAULTS.tab);

    tDark?.addEventListener("change", () => {
      const theme = tDark.checked ? "dark" : "light";
      write(STORAGE.theme, theme);
      applyTheme(theme);
    });

    tBlur?.addEventListener("change", () => {
      const blur = tBlur.checked ? "on" : "off";
      write(STORAGE.blur, blur);
      applyBlur(blur);
    });

    tPulsate?.addEventListener("change", () => {
      const pulsate = tPulsate.checked ? "on" : "off";
      write(STORAGE.pulsate, pulsate);
      applyPulsate(pulsate);
    });

    selLang?.addEventListener("change", () => {
      const lang = selLang.value || DEFAULTS.lang;
      write(STORAGE.lang, lang);
      applyLanguage(lang);
      hlUpdateLangFlag(lang);
    });

    // Ensure settings are applied even if UI missing on some pages
    applyAll(getSettings());
  }

  document.addEventListener("DOMContentLoaded", () => {
    applyAll(getSettings());
    setupUI();
  });
})();
