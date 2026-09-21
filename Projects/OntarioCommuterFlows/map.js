"use strict";

const map = L.map("map", {
  preferCanvas: true,
  zoomControl: true,
}).setView([49.1, -84.6], 5);

const statusElement = document.getElementById("status");
const FLOW_ARROW_FRACTION = 0.25;
const FLOW_ARROW_MAX_PLACEMENT_SIZE = 6;
const FLOW_ARROW_MIN_PLACEMENT_SIZE = 2.5;
const FLOW_ARROW_MIN_VISIBLE_SIZE = 5.5;
const FLOW_ARROW_MAX_VISIBLE_SIZE = 12;
const FLOW_ARROW_ENDPOINT_GAP = 2;
const FLOW_ARROW_MAX_HIT_RADIUS = 12;
const FLOW_RECIPROCAL_OFFSET = 5;

function flowArrowVisibleSize(lineWeight) {
  return Math.min(
    FLOW_ARROW_MAX_VISIBLE_SIZE,
    Math.max(FLOW_ARROW_MIN_VISIBLE_SIZE, 5 + lineWeight),
  );
}

function flowDirectionKey(homeUid, workUid) {
  return `${homeUid}\u0000${workUid}`;
}

function offsetProjectedFlow(layer, offset) {
  const shiftedBounds = new L.Bounds();

  for (const ring of layer._rings) {
    const start = ring[0];
    const end = ring[ring.length - 1];
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    const length = Math.hypot(deltaX, deltaY);
    const offsetX = length === 0 ? 0 : (-deltaY / length) * offset;
    const offsetY = length === 0 ? 0 : (deltaX / length) * offset;

    for (const point of ring) {
      point.x += offsetX;
      point.y += offsetY;
      shiftedBounds.extend(point);
    }
  }

  if (shiftedBounds.isValid()) {
    layer._rawPxBounds = shiftedBounds;
    layer._updateBounds();
  }
}

function flowArrowGeometry(layer) {
  const rings = layer._rings;
  if (!rings?.length) return null;

  let totalLength = 0;
  for (const ring of rings) {
    for (let index = 1; index < ring.length; index += 1) {
      totalLength += ring[index - 1].distanceTo(ring[index]);
    }
  }

  if (totalLength === 0) return null;

  const placementSize = Math.min(
    FLOW_ARROW_MAX_PLACEMENT_SIZE,
    Math.max(FLOW_ARROW_MIN_PLACEMENT_SIZE, totalLength / 3),
  );
  const endpointPadding = placementSize + FLOW_ARROW_ENDPOINT_GAP;
  const preferredDistance = totalLength * FLOW_ARROW_FRACTION;
  const arrowDistance =
    totalLength >= endpointPadding * 2
      ? Math.min(
          Math.max(preferredDistance, endpointPadding),
          totalLength - endpointPadding,
        )
      : totalLength / 2;

  let traversed = 0;
  for (const ring of rings) {
    for (let index = 1; index < ring.length; index += 1) {
      const start = ring[index - 1];
      const end = ring[index];
      const segmentLength = start.distanceTo(end);
      if (segmentLength === 0) continue;

      if (traversed + segmentLength >= arrowDistance) {
        const segmentFraction = (arrowDistance - traversed) / segmentLength;
        const unitX = (end.x - start.x) / segmentLength;
        const unitY = (end.y - start.y) / segmentLength;
        const tip = L.point(
          start.x + (end.x - start.x) * segmentFraction,
          start.y + (end.y - start.y) * segmentFraction,
        );
        return {
          tip,
          unitX,
          unitY,
          hitCenter: L.point(
            tip.x - unitX * placementSize * 0.45,
            tip.y - unitY * placementSize * 0.45,
          ),
          hitRadius: Math.min(
            FLOW_ARROW_MAX_HIT_RADIUS,
            Math.max(6, totalLength * 0.35),
          ),
        };
      }

      traversed += segmentLength;
    }
  }

  return null;
}

function flowContainsPoint(point, closed) {
  if (L.Polyline.prototype._containsPoint.call(this, point, closed)) return true;

  return flowArrowContainsPoint(this, point);
}

