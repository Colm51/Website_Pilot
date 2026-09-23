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
const municipalLabelPane = map.createPane("municipalLabels");
municipalLabelPane.style.zIndex = "425";
const csdNames = new Map();
const csdSearchEntries = [];
const MAX_SEARCH_RESULTS = 10;

let csdLayer;
let flowLayer;
let municipalLayer;
let municipalLabelLayer;
let selectedCsdUid = null;
let selectedWorkCsdUid = null;
let selectedFlowRanks = new Map();
let selectedMajorFlowFeatures = new Set();
let selectedFlowSummary = null;
let flowDisplayMode = "all";
let baseStatusMessage = "";
let clearSelectionButton;
let flowModeButton;
let flowLegendElement;
let csdSearchInput;
let csdSearchList;
let searchResults = [];
let activeSearchResultIndex = -1;
let workCsdSearchInput;
let workCsdSearchList;
let workSearchResults = [];
let activeWorkSearchResultIndex = -1;

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
    const label = L.DomUtil.create("label", "csd-search-label", container);
    label.htmlFor = "csd-search-input";
    label.textContent = "Connections to/from a CSD";
    csdSearchInput = L.DomUtil.create("input", "csd-search-input", container);
    csdSearchInput.id = "csd-search-input";
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

const WorkCsdSearchControl = L.Control.extend({
  options: { position: "topleft" },

  onAdd() {
    const container = L.DomUtil.create(
      "div",
      "leaflet-bar csd-search-control work-csd-search-control",
    );
    const label = L.DomUtil.create("label", "csd-search-label", container);
    label.htmlFor = "work-csd-search-input";
    label.textContent = "Commuters travelling to a Work CSD";
    workCsdSearchInput = L.DomUtil.create("input", "csd-search-input", container);
    workCsdSearchInput.id = "work-csd-search-input";
    workCsdSearchInput.type = "search";
    workCsdSearchInput.placeholder = "Loading CSD names…";
    workCsdSearchInput.setAttribute("aria-label", "Search work census subdivisions by name");
    workCsdSearchInput.setAttribute("role", "combobox");
    workCsdSearchInput.setAttribute("aria-autocomplete", "list");
    workCsdSearchInput.setAttribute("aria-controls", "work-csd-search-results");
    workCsdSearchInput.setAttribute("aria-expanded", "false");
    workCsdSearchInput.autocomplete = "off";
    workCsdSearchInput.spellcheck = false;
    workCsdSearchInput.disabled = true;

    workCsdSearchList = L.DomUtil.create("ul", "csd-search-results", container);
    workCsdSearchList.id = "work-csd-search-results";
    workCsdSearchList.setAttribute("role", "listbox");
    workCsdSearchList.hidden = true;

    L.DomEvent.disableClickPropagation(container);
    L.DomEvent.disableScrollPropagation(container);
    L.DomEvent.on(workCsdSearchInput, "input", updateWorkSearchResults);
    L.DomEvent.on(workCsdSearchInput, "focus", updateWorkSearchResults);
    L.DomEvent.on(workCsdSearchInput, "keydown", handleWorkSearchKeydown);

    return container;
  },
});

new WorkCsdSearchControl().addTo(map);

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

const FlowModeControl = L.Control.extend({
  options: { position: "topleft" },

  onAdd() {
    flowModeButton = L.DomUtil.create("button", "leaflet-bar flow-mode-control");
    flowModeButton.type = "button";
    flowModeButton.hidden = true;

    L.DomEvent.disableClickPropagation(flowModeButton);
    L.DomEvent.on(flowModeButton, "click", toggleFlowDisplayMode);
    updateFlowModeButton();
    return flowModeButton;
  },
});

new FlowModeControl().addTo(map);

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
  csdSearchInput.closest(".csd-search-control").classList.remove("is-search-open");
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
  csdSearchInput
    .closest(".csd-search-control")
    .classList.toggle("is-search-open", results.length > 0);
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

