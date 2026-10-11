(function () {
  "use strict";

  var VARIABLES = {
    C6: { label: "Population density", decimals: 1, suffix: " people per km²" },
    C40: { label: "Median age", decimals: 1, suffix: " years" },
    C42: { label: "Single-detached houses", decimals: 0, suffix: "" },
    C47: {
      label: "Apartments in buildings with five or more storeys",
      decimals: 0,
      suffix: "",
    },
    C113: { label: "Median income (individuals)", decimals: 0, prefix: "$", suffix: " CAD" },
  };
  var COLORS = ["#f1f8e9", "#c7e9c0", "#7fcdbb", "#41b6c4", "#2c7fb8", "#253494"];
  var NO_DATA_COLOR = "#d8dcda";
  var classifications = {};
  var censusData = null;
  var cityBoundaryData = null;
  var primaryView = null;
  var comparisonView = null;
  var currentMode = "single";

  var page = document.querySelector(".map-page");
  var mapGrid = document.getElementById("map-grid");
  var comparePanel = document.getElementById("compare-panel");
  var comparePicker = document.getElementById("compare-picker");
  var singleModeButton = document.getElementById("single-mode");
  var compareModeButton = document.getElementById("compare-mode");

  function isValue(value) {
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  }

  function formatNumber(value, field) {
    if (!isValue(value)) return "No data";
    var details = VARIABLES[field];
    return (
      (details.prefix || "") +
      Number(value).toLocaleString("en-CA", {
        minimumFractionDigits: details.decimals,
        maximumFractionDigits: details.decimals,
      }) +
      (details.suffix || "")
    );
  }

  function buildClassifications(features) {
    Object.keys(VARIABLES).forEach(function (field) {
      var values = features
        .map(function (feature) { return feature.properties[field]; })
        .filter(isValue)
        .map(Number);
      var classCount = Math.min(6, new Set(values).size);
      classifications[field] = ss.ckmeans(values, classCount).map(function (cluster) {
        return { min: cluster[0], max: cluster[cluster.length - 1] };
      });
    });
  }

  function classIndex(value, field) {
    if (!isValue(value)) return -1;
    var ranges = classifications[field];
    for (var index = 0; index < ranges.length; index += 1) {
      if (Number(value) <= ranges[index].max) return index;
    }
    return ranges.length - 1;
  }

  function formatRange(range, field) {
    return formatNumber(range.min, field) + " – " + formatNumber(range.max, field);
  }

  function showLoadError(infoPanel) {
    infoPanel.replaceChildren();
    infoPanel.hidden = false;
    var message = document.createElement("p");
    message.className = "info-message";
    message.textContent = "Map unavailable. The Census boundary data could not be loaded.";
    infoPanel.append(message);
  }

  function createMapView(options) {
    var currentField = options.select.value;
    var selectedClasses = new Set();
    var noDataSelected = false;
    var selectedLayer = null;
    var legendCollapsed = false;

    var map = L.map(options.mapElement, {
      zoomControl: true,
      attributionControl: true,
      maxBoundsViscosity: 1,
      preferCanvas: true,
    });

    var basemap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    function hasLegendSelection() {
      return selectedClasses.size > 0 || noDataSelected;
    }

    function isClassEnabled(index) {
      if (!hasLegendSelection()) return true;
      return index < 0 ? noDataSelected : selectedClasses.has(index);
    }

    function isFeatureActive(feature) {
      return isClassEnabled(classIndex(feature.properties[currentField], currentField));
    }

    function baseStyle(feature) {
      var index = classIndex(feature.properties[currentField], currentField);
      var active = isClassEnabled(index);
      return {
        fillColor: index < 0 ? NO_DATA_COLOR : COLORS[index],
        fillOpacity: active ? 0.78 : 0,
        color: "#4e625c",
        opacity: active ? 0.72 : 0,
        weight: active ? 0.55 : 0.3,
      };
    }

    function applyLayerStyle(layer) {
      var style = baseStyle(layer.feature);
      if (layer === selectedLayer && isFeatureActive(layer.feature)) {
        style.color = "#152d28";
        style.weight = 2.2;
        style.opacity = 1;
        style.fillOpacity = 0.88;
      }
      layer.setStyle(style);
    }

    function hideInfo() {
      options.infoPanel.replaceChildren();
      options.infoPanel.hidden = true;
    }

    function showFeatureInfo(layer) {
      var properties = layer.feature.properties;
      var details = VARIABLES[currentField];
      options.infoPanel.replaceChildren();
      options.infoPanel.hidden = false;

      var id = document.createElement("p");
      id.className = "info-dauid";
      id.textContent = "DA " + properties.DAUID;
      var label = document.createElement("p");
      label.className = "info-variable";
      label.textContent = details.label;
      var value = document.createElement("p");
      value.className = "info-value";
      value.textContent = formatNumber(properties[currentField], currentField);
      options.infoPanel.append(id, label, value);
    }

    function highlight(layer) {
      var active = isFeatureActive(layer.feature);
      layer.setStyle({
        color: "#162d28",
        weight: active ? 1.8 : 0.3,
        opacity: active ? 1 : 0,
        fillOpacity: active ? 0.9 : 0,
      });
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) layer.bringToFront();
    }

    function onEachFeature(feature, layer) {
      layer.on({
        mouseover: function () {
          highlight(layer);
          showFeatureInfo(layer);
        },
        mouseout: function () {
          applyLayerStyle(layer);
          if (selectedLayer) showFeatureInfo(selectedLayer);
          else hideInfo();
        },
        click: function (event) {
          L.DomEvent.stopPropagation(event.originalEvent);
          if (selectedLayer && selectedLayer !== layer) applyLayerStyle(selectedLayer);
          selectedLayer = layer;
          highlight(layer);
          showFeatureInfo(layer);
        },
      });
    }

    var geojsonLayer = L.geoJSON(censusData, {
      style: baseStyle,
      onEachFeature: onEachFeature,
    }).addTo(map);

    var cityBoundaryLayer = L.geoJSON(cityBoundaryData, {
      interactive: false,
      style: {
        color: "#68736f",
        opacity: 0.82,
        weight: 1.25,
      },
    });

    function restyleMap() {
      var filtered = hasLegendSelection();
      geojsonLayer.eachLayer(applyLayerStyle);
      if (filtered) {
        if (map.hasLayer(basemap)) map.removeLayer(basemap);
        if (!map.hasLayer(cityBoundaryLayer)) cityBoundaryLayer.addTo(map);
      } else {
        if (!map.hasLayer(basemap)) basemap.addTo(map);
        if (map.hasLayer(cityBoundaryLayer)) map.removeLayer(cityBoundaryLayer);
      }
      options.mapElement.classList.toggle("is-filtered", filtered);
    }

    function clearLegendSelection() {
      selectedClasses = new Set();
      noDataSelected = false;
      options.legendClasses.classList.remove("has-selection");
      options.legendClasses.querySelectorAll(".legend-row").forEach(function (row) {
        row.classList.remove("is-selected");
        row.setAttribute("aria-pressed", "false");
      });
      options.clearSelectionButton.hidden = true;
    }

    function toggleLegendClass(index, row) {
      if (index < 0) {
        noDataSelected = !noDataSelected;
      } else if (selectedClasses.has(index)) {
        selectedClasses.delete(index);
      } else {
        selectedClasses.add(index);
      }
      var selected = index < 0 ? noDataSelected : selectedClasses.has(index);
      row.classList.toggle("is-selected", selected);
      row.setAttribute("aria-pressed", String(selected));
      options.legendClasses.classList.toggle("has-selection", hasLegendSelection());
      options.clearSelectionButton.hidden = !hasLegendSelection();
      restyleMap();
    }

    function addLegendRow(color, text, index) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "legend-row";
      row.setAttribute("aria-pressed", "false");
      row.addEventListener("click", function () { toggleLegendClass(index, row); });
      var swatch = document.createElement("span");
      swatch.className = "legend-swatch";
      swatch.style.backgroundColor = color;
      var label = document.createElement("span");
      label.textContent = text;
      row.append(swatch, label);
      options.legendClasses.append(row);
    }

    function updateLegend() {
      options.legendTitle.textContent = VARIABLES[currentField].label;
      options.legendClasses.replaceChildren();
      classifications[currentField].forEach(function (range, index) {
        addLegendRow(COLORS[index], formatRange(range, currentField), index);
      });
      addLegendRow(NO_DATA_COLOR, "No data", -1);
    }

    function setLegendCollapsed(collapsed) {
      legendCollapsed = collapsed;
      options.legend.classList.toggle("is-collapsed", legendCollapsed);
      options.legendContent.hidden = legendCollapsed;
      options.legendToggle.textContent = legendCollapsed ? "+" : "−";
      options.legendToggle.setAttribute("aria-expanded", String(!legendCollapsed));
      options.legendToggle.setAttribute(
        "aria-label",
        legendCollapsed ? "Expand legend" : "Collapse legend"
      );
    }

    function updateVariable() {
      currentField = options.select.value;
      clearLegendSelection();
      restyleMap();
      updateLegend();
      if (selectedLayer) showFeatureInfo(selectedLayer);
      else hideInfo();
    }

    var bounds = geojsonLayer.getBounds();
    map.fitBounds(bounds, { padding: [12, 12] });
    map.setMaxBounds(bounds.pad(0.22));
    map.setMinZoom(Math.max(9, map.getZoom() - 1));
    updateLegend();

    options.select.addEventListener("change", updateVariable);
    options.legendToggle.addEventListener("click", function () {
      setLegendCollapsed(!legendCollapsed);
    });
    options.clearSelectionButton.addEventListener("click", function () {
      clearLegendSelection();
      restyleMap();
    });
    map.on("click", function () {
      if (selectedLayer) applyLayerStyle(selectedLayer);
      selectedLayer = null;
      hideInfo();
    });

    return {
      invalidateSize: function () {
        map.invalidateSize({ pan: false });
      },
    };
  }

  function primaryOptions() {
    return {
      mapElement: document.getElementById("map"),
      select: document.getElementById("variable-select"),
      infoPanel: document.getElementById("info-panel"),
      legend: document.querySelector("#legend-title").closest(".legend"),
      legendTitle: document.getElementById("legend-title"),
      legendToggle: document.getElementById("legend-toggle"),
      legendContent: document.getElementById("legend-content"),
      legendClasses: document.getElementById("legend-classes"),
      clearSelectionButton: document.getElementById("clear-selection"),
    };
  }

  function comparisonOptions() {
    return {
      mapElement: document.getElementById("compare-map"),
      select: document.getElementById("compare-variable-select"),
      infoPanel: document.getElementById("compare-info-panel"),
      legend: document.querySelector("#compare-legend-title").closest(".legend"),
      legendTitle: document.getElementById("compare-legend-title"),
      legendToggle: document.getElementById("compare-legend-toggle"),
      legendContent: document.getElementById("compare-legend-content"),
      legendClasses: document.getElementById("compare-legend-classes"),
      clearSelectionButton: document.getElementById("compare-clear-selection"),
    };
  }

  function ensureComparisonView() {
    if (!comparisonView && censusData && cityBoundaryData) {
      comparisonView = createMapView(comparisonOptions());
    }
  }

  function refreshVisibleMaps() {
    window.requestAnimationFrame(function () {
      if (primaryView) primaryView.invalidateSize();
      if (currentMode === "compare" && comparisonView) comparisonView.invalidateSize();
    });
  }

  function setMode(mode) {
    currentMode = mode;
    var comparing = mode === "compare";
    page.classList.toggle("is-compare", comparing);
    mapGrid.classList.toggle("is-compare", comparing);
    comparePanel.hidden = !comparing;
    comparePicker.hidden = !comparing;
    singleModeButton.setAttribute("aria-pressed", String(!comparing));
    compareModeButton.setAttribute("aria-pressed", String(comparing));
    if (comparing) ensureComparisonView();
    refreshVisibleMaps();
  }

  singleModeButton.addEventListener("click", function () { setMode("single"); });
  compareModeButton.addEventListener("click", function () { setMode("compare"); });

  Promise.all([
    fetch("data/vancouver_das.geojson"),
    fetch("data/vancouver_city_boundary.geojson"),
  ])
    .then(function (responses) {
      responses.forEach(function (response) {
        if (!response.ok) throw new Error("GeoJSON request failed: " + response.status);
      });
      return Promise.all(responses.map(function (response) { return response.json(); }));
    })
    .then(function (datasets) {
      censusData = datasets[0];
      cityBoundaryData = datasets[1];
      buildClassifications(censusData.features);
      primaryView = createMapView(primaryOptions());
      if (currentMode === "compare") ensureComparisonView();
      refreshVisibleMaps();
    })
    .catch(function (error) {
      console.error(error);
      showLoadError(document.getElementById("info-panel"));
      if (currentMode === "compare") {
        showLoadError(document.getElementById("compare-info-panel"));
      }
    });
})();
