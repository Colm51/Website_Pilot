"use strict";

const map = L.map("map", {
  preferCanvas: true,
  zoomControl: true,
}).setView([49.1, -84.6], 5);

const statusElement = document.getElementById("status");
const canvasRenderer = L.canvas({ padding: 0.4, tolerance: 5 });
const csdNames = new Map();

let csdLayer;
let flowLayer;
let selectedCsdUid = null;
let selectedFlowRanks = new Map();
let baseStatusMessage = "";
let clearSelectionButton;

const basemap = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);

const lightGrayBasemap = L.tileLayer(
  "https://services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 19,
    attribution:
      '&copy; Esri, HERE, Garmin, <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community',
  },
);

const overlays = {};
const layerControl = L.control.layers(
  { OpenStreetMap: basemap, "Esri Light Gray": lightGrayBasemap },
  overlays,
  {
    collapsed: window.innerWidth < 700,
  },
).addTo(map);

const ClearSelectionControl = L.Control.extend({
  options: { position: "topleft" },

  onAdd() {
    clearSelectionButton = L.DomUtil.create("button", "leaflet-bar clear-selection-control");
    clearSelectionButton.type = "button";
    clearSelectionButton.textContent = "Clear CSD selection";
    clearSelectionButton.title = "Show all commuter flows";
    clearSelectionButton.hidden = true;

    L.DomEvent.disableClickPropagation(clearSelectionButton);
    L.DomEvent.on(clearSelectionButton, "click", clearCsdSelection);
    return clearSelectionButton;
  },
});

new ClearSelectionControl().addTo(map);