function closeWorkSearchResults() {
  workSearchResults = [];
  activeWorkSearchResultIndex = -1;
  workCsdSearchInput.closest(".csd-search-control").classList.remove("is-search-open");
  workCsdSearchList.replaceChildren();
  workCsdSearchList.hidden = true;
  workCsdSearchInput.setAttribute("aria-expanded", "false");
  workCsdSearchInput.removeAttribute("aria-activedescendant");
}

function setActiveWorkSearchResult(index) {
  if (!workSearchResults.length) return;

  activeWorkSearchResultIndex = (index + workSearchResults.length) % workSearchResults.length;
  const options = workCsdSearchList.querySelectorAll('[role="option"]');
  options.forEach((option, optionIndex) => {
    const isActive = optionIndex === activeWorkSearchResultIndex;
    option.classList.toggle("is-active", isActive);
    option.setAttribute("aria-selected", String(isActive));
  });

  const activeOption = options[activeWorkSearchResultIndex];
  workCsdSearchInput.setAttribute("aria-activedescendant", activeOption.id);
  activeOption.scrollIntoView({ block: "nearest" });
}

function selectWorkSearchResult(entry) {
  workCsdSearchInput.value = entry.name;
  closeWorkSearchResults();
  selectWorkCsd(entry.feature);
  map.flyToBounds(entry.layer.getBounds(), {
    padding: [30, 30],
    maxZoom: 11,
    duration: 0.7,
  });
  workCsdSearchInput.blur();
}

function renderWorkSearchResults(results) {
  workSearchResults = results;
  activeWorkSearchResultIndex = -1;
  workCsdSearchInput
    .closest(".csd-search-control")
    .classList.toggle("is-search-open", results.length > 0);
  workCsdSearchList.replaceChildren();

  results.forEach((entry, index) => {
    const option = document.createElement("li");
    option.id = `work-csd-search-option-${index}`;
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
      selectWorkSearchResult(entry);
    });
    workCsdSearchList.append(option);
  });

  workCsdSearchList.hidden = results.length === 0;
  workCsdSearchInput.setAttribute("aria-expanded", String(results.length > 0));
}

