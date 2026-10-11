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
  var select = document.getElementById("variable-select");
  var mapElement = document.getElementById("map");
  var infoPanel = document.getElementById("info-panel");
  var legendTitle = document.getElementById("legend-title");
  var legendClasses = document.getElementById("legend-classes");
  var currentField = "C6";
  var classifications = {};
  var selectedClasses = new Set();
  var noDataSelected = false;
  var selectedLayer = null;
  var geojsonLayer = null;
  var cityBoundaryLayer = null;

  var map = L.map("map", {
    zoomControl: true,
    attributionControl: true,
    maxBoundsViscosity: 1,
    preferCanvas: true,
  });

  var basemap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

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
      var uniqueCount = new Set(values).size;
      var classCount = Math.min(6, uniqueCount);
      var clusters = ss.ckmeans(values, classCount);
      classifications[field] = clusters.map(function (cluster) {
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
    if (layer === selectedLayer) {
      if (isFeatureActive(layer.feature)) {
        style.color = "#152d28";
        style.weight = 2.2;
        style.opacity = 1;
        style.fillOpacity = 0.88;
      }
    }
    layer.setStyle(style);
  }

  function showDefaultInfo() {
    infoPanel.replaceChildren();
    var kicker = document.createElement("p");
    kicker.className = "panel-kicker";
    kicker.textContent = "Dissemination area";
    var prompt = document.createElement("p");
    prompt.className = "info-prompt";
    prompt.textContent = "Hover over or tap a DA to see its value.";
    infoPanel.append(kicker, prompt);
  }

  function showFeatureInfo(layer) {
    var properties = layer.feature.properties;
    var details = VARIABLES[currentField];
    infoPanel.replaceChildren();

    var kicker = document.createElement("p");
    kicker.className = "panel-kicker";
    kicker.textContent = "Dissemination area";
    var id = document.createElement("p");
    id.className = "info-dauid";
    id.textContent = properties.DAUID;
    var label = document.createElement("p");
    label.className = "info-variable";
    label.textContent = details.label;
    var value = document.createElement("p");
    value.className = "info-value";
    value.textContent = formatNumber(properties[currentField], currentField);
    infoPanel.append(kicker, id, label, value);
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
        else showDefaultInfo();
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
    legendClasses.classList.toggle("has-selection", hasLegendSelection());
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
    legendClasses.append(row);
  }

  function updateLegend() {
    legendTitle.textContent = VARIABLES[currentField].label;
    legendClasses.replaceChildren();
    classifications[currentField].forEach(function (range, index) {
      addLegendRow(COLORS[index], formatRange(range, currentField), index);
    });
    addLegendRow(NO_DATA_COLOR, "No data", -1);
  }

  function restyleMap() {
    var filtered = hasLegendSelection();
    if (geojsonLayer) geojsonLayer.eachLayer(applyLayerStyle);
    if (filtered) {
      if (map.hasLayer(basemap)) map.removeLayer(basemap);
      if (cityBoundaryLayer && !map.hasLayer(cityBoundaryLayer)) cityBoundaryLayer.addTo(map);
    } else {
      if (!map.hasLayer(basemap)) basemap.addTo(map);
      if (cityBoundaryLayer && map.hasLayer(cityBoundaryLayer)) map.removeLayer(cityBoundaryLayer);
    }
    mapElement.classList.toggle("is-filtered", filtered);
  }

  function clearLegendSelection() {
    selectedClasses = new Set();
    noDataSelected = false;
    legendClasses.classList.remove("has-selection");
  }

  function updateVariable() {
    currentField = select.value;
    clearLegendSelection();
    restyleMap();
    updateLegend();
    if (selectedLayer) showFeatureInfo(selectedLayer);
    else showDefaultInfo();
  }

  function showLoadError() {
    infoPanel.replaceChildren();
    var kicker = document.createElement("p");
    kicker.className = "panel-kicker";
    kicker.textContent = "Map unavailable";
    var message = document.createElement("p");
    message.className = "info-prompt";
    message.textContent = "The Census boundary data could not be loaded. Serve this folder with a local web server and try again.";
    infoPanel.append(kicker, message);
  }

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
      var data = datasets[0];
      var cityBoundary = datasets[1];
      buildClassifications(data.features);
      clearLegendSelection();
      geojsonLayer = L.geoJSON(data, { style: baseStyle, onEachFeature: onEachFeature }).addTo(map);
      cityBoundaryLayer = L.geoJSON(cityBoundary, {
        interactive: false,
        style: {
          color: "#68736f",
          opacity: 0.82,
          weight: 1.25,
        },
      });
      var bounds = geojsonLayer.getBounds();
      map.fitBounds(bounds, { padding: [12, 12] });
      map.setMaxBounds(bounds.pad(0.22));
      map.setMinZoom(Math.max(9, map.getZoom() - 1));
      updateLegend();
      select.addEventListener("change", updateVariable);
      map.on("click", function () {
        if (selectedLayer) applyLayerStyle(selectedLayer);
        selectedLayer = null;
        showDefaultInfo();
      });
    })
    .catch(function (error) {
      console.error(error);
      showLoadError();
    });
})();