function flowArrowContainsPoint(layer, point) {
  const arrow = layer._flowArrowGeometry;
  return Boolean(arrow && point.distanceTo(arrow.hitCenter) <= arrow.hitRadius);
}

const FlowCanvasRenderer = L.Canvas.extend({
  _updatePoly(layer, closed) {
    L.Canvas.prototype._updatePoly.call(this, layer, closed);
    if (!this._drawing || closed || !layer.options.flowArrow) return;

    const arrow = layer._flowArrowGeometry;
    if (!arrow) return;

    const size = flowArrowVisibleSize(layer.options.weight);
    const wingOffset = size * 0.55;
    const wingBaseX = arrow.tip.x - arrow.unitX * size;
    const wingBaseY = arrow.tip.y - arrow.unitY * size;
    const context = this._ctx;
    context.save();
    context.beginPath();
    context.moveTo(
      wingBaseX - arrow.unitY * wingOffset,
      wingBaseY + arrow.unitX * wingOffset,
    );
    context.lineTo(arrow.tip.x, arrow.tip.y);
    context.lineTo(
      wingBaseX + arrow.unitY * wingOffset,
      wingBaseY - arrow.unitX * wingOffset,
    );
    context.setLineDash([]);
    context.globalAlpha = layer.options.opacity;
    context.strokeStyle = layer.options.color;
    context.lineWidth = Math.max(0.5, Math.min(1.5, layer.options.weight * 0.8));
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
    context.restore();
  },

  _interactiveLayerAtPoint(point) {
    let arrowLayer;
    let hitLayer;

    for (let order = this._drawFirst; order; order = order.next) {
      const layer = order.layer;
      if (!layer.options.interactive) continue;

      if (layer.options.flowArrow) {
        if (flowArrowContainsPoint(layer, point)) {
          arrowLayer = layer;
          hitLayer = layer;
        } else if (L.Polyline.prototype._containsPoint.call(layer, point)) {
          hitLayer = layer;
        }
      } else if (layer._containsPoint(point)) {
        hitLayer = layer;
      }
    }

    return arrowLayer ?? hitLayer;
  },

  _onClick(event) {
    const point = this._map.mouseEventToLayerPoint(event);
    const layer = this._interactiveLayerAtPoint(point);
    const isUndraggedClick =
      !(event.type === "click" || event.type === "preclick") ||
      !layer ||
      !this._map._draggableMoved(layer);

    this._fireEvent(layer && isUndraggedClick ? [layer] : false, event);
  },

  _handleMouseHover(event, point) {
    if (this._mouseHoverThrottled) return;

    const hoveredLayer = this._interactiveLayerAtPoint(point);
    if (hoveredLayer !== this._hoveredLayer) {
      this._handleMouseOut(event);

      if (hoveredLayer) {
        L.DomUtil.addClass(this._container, "leaflet-interactive");
        this._fireEvent([hoveredLayer], event, "mouseover");
        this._hoveredLayer = hoveredLayer;
      }
    }

    this._fireEvent(this._hoveredLayer ? [this._hoveredLayer] : false, event);
    this._mouseHoverThrottled = true;
    setTimeout(() => {
      this._mouseHoverThrottled = false;
    }, 32);
  },
});

const canvasRenderer = new FlowCanvasRenderer({ padding: 0.4, tolerance: 5 });
const csdNames = new Map();
const csdSearchEntries = [];
const MAX_SEARCH_RESULTS = 10;

let csdLayer;
let flowLayer;
let selectedCsdUid = null;
let selectedFlowRanks = {
  outgoing: new Map(),
  incoming: new Map(),
};
let baseStatusMessage = "";
let clearSelectionButton;
let flowLegendElement;
let csdSearchInput;
let csdSearchList;
let searchResults = [];
let activeSearchResultIndex = -1;

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

