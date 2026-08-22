import { writeFile } from "node:fs/promises";
import readXlsxFile from "read-excel-file/node";

const workbookPath = "Books/TravelBooksExport.xlsx";
const outputPath = "Travels/books-data.json";
const requiredColumns = ["trip", "title", "author"];
const collator = new Intl.Collator("en", { sensitivity: "base" });

function clean(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeColumnName(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function publicationYear(value) {
  const match = clean(value).match(/\b(1[0-9]{3}|20[0-9]{2}|2100)\b/);
  return match ? Number(match[1]) : null;
}

function isbnValues(value) {
  return clean(value)
    .replace(/^\[|\]$/g, "")
    .split(",")
    .map(clean)
    .filter(Boolean);
}

async function main() {
  const worksheets = await readXlsxFile(workbookPath);
  const worksheet = worksheets.find((sheet) => sheet.sheet === "Simple") || worksheets[0];

  if (!worksheet?.data.length) {
    throw new Error(`${workbookPath} does not contain a worksheet with data.`);
  }

  const [headerRow, ...rows] = worksheet.data;
  const headers = headerRow.map(normalizeColumnName);
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column));

  if (missingColumns.length) {
    throw new Error(`Missing required workbook columns: ${missingColumns.join(", ")}.`);
  }

  const books = rows
    .filter((row) => row.some((value) => clean(value)))
    .map((row, index) => {
      const record = Object.fromEntries(headers.map((header, column) => [header, row[column]]));
      const title = clean(record.title);

      if (!title) {
        throw new Error(`Workbook row ${index + 2} must have a title.`);
      }

      const isbns = isbnValues(record.isbns);

      return {
        trip: clean(record.trip) || "Other",
        title,
        author: clean(record.author),
        year: publicationYear(record.date),
        isbn: isbnValues(record.isbn)[0] || null,
        isbns,
      };
    });

  const groups = [...Map.groupBy(books, (book) => book.trip)]
    .sort(([first], [second]) => collator.compare(first, second))
    .map(([trip, tripBooks]) => ({
      trip,
      books: tripBooks
        .sort((first, second) => collator.compare(first.title, second.title))
        .map(({ trip: _trip, ...book }) => book),
    }));

  const output = {
    bookCount: books.length,
    tripCount: groups.length,
    groups,
  };

  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`Prepared ${books.length} books across ${groups.length} trips.`);
}

main().catch((error) => {
  console.error(`Book synchronization failed: ${error.message}`);
  process.exitCode = 1;
});
