(function () {
  const mapElement = document.getElementById("travel-map");

  if (!mapElement || typeof window.L === "undefined") {
    return;
  }

  const yearSelect = document.getElementById("travel-year");
  const summary = document.getElementById("map-summary");
  const destinationList = document.getElementById("destination-list");
  const destinationListTitle = document.getElementById("destination-list-title");
  const map = window.L.map(mapElement, {
    scrollWheelZoom: false,
    worldCopyJump: true,
  }).setView([30, -15], 2);
  const routeLayer = window.L.layerGroup().addTo(map);
  const markerLayer = window.L.layerGroup().addTo(map);
  const labelPane = map.createPane("travelLabels");
  labelPane.style.zIndex = "625";
  labelPane.style.pointerEvents = "none";
  let activeLabels = [];
  let markerByPlace = new Map();
  let labelFrame = null;

  window.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  function rectanglesOverlap(first, second, spacing = 2) {
    return !(
      first.right + spacing <= second.left ||
      first.left >= second.right + spacing ||
      first.bottom + spacing <= second.top ||
      first.top >= second.bottom + spacing
    );
  }

  function positionLabels() {
    labelFrame = null;
    const mapSize = map.getSize();
    const topLeft = map.containerPointToLayerPoint([0, 0]);
    const viewport = {
      left: topLeft.x,
      top: topLeft.y,
      right: topLeft.x + mapSize.x,
      bottom: topLeft.y + mapSize.y,
    };
    const markerRects = activeLabels.map((label) => {
      const point = map.latLngToLayerPoint(label.coordinates);
      return {
        placeId: label.placeId,
        left: point.x - 7,
        top: point.y - 7,
        right: point.x + 7,
        bottom: point.y + 7,
      };
    });
    const occupied = [];

    for (const label of activeLabels) {
      label.element.hidden = false;
      label.element.style.visibility = "hidden";
    }

    for (const label of activeLabels) {
      const point = map.latLngToLayerPoint(label.coordinates);
      const width = label.element.offsetWidth;
      const height = label.element.offsetHeight;
      const gap = 9;
      const candidates = [
        [point.x + gap, point.y - height / 2],
        [point.x - width - gap, point.y - height / 2],
        [point.x - width / 2, point.y - height - gap],
        [point.x - width / 2, point.y + gap],
        [point.x + gap, point.y - height - gap],
        [point.x - width - gap, point.y - height - gap],
        [point.x + gap, point.y + gap],
        [point.x - width - gap, point.y + gap],
      ];
      let placement = null;

      for (const [left, top] of candidates) {
        const rectangle = { left, top, right: left + width, bottom: top + height };
        const withinViewport =
          rectangle.left >= viewport.left &&
          rectangle.top >= viewport.top &&
          rectangle.right <= viewport.right &&
          rectangle.bottom <= viewport.bottom;
        const coversMarker = markerRects.some(
          (markerRect) =>
            markerRect.placeId !== label.placeId && rectanglesOverlap(rectangle, markerRect, 1),
        );
        const coversLabel = occupied.some((used) => rectanglesOverlap(rectangle, used));

        if (withinViewport && !coversMarker && !coversLabel) {
          placement = rectangle;
          break;
        }
      }

      if (!placement) {
        label.element.hidden = true;
        continue;
      }

      label.element.style.left = `${placement.left}px`;
      label.element.style.top = `${placement.top}px`;
      label.element.style.visibility = "visible";
      occupied.push(placement);
    }
  }

  function scheduleLabelPlacement() {
    if (labelFrame !== null) {
      window.cancelAnimationFrame(labelFrame);
    }
    labelFrame = window.requestAnimationFrame(positionLabels);
  }

  function clearLabels() {
    for (const label of activeLabels) {
      label.element.remove();
    }
    activeLabels = [];
  }

  function addDestinationLabel(placeId, place, coordinates, visitCount) {
    const element = document.createElement("div");
    element.className = "travel-destination-label";
    element.textContent = place.displayName;
    labelPane.append(element);
    activeLabels.push({ placeId, coordinates, element, visitCount, name: place.displayName });
  }

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

  function compactVisits(visits, selectedYear) {
    const monthsFor = (yearVisits) =>
      [...new Set(yearVisits.map((visit) => visit.month || "Month not recorded"))].join(", ");

    if (selectedYear !== "all") {
      return monthsFor(visits);
    }

    const visitsByYear = new Map();
    for (const visit of visits) {
      const yearVisits = visitsByYear.get(visit.year) || [];
      yearVisits.push(visit);
      visitsByYear.set(visit.year, yearVisits);
    }
    return [...visitsByYear].map(([year, yearVisits]) => `${year}: ${monthsFor(yearVisits)}`).join("; ");
  }

  function renderDestinationList(data, visitsByPlace, selectedYear) {
    destinationList.replaceChildren();
    destinationListTitle.textContent =
      selectedYear === "all" ? "Destinations — all years" : `Destinations in ${selectedYear}`;

    for (const [placeId, visits] of visitsByPlace) {
      const place = data.places[placeId];
      const item = document.createElement("li");
      const button = document.createElement("button");
      const name = document.createElement("span");
      const dates = document.createElement("span");

      button.type = "button";
      name.className = "destination-name";
      name.textContent = `${place.displayName}, ${place.country}`;
      dates.className = "destination-visits";
      dates.textContent = compactVisits(visits, selectedYear);
      button.append(name, dates);
      button.addEventListener("click", () => {
        const marker = markerByPlace.get(placeId);
        if (!marker) return;
        map.setView(marker.getLatLng(), Math.max(map.getZoom(), 6), { animate: false });
        marker.openPopup();
        scheduleLabelPlacement();
      });
      item.append(button);
      destinationList.append(item);
    }
  }

  function render(data, selectedYear) {
    routeLayer.clearLayers();
    markerLayer.clearLayers();
    clearLabels();
    markerByPlace = new Map();

    const trips = data.trips.filter(
      (trip) => selectedYear === "all" || String(trip.year) === selectedYear,
    );
    const visitsByPlace = new Map();
    const bounds = [];
    const renderedRoutes = new Set();

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
        const routeKey = `${trip.originId}->${trip.destinationId}`;
        if (!renderedRoutes.has(routeKey)) {
          const coordinates = [
            [origin.latitude, origin.longitude],
            [destination.latitude, destination.longitude],
          ];
          const route = window.L.polyline(coordinates, {
            color: "#b3261e",
            weight: 1.5,
            opacity: 0.68,
            interactive: false,
          }).addTo(routeLayer);

          if (typeof window.L.polylineDecorator === "function") {
            window.L.polylineDecorator(route, {
              patterns: [
                {
                  offset: "74%",
                  repeat: 0,
                  symbol: window.L.Symbol.arrowHead({
                    pixelSize: 7,
                    polygon: true,
                    pathOptions: {
                      color: "#b3261e",
                      fillColor: "#b3261e",
                      fillOpacity: 0.82,
                      opacity: 0.82,
                      weight: 1,
                      interactive: false,
                    },
                  }),
                },
              ],
            }).addTo(routeLayer);
          }
          renderedRoutes.add(routeKey);
        }
      }
    }

    for (const [placeId, visits] of visitsByPlace) {
      const place = data.places[placeId];
      const coordinates = [place.latitude, place.longitude];
      bounds.push(coordinates);
      const marker = window.L.circleMarker(coordinates, {
        radius: 5,
        color: "#4e3c2d",
        weight: 1.5,
        fillColor: "#f4efe7",
        fillOpacity: 0.95,
      })
        .bindPopup(popupFor(place, visits))
        .addTo(markerLayer);
      markerByPlace.set(placeId, marker);
      addDestinationLabel(placeId, place, coordinates, visits.length);
    }

    activeLabels.sort(
      (first, second) => second.visitCount - first.visitCount || first.name.localeCompare(second.name),
    );
    renderDestinationList(data, visitsByPlace, selectedYear);

    const routeCount = trips.filter((trip) => trip.originId).length;
    summary.textContent = `${visitsByPlace.size} destination${visitsByPlace.size === 1 ? "" : "s"} · ${routeCount} route${routeCount === 1 ? "" : "s"}`;

    if (bounds.length) {
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 7, animate: false });
    }
    scheduleLabelPlacement();
  }

  map.on("moveend zoomend resize", scheduleLabelPlacement);

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