const CsdSearchControl = L.Control.extend({
  options: { position: "topleft" },

  onAdd() {
    const container = L.DomUtil.create("div", "leaflet-bar csd-search-control");
    csdSearchInput = L.DomUtil.create("input", "csd-search-input", container);
    csdSearchInput.type = "search";
    csdSearchInput.placeholder = "Loading CSD names…";
    csdSearchInput.setAttribute("aria-label", "Search census subdivisions by name");
    csdSearchInput.setAttribute("role", "combobox");
    csdSearchInput.setAttribute("aria-autocomplete", "list");
    csdSearchInput.setAttribute("aria-controls", "csd-search-results");
    csdSearchInput.setAttribute("aria-expanded", "false");
    csdSearchInput.autocomplete = "off";
    csdSearchInput.spellcheck = false;
    csdSearchInput.disabled = true;

    csdSearchList = L.DomUtil.create("ul", "csd-search-results", container);
    csdSearchList.id = "csd-search-results";
    csdSearchList.setAttribute("role", "listbox");
    csdSearchList.hidden = true;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    L.DomEvent.on(csdSearchInput, "input", updateSearchResults);
    L.DomEvent.on(csdSearchInput, "focus", updateSearchResults);
    L.DomEvent.on(csdSearchInput, "keydown", handleSearchKeydown);

    return container;
  },
});

new CsdSearchControl().addTo(map);

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

const FlowLegendControl = L.Control.extend({
  options: { position: "bottomright" },

  onAdd() {
    flowLegendElement = L.DomUtil.create("div", "flow-legend");
    flowLegendElement.hidden = true;
    flowLegendElement.setAttribute("aria-label", "Selected commuter-flow directions");
    flowLegendElement.innerHTML = `
      <div class="flow-legend-title">Selected CSD flows</div>
      <div><span class="flow-legend-swatch flow-legend-outgoing"></span>Home / outgoing commuters</div>
      <div><span class="flow-legend-swatch flow-legend-incoming"></span>Work / incoming commuters</div>`;
    return flowLegendElement;
  },
});

new FlowLegendControl().addTo(map);

function normalizedSearchText(value) {
  return String(value ?? "").trim().toLocaleLowerCase("en-CA");
}

function closeSearchResults() {
  searchResults = [];
  activeSearchResultIndex = -1;
  csdSearchList.replaceChildren();
  csdSearchList.hidden = true;
  csdSearchInput.setAttribute("aria-expanded", "false");
  csdSearchInput.removeAttribute("aria-activedescendant");
}

function setActiveSearchResult(index) {
  if (!searchResults.length) return;

  activeSearchResultIndex = (index + searchResults.length) % searchResults.length;
  const options = csdSearchList.querySelectorAll('[role="option"]');
  options.forEach((option, optionIndex) => {
    const isActive = optionIndex === activeSearchResultIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });

  const activeOption = options[activeSearchResultIndex];
  csdSearchInput.setAttribute("aria-activedescendant", activeOption.id);
  activeOption.scrollIntoView({ block: "nearest" });
}

function selectSearchResult(entry) {
  csdSearchInput.value = entry.name;
  closeSearchResults();
  selectCsd(entry.feature);
  map.flyToBounds(entry.layer.getBounds(), {
    padding: [30, 30],
    maxZoom: 11,
    duration: 0.7,
  });
  csdSearchInput.blur();
}

function renderSearchResults(results) {
  searchResults = results;
  activeSearchResultIndex = -1;
  csdSearchList.replaceChildren();

  results.forEach((entry, index) => {
    const option = document.createElement("li");
    option.id = `csd-search-option-${index}`;
    option.className = "csd-search-result";
    option.setAttribute("role", "option");
    option.setAttribute("aria-selected", "false");

    const name = document.createElement("span");
    name.className = "csd-search-result-name";
    name.textContent = entry.name;

    const context = document.createElement("span");
    context.className = "csd-search-result-context";
    context.textContent = [entry.province, entry.type].filter(Boolean).join(" · ");

    option.append(name, context);
    option.addEventListener("click", (event) => {
      event.preventDefault();
      selectSearchResult(entry);
    });
    csdSearchList.append(option);
  });

  csdSearchList.hidden = results.length === 0;
  csdSearchInput.setAttribute("aria-expanded", String(results.length > 0));
}