function updateWorkSearchResults() {
  const query = normalizedSearchText(workCsdSearchInput.value);
  if (!query) {
    closeWorkSearchResults();
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

  renderWorkSearchResults(matches);
}

function handleWorkSearchKeydown(event) {
  if (event.key === "Escape") {
    event.preventDefault();
    closeWorkSearchResults();
    return;
  }

  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    if (!workSearchResults.length) updateWorkSearchResults();
    if (!workSearchResults.length) return;
    event.preventDefault();
    const step = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex =
      activeWorkSearchResultIndex < 0
        ? event.key === "ArrowDown"
          ? 0
          : workSearchResults.length - 1
        : activeWorkSearchResultIndex + step;
    setActiveWorkSearchResult(nextIndex);
    return;
  }

  if (event.key === "Enter" && workSearchResults.length) {
    event.preventDefault();
    const selectedIndex = activeWorkSearchResultIndex >= 0 ? activeWorkSearchResultIndex : 0;
    selectWorkSearchResult(workSearchResults[selectedIndex]);
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
  const isIncoming =
    (selectedCsdUid !== null && workUid === selectedCsdUid) ||
    (selectedWorkCsdUid !== null && workUid === selectedWorkCsdUid);
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

function selectedFlowWeight(commuters) {
  const percentile = selectedFlowRanks.get(Number(commuters)) ?? 0;
  if (percentile <= 0.5) return 1;
  if (percentile <= 0.75) return 1.75;
  if (percentile <= 0.9) return 3;
  if (percentile <= 0.97) return 4.75;
  return 7;
}

function flowStyle(feature) {
  if (selectedCsdUid === null && selectedWorkCsdUid === null) {
    return {
      color: "#c43d3d",
      weight: 1,
      opacity: 0.24,
    };
  }

  const properties = feature.properties ?? {};
  const isOutgoing = normalizeUid(properties.Home_CSDUID) === selectedCsdUid;
  const isIncoming =
    normalizeUid(properties.Work_CSDUID) === (selectedWorkCsdUid ?? selectedCsdUid);
  const isMajorFlow = selectedMajorFlowFeatures.has(feature);
  const selectedOpacity = flowDisplayMode === "all" || isMajorFlow ? 0.82 : 0.08;

  if (isOutgoing) {
    return {
      color: "#d7301f",
      weight: selectedFlowWeight(properties.Commuters),
      opacity: selectedOpacity,
    };
  }

  if (isIncoming) {
    return {
      color: "#2166ac",
      weight: selectedFlowWeight(properties.Commuters),
      opacity: selectedOpacity,
    };
  }

  return {
    color: "#68737d",
    weight: 0.5,
    opacity: 0.035,
  };
}

function csdStyle(feature) {
  const isSelected =
    normalizeUid(feature.properties?.CSDUID) === (selectedWorkCsdUid ?? selectedCsdUid);

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
  const combinedCounts = [];
  const outgoingFlows = [];
  const incomingFlows = [];

  flowLayer.eachLayer((layer) => {
    const properties = layer.feature?.properties ?? {};
    const commuters = Number(properties.Commuters);
    if (!Number.isFinite(commuters)) return;
    const isOutgoing = normalizeUid(properties.Home_CSDUID) === csdUid;
    const isIncoming = normalizeUid(properties.Work_CSDUID) === csdUid;

    if (isOutgoing) outgoingFlows.push({ feature: layer.feature, commuters });
    if (isIncoming) incomingFlows.push({ feature: layer.feature, commuters });
    if (isOutgoing || isIncoming) combinedCounts.push(commuters);
  });

  return {
    combined: rankFlowCounts(combinedCounts),
    outgoing: selectMajorFlows(outgoingFlows),
    incoming: selectMajorFlows(incomingFlows),
  };
}

function rankSelectedWorkFlows(csdUid) {
  const incomingFlows = [];

  flowLayer.eachLayer((layer) => {
    const properties = layer.feature?.properties ?? {};
    const commuters = Number(properties.Commuters);
    if (
      Number.isFinite(commuters) &&
      normalizeUid(properties.Work_CSDUID) === csdUid
    ) {
      incomingFlows.push({ feature: layer.feature, commuters });
    }
  });

  return {
    ranks: rankFlowCounts(incomingFlows.map((flow) => flow.commuters)),
    incoming: selectMajorFlows(incomingFlows),
  };
}

function selectMajorFlows(flows) {
  const total = flows.reduce((sum, flow) => sum + flow.commuters, 0);
  const features = new Set();
  let cumulative = 0;

  if (total > 0) {
    const sortedFlows = [...flows].sort((a, b) => b.commuters - a.commuters);
    for (const flow of sortedFlows) {
      features.add(flow.feature);
      cumulative += flow.commuters;
      if (cumulative >= total * 0.5) break;
    }
  }

  return {
    features,
    count: flows.length,
    total,
    majorCount: features.size,
    cumulative,
    cumulativeShare: total > 0 ? cumulative / total : 0,
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
    const isSelectedFlow =
      selectedWorkCsdUid !== null
        ? workUid === selectedWorkCsdUid
        : homeUid === selectedCsdUid || workUid === selectedCsdUid;
    const isInteractive =
      (selectedCsdUid === null && selectedWorkCsdUid === null) ||
      (isSelectedFlow &&
        (flowDisplayMode === "all" || selectedMajorFlowFeatures.has(layer.feature)));

    layer.options.interactive = isInteractive;
    if (!isInteractive) {
      layer.closeTooltip();
      layer.closePopup();
    }
  });
}

function updateFlowModeButton() {
  if (!flowModeButton) return;

  const isMajorMode = flowDisplayMode === "major";
  const workMode = selectedWorkCsdUid !== null;
  flowModeButton.textContent = isMajorMode ? "Select all flows" : "Select top 50% flows only";
  flowModeButton.title = isMajorMode
    ? workMode
      ? "Show all incoming flows"
      : "Show all incoming and outgoing flows"
    : workMode
      ? "Emphasize incoming flows that reach 50% of incoming commuters"
      : "Emphasize incoming and outgoing flows that separately reach 50%";
  flowModeButton.setAttribute("aria-pressed", String(isMajorMode));
  flowModeButton.classList.toggle("is-major-mode", isMajorMode);
}

function updateSelectedFlowStatus() {
  if (!selectedFlowSummary) return;

  const { name, mode, outgoing, incoming } = selectedFlowSummary;
  if (mode === "work") {
    statusElement.textContent =
      flowDisplayMode === "major"
        ? `${name}: major incoming flows highlight ${incoming.majorCount.toLocaleString()} of ` +
          `${incoming.count.toLocaleString()} records (${(incoming.cumulativeShare * 100).toFixed(1)}% of incoming commuters).`
        : `${name}: ${incoming.count.toLocaleString()} incoming commuter-flow records highlighted.`;
    return;
  }

  if (flowDisplayMode === "major") {
    statusElement.textContent =
      `${name}: major flows highlight ${outgoing.majorCount.toLocaleString()} of ` +
      `${outgoing.count.toLocaleString()} outgoing records (${(outgoing.cumulativeShare * 100).toFixed(1)}%) and ` +
      `${incoming.majorCount.toLocaleString()} of ${incoming.count.toLocaleString()} incoming records ` +
      `(${(incoming.cumulativeShare * 100).toFixed(1)}%).`;
    return;
  }

  statusElement.textContent =
    `${name}: ${outgoing.count.toLocaleString()} outgoing and ` +
    `${incoming.count.toLocaleString()} incoming commuter-flow records highlighted.`;
}

function toggleFlowDisplayMode() {
  if (selectedCsdUid === null && selectedWorkCsdUid === null) return;

  flowDisplayMode = flowDisplayMode === "all" ? "major" : "all";
  updateFlowModeButton();
  flowLayer.setStyle(flowStyle);
  updateFlowInteractivity();
  updateSelectedFlowStatus();
}

function selectCsd(feature) {
  selectedWorkCsdUid = null;
  if (workCsdSearchInput) workCsdSearchInput.value = "";
  if (workCsdSearchList) closeWorkSearchResults();
  selectedCsdUid = normalizeUid(feature.properties?.CSDUID);
  const rankedFlows = rankSelectedFlows(selectedCsdUid);
  selectedFlowRanks = rankedFlows.combined;
  selectedMajorFlowFeatures = new Set([
    ...rankedFlows.outgoing.features,
    ...rankedFlows.incoming.features,
  ]);
  const csdName = feature.properties?.CSDNAME ?? selectedCsdUid;
  selectedFlowSummary = {
    name: csdName,
    mode: "csd",
    outgoing: rankedFlows.outgoing,
    incoming: rankedFlows.incoming,
  };

  csdLayer.resetStyle();
  flowLayer.setStyle(flowStyle);
  updateFlowInteractivity();

  clearSelectionButton.hidden = false;
  flowModeButton.hidden = false;
  flowLegendElement.hidden = false;
  updateFlowLegend();
  updateFlowModeButton();
  updateSelectedFlowStatus();
}

function selectWorkCsd(feature) {
  selectedCsdUid = null;
  if (csdSearchInput) csdSearchInput.value = "";
  if (csdSearchList) closeSearchResults();
  selectedWorkCsdUid = normalizeUid(feature.properties?.CSDUID);
  const rankedFlows = rankSelectedWorkFlows(selectedWorkCsdUid);
  selectedFlowRanks = rankedFlows.ranks;
  selectedMajorFlowFeatures = new Set(rankedFlows.incoming.features);
  const csdName = feature.properties?.CSDNAME ?? selectedWorkCsdUid;
  selectedFlowSummary = {
    name: csdName,
    mode: "work",
    incoming: rankedFlows.incoming,
  };

  csdLayer.resetStyle();
  flowLayer.setStyle(flowStyle);
  updateFlowInteractivity();

  clearSelectionButton.hidden = false;
  flowModeButton.hidden = false;
  flowLegendElement.hidden = false;
  updateFlowLegend();
  updateFlowModeButton();
  updateSelectedFlowStatus();
}

function updateFlowLegend() {
  if (!flowLegendElement) return;

  flowLegendElement.innerHTML = selectedWorkCsdUid !== null
    ? `<div class="flow-legend-title">Selected Work CSD flows</div>
       <div><span class="flow-legend-swatch flow-legend-incoming"></span>Incoming commuters</div>`
    : `<div class="flow-legend-title">Selected CSD flows</div>
       <div><span class="flow-legend-swatch flow-legend-outgoing"></span>Home / outgoing commuters</div>
       <div><span class="flow-legend-swatch flow-legend-incoming"></span>Work / incoming commuters</div>`;
}

function clearCsdSelection() {
  selectedCsdUid = null;
  selectedWorkCsdUid = null;
  selectedFlowRanks = new Map();
  selectedMajorFlowFeatures = new Set();
  selectedFlowSummary = null;
  flowDisplayMode = "all";

  if (csdLayer) csdLayer.resetStyle();
  if (flowLayer) {
    flowLayer.setStyle(flowStyle);
    updateFlowInteractivity();
  }

  if (clearSelectionButton) clearSelectionButton.hidden = true;
  if (flowModeButton) {
    flowModeButton.hidden = true;
    updateFlowModeButton();
  }
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

class LabelCell {
  constructor(x, y, halfSize, polygon) {
    this.x = x;
    this.y = y;
    this.halfSize = halfSize;
    this.distance = pointToPolygonDistance(x, y, polygon);
    this.maximum = this.distance + halfSize * Math.SQRT2;
  }
}

class MaxHeap {
  constructor() {
    this.items = [];
  }

  push(item) {
    const items = this.items;
    items.push(item);
    let index = items.length - 1;

    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (items[parentIndex].maximum >= item.maximum) break;
      items[index] = items[parentIndex];
      index = parentIndex;
    }
    items[index] = item;
  }

  pop() {
    const items = this.items;
    if (!items.length) return null;

    const result = items[0];
    const last = items.pop();
    if (!items.length) return result;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= items.length) break;
      const child = right < items.length && items[right].maximum > items[left].maximum
        ? right
        : left;
      if (items[child].maximum <= last.maximum) break;
      items[index] = items[child];
      index = child;
    }
    items[index] = last;
    return result;
  }

  get length() {
    return this.items.length;
  }
}

