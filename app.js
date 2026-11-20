(() => {
  "use strict";

  const STORAGE_SAVED_KEY = "nearby_companies_saved_v1";
  const STORAGE_THEME_KEY = "nearby_companies_theme_v1";

  // Default map center: Tokyo Station
  const DEFAULT_CENTER = { lat: 35.681236, lon: 139.767125 };

  // Category Definitions
  const CATEGORY_META = {
    corporate: { label: "一般企業・本社", icon: "🏢", color: "#2563eb" },
    it_pro: { label: "IT・専門・研究", icon: "💻", color: "#7c3aed" },
    manufacturing: { label: "製造・工場・建設", icon: "🏭", color: "#ea580c" },
    finance_realty: { label: "金融・不動産・士業", icon: "🏦", color: "#059669" },
    office_bldg: { label: "オフィスビル", icon: "🏙️", color: "#475569" }
  };

  // Detailed Japanese Subcategory Labels for OSM tags
  const OSM_SUBTYPE_JA = {
    "office:company": "企業オフィス",
    "office:corporation": "法人・本社",
    "office:yes": "事務所・オフィス",
    "office:it": "IT・ソフトウェア企業",
    "office:telecommunication": "通信・テレコム企業",
    "office:research": "研究開発・研究所",
    "office:consulting": "コンサルティング",
    "office:advertising": "広告代理店・マーケティング",
    "office:architect": "建築設計事務所",
    "office:engineer": "エンジニアリング事務所",
    "office:surveyor": "測量事務所",
    "office:graphic_design": "デザイン事務所",
    "office:publisher": "出版社",
    "office:newspaper": "新聞・報道機関",
    "office:employment_agency": "人材紹介・派遣会社",
    "office:logistics": "物流・運輸オフィス",
    "office:moving_company": "引越・運送業",
    "office:energy_supplier": "エネルギー・電力・ガス",
    "office:financial": "金融機関オフィス",
    "office:financial_advisor": "財務・ファイナンシャル",
    "office:insurance": "保険会社",
    "office:estate_agent": "不動産会社",
    "office:property_management": "不動産管理会社",
    "office:lawyer": "法律事務所",
    "office:notary": "公証役場・法務",
    "office:accountant": "会計事務所",
    "office:tax_advisor": "税理士事務所",
    "office:association": "業界団体・協会",
    "office:foundation": "財団法人",
    "office:cooperative": "協同組合",
    "office:coworking": "コワーキングオフィス",
    "office:construction_company": "建設会社",
    "building:office": "オフィスビル",
    "building:commercial": "商業・テナントビル",
    "building:industrial": "工場・産業施設",
    "industrial:factory": "工場",
    "industrial:warehouse": "物流倉庫",
    "industrial:manufacturing": "製造拠点",
    "craft:electronics_repair": "電子機器技術",
    "craft:metal_construction": "金属加工・鉄工所",
    "craft:carpenter": "工務店・木工",
    "craft:electrician": "電気工事会社",
    "craft:plumber": "管工事・設備会社",
    "craft:hvac": "空調設備会社",
    "craft:printer": "印刷会社"
  };

  // State
  const state = {
    searchCenter: null,
    searchLabel: "",
    accuracyMeters: null,
    radiusMeters: 2000,
    activeCategory: "all",
    sortBy: "distance",
    keyword: "",
    companies: [],
    filteredCompanies: [],
    selectedId: null,
    savedMap: loadSavedMap(),
    activeRequestId: 0,
    isSearching: false
  };

  // DOM Elements
  const dom = {
    locateBtn: document.getElementById("locateBtn"),
    welcomeLocateBtn: document.getElementById("welcomeLocateBtn"),
    placeSearchForm: document.getElementById("placeSearchForm"),
    placeSearchInput: document.getElementById("placeSearchInput"),
    currentLocationLabel: document.getElementById("currentLocationLabel"),
    radiusSelect: document.getElementById("radiusSelect"),
    sortSelect: document.getElementById("sortSelect"),
    keywordFilterInput: document.getElementById("keywordFilterInput"),
    categoryChips: document.getElementById("categoryChips"),
    resultCountNum: document.getElementById("resultCountNum"),
    mobileCountBadge: document.getElementById("mobileCountBadge"),
    statusBadge: document.getElementById("statusBadge"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    companyList: document.getElementById("companyList"),
    searchMapCenterBtn: document.getElementById("searchMapCenterBtn"),
    sidebarPanel: document.getElementById("sidebarPanel"),
    mobileTabMap: document.getElementById("mobileTabMap"),
    mobileTabList: document.getElementById("mobileTabList"),
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    themeIconSun: document.getElementById("themeIconSun"),
    themeIconMoon: document.getElementById("themeIconMoon"),
    toast: document.getElementById("toast")
  };

  // Initialize Leaflet Map
  const map = L.map("map", {
    center: [DEFAULT_CENTER.lat, DEFAULT_CENTER.lon],
    zoom: 14,
    zoomControl: false
  });

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors | Wikidata / Wikipedia'
  }).addTo(map);

  const markersLayer = L.layerGroup().addTo(map);
  const centerLayer = L.layerGroup().addTo(map);
  const markerById = new Map();

  // Utility Functions
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (deg) => (deg * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(meters) {
    if (meters == null || Number.isNaN(meters)) return "";
    const walkMin = Math.max(1, Math.round(meters / 80));
    if (meters < 1000) {
      return `${Math.round(meters)}m（徒歩約${walkMin}分）`;
    }
    return `${(meters / 1000).toFixed(2)}km（徒歩約${walkMin}分）`;
  }

  function normalizeCompanyName(name) {
    if (!name) return "";
    return name
      .normalize("NFKC")
      .replace(/株式会社|有限会社|合同会社|\(株\)|\(有\)|㈱|㈲/g, "")
      .replace(/[\s・\-_]/g, "")
      .toLowerCase();
  }

  let toastTimer = null;
  function showToast(message, duration = 3600) {
    dom.toast.textContent = message;
    dom.toast.classList.remove("hidden");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      dom.toast.classList.add("hidden");
    }, duration);
  }

  function loadSavedMap() {
    try {
      const raw = localStorage.getItem(STORAGE_SAVED_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function persistSavedMap() {
    try {
      localStorage.setItem(STORAGE_SAVED_KEY, JSON.stringify(state.savedMap));
    } catch {
      // Ignore quota errors
    }
  }

  // Theme Management
  function initTheme() {
    const savedTheme = localStorage.getItem(STORAGE_THEME_KEY);
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = savedTheme || (prefersDark ? "dark" : "light");
    applyTheme(theme);
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (theme === "dark") {
      dom.themeIconSun.classList.remove("hidden");
      dom.themeIconMoon.classList.add("hidden");
    } else {
      dom.themeIconSun.classList.add("hidden");
      dom.themeIconMoon.classList.remove("hidden");
    }
    try {
      localStorage.setItem(STORAGE_THEME_KEY, theme);
    } catch {
      // Ignore
    }
  }

  // Classification Helpers
  function classifyOsmFeature(osmKey, osmVal, name) {
    const pair = `${osmKey}:${osmVal}`;
    const subtypeLabel =
      OSM_SUBTYPE_JA[pair] ||
      (osmKey === "industrial" ? "工場・産業施設" : osmKey === "craft" ? "製造・技術・工事事業" : "企業・事業所");

    if (osmKey === "building" && (osmVal === "office" || osmVal === "commercial")) {
      return { category: "office_bldg", subtype: subtypeLabel };
    }
    if (osmKey === "industrial" || osmKey === "craft" || pair === "building:industrial" || pair === "office:construction_company") {
      return { category: "manufacturing", subtype: subtypeLabel };
    }
    if (
      [
        "it",
        "telecommunication",
        "research",
        "consulting",
        "advertising",
        "architect",
        "design",
        "engineer",
        "surveyor",
        "graphic_design",
        "publisher",
        "newspaper"
      ].includes(osmVal)
    ) {
      return { category: "it_pro", subtype: subtypeLabel };
    }
    if (
      [
        "financial",
        "financial_advisor",
        "insurance",
        "estate_agent",
        "property_management",
        "lawyer",
        "notary",
        "accountant",
        "tax_advisor"
      ].includes(osmVal)
    ) {
      return { category: "finance_realty", subtype: subtypeLabel };
    }
    if (osmVal === "coworking") {
      return { category: "office_bldg", subtype: subtypeLabel };
    }

    // Name-based refinement for generic office=company / office=yes
    if (/システム|ソフト|情報|テクノロジ|デジタル|ネット|IT|通信|ラボ|研究所|デザイン|出版|放送/.test(name)) {
      return { category: "it_pro", subtype: subtypeLabel };
    }
    if (/工業|製作所|製造|化成|薬品|重工|電機|建設|工務|鉄工|印刷/.test(name)) {
      return { category: "manufacturing", subtype: subtypeLabel };
    }
    if (/銀行|証券|保険|信用金庫|不動産|地所|法律|税理士|会計/.test(name)) {
      return { category: "finance_realty", subtype: subtypeLabel };
    }

    return { category: "corporate", subtype: subtypeLabel };
  }

  function classifyWikiCompany(title, desc, catsText) {
    const combined = `${title} ${desc} ${catsText}`;
    if (/オフィスビル|超高層ビル|複合施設|商業施設/.test(combined) && !/企業|会社|ホールディングス|銀行|メーカー/.test(desc)) {
      return { category: "office_bldg", subtype: desc || "オフィス・複合ビル" };
    }
    if (/銀行|証券|保険|金融|信用金庫|リース|不動産|デベロッパー/.test(combined)) {
      return { category: "finance_realty", subtype: desc || "金融・不動産企業" };
    }
    if (/IT|ソフトウェア|情報・通信|インターネット|通信事業|放送|出版|新聞社|ゲーム会社|広告|システム|研究所/.test(combined)) {
      return { category: "it_pro", subtype: desc || "IT・情報通信・メディア企業" };
    }
    if (/メーカー|製造|工業|製作所|電機|自動車|化学|製薬|食品|建設|ゼネコン|重工|金属|機械|繊維|製紙/.test(combined)) {
      return { category: "manufacturing", subtype: desc || "メーカー・製造・建設企業" };
    }
    return { category: "corporate", subtype: desc || "企業・法人本社" };
  }

  // Build Address from Photon Properties
  function formatPhotonAddress(props) {
    const parts = [
      props.state || "",
      props.county || "",
      props.city || "",
      props.district || "",
      props.locality || "",
      props.street || "",
      props.housenumber || ""
    ].filter(Boolean);
    // Deduplicate adjacent identical segments
    const deduped = [];
    for (const p of parts) {
      if (deduped[deduped.length - 1] !== p) deduped.push(p);
    }
    return deduped.join("");
  }

  // Fetch JSON with timeout
  async function fetchJsonWithTimeout(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }

  // Data Stream 1-3: Photon OpenStreetMap Reverse POI Queries
  async function fetchPhotonStream(lat, lon, radiusKm, tagParams) {
    const qs = tagParams.map((t) => `osm_tag=${encodeURIComponent(t)}`).join("&");
    const url = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&radius=${radiusKm}&limit=50&${qs}`;
    const data = await fetchJsonWithTimeout(url, 8500);
    if (!data || !Array.isArray(data.features)) return [];

    const items = [];
    for (const feat of data.features) {
      const props = feat.properties || {};
      const coords = feat.geometry && feat.geometry.coordinates;
      if (!props.name || !Array.isArray(coords) || coords.length < 2) continue;

      // Filter out non-company government offices if tagged office=government
      if (props.osm_value === "government" || props.osm_value === "administrative" || props.osm_value === "diplomatic") {
        continue;
      }

      const itemLon = Number(coords[0]);
      const itemLat = Number(coords[1]);
      const dist = haversineMeters(lat, lon, itemLat, itemLon);

      const { category, subtype } = classifyOsmFeature(props.osm_key || "", props.osm_value || "", props.name);
      const address = formatPhotonAddress(props);

      items.push({
        id: `osm_${props.osm_type || "N"}_${props.osm_id || `${itemLat}_${itemLon}`}`,
        name: props.name,
        category,
        subtype,
        address,
        description: "",
        lat: itemLat,
        lon: itemLon,
        distance: dist,
        corpNum: "",
        website: "",
        foundedYear: "",
        isListed: false,
        wikipediaUrl: "",
        source: "OpenStreetMap"
      });
    }
    return items;
  }

  // Data Stream 4: Japanese Wikipedia GeoSearch + Wikidata Corporate Claims
  async function fetchWikiCompaniesStream(lat, lon, radiusMeters) {
    const ggsRadius = Math.min(10000, Math.max(500, radiusMeters));
    const wpUrl =
      `https://ja.wikipedia.org/w/api.php?action=query&generator=geosearch` +
      `&ggscoord=${lat}|${lon}&ggsradius=${ggsRadius}&ggslimit=50` +
      `&prop=coordinates|pageprops|description|categories&cllimit=max&origin=*&format=json`;

    const wpData = await fetchJsonWithTimeout(wpUrl, 8000);
    const pagesObj = wpData?.query?.pages;
    if (!pagesObj) return [];

    const pages = Object.values(pagesObj);
    const qids = pages
      .map((p) => p.pageprops?.wikibase_item)
      .filter(Boolean);

    // Batch-fetch Wikidata entities for corporate numbers (P3225), websites (P856), founded year (P571), stock exchange (P414)
    let wdEntities = {};
    if (qids.length > 0) {
      try {
        const uniqueQids = Array.from(new Set(qids)).slice(0, 50);
        const wdUrl =
          `https://www.wikidata.org/w/api.php?action=wbgetentities` +
          `&ids=${uniqueQids.join("|")}&props=claims&origin=*&format=json`;
        const wdData = await fetchJsonWithTimeout(wdUrl, 7000);
        wdEntities = wdData?.entities || {};
      } catch {
        // Proceed with Wikipedia info even if Wikidata enrichment fails
      }
    }

    const excludePattern =
      /鉄道駅|日本の駅|廃駅|日本の神社|日本の寺院|キリスト教の教会|日本の公園|日本の城|史跡|重要文化財|日本の小学校|日本の中学校|日本の高等学校|日本の大学|日本の幼稚園|日本の病院|日本の河川|日本の橋|日本の道路|交差点|市町村|特別区|町・字|かつて存在した/;

    const positiveCompanyPattern =
      /企業|会社|メーカー|銀行|信用金庫|証券|保険|商社|出版|新聞社|放送|通信|ソフトウェア|百貨店|チェーン|ホールディングス|グループ本社|実業|法人|研究所|工場|製作所|工業|建設|不動産|鉄道事業者|バス事業者|航空会社|物流|オフィスビル|超高層ビル/;

    const results = [];
    for (const page of pages) {
      const coord = page.coordinates?.[0];
      if (!coord || !page.title) continue;

      const catsText = (page.categories || []).map((c) => c.title || "").join(" ");
      const desc = page.description || "";
      const qid = page.pageprops?.wikibase_item;
      const entity = qid ? wdEntities[qid] : null;
      const claims = entity?.claims || {};

      const corpNum = claims.P3225?.[0]?.mainsnak?.datavalue?.value || "";
      const website = claims.P856?.[0]?.mainsnak?.datavalue?.value || "";
      const isListed = Boolean(claims.P414);
      const hasIndustry = Boolean(claims.P452);

      let foundedYear = "";
      const rawTime = claims.P571?.[0]?.mainsnak?.datavalue?.value?.time;
      if (typeof rawTime === "string") {
        const m = rawTime.match(/([0-9]{4})/);
        if (m) foundedYear = `${m[1]}年設立`;
      }

      // Exclude stations, schools, parks, shrines, historical ruins, administrative divisions
      if (excludePattern.test(catsText) || /駅$/.test(page.title)) {
        continue;
      }

      const isCompanyMatch =
        positiveCompanyPattern.test(catsText) ||
        positiveCompanyPattern.test(desc) ||
        isListed ||
        (Boolean(corpNum) && hasIndustry);

      if (!isCompanyMatch) continue;

      const dist = haversineMeters(lat, lon, coord.lat, coord.lon);
      const { category, subtype } = classifyWikiCompany(page.title, desc, catsText);

      results.push({
        id: `wiki_${page.pageid}`,
        name: page.title,
        category,
        subtype,
        address: "",
        description: desc,
        lat: coord.lat,
        lon: coord.lon,
        distance: dist,
        corpNum: typeof corpNum === "string" ? corpNum : "",
        website: typeof website === "string" ? website : "",
        foundedYear,
        isListed,
        wikipediaUrl: `https://ja.wikipedia.org/wiki/${encodeURIComponent(page.title)}`,
        source: "Wikipedia/Wikidata"
      });
    }

    return results;
  }

  // Merge and Deduplicate Multi-Source Results
  function mergeCompanies(rawList, radiusMeters) {
    const byId = new Map();
    for (const item of rawList) {
      if (item.distance > radiusMeters * 1.05) continue;
      if (!byId.has(item.id)) {
        byId.set(item.id, { ...item });
      }
    }

    const uniqueById = Array.from(byId.values());
    const merged = [];

    for (const candidate of uniqueById) {
      const normName = normalizeCompanyName(candidate.name);
      if (!normName) continue;

      const existing = merged.find((m) => {
        const sameNorm = normalizeCompanyName(m.name) === normName;
        if (!sameNorm) return false;
        return haversineMeters(m.lat, m.lon, candidate.lat, candidate.lon) < 280;
      });

      if (!existing) {
        merged.push(candidate);
      } else {
        // Enrich existing record with complementary fields
        if (!existing.address && candidate.address) existing.address = candidate.address;
        if (!existing.description && candidate.description) existing.description = candidate.description;
        if (!existing.corpNum && candidate.corpNum) existing.corpNum = candidate.corpNum;
        if (!existing.website && candidate.website) existing.website = candidate.website;
        if (!existing.foundedYear && candidate.foundedYear) existing.foundedYear = candidate.foundedYear;
        if (!existing.wikipediaUrl && candidate.wikipediaUrl) existing.wikipediaUrl = candidate.wikipediaUrl;
        if (candidate.isListed) existing.isListed = true;
        if (existing.category === "office_bldg" && candidate.category !== "office_bldg") {
          existing.category = candidate.category;
          existing.subtype = candidate.subtype;
        }
      }
    }

    return merged;
  }

  // Reverse Geocode Current Search Center for Header Subtitle
  async function updateLocationSubtitle(lat, lon, customPrefix = "検索地点") {
    try {
      const data = await fetchJsonWithTimeout(
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lon}&limit=1`,
        5000
      );
      const props = data?.features?.[0]?.properties;
      if (props) {
        const addr = formatPhotonAddress(props) || props.name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
        state.searchLabel = addr;
        dom.currentLocationLabel.textContent = `${customPrefix}: ${addr}`;
        return;
      }
    } catch {
      // Fallback to coordinates
    }
    const fallback = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    state.searchLabel = fallback;
    dom.currentLocationLabel.textContent = `${customPrefix}: ${fallback}`;
  }

  // Draw Search Center & Radius Circle on Map
  function renderSearchCenterOnMap(lat, lon, radiusMeters) {
    centerLayer.clearLayers();

    // Search radius circle
    const radiusCircle = L.circle([lat, lon], {
      radius: radiusMeters,
      color: "#2563eb",
      weight: 1.5,
      dashArray: "6 6",
      fillColor: "#3b82f6",
      fillOpacity: 0.06,
      interactive: false
    }).addTo(centerLayer);

    // Optional GPS accuracy circle
    if (state.accuracyMeters && state.accuracyMeters < radiusMeters) {
      L.circle([lat, lon], {
        radius: state.accuracyMeters,
        color: "#0ea5e9",
        weight: 1,
        fillColor: "#0ea5e9",
        fillOpacity: 0.12,
        interactive: false
      }).addTo(centerLayer);
    }

    // Pulse pin
    const userIcon = L.divIcon({
      className: "user-location-marker",
      html: `<div class="user-location-pulse"></div><div class="user-location-core"></div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    L.marker([lat, lon], { icon: userIcon, zIndexOffset: 1000 })
      .bindPopup(`<strong>検索中心地点</strong><br/>半径 ${(radiusMeters / 1000).toFixed(1)}km 以内を表示中`)
      .addTo(centerLayer);

    map.fitBounds(radiusCircle.getBounds(), { padding: [24, 24], maxZoom: 16 });
  }

  // Main Search Orchestrator
  async function searchNearbyCompanies(lat, lon, labelPrefix = "現在地付近", customLabel = "") {
    const requestId = ++state.activeRequestId;
    state.isSearching = true;
    state.searchCenter = { lat, lon };
    state.selectedId = null;

    dom.statusBadge.textContent = "周辺企業を取得中...";
    dom.statusBadge.classList.remove("hidden");
    dom.locateBtn.disabled = true;
    dom.searchMapCenterBtn.classList.add("hidden");

    const radiusMeters = Number(dom.radiusSelect.value) || 2000;
    state.radiusMeters = radiusMeters;
    const radiusKm = Math.max(0.5, radiusMeters / 1000);

    renderSearchCenterOnMap(lat, lon, radiusMeters);

    if (customLabel) {
      state.searchLabel = customLabel;
      dom.currentLocationLabel.textContent = `${labelPrefix}: ${customLabel}`;
    } else {
      updateLocationSubtitle(lat, lon, labelPrefix);
    }

    // Show loading skeleton if list is empty
    dom.companyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <h2>周辺の企業データを検索しています...</h2>
        <p>OpenStreetMap・Wikipedia・Wikidata法人データベースから半径 ${(radiusMeters / 1000).toFixed(1)}km 以内の企業を取得中です。</p>
      </div>
    `;

    const corporateTags = [
      "office:company",
      "office:corporation",
      "office:it",
      "office:telecommunication",
      "office:research",
      "office:consulting",
      "office:advertising",
      "office:financial",
      "office:architect",
      "office:employment_agency",
      "office:logistics",
      "office:publisher",
      "office:yes"
    ];

    const industrialTags = [
      "industrial",
      "craft",
      "building:office",
      "building:commercial",
      "building:industrial"
    ];

    const settled = await Promise.allSettled([
      fetchPhotonStream(lat, lon, radiusKm, corporateTags),
      fetchPhotonStream(lat, lon, radiusKm, ["office"]),
      fetchPhotonStream(lat, lon, radiusKm, industrialTags),
      fetchWikiCompaniesStream(lat, lon, radiusMeters)
    ]);

    // Discard stale responses
    if (requestId !== state.activeRequestId) return;

    state.isSearching = false;
    dom.statusBadge.classList.add("hidden");
    dom.locateBtn.disabled = false;

    const combined = [];
    let anySucceeded = false;
    for (const res of settled) {
      if (res.status === "fulfilled") {
        anySucceeded = true;
        combined.push(...res.value);
      }
    }

    if (!anySucceeded) {
      state.companies = [];
      applyFiltersAndRender("通信エラーが発生しました。ネットワーク接続をご確認のうえ再試行してください。");
      return;
    }

    state.companies = mergeCompanies(combined, radiusMeters);

    // Switch away from "saved" filter if searching a new area so user sees fresh results
    if (state.activeCategory === "saved") {
      setActiveCategoryChip("all");
    }

    applyFiltersAndRender();
    showToast(`周辺 ${state.companies.length} 件の企業・事業所を取得しました`);
  }

  // Filtering, Sorting & Rendering
  function applyFiltersAndRender(customEmptyMessage = "") {
    const kw = state.keyword.trim().toLowerCase();

    let baseList =
      state.activeCategory === "saved"
        ? Object.values(state.savedMap).map((item) => {
            if (state.searchCenter) {
              return {
                ...item,
                distance: haversineMeters(
                  state.searchCenter.lat,
                  state.searchCenter.lon,
                  item.lat,
                  item.lon
                )
              };
            }
            return item;
          })
        : state.companies;

    let filtered = baseList.filter((c) => {
      if (state.activeCategory !== "all" && state.activeCategory !== "saved") {
        if (c.category !== state.activeCategory) return false;
      }
      if (kw) {
        const hay = `${c.name} ${c.subtype} ${c.address} ${c.description} ${c.corpNum}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      if (state.sortBy === "name") {
        return a.name.localeCompare(b.name, "ja");
      }
      if (state.sortBy === "featured") {
        const score = (x) =>
          (x.isListed ? 4 : 0) +
          (x.corpNum ? 3 : 0) +
          (x.website ? 2 : 0) +
          (x.description ? 1 : 0);
        const diff = score(b) - score(a);
        if (diff !== 0) return diff;
      }
      return (a.distance ?? Infinity) - (b.distance ?? Infinity);
    });

    state.filteredCompanies = filtered;

    dom.resultCountNum.textContent = String(filtered.length);
    dom.mobileCountBadge.textContent = String(filtered.length);
    dom.exportCsvBtn.disabled = filtered.length === 0;

    renderMarkers(filtered);
    renderCompanyList(filtered, customEmptyMessage);
  }

  function renderMarkers(companies) {
    markersLayer.clearLayers();
    markerById.clear();

    for (const comp of companies) {
      const meta = CATEGORY_META[comp.category] || CATEGORY_META.corporate;
      const isSelected = comp.id === state.selectedId;

      const pinIcon = L.divIcon({
        className: "",
        html: `<div class="company-pin ${isSelected ? "pin-selected" : ""}" style="background:${meta.color}"><span>${meta.icon}</span></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -26]
      });

      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${comp.name} ${comp.address || ""}`.trim()
      )}`;
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${comp.name} 企業情報`)}`;

      const popupHtml = `
        <div class="popup-body">
          <span class="cat-badge cat-${escapeHtml(comp.category)}">${escapeHtml(meta.label)}</span>
          <h3 class="popup-title">${escapeHtml(comp.name)}</h3>
          <p class="popup-sub">${escapeHtml(comp.subtype)}${comp.distance != null ? ` ・ ${escapeHtml(formatDistance(comp.distance))}` : ""}</p>
          ${comp.address ? `<p class="popup-sub">📍 ${escapeHtml(comp.address)}</p>` : ""}
          ${comp.corpNum ? `<p class="popup-sub">🏛️ 法人番号: ${escapeHtml(comp.corpNum)}</p>` : ""}
          <div class="popup-links">
            ${comp.website ? `<a class="action-link primary-link" href="${escapeHtml(comp.website)}" target="_blank" rel="noopener noreferrer">公式サイト ↗</a>` : ""}
            <a class="action-link" href="${escapeHtml(gmapsUrl)}" target="_blank" rel="noopener noreferrer">Googleマップ ↗</a>
            <a class="action-link" href="${escapeHtml(googleSearchUrl)}" target="_blank" rel="noopener noreferrer">Web検索 ↗</a>
          </div>
        </div>
      `;

      const marker = L.marker([comp.lat, comp.lon], { icon: pinIcon }).bindPopup(popupHtml);
      marker.on("click", () => {
        highlightCard(comp.id, false);
      });

      marker.addTo(markersLayer);
      markerById.set(comp.id, marker);
    }
  }

  function renderCompanyList(companies, customEmptyMessage = "") {
    if (companies.length === 0) {
      const msg =
        customEmptyMessage ||
        (state.activeCategory === "saved"
          ? "保存済みの企業はまだありません。気になる企業カードの「☆」ボタンを押すとここに保存されます。"
          : "条件に一致する企業が見つかりませんでした。検索範囲を広げる（半径3km・5kmなど）か、別のカテゴリをお試しください。");

      dom.companyList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🏢</div>
          <h2>該当する企業がありません</h2>
          <p>${escapeHtml(msg)}</p>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const comp of companies) {
      const meta = CATEGORY_META[comp.category] || CATEGORY_META.corporate;
      const isSaved = Boolean(state.savedMap[comp.id]);
      const isSelected = comp.id === state.selectedId;

      const card = document.createElement("article");
      card.className = `company-card${isSelected ? " selected" : ""}`;
      card.dataset.id = comp.id;

      const gmapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${comp.name} ${comp.address || ""}`.trim()
      )}`;
      const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${comp.name} 企業 採用`)}`;
      const gbizUrl = comp.corpNum
        ? `https://info.gbiz.go.jp/hojin/ichiran?hojinBango=${encodeURIComponent(comp.corpNum)}`
        : "";

      card.innerHTML = `
        <div class="card-header">
          <div>
            <div class="card-badges">
              <span class="cat-badge cat-${escapeHtml(comp.category)}">${escapeHtml(meta.icon)} ${escapeHtml(meta.label)}</span>
              ${comp.distance != null ? `<span class="distance-badge">${escapeHtml(formatDistance(comp.distance))}</span>` : ""}
              ${comp.isListed ? `<span class="corp-num-badge">上場企業</span>` : ""}
              ${comp.foundedYear ? `<span class="distance-badge">${escapeHtml(comp.foundedYear)}</span>` : ""}
            </div>
            <h3 class="company-name">${escapeHtml(comp.name)}</h3>
          </div>
          <button
            type="button"
            class="bookmark-btn ${isSaved ? "saved" : ""}"
            data-bookmark-id="${escapeHtml(comp.id)}"
            title="${isSaved ? "保存を解除" : "お気に入りに保存"}"
            aria-label="${isSaved ? "保存を解除" : "お気に入りに保存"}"
          >${isSaved ? "★" : "☆"}</button>
        </div>

        ${comp.description && comp.description !== comp.subtype ? `<p class="company-desc">${escapeHtml(comp.description)}</p>` : ""}

        <div class="company-meta">
          <div class="meta-row">🏷️ <span>${escapeHtml(comp.subtype)}</span></div>
          ${comp.address ? `<div class="meta-row">📍 <span>${escapeHtml(comp.address)}</span></div>` : ""}
          ${comp.corpNum ? `<div class="meta-row">🏛️ <span>法人番号: ${escapeHtml(comp.corpNum)}</span></div>` : ""}
        </div>

        <div class="card-actions">
          ${comp.website ? `<a class="action-link primary-link" href="${escapeHtml(comp.website)}" target="_blank" rel="noopener noreferrer">🌐 公式サイト</a>` : ""}
          <a class="action-link" href="${escapeHtml(gmapsUrl)}" target="_blank" rel="noopener noreferrer">🗺️ Googleマップ経路</a>
          ${gbizUrl ? `<a class="action-link" href="${escapeHtml(gbizUrl)}" target="_blank" rel="noopener noreferrer">📊 gBizINFO法人情報</a>` : ""}
          ${comp.wikipediaUrl ? `<a class="action-link" href="${escapeHtml(comp.wikipediaUrl)}" target="_blank" rel="noopener noreferrer">📖 Wikipedia</a>` : ""}
          <a class="action-link" href="${escapeHtml(googleSearchUrl)}" target="_blank" rel="noopener noreferrer">🔎 企業・採用検索</a>
        </div>
      `;

      // Card click focuses marker on map
      card.addEventListener("click", (ev) => {
        if (ev.target.closest("a") || ev.target.closest(".bookmark-btn")) return;
        focusCompanyOnMap(comp);
      });

      // Bookmark click
      const bmBtn = card.querySelector(".bookmark-btn");
      bmBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        toggleBookmark(comp);
      });

      fragment.appendChild(card);
    }

    dom.companyList.innerHTML = "";
    dom.companyList.appendChild(fragment);
  }

  function focusCompanyOnMap(comp) {
    state.selectedId = comp.id;

    // Switch to map tab on mobile when clicking a card
    if (window.innerWidth <= 900) {
      setMobileView("map");
    }

    map.flyTo([comp.lat, comp.lon], Math.max(map.getZoom(), 16), { duration: 0.5 });
    const marker = markerById.get(comp.id);
    if (marker) {
      setTimeout(() => marker.openPopup(), 250);
    }

    highlightCard(comp.id, false);
  }

  function highlightCard(id, scrollIntoView = true) {
    state.selectedId = id;
    const cards = dom.companyList.querySelectorAll(".company-card");
    for (const c of cards) {
      const match = c.dataset.id === id;
      c.classList.toggle("selected", match);
      if (match && scrollIntoView) {
        c.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }

  function toggleBookmark(comp) {
    if (state.savedMap[comp.id]) {
      delete state.savedMap[comp.id];
      showToast(`「${comp.name}」の保存を解除しました`, 2200);
    } else {
      state.savedMap[comp.id] = { ...comp };
      showToast(`「${comp.name}」を保存しました`, 2200);
    }
    persistSavedMap();
    applyFiltersAndRender();
  }

  // Browser Geolocation Handler with High-Accuracy -> Low-Accuracy Fallback
  function triggerGeolocation() {
    if (!navigator.geolocation) {
      showToast("お使いのブラウザは現在地取得（Geolocation API）に対応していません。駅名検索をご利用ください。");
      return;
    }

    dom.locateBtn.disabled = true;
    dom.statusBadge.textContent = "現在地を測位中...";
    dom.statusBadge.classList.remove("hidden");

    const onSuccess = (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      state.accuracyMeters = accuracy || null;
      searchNearbyCompanies(latitude, longitude, "現在地付近");
    };

    const onFinalError = (err) => {
      dom.locateBtn.disabled = false;
      dom.statusBadge.classList.add("hidden");
      if (err.code === 1) {
        showToast("位置情報の利用が許可されませんでした。ブラウザの許可設定を確認するか、上の検索欄から駅名・住所で検索してください。", 5000);
      } else {
        showToast("現在地を取得できませんでした。駅名・住所検索または地図の中心検索をお試しください。", 4500);
      }
    };

    navigator.geolocation.getCurrentPosition(
      onSuccess,
      (err) => {
        if (err.code === 1) {
          onFinalError(err);
          return;
        }
        // Fallback without high accuracy (helpful on desktop Wi-Fi/IP positioning)
        navigator.geolocation.getCurrentPosition(onSuccess, onFinalError, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 7000,
        maximumAge: 60000
      }
    );
  }

  // Forward Place Search (Station / Address -> Coordinates)
  async function searchByPlaceName(query) {
    const trimmed = query.trim();
    if (!trimmed) return;

    dom.statusBadge.textContent = "場所を検索中...";
    dom.statusBadge.classList.remove("hidden");

    try {
      // Primary: Nominatim (great for Japanese stations & addresses)
      const nomUrl =
        `https://nominatim.openstreetmap.org/search?format=jsonv2` +
        `&q=${encodeURIComponent(trimmed)}&accept-language=ja&limit=1`;
      const nomData = await fetchJsonWithTimeout(nomUrl, 6000);

      if (Array.isArray(nomData) && nomData.length > 0) {
        const hit = nomData[0];
        state.accuracyMeters = null;
        const shortName = (hit.name || hit.display_name?.split(",")[0] || trimmed).trim();
        searchNearbyCompanies(Number(hit.lat), Number(hit.lon), "指定エリア", shortName);
        return;
      }

      // Fallback: Photon Search
      const phData = await fetchJsonWithTimeout(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(trimmed)}&limit=1`,
        6000
      );
      const feat = phData?.features?.[0];
      if (feat?.geometry?.coordinates) {
        const [lon, lat] = feat.geometry.coordinates;
        state.accuracyMeters = null;
        searchNearbyCompanies(lat, lon, "指定エリア", feat.properties?.name || trimmed);
        return;
      }

      dom.statusBadge.classList.add("hidden");
      showToast(`「${trimmed}」の場所が見つかりませんでした。別の駅名や市区町村名をお試しください。`);
    } catch {
      dom.statusBadge.classList.add("hidden");
      showToast("場所検索中に通信エラーが発生しました。");
    }
  }

  // CSV Export (UTF-8 with BOM for Excel compatibility)
  function exportFilteredToCsv() {
    if (state.filteredCompanies.length === 0) return;

    const headers = [
      "企業・事業所名",
      "カテゴリ",
      "業種・種別",
      "距離(m)",
      "住所",
      "法人番号",
      "公式サイト",
      "概要",
      "緯度",
      "経度",
      "GoogleマップURL"
    ];

    const escapeCsv = (val) => {
      const s = val == null ? "" : String(val);
      return `"${s.replace(/"/g, '""')}"`;
    };

    const rows = state.filteredCompanies.map((c) => {
      const meta = CATEGORY_META[c.category] || CATEGORY_META.corporate;
      const gmaps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
        `${c.name} ${c.address || ""}`.trim()
      )}`;
      return [
        c.name,
        meta.label,
        c.subtype,
        c.distance != null ? Math.round(c.distance) : "",
        c.address,
        c.corpNum,
        c.website,
        c.description,
        c.lat.toFixed(6),
        c.lon.toFixed(6),
        gmaps
      ]
        .map(escapeCsv)
        .join(",");
    });

    const csvContent = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `周辺企業リスト_${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast(`${state.filteredCompanies.length} 件の企業リストをCSV出力しました`);
  }

  function setActiveCategoryChip(cat) {
    state.activeCategory = cat;
    for (const btn of dom.categoryChips.querySelectorAll(".chip")) {
      btn.classList.toggle("active", btn.dataset.category === cat);
    }
  }

  function setMobileView(mode) {
    const isList = mode === "list";
    dom.sidebarPanel.classList.toggle("mobile-open", isList);
    dom.mobileTabList.classList.toggle("active", isList);
    dom.mobileTabMap.classList.toggle("active", !isList);
    if (!isList) {
      setTimeout(() => map.invalidateSize(), 100);
    }
  }

  // Event Listeners
  dom.locateBtn.addEventListener("click", triggerGeolocation);
  if (dom.welcomeLocateBtn) {
    dom.welcomeLocateBtn.addEventListener("click", triggerGeolocation);
  }

  dom.placeSearchForm.addEventListener("submit", (ev) => {
    ev.preventDefault();
    searchByPlaceName(dom.placeSearchInput.value);
  });

  dom.radiusSelect.addEventListener("change", () => {
    if (state.searchCenter) {
      searchNearbyCompanies(state.searchCenter.lat, state.searchCenter.lon, "検索地点", state.searchLabel);
    }
  });

  dom.sortSelect.addEventListener("change", () => {
    state.sortBy = dom.sortSelect.value;
    applyFiltersAndRender();
  });

  dom.keywordFilterInput.addEventListener("input", () => {
    state.keyword = dom.keywordFilterInput.value;
    applyFiltersAndRender();
  });

  dom.categoryChips.addEventListener("click", (ev) => {
    const chip = ev.target.closest(".chip");
    if (!chip) return;
    setActiveCategoryChip(chip.dataset.category);
    applyFiltersAndRender();
  });

  dom.exportCsvBtn.addEventListener("click", exportFilteredToCsv);

  // Quick preset area chips inside welcome screen
  dom.companyList.addEventListener("click", (ev) => {
    const areaChip = ev.target.closest(".area-chip");
    if (!areaChip) return;
    const lat = Number(areaChip.dataset.lat);
    const lon = Number(areaChip.dataset.lon);
    const name = areaChip.dataset.name || "";
    state.accuracyMeters = null;
    searchNearbyCompanies(lat, lon, "指定エリア", name);
  });

  // Show "Search this map area" button when user pans map away from last search center
  map.on("moveend", () => {
    if (state.isSearching) return;
    const c = map.getCenter();
    if (!state.searchCenter) {
      dom.searchMapCenterBtn.classList.remove("hidden");
      return;
    }
    const movedMeters = haversineMeters(state.searchCenter.lat, state.searchCenter.lon, c.lat, c.lng);
    if (movedMeters > 350) {
      dom.searchMapCenterBtn.classList.remove("hidden");
    } else {
      dom.searchMapCenterBtn.classList.add("hidden");
    }
  });

  dom.searchMapCenterBtn.addEventListener("click", () => {
    const c = map.getCenter();
    state.accuracyMeters = null;
    searchNearbyCompanies(c.lat, c.lng, "地図の中心");
  });

  dom.mobileTabMap.addEventListener("click", () => setMobileView("map"));
  dom.mobileTabList.addEventListener("click", () => setMobileView("list"));

  dom.themeToggleBtn.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // Startup
  initTheme();

  // Automatically request current location on load unless explicitly denied
  if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions
      .query({ name: "geolocation" })
      .then((result) => {
        if (result.state !== "denied") {
          triggerGeolocation();
        }
      })
      .catch(() => {
        triggerGeolocation();
      });
  } else {
    triggerGeolocation();
  }
})();
