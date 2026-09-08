const map = L.map("municipal-map", {
  zoomControl: true,
  preferCanvas: true,
});

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
  maxZoom: 19,
}).addTo(map);

const statusMessage = document.querySelector("#map-status");

function escapeHtml(value) {
  return String(value ?? "Not available")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function popupContent(properties) {
  return `
    <div class="municipal-popup">
      <strong>${escapeHtml(properties.MUNICIPAL_NAME_SHORTFORM || properties.MUNICIPAL_NAME)}</strong>
      <dl>
        <dt>Full municipal name</dt><dd>${escapeHtml(properties.MUNICIPAL_NAME)}</dd>
        <dt>Municipal type</dt><dd>${escapeHtml(properties.MUNICIPAL_TYPE)}</dd>
        <dt>Municipal ID</dt><dd>${escapeHtml(properties.MUNID)}</dd>
        <dt>Assessment code</dt><dd>${escapeHtml(properties.ASSESSMENT_CODE)}</dd>
        <dt>CSD name</dt><dd>${escapeHtml(properties.CSDNAME)}</dd>
        <dt>CSD UID</dt><dd>${escapeHtml(properties.CSDUID)}</dd>
      </dl>
    </div>
  `;
}

function defaultStyle() {
  return {
    color: "#5c4633",
    weight: 1,
    opacity: 0.9,
    fillColor: "#b99a78",
    fillOpacity: 0.32,
  };
}

fetch("./data/municipal-boundaries-csd.web.geojson")
  .then((response) => {
    if (!response.ok) {
      throw new Error(`GeoJSON request failed with status ${response.status}`);
    }
    return response.json();
  })
  .then((data) => {
    const municipalLayer = L.geoJSON(data, {
      style: defaultStyle,
      onEachFeature(feature, layer) {
        const properties = feature.properties || {};
        layer.bindPopup(popupContent(properties), { maxWidth: 360 });
        layer.bindTooltip(
          escapeHtml(properties.MUNICIPAL_NAME_SHORTFORM || properties.MUNICIPAL_NAME),
          { sticky: true },
        );
        layer.on({
          mouseover(event) {
            event.target.setStyle({ weight: 2.5, fillOpacity: 0.55 });
            event.target.bringToFront();
          },
          mouseout(event) {
            municipalLayer.resetStyle(event.target);
          },
        });
      },
    }).addTo(map);

    map.fitBounds(municipalLayer.getBounds(), { padding: [12, 12] });
    statusMessage.hidden = true;
  })
  .catch((error) => {
    console.error(error);
    statusMessage.textContent = "The municipal boundary data could not be loaded.";
  });