function pointToSegmentDistanceSquared(x, y, first, second) {
  let segmentX = second[0] - first[0];
  let segmentY = second[1] - first[1];
  if (segmentX !== 0 || segmentY !== 0) {
    const fraction = Math.max(
      0,
      Math.min(
        1,
        ((x - first[0]) * segmentX + (y - first[1]) * segmentY) /
          (segmentX * segmentX + segmentY * segmentY),
      ),
    );
    segmentX = first[0] + segmentX * fraction - x;
    segmentY = first[1] + segmentY * fraction - y;
  } else {
    segmentX = first[0] - x;
    segmentY = first[1] - y;
  }
  return segmentX * segmentX + segmentY * segmentY;
}

function pointToPolygonDistance(x, y, polygon) {
  let inside = false;
  let minimumDistanceSquared = Infinity;

  for (const ring of polygon) {
    for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
      const first = ring[index];
      const second = ring[previous];
      if (
        (first[1] > y) !== (second[1] > y) &&
        x < ((second[0] - first[0]) * (y - first[1])) / (second[1] - first[1]) + first[0]
      ) {
        inside = !inside;
      }
      minimumDistanceSquared = Math.min(
        minimumDistanceSquared,
        pointToSegmentDistanceSquared(x, y, first, second),
      );
    }
  }

  const distance = Math.sqrt(minimumDistanceSquared);
  return inside ? distance : -distance;
}