function escapeHtml(value) {
  return String(value ?? "Unknown")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeUid(value) {
  return String(value ?? "");
}

function csdDetails(properties) {
  return `
    <dl class="feature-details">
      <dt>CSDNAME</dt><dd>${escapeHtml(properties.CSDNAME)}</dd>
      <dt>CSDTYPE</dt><dd>${escapeHtml(properties.CSDTYPE)}</dd>
      <dt>CSDUID</dt><dd>${escapeHtml(properties.CSDUID)}</dd>
    </dl>`;
}

function flowDetails(properties) {
  const commuters = Number(properties.Commuters);
  const formattedCommuters = Number.isFinite(commuters)
    ? commuters.toLocaleString()
    : escapeHtml(properties.Commuters);
  const homeUid = normalizeUid(properties.Home_CSDUID);
  const workUid = normalizeUid(properties.Work_CSDUID);

  return `
    <dl class="feature-details flow-details">
      <dt>Home CSD</dt><dd>${escapeHtml(csdNames.get(homeUid))}</dd>
      <dt>Home CSDUID</dt><dd>${escapeHtml(homeUid)}</dd>
      <dt>Work CSD</dt><dd>${escapeHtml(csdNames.get(workUid))}</dd>
      <dt>Work CSDUID</dt><dd>${escapeHtml(workUid)}</dd>
      <dt>Commuters</dt><dd>${formattedCommuters}</dd>
    </dl>`;
}

function selectedFlowWeight(commuters) {
  const percentile = selectedFlowRanks.get(Number(commuters)) ?? 0;
  if (percentile <= 0.5) return 1;
  if (percentile <= 0.75) return 1.75;
  if (percentile <= 0.9) return 3;
  if (percentile <= 0.97) return 4.75;
  return 7;
}

function flowStyle(feature) {
  if (selectedCsdUid === null) {
    return {
      color: "#c43d3d",
      weight: 1,
      opacity: 0.24,
    };
  }

  const properties = feature.properties ?? {};
  const isSelected = normalizeUid(properties.Home_CSDUID) === selectedCsdUid;

  return isSelected
    ? {
        color: "#d7301f",
        weight: selectedFlowWeight(properties.Commuters),
        opacity: 0.82,
      }
    : {
        color: "#68737d",
        weight: 0.5,
        opacity: 0.035,
      };
}

function csdStyle(feature) {
  const isSelected = normalizeUid(feature.properties?.CSDUID) === selectedCsdUid;

  return isSelected
    ? {
        color: "#f2a900",
        weight: 3,
        opacity: 1,
        fillColor: "#ffd24d",
        fillOpacity: 0.18,
      }
    : {
        color: "#355c7d",
        weight: 0.8,
        opacity: 0.65,
        fillOpacity: 0,
      };
}

function rankSelectedFlows(csdUid) {
  const counts = [];

  flowLayer.eachLayer((layer) => {
    const properties = layer.feature?.properties ?? {};
    if (normalizeUid(properties.Home_CSDUID) === csdUid) {
      const commuters = Number(properties.Commuters);
      if (Number.isFinite(commuters)) counts.push(commuters);
    }
  });

  counts.sort((a, b) => a - b);
  const ranks = new Map();

  // Equal commuter counts receive the same upper-rank percentile.
  for (let index = 0; index < counts.length; ) {
    let end = index + 1;
    while (end < counts.length && counts[end] === counts[index]) end += 1;
    ranks.set(counts[index], end / counts.length);
    index = end;
  }

  return { ranks, count: counts.length };
}

function updateFlowInteractivity() {
  flowLayer.eachLayer((layer) => {
    const homeUid = normalizeUid(layer.feature?.properties?.Home_CSDUID);
    layer.options.interactive = selectedCsdUid === null || homeUid === selectedCsdUid;
  });
}

function selectCsd(feature) {
  selectedCsdUid = normalizeUid(feature.properties?.CSDUID);
  const rankedFlows = rankSelectedFlows(selectedCsdUid);
  selectedFlowRanks = rankedFlows.ranks;

  csdLayer.resetStyle();
  flowLayer.setStyle(flowStyle);
  updateFlowInteractivity();

  clearSelectionButton.hidden = false;
  const csdName = feature.properties?.CSDNAME ?? selectedCsdUid;
  statusElement.textContent =
    `${csdName}: ${rankedFlows.count.toLocaleString()} outgoing commuter-flow records highlighted.`;
}

function clearCsdSelection() {
  selectedCsdUid = null;
  selectedFlowRanks = new Map();

  if (csdLayer) csdLayer.resetStyle();
  if (flowLayer) {
    flowLayer.setStyle(flowStyle);
    updateFlowInteractivity();
  }

  if (clearSelectionButton) clearSelectionButton.hidden = true;
  if (baseStatusMessage) statusElement.textContent = baseStatusMessage;
}

async function fetchLocalGeoJson(filename) {
  const paths = [`data/${filename}`, filename];
  let lastError;

  for (const path of paths) {
    try {
      const response = await fetch(path);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      return { data: await response.json(), path };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(`Could not load ${filename}: ${lastError?.message ?? "unknown error"}`);
}

function registerOverlay(name, layer) {
  overlays[name] = layer;
  layer.addTo(map);
  layerControl.addOverlay(layer, name);
}

async function loadMapData() {
  const startedAt = performance.now();

  try {
    const [csdResult, municipalResult, flowResult] = await Promise.all([
      fetchLocalGeoJson("csd_boundaries_250m.geojson"),
      fetchLocalGeoJson("ontario_municipal_boundaries_100m.geojson"),
      fetchLocalGeoJson("commuter_flows.geojson"),
    ]);

    csdResult.data.features.forEach((feature) => {
      const properties = feature.properties ?? {};
      csdNames.set(normalizeUid(properties.CSDUID), properties.CSDNAME);
    });

    csdLayer = L.geoJSON(csdResult.data, {
      renderer: canvasRenderer,
      style: csdStyle,
      onEachFeature: (feature, layer) => {
        layer.bindTooltip(csdDetails(feature.properties ?? {}), {
          sticky: true,
          direction: "top",
        });
        layer.on("click", () => selectCsd(feature));
      },
    });

    const municipalLayer = L.geoJSON(municipalResult.data, {
      renderer: canvasRenderer,
      interactive: false,
      style: {
        color: "#2f855a",
        weight: 1.2,
        opacity: 0.75,
        dashArray: "4 3",
        fillOpacity: 0,
      },
    });

    flowLayer = L.geoJSON(flowResult.data, {
      renderer: canvasRenderer,
      style: flowStyle,
      onEachFeature: (feature, layer) => {
        const details = flowDetails(feature.properties ?? {});
        layer.bindTooltip(details, { sticky: true, direction: "top" });
        layer.bindPopup(details, { maxWidth: 280 });
      },
    });

    registerOverlay("CSD boundaries", csdLayer);
    registerOverlay("Ontario municipal boundaries", municipalLayer);
    registerOverlay("Commuter flows", flowLayer);

    const bounds = municipalLayer.getBounds();
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] });

    const elapsedSeconds = ((performance.now() - startedAt) / 1000).toFixed(1);
    const fallbackFiles = [csdResult, municipalResult, flowResult]
      .filter((result) => !result.path.startsWith("data/"))
      .length;
    const locationNote = fallbackFiles
      ? ` ${fallbackFiles} files loaded from the workspace root because the data/ folder was not present.`
      : "";

    baseStatusMessage =
      `Loaded ${flowResult.data.features.length.toLocaleString()} unmodified flow records in ${elapsedSeconds}s.${locationNote}`;
    statusElement.textContent = baseStatusMessage;
  } catch (error) {
    console.error(error);
    statusElement.textContent = `${error.message}. Run this site through a local HTTP server; browser file:// access will not work.`;
  }
}

loadMapData();