function updateSearchResults() {
  const query = normalizedSearchText(csdSearchInput.value);
  if (!query) {
    closeSearchResults();
    return;
  }

  const matches = csdSearchEntries
    .filter((entry) => entry.normalizedName.includes(query))
    .sort((a, b) => {
      const prefixDifference =
        Number(b.normalizedName.startsWith(query)) - Number(a.normalizedName.startsWith(query));
      if (prefixDifference) return prefixDifference;

      const nameDifference = a.name.localeCompare(b.name, "en-CA", {
        sensitivity: "base",
        numeric: true,
      });
      if (nameDifference) return nameDifference;

      const provinceDifference = a.province.localeCompare(b.province, "en-CA", {
        sensitivity: "base",
      });
      if (provinceDifference) return provinceDifference;
      return a.uid.localeCompare(b.uid, "en-CA", { numeric: true });
    })
    .slice(0, MAX_SEARCH_RESULTS);

  renderSearchResults(matches);
}

function handleSearchKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeSearchResults();
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (!searchResults.length) updateSearchResults();
    if (!searchResults.length) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      activeSearchResultIndex < 0
        ? event.key === "ArrowDown"
          ? 0
          : searchResults.length - 1
        : activeSearchResultIndex + step;
    setActiveSearchResult(nextIndex);
    return;
  }

  if (event.key === "Enter" && searchResults.length) {
    event.preventDefault();
    const selectedIndex = activeSearchResultIndex >= 0 ? activeSearchResultIndex : 0;
    selectSearchResult(searchResults[selectedIndex]);
  }
}

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
  const isOutgoing = selectedCsdUid !== null && homeUid === selectedCsdUid;
  const isIncoming = selectedCsdUid !== null && workUid === selectedCsdUid;
  let selectedRole = "";

  if (isOutgoing && isIncoming) {
    selectedRole = "Home and Work CSD";
  } else if (isOutgoing) {
    selectedRole = "Home CSD (outgoing)";
  } else if (isIncoming) {
    selectedRole = "Work CSD (incoming)";
  }

  const roleDetails = selectedRole
    ? `<dt>Selected CSD role</dt><dd>${selectedRole}</dd>`
    : "";

  return `
    <dl class="feature-details flow-details">
      ${roleDetails}
      <dt>Home CSD</dt><dd>${escapeHtml(csdNames.get(homeUid))}</dd>
      <dt>Home CSDUID</dt><dd>${escapeHtml(homeUid)}</dd>
      <dt>Work CSD</dt><dd>${escapeHtml(csdNames.get(workUid))}</dd>
      <dt>Work CSDUID</dt><dd>${escapeHtml(workUid)}</dd>
      <dt>Commuters</dt><dd>${formattedCommuters}</dd>
    </dl>`;
}