function ringArea(ring) {
  let twiceArea = 0;
  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    twiceArea +=
      ring[previous][0] * ring[index][1] - ring[index][0] * ring[previous][1];
  }
  return Math.abs(twiceArea / 2);
}

function polygonArea(polygon) {
  if (!polygon.length) return 0;
  return Math.max(
    0,
    ringArea(polygon[0]) - polygon.slice(1).reduce((area, ring) => area + ringArea(ring), 0),
  );
}

function polygonCentroidCell(polygon) {
  const ring = polygon[0];
  let areaFactor = 0;
  let x = 0;
  let y = 0;

  for (let index = 0, previous = ring.length - 1; index < ring.length; previous = index++) {
    const cross =
      ring[previous][0] * ring[index][1] - ring[index][0] * ring[previous][1];
    areaFactor += cross;
    x += (ring[previous][0] + ring[index][0]) * cross;
    y += (ring[previous][1] + ring[index][1]) * cross;
  }

  if (areaFactor === 0) return new LabelCell(ring[0][0], ring[0][1], 0, polygon);
  return new LabelCell(x / (3 * areaFactor), y / (3 * areaFactor), 0, polygon);
}

function poleOfInaccessibility(polygon) {
  const outerRing = polygon[0];
  let minimumX = Infinity;
  let minimumY = Infinity;
  let maximumX = -Infinity;
  let maximumY = -Infinity;

  for (const point of outerRing) {
    minimumX = Math.min(minimumX, point[0]);
    minimumY = Math.min(minimumY, point[1]);
    maximumX = Math.max(maximumX, point[0]);
    maximumY = Math.max(maximumY, point[1]);
  }

  const width = maximumX - minimumX;
  const height = maximumY - minimumY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return outerRing[0];

  const queue = new MaxHeap();
  const halfSize = cellSize / 2;
  for (let x = minimumX; x < maximumX; x += cellSize) {
    for (let y = minimumY; y < maximumY; y += cellSize) {
      queue.push(new LabelCell(x + halfSize, y + halfSize, halfSize, polygon));
    }
  }

  let bestCell = polygonCentroidCell(polygon);
  const boundingBoxCell = new LabelCell(
    minimumX + width / 2,
    minimumY + height / 2,
    0,
    polygon,
  );
  if (boundingBoxCell.distance > bestCell.distance) bestCell = boundingBoxCell;

  const precision = Math.max(25, cellSize / 200);
  while (queue.length) {
    const cell = queue.pop();
    if (cell.distance > bestCell.distance) bestCell = cell;
    if (cell.maximum - bestCell.distance <= precision) continue;

    const childHalfSize = cell.halfSize / 2;
    queue.push(new LabelCell(cell.x - childHalfSize, cell.y - childHalfSize, childHalfSize, polygon));
    queue.push(new LabelCell(cell.x + childHalfSize, cell.y - childHalfSize, childHalfSize, polygon));
    queue.push(new LabelCell(cell.x - childHalfSize, cell.y + childHalfSize, childHalfSize, polygon));
    queue.push(new LabelCell(cell.x + childHalfSize, cell.y + childHalfSize, childHalfSize, polygon));
  }

  return [bestCell.x, bestCell.y];
}

