(function () {
  const mapElement = document.getElementById("travel-map");

  if (!mapElement || typeof window.L === "undefined") {
    return;
  }

  const yearSelect = document.getElementById("travel-year");
  const summary = document.getElementById("map-summary");
  const map = window.L.map(mapElement, {
    scrollWheelZoom: false,
    worldCopyJump: true,
  }).setView([30, -15], 2);
  const routeLayer = window.L.layerGroup().addTo(map);
  const markerLayer = window.L.layerGroup().addTo(map);

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  function popupFor(place, visits) {
    const popup = document.createElement("div");
    popup.className = "travel-marker-popup";

    const name = document.createElement("strong");
    name.textContent = place.displayName;
    popup.append(name);

    const country = document.createElement("p");
    country.textContent = place.country;
    popup.append(country);

    const list = document.createElement("ul");
    for (const visit of visits) {
      const item = document.createElement("li");
      item.textContent = `${visit.month || "Month not recorded"} ${visit.year}`;
      list.append(item);
    }
    popup.append(list);
    return popup;
  }

  function render(data, selectedYear) {
    routeLayer.clearLayers();
    markerLayer.clearLayers();

    const trips = data.trips.filter(
      (trip) => selectedYear === "all" || String(trip.year) === selectedYear,
    );
    const visitsByPlace = new Map();
    const bounds = [];

    for (const trip of trips) {
      const destination = data.places[trip.destinationId];
      const origin = trip.originId ? data.places[trip.originId] : null;

      if (!destination) {
        continue;
      }

      const visits = visitsByPlace.get(trip.destinationId) || [];
      visits.push(trip);
      visitsByPlace.set(trip.destinationId, visits);

      if (origin) {
        window.L.polyline(
          [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ],
          { color: "#785f47", weight: 1.5, opacity: 0.58, interactive: false },
        ).addTo(routeLayer);
      }
    }

    for (const [placeId, visits] of visitsByPlace) {
      const place = data.places[placeId];
      const coordinates = [place.latitude, place.longitude];
      bounds.push(coordinates);
      window.L.circleMarker(coordinates, {
        radius: 5,
        color: "#4e3c2d",
        weight: 1.5,
        fillColor: "#f4efe7",
        fillOpacity: 0.95,
      })
        .bindPopup(popupFor(place, visits))
        .addTo(markerLayer);
    }

    const routeCount = trips.filter((trip) => trip.originId).length;
    summary.textContent = `${visitsByPlace.size} destination${visitsByPlace.size === 1 ? "" : "s"} · ${routeCount} route${routeCount === 1 ? "" : "s"}`;

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7, animate: false });
    }
  }

  fetch(mapElement.dataset.source)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Travel data request failed (${response.status})`);
      }
      return response.json();
    })
    .then((data) => {
      for (const year of data.years) {
        const option = document.createElement("option");
        option.value = String(year);
        option.textContent = String(year);
        yearSelect.append(option);
      }

      yearSelect.addEventListener("change", () => render(data, yearSelect.value));
      render(data, "all");
    })
    .catch((error) => {
      summary.textContent = "Travel data could not be loaded.";
      mapElement.textContent = error.message;
    });
})();
