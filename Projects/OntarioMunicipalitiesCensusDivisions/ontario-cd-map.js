const map = L.map("ontario-cd-map", {
  zoomControl: true,
  preferCanvas: true,
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  maxZoom: 19,
}).addTo(map);

const statusMessage = document.querySelector("#map-status");
let activeHoverLayer = null;
let activeHoverReset = null;

function clearActiveHover() {
  if (!activeHoverLayer) return;

  activeHoverLayer.closeTooltip();
  activeHoverReset();
  activeHoverLayer = null;
  activeHoverReset = null;
}

function escapeHtml(value) {
  return String(value ?? "Not available")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function definitionList(rows) {
  return rows
    .map(([label, value]) => `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`)
    .join("");
}

function municipalPopup(properties) {
  return `
    <div class="feature-popup">
      <strong>${escapeHtml(properties.MUNICIPALITY)}</strong>
      <dl>${definitionList([
        ["Municipality", properties.MUNICIPALITY],
        ["Tier", properties.TIER],
        ["Assessment", properties.ASSESSMENT],
        ["Upper-tier name", properties.UT_Name],
        ["Separated", properties.Separated],
        ["CD name", properties.CDNAME],
        ["CD UID", properties.CDUID],
      ])}</dl>
    </div>
  `;
}

function separatedPopup(properties) {
  return `
    <div class="feature-popup">
      <strong>${escapeHtml(properties.MUNICIPALITY)}</strong>
      <dl>${definitionList([
        ["Assessment", properties.ASSESSMENT],
        ["Tier", properties.TIER],
        ["Upper-tier ID", properties.UT_ID],
        ["Upper-tier name", properties.UT_Name],
        ["Geographic county", properties.Geographic_County],
      ])}</dl>
    </div>
  `;
}

function censusDivisionPopup(properties) {
  return `
    <div class="feature-popup">
      <strong>${escapeHtml(properties.CDNAME)}</strong>
      <dl>${definitionList([
        ["CD UID", properties.CDUID],
        ["CD type", properties.CDTYPE],
      ])}</dl>
    </div>
  `;
}

function addInteraction(layer, popup, hoverStyle, defaultStyle) {
  const properties = layer.feature.properties || {};
  const content = popup(properties);
  layer.bindPopup(content, { maxWidth: 380 });
  layer.bindTooltip(content, {
    className: "feature-hover-tooltip",
    sticky: true,
  });
  layer.on({
    mouseover(event) {
      if (activeHoverLayer !== event.target) {
        clearActiveHover();
      }
      event.target.setStyle(hoverStyle);
      activeHoverLayer = event.target;
      activeHoverReset = () => event.target.setStyle(defaultStyle);
    },
    mouseout(event) {
      if (activeHoverLayer === event.target) {
        clearActiveHover();
      } else {
        event.target.closeTooltip();
        event.target.setStyle(defaultStyle);
      }
    },
  });
}



async function loadGeoJson(path) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`${path} request failed with status ${response.status}`);
  }
  return response.json();
}

Promise.all([
  loadGeoJson("./data/ontario-municipal-boundaries.web.geojson"),
  loadGeoJson("./data/separated-municipalities.web.geojson"),
  loadGeoJson("./data/ontario-census-divisions.web.geojson"),
])
  .then(([municipalData, separatedData, censusDivisionData]) => {
    const censusDivisionStyle = {
      color: "#1f5f73",
      dashArray: "7 5",
      fillColor: "#1f5f73",
      fillOpacity: 0.05,
      opacity: 0.95,
      weight: 2.5,
    };
    const censusDivisionLayer = L.geoJSON(censusDivisionData, {
      style: censusDivisionStyle,
      onEachFeature(feature, layer) {
        addInteraction(layer, censusDivisionPopup, {
          fillOpacity: 0.18,
          weight: 4,
        }, censusDivisionStyle);
      },
    }).addTo(map);

    const municipalStyle = {
      color: "#5c4633",
      fillColor: "#b99a78",
      fillOpacity: 0.22,
      opacity: 0.85,
      weight: 1,
    };
    const municipalLayer = L.geoJSON(municipalData, {
      style: municipalStyle,
      onEachFeature(feature, layer) {
        addInteraction(layer, municipalPopup, {
          fillOpacity: 0.45,
          weight: 2.5,
        }, municipalStyle);
      },
    }).addTo(map);

    const separatedStyle = {
      color: "#8f2d22",
      fillColor: "#d36a4a",
      fillOpacity: 0.48,
      opacity: 1,
      weight: 2,
    };
    const separatedLayer = L.geoJSON(separatedData, {
      style: separatedStyle,
      onEachFeature(feature, layer) {
        addInteraction(layer, separatedPopup, {
          fillOpacity: 0.7,
          weight: 3.5,
        }, separatedStyle);
      },
    }).addTo(map);

    L.control.layers(
      null,
      {
        "Ontario municipal boundaries": municipalLayer,
        "Separated municipalities": separatedLayer,
        "Ontario Census Divisions": censusDivisionLayer,
      },
      {
        collapsed: window.matchMedia("(max-width: 35rem)").matches,
      },
    ).addTo(map);

    map.fitBounds(censusDivisionLayer.getBounds(), { padding: [12, 12] });
    statusMessage.hidden = true;
  })
  .catch((error) => {
    console.error(error);
    statusMessage.textContent = "One or more map layers could not be loaded.";
  });
