(function () {
  "use strict";

  var SHARE_BREAKS = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1.0000001];

  function shareClass(value) {
    if (value === null || value === undefined || !Number.isFinite(Number(value))) return -1;
    for (var index = 0; index < SHARE_BREAKS.length - 1; index += 1) {
      if (Number(value) < SHARE_BREAKS[index + 1]) return index;
    }
    return SHARE_BREAKS.length - 2;
  }

  function voteRadius(votes, maximum, maxRadius) {
    if (!Number.isFinite(Number(votes)) || Number(votes) <= 0 || maximum <= 0) return 0;
    return maxRadius * Math.sqrt(Number(votes) / maximum);
  }

  function voteBreaks(maximum) {
    return [0, 0.25, 0.5, 0.75, 1].map(function (portion) {
      return portion === 0 ? 0 : Math.ceil(Number(maximum) * portion);
    });
  }

  function voteClass(votes, maximum) {
    if (!Number.isFinite(Number(votes)) || maximum <= 0) return -1;
    var breaks = voteBreaks(maximum);
    for (var index = 1; index < breaks.length - 1; index += 1) {
      if (Number(votes) < breaks[index]) return index - 1;
    }
    return breaks.length - 2;
  }

  function jaccardIndex(left, right) {
    var common = 0;
    left.forEach(function (value) { if (right.has(value)) common += 1; });
    var union = left.size + right.size - common;
    return union ? common / union : 0;
  }

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { shareClass: shareClass, voteRadius: voteRadius, voteBreaks: voteBreaks, voteClass: voteClass, jaccardIndex: jaccardIndex };
  }
  if (typeof document === "undefined") return;

  var VARIABLES = {
    C6: { label: "Population density", decimals: 1, suffix: " people per km²" },
    C40: { label: "Median age", decimals: 1, suffix: " years" },
    C42: { label: "Single-detached houses", decimals: 0, suffix: "" },
    C47: { label: "Apartments in buildings with five or more storeys", decimals: 0, suffix: "" },
    C113: { label: "Median income (individuals)", decimals: 0, prefix: "$", suffix: " CAD" },
    C1474: { label: "Median dwelling value", decimals: 0, prefix: "$", suffix: " CAD" },
  };
  var CENSUS_COLORS = ["#f1f8e9", "#c7e9c0", "#7fcdbb", "#41b6c4", "#2c7fb8", "#253494"];
  var NO_DATA_COLOR = "#d8dcda";
  var CANDIDATE_STYLES = {
    "51": { base: "#d1495b", ramp: ["#fff0f3", "#ffd6df", "#f8a8ba", "#ed7893", "#d1495b", "#8f1d3a"] },
    "54": { base: "#e68a00", ramp: ["#fff7e6", "#ffe5b2", "#ffc96b", "#f2a93b", "#e68a00", "#9a5400"] },
    "50": { base: "#8e44ad", ramp: ["#f8f0fc", "#ead5f3", "#d2a9e4", "#b97bd2", "#8e44ad", "#57266b"] },
    "56": { base: "#b33c86" },
    "52": { base: "#a65f2b" },
    "53": { base: "#c6a500" },
    "57": { base: "#5c514b" },
    "55": { base: "#7f1d1d" },
  };
  var TIE_COLOR = "#2f2a26";
  var ELECTION_MARKER_OUTLINE = "#fffdf7";
  var ROAD_STYLES = {
    "Arterial": { color: "#8b1d1d", weight: 1.2 },
    "Secondary Arterial": { color: "#e87500", weight: 1 },
  };
  var SKYTRAIN_STYLES = {
    "Expo Line": "#dca600",
    "Millennium Line": "#c67898",
    "Canada Line": "#1a83bd",
  };
  var RAPIDBUS_COLOR = "#8753b5";
  var datasets = {};
  var classifications = {};
  var dataPromises = {};
  var primaryView = null;
  var comparisonView = null;
  var state = {
    mode: "election",
    candidate: null,
    metric: "share",
    electionVisible: true,
    censusVisible: true,
    basemapFaded: false,
  };

  var page = document.querySelector(".map-page");
  var mapGrid = document.getElementById("map-grid");
  var comparePanel = document.getElementById("compare-panel");
  var electionControls = document.getElementById("election-controls");
  var censusPicker = document.getElementById("census-picker");
  var compareCensusPicker = document.getElementById("compare-census-picker");
  var candidateSelect = document.getElementById("candidate-select");
  var metricControl = document.getElementById("metric-control");
  var electionToggle = document.getElementById("election-layer-toggle");
  var censusToggle = document.getElementById("census-layer-toggle");
  var basemapFadeToggle = document.getElementById("basemap-fade-toggle");
  var summaryPanel = document.getElementById("summary-panel");
  var primaryMapLabel = document.getElementById("primary-map-label");

  function isFiniteValue(value) {
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  }

  function formatInteger(value) {
    return Number(value).toLocaleString("en-CA", { maximumFractionDigits: 0 });
  }

  function formatPercent(value, decimals) {
    if (!isFiniteValue(value)) return "No mayoral results";
    return (Number(value) * 100).toLocaleString("en-CA", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }) + "%";
  }

  function formatCensus(value, field) {
    if (!isFiniteValue(value)) return "No data";
    var details = VARIABLES[field];
    return (details.prefix || "") + Number(value).toLocaleString("en-CA", {
      minimumFractionDigits: details.decimals,
      maximumFractionDigits: details.decimals,
    }) + (details.suffix || "");
  }

  function createElement(tag, className, text) {
    var element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function fetchJson(url) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error(url + " request failed: " + response.status);
      return response.json();
    });
  }

  function lazyData(key, url) {
    if (!dataPromises[key]) {
      dataPromises[key] = fetchJson(url).catch(function (error) {
        delete dataPromises[key];
        throw error;
      });
    }
    return dataPromises[key];
  }

  function buildClassifications() {
    Object.keys(VARIABLES).forEach(function (field) {
      var values = datasets.census.features
        .map(function (feature) { return feature.properties[field]; })
        .filter(isFiniteValue)
        .map(Number);
      var count = Math.min(6, new Set(values).size);
      classifications[field] = ss.ckmeans(values, count).map(function (cluster) {
        return { min: cluster[0], max: cluster[cluster.length - 1] };
      });
    });
  }

  function censusClass(value, field) {
    if (!isFiniteValue(value)) return -1;
    var ranges = classifications[field];
    for (var index = 0; index < ranges.length; index += 1) {
      if (Number(value) <= ranges[index].max) return index;
    }
    return ranges.length - 1;
  }

  function candidateByNumber(number) {
    return datasets.summary.candidates.find(function (candidate) {
      return String(candidate.number) === String(number);
    });
  }

  function allCandidateByNumber(number) {
    return datasets.summary.all_candidates.find(function (candidate) {
      return String(candidate.number) === String(number);
    });
  }

  function isWinnerDisplay() { return state.candidate === "winner"; }

  function candidateStyle() {
    return CANDIDATE_STYLES[state.candidate] || CANDIDATE_STYLES["51"];
  }

  function maxCandidateVotes() {
    return Math.max.apply(null, datasets.election.features.map(function (feature) {
      return feature.properties.candidates[state.candidate].votes;
    }));
  }

  function renderSummary() {
    var content = document.getElementById("summary-content");
    content.replaceChildren();
    content.append(createElement("h3", "", "Citywide mayoral results"));
    var list = createElement("ol", "summary-list");
    datasets.summary.candidates.forEach(function (candidate) {
      var item = document.createElement("li");
      var dot = createElement("span", "candidate-dot");
      dot.style.backgroundColor = CANDIDATE_STYLES[String(candidate.number)].base;
      var label = createElement("span", "", candidate.name + (candidate.affiliation ? " · " + candidate.affiliation : ""));
      var value = createElement("span", "summary-value", formatInteger(candidate.votes) + " · " + formatPercent(candidate.share, 2));
      item.append(dot, label, value);
      list.append(item);
    });
    content.append(list);
    var nonspatial = createElement("p", "summary-note");
    var nonspatialText = formatInteger(datasets.summary.totals.nonspatial_total_votes) + " valid votes";
    if (!isWinnerDisplay()) {
      var selected = candidateByNumber(state.candidate);
      nonspatialText += "; " + selected.name + " " + formatInteger(selected.nonspatial_votes);
    }
    nonspatial.append(createElement("strong", "", "Mail + SVO (not mapped): "), document.createTextNode(nonspatialText + "."));
    content.append(nonspatial);
    content.append(createElement("p", "summary-note", "All citywide totals include the two non-spatial records. Map symbols include only the 147 matched records aggregated to 88 physical locations."));
  }

  function buildLocationPopup(feature) {
    var properties = feature.properties;
    var container = createElement("div", "location-popup");
    container.append(createElement("h3", "", properties.facility_name));
    container.append(createElement("p", "popup-address", properties.facility_address + (properties.local_area ? " · " + properties.local_area : "")));
    container.append(createElement("p", "popup-address", "Voting-place IDs: " + properties.component_ids.join(", ") + " · " + formatInteger(properties.total_votes) + " valid mayor votes"));

    if (!properties.has_mayoral_results) {
      container.append(createElement("p", "popup-flags", "No mayoral contest/results. These records have a zero mayoral denominator and are not shown as 0% support."));
    } else {
      if (isWinnerDisplay()) {
        var winnerNames = properties.winner.candidate_numbers.map(function (number) {
          return allCandidateByNumber(number).name;
        });
        var winnerLabel = properties.winner.status === "tie" ? "Tie: " : "Winning candidate: ";
        container.append(createElement("p", "popup-winner", winnerLabel + winnerNames.join(" and ") + " · " + formatInteger(properties.winner.votes) + " votes"));
      }
      var table = createElement("table", "popup-results");
      var head = document.createElement("thead");
      var headRow = document.createElement("tr");
      ["Candidate", "Votes", "Share"].forEach(function (text) { headRow.append(createElement("th", "", text)); });
      head.append(headRow);
      var body = document.createElement("tbody");
      var popupCandidates = isWinnerDisplay() ? datasets.summary.all_candidates : datasets.summary.candidates;
      popupCandidates.forEach(function (candidate) {
        var results = isWinnerDisplay() ? properties.all_candidates : properties.candidates;
        var result = results[String(candidate.number)];
        var row = document.createElement("tr");
        if (isWinnerDisplay() ? properties.winner.candidate_numbers.indexOf(String(candidate.number)) >= 0 : String(candidate.number) === state.candidate) row.className = "is-selected";
        row.append(
          createElement("td", "", candidate.name),
          createElement("td", "", formatInteger(result.votes)),
          createElement("td", "", formatPercent(result.share, 1))
        );
        body.append(row);
      });
      table.append(head, body);
      container.append(table);
    }

    if (properties.components.length > 1 && !isWinnerDisplay()) {
      var details = createElement("details", "component-details");
      details.append(createElement("summary", "", "Component-record breakdown"));
      var list = document.createElement("ul");
      properties.components.forEach(function (component) {
        var result = component.candidates[state.candidate];
        list.append(createElement("li", "", "ID " + component.id + ": " + formatInteger(result.votes) + " votes · " + formatPercent(result.share, 1) + " · " + formatInteger(component.total_votes) + " total valid"));
      });
      details.append(list);
      container.append(details);
    }

    var flagLabels = [];
    if (properties.flags.advance_only) flagLabels.push("Advance-only flag supplied");
    if (properties.flags.supercentre) flagLabels.push("Supercentre flag supplied");
    if (properties.flags.imagecast_evolution) flagLabels.push("ImageCast Evolution flag supplied");
    if (flagLabels.length) container.append(createElement("p", "popup-flags", flagLabels.join(" · ")));
    container.append(createElement("p", "popup-warning", "Results are associated with the voting location, not voters’ home addresses."));
    return container;
  }

  function createAuxLegend(mapElement) {
    var panel = createElement("aside", "aux-legend");
    panel.hidden = true;
    mapElement.parentElement.append(panel);
    return panel;
  }

  function createMapView(options) {
    var censusField = options.select.value;
    var selectedCensusLayer = null;
    var selectedCensusClasses = new Set();
    var noDataSelected = false;
    var selectedElectionCategories = new Set();
    var showElection = false;
    var showCensus = false;
    var userAdjustedView = false;
    var hasFit = false;
    var legendCollapsed = false;

    var map = L.map(options.mapElement, {
      zoomControl: true,
      attributionControl: true,
      preferCanvas: false,
      zoomSnap: 0.25,
    });
    var basemap = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      opacity: state.basemapFaded ? 0.25 : 1,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    map.createPane("censusPane");
    map.getPane("censusPane").style.zIndex = 350;
    map.createPane("boundaryPane");
    map.getPane("boundaryPane").style.zIndex = 410;
    map.createPane("roadsPane");
    map.getPane("roadsPane").style.zIndex = 440;
    map.createPane("transitPane");
    map.getPane("transitPane").style.zIndex = 460;
    map.createPane("electionPane");
    map.getPane("electionPane").style.zIndex = 500;

    function hasCensusFilter() { return selectedCensusClasses.size > 0 || noDataSelected; }
    function censusClassEnabled(index) {
      if (!hasCensusFilter()) return true;
      return index < 0 ? noDataSelected : selectedCensusClasses.has(index);
    }
    function baseCensusStyle(feature) {
      var index = censusClass(feature.properties[censusField], censusField);
      var active = censusClassEnabled(index);
      return {
        pane: "censusPane",
        fillColor: index < 0 ? NO_DATA_COLOR : CENSUS_COLORS[index],
        fillOpacity: active ? (showElection ? 0.55 : 0.78) : 0,
        color: "#4e625c",
        opacity: active ? 0.65 : 0,
        weight: active ? 0.5 : 0.2,
      };
    }
    function applyCensusStyle(layer) {
      var style = baseCensusStyle(layer.feature);
      if (selectedCensusLayer === layer) {
        style.color = "#152d28";
        style.opacity = 1;
        style.weight = 2.2;
        style.fillOpacity = 0.86;
      }
      layer.setStyle(style);
    }
    function showCensusInfo(layer) {
      var properties = layer.feature.properties;
      options.infoPanel.replaceChildren(
        createElement("p", "info-title", "DA " + properties.DAUID),
        createElement("p", "", VARIABLES[censusField].label),
        createElement("p", "info-value", formatCensus(properties[censusField], censusField))
      );
      options.infoPanel.hidden = false;
    }
    function hideCensusInfo() {
      options.infoPanel.hidden = true;
      options.infoPanel.replaceChildren();
    }
    function censusEvents(feature, layer) {
      layer.on({
        mouseover: function () {
          if (censusClassEnabled(censusClass(feature.properties[censusField], censusField))) {
            layer.setStyle({ color: "#162d28", weight: 1.8, opacity: 1, fillOpacity: 0.88 });
            layer.bringToFront();
            showCensusInfo(layer);
          }
        },
        mouseout: function () {
          applyCensusStyle(layer);
          if (selectedCensusLayer) showCensusInfo(selectedCensusLayer); else hideCensusInfo();
        },
        click: function (event) {
          L.DomEvent.stopPropagation(event.originalEvent);
          selectedCensusLayer = layer;
          censusLayer.eachLayer(applyCensusStyle);
          showCensusInfo(layer);
        },
      });
    }
    var censusLayer = L.geoJSON(datasets.census, {
      pane: "censusPane",
      style: baseCensusStyle,
      onEachFeature: censusEvents,
      bubblingMouseEvents: false,
    });

    function hasElectionFilter() { return selectedElectionCategories.size > 0; }
    function electionCategory(feature) {
      if (!feature.properties.has_mayoral_results) return "no_results";
      if (isWinnerDisplay()) {
        if (feature.properties.winner.status === "tie") return "winner:tie";
        return "winner:" + feature.properties.winner.candidate_numbers[0];
      }
      var result = feature.properties.candidates[state.candidate];
      if (state.metric === "share") return "share:" + shareClass(result.share);
      return "votes:" + voteClass(result.votes, maxCandidateVotes());
    }
    function electionFeatureEnabled(feature) {
      return !hasElectionFilter() || selectedElectionCategories.has(electionCategory(feature));
    }
    function electionMarkerStyle(feature) {
      if (!feature.properties.has_mayoral_results) {
        return { pane: "electionPane", radius: 7, fillColor: NO_DATA_COLOR, fillOpacity: 0.9, color: ELECTION_MARKER_OUTLINE, weight: 2, dashArray: "3 2" };
      }
      if (isWinnerDisplay()) {
        var outcome = feature.properties.winner;
        var fillColor = outcome.status === "tie" ? TIE_COLOR : CANDIDATE_STYLES[outcome.candidate_numbers[0]].base;
        return { pane: "electionPane", radius: 9, fillColor: fillColor, fillOpacity: 0.88, color: ELECTION_MARKER_OUTLINE, weight: 2 };
      }
      var result = feature.properties.candidates[state.candidate];
      var style = candidateStyle();
      if (state.metric === "share") {
        return { pane: "electionPane", radius: 8, fillColor: style.ramp[shareClass(result.share)], fillOpacity: 0.88, color: ELECTION_MARKER_OUTLINE, weight: 2 };
      }
      return { pane: "electionPane", radius: Math.max(1.5, voteRadius(result.votes, maxCandidateVotes(), 25)), fillColor: style.base, fillOpacity: 0.68, color: ELECTION_MARKER_OUTLINE, weight: 2 };
    }
    function applyElectionStyle(layer) {
      layer.setStyle(electionMarkerStyle(layer.feature));
      var element = layer.getElement();
      if (!element) return;
      var enabled = electionFeatureEnabled(layer.feature);
      element.style.display = enabled ? "" : "none";
      element.setAttribute("aria-hidden", String(!enabled));
      element.setAttribute("tabindex", enabled ? "0" : "-1");
    }
    function electionFeature(feature, layer) {
      layer.bindPopup(function () { return buildLocationPopup(feature); }, { maxWidth: 360 });
      layer.on("add", function () {
        var element = layer.getElement();
        if (!element) return;
        element.setAttribute("tabindex", "0");
        element.setAttribute("role", "button");
        element.setAttribute("aria-label", feature.properties.facility_name + ", voting-place results");
        element.addEventListener("keydown", function (event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            layer.openPopup();
          }
        });
        applyElectionStyle(layer);
      });
    }
    var electionLayer = L.geoJSON(datasets.election, {
      pane: "electionPane",
      pointToLayer: function (feature, latlng) { return L.circleMarker(latlng, electionMarkerStyle(feature)); },
      onEachFeature: electionFeature,
    });

    var boundaryLayer = L.geoJSON(datasets.boundary, {
      pane: "boundaryPane",
      interactive: false,
      style: { color: "#68736f", opacity: 0.86, weight: 1.35 },
    }).addTo(map);
    var cityBounds = boundaryLayer.getBounds();

    var roads = L.layerGroup();
    var skytrain = L.layerGroup();
    var rapidbus = L.layerGroup();
    var populated = { roads: false, skytrain: false, rapidbus: false };
    var auxLegend = createAuxLegend(options.mapElement);
    L.control.layers(null, { "Road network": roads, "SkyTrain": skytrain, "RapidBus": rapidbus }, { position: "topright" }).addTo(map);

    function routePopup(feature) {
      var properties = feature.properties || {};
      return createElement("div", "", properties.route_name || properties.HBLOCK || "Route information unavailable");
    }
    function populateOverlay(type, collection) {
      if (populated[type]) return;
      var group = type === "roads" ? roads : type === "skytrain" ? skytrain : rapidbus;
      var filtered = collection;
      if (type === "roads") {
        filtered = { type: "FeatureCollection", features: collection.features.filter(function (feature) {
          return Object.prototype.hasOwnProperty.call(ROAD_STYLES, feature.properties && feature.properties.STREETUSE);
        }) };
      }
      group.addLayer(L.geoJSON(filtered, {
        pane: type === "roads" ? "roadsPane" : "transitPane",
        style: function (feature) {
          if (type === "roads") return Object.assign({ opacity: 0.72 }, ROAD_STYLES[feature.properties.STREETUSE]);
          return { color: type === "rapidbus" ? RAPIDBUS_COLOR : (SKYTRAIN_STYLES[feature.properties.route_name] || "#555"), weight: 2, opacity: 0.82 };
        },
        onEachFeature: function (feature, layer) { layer.bindPopup(function () { return routePopup(feature); }); },
      }));
      populated[type] = true;
    }
    function updateAuxLegend(message) {
      var enabled = [];
      if (map.hasLayer(roads)) enabled.push("Road network");
      if (map.hasLayer(skytrain)) enabled.push("SkyTrain");
      if (map.hasLayer(rapidbus)) enabled.push("RapidBus");
      auxLegend.hidden = enabled.length === 0;
      auxLegend.replaceChildren();
      if (!enabled.length) return;
      auxLegend.append(createElement("h3", "", "Transport overlays"));
      enabled.forEach(function (label) {
        var row = createElement("div", "aux-row");
        var line = createElement("span", "aux-line");
        line.style.backgroundColor = label === "Road network" ? "#8b1d1d" : label === "RapidBus" ? RAPIDBUS_COLOR : "#1a83bd";
        row.append(line, createElement("span", "", label));
        auxLegend.append(row);
      });
      if (message) auxLegend.append(createElement("p", "aux-status", message));
    }
    map.on("overlayadd", function (event) {
      var type = event.layer === roads ? "roads" : event.layer === skytrain ? "skytrain" : event.layer === rapidbus ? "rapidbus" : null;
      if (!type) return;
      updateAuxLegend("Loading…");
      var url = type === "roads" ? "data/vancouver_roads.geojson" : type === "skytrain" ? "data/vancouver_skytrain.geojson" : "data/vancouver_rapidbus.geojson";
      lazyData(type, url).then(function (data) {
        populateOverlay(type, data);
        updateAuxLegend();
      }).catch(function (error) {
        console.error(error);
        updateAuxLegend("Overlay data unavailable.");
      });
    });
    map.on("overlayremove", function () { updateAuxLegend(); });

    function addLegendRow(container, color, text, index) {
      var row = createElement("button", "legend-row");
      row.type = "button";
      row.dataset.classIndex = String(index);
      row.setAttribute("aria-pressed", "false");
      var swatch = createElement("span", "legend-swatch");
      swatch.style.backgroundColor = color;
      row.append(swatch, createElement("span", "", text));
      row.addEventListener("click", function () {
        if (index < 0) noDataSelected = !noDataSelected;
        else if (selectedCensusClasses.has(index)) selectedCensusClasses.delete(index);
        else selectedCensusClasses.add(index);
        renderLegend();
        restyleCensus();
      });
      container.append(row);
    }

    function renderElectionLegend(parent) {
      var section = createElement("section", "legend-section election-legend-section");
      var rows = createElement("div", "legend-rows" + (hasElectionFilter() ? " has-selection" : ""));
      function addElectionLegendRow(color, text, category, circleSize) {
        var row = createElement("button", "legend-row");
        row.type = "button";
        row.dataset.electionCategory = category;
        var swatch = createElement("span", circleSize ? "circle-key" : "legend-swatch");
        if (circleSize) {
          swatch.style.color = color;
          swatch.style.backgroundColor = color;
          swatch.style.borderColor = ELECTION_MARKER_OUTLINE;
          swatch.style.width = circleSize + "px";
          swatch.style.height = circleSize + "px";
        } else {
          swatch.style.backgroundColor = color;
        }
        var selected = selectedElectionCategories.has(category);
        row.classList.toggle("is-selected", selected);
        row.setAttribute("aria-pressed", String(selected));
        row.append(swatch, createElement("span", "", text));
        row.addEventListener("click", function () {
          if (selectedElectionCategories.has(category)) selectedElectionCategories.delete(category);
          else selectedElectionCategories.add(category);
          renderLegend();
          restyleElection();
        });
        rows.append(row);
      }

      if (isWinnerDisplay()) {
        section.append(createElement("h3", "", "Winning candidate · combined location totals"));
        var winningNumbers = new Set();
        var hasTie = false;
        datasets.election.features.forEach(function (feature) {
          if (feature.properties.winner.status === "winner") winningNumbers.add(feature.properties.winner.candidate_numbers[0]);
          if (feature.properties.winner.status === "tie") hasTie = true;
        });
        datasets.summary.all_candidates.forEach(function (candidate) {
          var number = String(candidate.number);
          if (winningNumbers.has(number)) addElectionLegendRow(CANDIDATE_STYLES[number].base, candidate.name, "winner:" + number);
        });
        if (hasTie) addElectionLegendRow(TIE_COLOR, "Tie", "winner:tie");
        addElectionLegendRow(NO_DATA_COLOR, "No mayoral contest/results", "no_results");
        section.append(rows);
        section.append(createElement("p", "legend-note", "All eight mayoral candidates are considered. Select categories to filter."));
      } else {
        var candidate = candidateByNumber(state.candidate);
        var style = candidateStyle();
        section.append(createElement("h3", "", candidate.name + " · " + (state.metric === "share" ? "vote share" : "votes")));
        if (state.metric === "share") {
          SHARE_BREAKS.slice(0, -1).forEach(function (minimum, index) {
            var maximum = SHARE_BREAKS[index + 1];
            var label = index === SHARE_BREAKS.length - 2 ? "50% and above" : Math.round(minimum * 100) + "% – under " + Math.round(maximum * 100) + "%";
            addElectionLegendRow(style.ramp[index], label, "share:" + index);
          });
        } else {
          var maximumVotes = maxCandidateVotes();
          var breaks = voteBreaks(maximumVotes);
          breaks.slice(0, -1).forEach(function (minimum, index) {
            var maximum = index === breaks.length - 2 ? maximumVotes : breaks[index + 1] - 1;
            var label = formatInteger(minimum) + " – " + formatInteger(maximum) + " votes";
            var representative = index === breaks.length - 2 ? maximumVotes : breaks[index + 1];
            var diameter = Math.max(4, voteRadius(representative, maximumVotes, 13) * 2);
            addElectionLegendRow(style.base, label, "votes:" + index, diameter);
          });
          section.append(createElement("p", "legend-note", "Circle area is proportional to candidate votes."));
        }
        addElectionLegendRow(NO_DATA_COLOR, "No mayoral contest/results", "no_results");
        section.append(rows);
        section.append(createElement("p", "legend-note", "Select categories to filter."));
      }
      if (hasElectionFilter()) {
        var clear = createElement("button", "legend-clear", "Clear election filter");
        clear.type = "button";
        clear.addEventListener("click", function () {
          selectedElectionCategories.clear();
          renderLegend();
          restyleElection();
        });
        section.append(clear);
      }
      parent.append(section);
    }

    function renderCensusLegend(parent) {
      var section = createElement("section", "legend-section");
      section.append(createElement("h3", "", VARIABLES[censusField].label + " · 2021 Census"));
      var rows = createElement("div", "legend-rows" + (hasCensusFilter() ? " has-selection" : ""));
      classifications[censusField].forEach(function (range, index) {
        addLegendRow(rows, CENSUS_COLORS[index], formatCensus(range.min, censusField) + " – " + formatCensus(range.max, censusField), index);
      });
      addLegendRow(rows, NO_DATA_COLOR, "No data", -1);
      rows.querySelectorAll(".legend-row").forEach(function (row) {
        var index = Number(row.dataset.classIndex);
        var selected = index < 0 ? noDataSelected : selectedCensusClasses.has(index);
        row.classList.toggle("is-selected", selected);
        row.setAttribute("aria-pressed", String(selected));
      });
      section.append(rows);
      if (hasCensusFilter()) {
        var clear = createElement("button", "legend-clear", "Clear Census filter");
        clear.type = "button";
        clear.addEventListener("click", function () {
          selectedCensusClasses.clear();
          noDataSelected = false;
          renderLegend();
          restyleCensus();
        });
        section.append(clear);
      }
      section.append(createElement("p", "legend-note", "Natural breaks (Jenks), excluding missing values. Select classes to filter."));
      parent.append(section);
    }

    function renderLegend() {
      options.legendContent.replaceChildren();
      if (showElection) renderElectionLegend(options.legendContent);
      if (showCensus) renderCensusLegend(options.legendContent);
      if (!showElection && !showCensus) options.legendContent.append(createElement("p", "legend-note", "No thematic layer is visible."));
    }

    function restyleCensus() {
      censusLayer.eachLayer(applyCensusStyle);
      var filtered = showCensus && hasCensusFilter();
      options.mapElement.classList.toggle("is-filtered", filtered);
    }

    function restyleElection() {
      electionLayer.eachLayer(applyElectionStyle);
      if (map.hasLayer(electionLayer)) electionLayer.bringToFront();
    }

    function fitInitialView() {
      if (hasFit || userAdjustedView || !cityBounds.isValid()) return;
      hasFit = true;
      map.invalidateSize({ pan: false });
      map.fitBounds(cityBounds, { animate: false, paddingTopLeft: [18, 18], paddingBottomRight: [70, 80] });
      map.setMinZoom(Math.max(9, map.getZoom() - 1));
    }

    function setLayers(nextElection, nextCensus) {
      if (showElection && !nextElection && hasElectionFilter()) selectedElectionCategories.clear();
      showElection = nextElection;
      showCensus = nextCensus;
      if (showElection && !map.hasLayer(electionLayer)) electionLayer.addTo(map);
      if (!showElection && map.hasLayer(electionLayer)) map.removeLayer(electionLayer);
      if (showCensus && !map.hasLayer(censusLayer)) censusLayer.addTo(map);
      if (!showCensus && map.hasLayer(censusLayer)) censusLayer.removeFrom(map);
      boundaryLayer.bringToFront();
      if (showElection) electionLayer.bringToFront();
      renderLegend();
      restyleCensus();
      window.requestAnimationFrame(fitInitialView);
    }

    function updateElection() {
      selectedElectionCategories.clear();
      restyleElection();
      renderLegend();
      map.closePopup();
    }

    function updateCensus() {
      censusField = options.select.value;
      selectedCensusLayer = null;
      selectedCensusClasses.clear();
      noDataSelected = false;
      hideCensusInfo();
      restyleCensus();
      renderLegend();
    }

    function markAdjusted() { userAdjustedView = true; }
    map.on("dragstart zoomstart boxzoomstart", markAdjusted);
    options.mapElement.addEventListener("wheel", markAdjusted, { passive: true });
    options.select.addEventListener("change", updateCensus);
    options.legendToggle.addEventListener("click", function () {
      legendCollapsed = !legendCollapsed;
      options.legend.classList.toggle("is-collapsed", legendCollapsed);
      options.legendContent.hidden = legendCollapsed;
      options.legendToggle.textContent = legendCollapsed ? "+" : "−";
      options.legendToggle.setAttribute("aria-expanded", String(!legendCollapsed));
    });
    map.on("click", function () {
      selectedCensusLayer = null;
      censusLayer.eachLayer(applyCensusStyle);
      hideCensusInfo();
    });

    return {
      setLayers: setLayers,
      updateElection: updateElection,
      setBasemapFaded: function (faded) { basemap.setOpacity(faded ? 0.25 : 1); },
      refresh: function () { map.invalidateSize({ pan: false }); window.requestAnimationFrame(fitInitialView); },
    };
  }

  function primaryOptions() {
    return {
      mapElement: document.getElementById("map"),
      select: document.getElementById("census-variable-select"),
      infoPanel: document.getElementById("info-panel"),
      legend: document.getElementById("legend"),
      legendContent: document.getElementById("legend-content"),
      legendToggle: document.getElementById("legend-toggle"),
    };
  }

  function comparisonOptions() {
    return {
      mapElement: document.getElementById("compare-map"),
      select: document.getElementById("compare-census-variable-select"),
      infoPanel: document.getElementById("compare-info-panel"),
      legend: document.getElementById("compare-legend"),
      legendContent: document.getElementById("compare-legend-content"),
      legendToggle: document.getElementById("compare-legend-toggle"),
    };
  }

  function ensureComparisonView() {
    if (!comparisonView) comparisonView = createMapView(comparisonOptions());
  }

  function updateLayerControlAvailability() {
    var censusOnly = state.mode === "census";
    electionToggle.disabled = censusOnly;
    electionToggle.closest("label").classList.toggle("is-disabled", censusOnly);
    if (censusOnly) electionToggle.setAttribute("aria-describedby", "primary-map-label");
    else electionToggle.removeAttribute("aria-describedby");
  }

  function applyMode() {
    var comparing = state.mode === "compare";
    page.className = "map-page mode-" + state.mode + (comparing ? " is-compare" : "");
    mapGrid.classList.toggle("is-compare", comparing);
    comparePanel.hidden = !comparing;
    compareCensusPicker.hidden = !comparing;
    censusPicker.hidden = comparing;
    electionControls.hidden = state.mode === "census";
    summaryPanel.hidden = state.mode === "census";
    primaryMapLabel.textContent = state.mode === "census" ? "Census characteristics" : state.mode === "compare" ? "Election results" : "Election results with Census context";
    document.querySelectorAll("[data-mode]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.dataset.mode === state.mode));
    });
    updateLayerControlAvailability();
    if (state.mode === "election") {
      primaryView.setLayers(state.electionVisible, state.censusVisible);
    } else if (state.mode === "census") {
      primaryView.setLayers(false, state.censusVisible);
    } else {
      ensureComparisonView();
      primaryView.setLayers(state.electionVisible, false);
      comparisonView.setLayers(false, state.censusVisible);
    }
    window.requestAnimationFrame(function () {
      primaryView.refresh();
      if (comparing && comparisonView) comparisonView.refresh();
    });
  }

  function updateElectionViews() {
    renderSummary();
    primaryView.updateElection();
    if (comparisonView) comparisonView.updateElection();
  }

  function updateMetricAvailability() {
    metricControl.hidden = isWinnerDisplay();
  }

  function initializeControls() {
    var winnerOption = document.createElement("option");
    winnerOption.value = "winner";
    winnerOption.textContent = "Winning Candidate";
    candidateSelect.append(winnerOption);
    datasets.summary.candidates.forEach(function (candidate) {
      var option = document.createElement("option");
      option.value = String(candidate.number);
      option.textContent = candidate.name + (candidate.affiliation ? " (" + candidate.affiliation + ")" : "");
      candidateSelect.append(option);
    });
    candidateSelect.value = state.candidate;
    updateMetricAvailability();
    candidateSelect.addEventListener("change", function () {
      state.candidate = candidateSelect.value;
      updateMetricAvailability();
      updateElectionViews();
    });
    document.getElementById("share-metric").addEventListener("click", function () {
      state.metric = "share";
      document.getElementById("share-metric").setAttribute("aria-pressed", "true");
      document.getElementById("votes-metric").setAttribute("aria-pressed", "false");
      updateElectionViews();
    });
    document.getElementById("votes-metric").addEventListener("click", function () {
      state.metric = "votes";
      document.getElementById("share-metric").setAttribute("aria-pressed", "false");
      document.getElementById("votes-metric").setAttribute("aria-pressed", "true");
      updateElectionViews();
    });
    document.querySelectorAll("[data-mode]").forEach(function (button) {
      button.addEventListener("click", function () { state.mode = button.dataset.mode; applyMode(); });
    });
    electionToggle.addEventListener("change", function () { state.electionVisible = electionToggle.checked; applyMode(); });
    censusToggle.addEventListener("change", function () { state.censusVisible = censusToggle.checked; applyMode(); });
    basemapFadeToggle.addEventListener("change", function () {
      state.basemapFaded = basemapFadeToggle.checked;
      primaryView.setBasemapFaded(state.basemapFaded);
      if (comparisonView) comparisonView.setBasemapFaded(state.basemapFaded);
    });
    var summaryCollapsed = false;
    document.getElementById("summary-toggle").addEventListener("click", function () {
      summaryCollapsed = !summaryCollapsed;
      summaryPanel.classList.toggle("is-collapsed", summaryCollapsed);
      document.getElementById("summary-content").hidden = summaryCollapsed;
      this.textContent = summaryCollapsed ? "+" : "−";
      this.setAttribute("aria-expanded", String(!summaryCollapsed));
    });
    window.addEventListener("resize", function () {
      if (primaryView) primaryView.refresh();
      if (comparisonView && state.mode === "compare") comparisonView.refresh();
    });
  }

  function showFatalError(error) {
    console.error(error);
    var panel = document.getElementById("summary-content");
    panel.replaceChildren(createElement("p", "loading-message", "Map unavailable. Required local data could not be loaded. Run the application through a local HTTP server and check the console for details."));
  }

  Promise.all([
    fetchJson("data/election_locations.geojson"),
    fetchJson("data/election_summary.json"),
    fetchJson("data/vancouver_das.geojson"),
    fetchJson("data/vancouver_city_boundary.geojson"),
  ]).then(function (loaded) {
    datasets.election = loaded[0];
    datasets.summary = loaded[1];
    datasets.census = loaded[2];
    datasets.boundary = loaded[3];
    state.candidate = String(datasets.summary.candidates[0].number);
    buildClassifications();
    initializeControls();
    renderSummary();
    primaryView = createMapView(primaryOptions());
    applyMode();
  }).catch(showFatalError);
})();
