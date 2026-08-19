import { readFile, writeFile } from "node:fs/promises";
import readXlsxFile from "read-excel-file/node";

const workbookPath = "Travels/Travels.xlsx";
const placesPath = "Travels/places.json";
const outputPath = "Travels/travel-data.json";
const shouldGeocode = process.argv.includes("--geocode");
const requiredColumns = ["year", "month", "destination", "Country", "origin"];
const monthOrder = new Map(
  [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ].map((month, index) => [month.toLowerCase(), index + 1]),
);

const aliases = new Map([
  ["CDMX", "Mexico City"],
  ["Cannnon Beach", "Cannon Beach"],
  ["Hague", "The Hague"],
  ["Maarrssen", "Maarssen"],
  ["Quetzaltanango", "Quetzaltenango"],
]);

const knownCountries = new Map([
  ["Toronto", "Canada"],
  ["Vancouver", "Canada"],
]);

const geocodingQueries = new Map([
  ["Campeche", "San Francisco de Campeche, Campeche, Mexico"],
  ["Copan", "Copán Ruinas, Copán, Honduras"],
  ["Guanajuato", "Guanajuato City, Guanajuato, Mexico"],
  ["Oaxaca", "Oaxaca de Juárez, Oaxaca, Mexico"],
  ["Pisa", { city: "Pisa", country: "Italy" }],
  ["Puebla", { city: "Puebla", country: "Mexico" }],
  ["Puno", { city: "Puno", country: "Peru" }],
]);

const countryNames = new Map([
  ["USA", "United States"],
  ["England", "England, UK"],
  ["Scotland", "Scotland, UK"],
]);

function clean(value) {
  return String(value ?? "").trim();
}

function canonicalPlace(place) {
  return aliases.get(clean(place)) || clean(place);
}