function selectedFlowWeight(commuters, direction) {
  const percentile = selectedFlowRanks[direction].get(Number(commuters)) ?? 0;
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
  const isOutgoing = normalizeUid(properties.Home_CSDUID) === selectedCsdUid;
  const isIncoming = normalizeUid(properties.Work_CSDUID) === selectedCsdUid;

  if (isOutgoing) {
    return {
      color: "#d7301f",
      weight: selectedFlowWeight(properties.Commuters, "outgoing"),
      opacity: 0.82,
    };
  }

  if (isIncoming) {
    return {
      color: "#2166ac",
      weight: selectedFlowWeight(properties.Commuters, "incoming"),
      opacity: 0.82,
    };
  }

  return {
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
  const outgoingCounts = [];
  const incomingCounts = [];

  flowLayer.eachLayer((layer) => {
    const properties = layer.feature?.properties ?? {};
    const commuters = Number(properties.Commuters);
    if (!Number.isFinite(commuters)) return;

    if (normalizeUid(properties.Home_CSDUID) === csdUid) {
      outgoingCounts.push(commuters);
    }
    if (normalizeUid(properties.Work_CSDUID) === csdUid) {
      incomingCounts.push(commuters);
    }
  });

  return {
    outgoing: rankFlowCounts(outgoingCounts),
    incoming: rankFlowCounts(incomingCounts),
    outgoingCount: outgoingCounts.length,
    incomingCount: incomingCounts.length,
  };
}

function rankFlowCounts(counts) {
  counts.sort((a, b) => a - b);
  const ranks = new Map();

  // Equal commuter counts receive the same upper-rank percentile.
  for (let index = 0; index < counts.length; ) {
    let end = index + 1;
    while (end < counts.length && counts[end] === counts[index]) end += 1;
    ranks.set(counts[index], end / counts.length);
    index = end;
  }

  return ranks;
}

function updateFlowInteractivity() {
  flowLayer.eachLayer((layer) => {
    const homeUid = normalizeUid(layer.feature?.properties?.Home_CSDUID);
    const workUid = normalizeUid(layer.feature?.properties?.Work_CSDUID);
    layer.options.interactive =
      selectedCsdUid === null || homeUid === selectedCsdUid || workUid === selectedCsdUid;
  });
}

function selectCsd(feature) {
  selectedCsdUid = normalizeUid(feature.properties?.CSDUID);
  const rankedFlows = rankSelectedFlows(selectedCsdUid);
  selectedFlowRanks = {
    outgoing: rankedFlows.outgoing,
    incoming: rankedFlows.incoming,
  };

  csdLayer.resetStyle();
  flowLayer.setStyle(flowStyle);
  updateFlowInteractivity();

  clearSelectionButton.hidden = false;
  flowLegendElement.hidden = false;
  const csdName = feature.properties?.CSDNAME ?? selectedCsdUid;
  statusElement.textContent =
    `${csdName}: ${rankedFlows.outgoingCount.toLocaleString()} outgoing and ` +
    `${rankedFlows.incomingCount.toLocaleString()} incoming commuter-flow records highlighted.`;
}

function clearCsdSelection() {
  selectedCsdUid = null;
  selectedFlowRanks = {
    outgoing: new Map(),
    incoming: new Map(),
  };

  if (csdLayer) csdLayer.resetStyle();
  if (flowLayer) {
    flowLayer.setStyle(flowStyle);
    updateFlowInteractivity();
  }

  if (clearSelectionButton) clearSelectionButton.hidden = true;
  if (flowLegendElement) flowLegendElement.hidden = true;
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
        const properties = feature.properties ?? {};
        const name = String(properties.CSDNAME ?? "");
        csdSearchEntries.push({
          feature,
          layer,
          name,
          normalizedName: normalizedSearchText(name),
          province: String(properties.Province ?? ""),
          type: String(properties.CSDTYPE ?? ""),
          uid: normalizeUid(properties.CSDUID),
        });
        layer.bindTooltip(csdDetails(feature.properties ?? {}), {
          sticky: true,
          direction: "top",
        });
        layer.on("click", () => selectCsd(feature));
      },
    });

    csdSearchInput.disabled = false;
    csdSearchInput.placeholder = "Search CSD name";

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

    const flowDirections = new Set(
      flowResult.data.features.map((feature) => {
        const properties = feature.properties ?? {};
        return flowDirectionKey(
          normalizeUid(properties.Home_CSDUID),
          normalizeUid(properties.Work_CSDUID),
        );
      }),
    );

    flowLayer = L.geoJSON(flowResult.data, {
      renderer: canvasRenderer,
      style: flowStyle,
      onEachFeature: (feature, layer) => {
        const properties = feature.properties ?? {};
        const homeUid = normalizeUid(properties.Home_CSDUID);
        const workUid = normalizeUid(properties.Work_CSDUID);
        const projectLine = layer._project;
        layer.options.flowArrow = true;
        layer.options.reciprocalFlow =
          homeUid !== workUid &&
          flowDirections.has(flowDirectionKey(workUid, homeUid));
        layer._project = function projectFlowLine() {
          projectLine.call(this);
          if (this.options.reciprocalFlow) {
            offsetProjectedFlow(this, FLOW_RECIPROCAL_OFFSET);
          }
          this._flowArrowGeometry = flowArrowGeometry(this);
        };
        layer._containsPoint = flowContainsPoint;

        const details = () => flowDetails(properties);
        layer.bindTooltip(details, { sticky: true, direction: "top" });
        layer.bindPopup(details, { maxWidth: 280 });
      },
    });
    flowDirections.clear();

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