function projectPolygon(coordinates) {
  return coordinates.map((ring) =>
    ring.map(([longitude, latitude]) => {
      const point = L.CRS.EPSG3857.project(L.latLng(latitude, longitude));
      return [point.x, point.y];
    }),
  );
}

function municipalLabelCandidate(feature, sourceIndex) {
  const geometry = feature.geometry;
  const polygons = geometry?.type === "Polygon"
    ? [geometry.coordinates]
    : geometry?.type === "MultiPolygon"
      ? geometry.coordinates
      : [];
  if (!polygons.length) return null;

  let largestPolygon;
  let largestArea = -Infinity;
  let totalArea = 0;
  for (const coordinates of polygons) {
    const polygon = projectPolygon(coordinates);
    const area = polygonArea(polygon);
    totalArea += area;
    if (area > largestArea) {
      largestArea = area;
      largestPolygon = polygon;
    }
  }

  const [x, y] = poleOfInaccessibility(largestPolygon);
  const point = L.CRS.EPSG3857.unproject(L.point(x, y));
  return {
    name: String(feature.properties?.MUNICIPAL_NAME_SHORTFORM ?? ""),
    point,
    area: totalArea,
    sourceIndex,
  };
}

function rectanglesOverlap(first, second) {
  return !(
    first.right <= second.left ||
    first.left >= second.right ||
    first.bottom <= second.top ||
    first.top >= second.bottom
  );
}