function placeId(place) {
  return place
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizedCountry(country) {
  const cleaned = clean(country);
  return countryNames.get(cleaned) || cleaned;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function loadExistingPlaces() {
  try {
    const parsed = JSON.parse(await readFile(placesPath, "utf8"));
    return new Map(parsed.map((place) => [place.place, place]));
  } catch (error) {
    if (error.code === "ENOENT") {
      return new Map();
    }
    throw error;
  }
}

async function geocode(place, country) {
  const queryOverride = geocodingQueries.get(place);
  const query = new URLSearchParams({
    ...(typeof queryOverride === "object"
      ? queryOverride
      : { q: queryOverride || `${place}, ${country}` }),
    format: "jsonv2",
    limit: "1",
  });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
    headers: {
      "User-Agent": "travel-notes-static-map/1.0 (personal site build)",
      "Accept-Language": "en",
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding ${place} failed with HTTP ${response.status}.`);
  }

  const [result] = await response.json();
  if (!result) {
    throw new Error(`No geocoding result found for ${place}, ${country}.`);
  }

  return {
    latitude: Number(result.lat),
    longitude: Number(result.lon),
  };
}

async function readTrips() {
  const sheets = await readXlsxFile(workbookPath);
  const worksheet = sheets.find((sheet) => sheet.sheet === "Sheet1");

  if (!worksheet) {
    throw new Error(`${workbookPath} does not contain a Sheet1 worksheet.`);
  }

  const rows = worksheet.data;
  const headers = rows.shift().map(clean);

  if (
    headers.length !== requiredColumns.length ||
    !requiredColumns.every((column, index) => headers[index] === column)
  ) {
    throw new Error(`Expected workbook columns: ${requiredColumns.join(", ")}.`);
  }

  return rows
    .filter((row) => row.some((value) => clean(value)))
    .map((row, index) => {
      const record = Object.fromEntries(headers.map((header, column) => [header, row[column]]));
      const year = Number(record.year);
      const month = clean(record.month);
      const destination = clean(record.destination);

      if (!Number.isInteger(year) || !destination) {
        throw new Error(`Workbook row ${index + 2} must have a valid year and destination.`);
      }
      if (month && !monthOrder.has(month.toLowerCase())) {
        throw new Error(`Workbook row ${index + 2} has an unrecognized month: ${month}.`);
      }

      return {
        sourceRow: index + 2,
        year,
        month,
        monthNumber: month ? monthOrder.get(month.toLowerCase()) : null,
        destination,
        destinationPlace: canonicalPlace(destination),
        country: normalizedCountry(record.Country),
        origin: clean(record.origin),
        originPlace: canonicalPlace(record.origin),
      };
    })
    .sort(
      (first, second) =>
        first.year - second.year ||
        (first.monthNumber ?? 0) - (second.monthNumber ?? 0) ||
        first.sourceRow - second.sourceRow,
    );
}

async function main() {
  const trips = await readTrips();
  const countriesByPlace = new Map();

  function addCountry(place, country) {
    if (!place || !country) return;
    const countries = countriesByPlace.get(place) || new Set();
    countries.add(country);
    countriesByPlace.set(place, countries);
  }

  for (const [place, country] of knownCountries) addCountry(place, country);
  for (const trip of trips) addCountry(trip.destinationPlace, trip.country);

  for (const trip of trips) {
    const destinationCountries = countriesByPlace.get(trip.destinationPlace);
    if (!trip.country && destinationCountries?.size === 1) {
      trip.country = [...destinationCountries][0];
    }
  }

  const allPlaces = [...new Set(trips.flatMap((trip) => [trip.originPlace, trip.destinationPlace]))]
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second));
  const rawNamesByPlace = new Map();

  function addRawName(place, rawName) {
    if (!place || !rawName) return;
    const rawNames = rawNamesByPlace.get(place) || new Set();
    rawNames.add(rawName);
    rawNamesByPlace.set(place, rawNames);
  }

  for (const trip of trips) {
    addRawName(trip.destinationPlace, trip.destination);
    addRawName(trip.originPlace, trip.origin);
  }
  const ambiguous = [];
  const unresolved = [];

  for (const place of allPlaces) {
    const countries = countriesByPlace.get(place);
    if (!countries?.size) unresolved.push(place);
    else if (countries.size > 1) ambiguous.push(`${place} (${[...countries].join(" / ")})`);
  }

  if (ambiguous.length || unresolved.length) {
    const details = [
      ambiguous.length ? `ambiguous: ${ambiguous.join(", ")}` : "",
      unresolved.length ? `country unknown: ${unresolved.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("; ");
    throw new Error(`Place lookup needs review (${details}). Add an explicit entry to knownCountries.`);
  }

  const existingPlaces = await loadExistingPlaces();
  const places = [];
  let addedCount = 0;

  for (const place of allPlaces) {
    const country = [...countriesByPlace.get(place)][0];
    const existing = existingPlaces.get(place);
    const placeAliases = [...(rawNamesByPlace.get(place) || [])]
      .filter((rawName) => rawName !== place)
      .sort((first, second) => first.localeCompare(second));

    if (existing) {
      if (existing.country !== country) {
        throw new Error(
          `${place} is ${country} in the workbook but ${existing.country} in ${placesPath}.`,
        );
      }
      if (
        !Number.isFinite(existing.latitude) ||
        !Number.isFinite(existing.longitude) ||
        Math.abs(existing.latitude) > 90 ||
        Math.abs(existing.longitude) > 180
      ) {
        throw new Error(`${place} has invalid coordinates in ${placesPath}.`);
      }
      places.push({
        place,
        country,
        latitude: existing.latitude,
        longitude: existing.longitude,
        ...(placeAliases.length ? { aliases: placeAliases } : {}),
      });
      continue;
    }

    if (!shouldGeocode) {
      throw new Error(
        `${place}, ${country} is missing from ${placesPath}. Run npm run sync-travels to geocode new places.`,
      );
    }

    console.log(`Geocoding ${place}, ${country}`);
    const coordinates = await geocode(place, country);
    places.push({
      place,
      country,
      ...coordinates,
      ...(placeAliases.length ? { aliases: placeAliases } : {}),
    });
    addedCount += 1;
    await sleep(1100);
  }

  const placeData = Object.fromEntries(
    places.map((place) => [
      placeId(place.place),
      {
        displayName: place.place,
        country: place.country,
        latitude: place.latitude,
        longitude: place.longitude,
      },
    ]),
  );
  const output = {
    years: [...new Set(trips.map((trip) => trip.year))],
    places: placeData,
    trips: trips.map((trip) => ({
      year: trip.year,
      month: trip.month,
      destination: trip.destination,
      country: trip.country,
      destinationId: placeId(trip.destinationPlace),
      originId: trip.originPlace ? placeId(trip.originPlace) : null,
    })),
  };

  await writeFile(placesPath, `${JSON.stringify(places, null, 2)}\n`);
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `Prepared ${trips.length} trips and ${places.length} places${addedCount ? ` (${addedCount} newly geocoded)` : ""}.`,
  );
}

main().catch((error) => {
  console.error(`Travel synchronization failed: ${error.message}`);
  process.exitCode = 1;
});