const MunicipalLabelLayer = L.Layer.extend({
  initialize(candidates) {
    this._candidates = candidates;
    this._redrawFrame = null;
  },

  onAdd(mapInstance) {
    this._map = mapInstance;
    this._container = L.DomUtil.create("div", "municipal-label-container");
    mapInstance.getPane("municipalLabels").append(this._container);
    mapInstance.on("moveend zoomend resize", this.scheduleRedraw, this);
    this.scheduleRedraw();
  },

  onRemove(mapInstance) {
    mapInstance.off("moveend zoomend resize", this.scheduleRedraw, this);
    if (this._redrawFrame !== null) cancelAnimationFrame(this._redrawFrame);
    this._redrawFrame = null;
    this._container.remove();
    this._container = null;
    this._map = null;
  },

  scheduleRedraw() {
    if (this._redrawFrame !== null) cancelAnimationFrame(this._redrawFrame);
    this._redrawFrame = requestAnimationFrame(() => {
      this._redrawFrame = null;
      this.redraw();
    });
  },

  redraw() {
    if (!this._map || !this._container) return;
    this._container.replaceChildren();
    if (!municipalLayer || !this._map.hasLayer(municipalLayer)) return;

    const acceptedRectangles = [];
    const mapBounds = this._map.getBounds();
    for (const candidate of this._candidates) {
      if (!candidate.name || !mapBounds.contains(candidate.point)) continue;

      const layerPoint = this._map.latLngToLayerPoint(candidate.point);
      const label = L.DomUtil.create("span", "municipal-name-label", this._container);
      label.textContent = candidate.name;
      label.dataset.municipality = candidate.name;
      label.style.left = `${layerPoint.x}px`;
      label.style.top = `${layerPoint.y}px`;

      const rectangle = label.getBoundingClientRect();
      if (acceptedRectangles.some((accepted) => rectanglesOverlap(rectangle, accepted))) {
        label.remove();
        continue;
      }
      acceptedRectangles.push(rectangle);
    }
  },
});

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
    csdSearchInput.placeholder = "Search CSD";
    workCsdSearchInput.disabled = false;
    workCsdSearchInput.placeholder = "Search Work CSD";

    municipalLayer = L.geoJSON(municipalResult.data, {
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

    const municipalLabelCandidates = municipalResult.data.features
      .map(municipalLabelCandidate)
      .filter(Boolean)
      .sort((first, second) =>
        second.area - first.area ||
        first.name.localeCompare(second.name, "en-CA", {
          sensitivity: "base",
          numeric: true,
        }) ||
        first.sourceIndex - second.sourceIndex,
      );
    municipalLabelLayer = new MunicipalLabelLayer(municipalLabelCandidates);

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
    overlays["Municipal name labels"] = municipalLabelLayer;
    layerControl.addOverlay(municipalLabelLayer, "Municipal name labels");
    registerOverlay("Commuter flows", flowLayer);

    map.on("overlayadd overlayremove", (event) => {
      if (event.layer === municipalLayer && map.hasLayer(municipalLabelLayer)) {
        municipalLabelLayer.scheduleRedraw();
      }
    });

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
