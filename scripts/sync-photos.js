import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

const trips = [
  {
    markdownPath: "Text/Naples.md",
    photoFolder: "Photos/Naples/SmallPhotos",
  },
  {
    markdownPath: "Text/Amsterdam.md",
    photoFolder: "Photos/Amsterdam/SmallPhotos",
  },

  {
    markdownPath: "Text/Guanajuato.md",
    photoFolder: "Photos/Guanajuato/SmallPhotos",
  },




];

function normalizeImagePath(imagePath) {
  return String(imagePath ?? "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .toLowerCase();
}

function readableImageName(filename) {
  return path
    .parse(filename)
    .name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getFrontMatter(source, markdownPath) {
  const match = source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)(\r?\n|$)/);

  if (!match) {
    throw new Error(`${markdownPath} does not contain valid YAML front matter.`);
  }

  return {
    opening: match[1],
    yaml: match[2],
    closing: `${match[3]}${match[4]}`,
    body: source.slice(match[0].length),
  };
}

function getPhotosBlock(yaml, markdownPath) {
  const photosMatch = /^photos:\s*\r?$/m.exec(yaml);

  if (!photosMatch) {
    throw new Error(`${markdownPath} does not contain a photos: front-matter section.`);
  }

  const contentStart = photosMatch.index + photosMatch[0].length;
  const nextTopLevelField = /\r?\n(?=[A-Za-z][\w-]*:\s*)/g;
  nextTopLevelField.lastIndex = contentStart;
  const nextFieldMatch = nextTopLevelField.exec(yaml);
  const contentEnd = nextFieldMatch ? nextFieldMatch.index : yaml.length;

  return {
    start: contentStart,
    end: contentEnd,
    content: yaml.slice(contentStart, contentEnd),
  };
}

function existingPhotoPaths(photosBlock, markdownPath) {
  const paths = new Set();
  const pathFields = /^\s+(?:thumbnail|full):\s+(.+?)\s*$/gm;

  for (const match of photosBlock.matchAll(pathFields)) {
    const value = match[1].replace(/^['"]|['"]$/g, "");
    if (!value) {
      throw new Error(`${markdownPath} contains an empty photograph path.`);
    }
    paths.add(normalizeImagePath(value));
  }

  if (paths.size === 0 && photosBlock.trim()) {
    throw new Error(`${markdownPath} has a photos: section with no readable image paths.`);
  }

  return paths;
}

function missingPhotos(photoFolder, knownPaths) {
  const normalizedFolder = photoFolder.replaceAll("\\", "/").replace(/\/$/, "");

  return readdirSync(normalizedFolder, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && supportedImageExtensions.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second))
    .filter(
      (filename) =>
        !knownPaths.has(normalizeImagePath(`/${normalizedFolder}/${filename}`)),
    );
}

function photoEntry(photoFolder, filename) {
  const imagePath = `/${photoFolder.replaceAll("\\", "/").replace(/\/$/, "")}/${filename}`;
  const readableName = readableImageName(filename);

  return [
    `  - thumbnail: ${imagePath}`,
    `    full: ${imagePath}`,
    `    alt: ${readableName}`,
    `    caption: ${readableName}`,
  ].join("\n");
}

function syncTrip({ markdownPath, photoFolder }) {
  const original = readFileSync(markdownPath, "utf8");

  try {
    const frontMatter = getFrontMatter(original, markdownPath);
    const photosBlock = getPhotosBlock(frontMatter.yaml, markdownPath);
    const additions = missingPhotos(
      photoFolder,
      existingPhotoPaths(photosBlock.content, markdownPath),
    );

    if (additions.length === 0) {
      return [];
    }

    const appendedEntries = additions.map((filename) => photoEntry(photoFolder, filename)).join("\n");
    const separator = photosBlock.content.endsWith("\n") ? "" : "\n";
    const updatedYaml =
      frontMatter.yaml.slice(0, photosBlock.end) +
      separator +
      appendedEntries +
      frontMatter.yaml.slice(photosBlock.end);
    const updated = `${frontMatter.opening}${updatedYaml}${frontMatter.closing}${frontMatter.body}`;

    writeFileSync(markdownPath, updated);
    return additions;
  } catch (error) {
    try {
      writeFileSync(markdownPath, original);
    } catch {
      // Preserve the original error, which describes the failed synchronization.
    }
    throw error;
  }
}

try {
  const added = trips.flatMap(syncTrip);

  if (added.length === 0) {
    console.log("No new photographs found");
  } else {
    console.log(`Added ${added.length} new photograph${added.length === 1 ? "" : "s"}`);
    for (const filename of added) {
      console.log(`- ${filename}`);
    }
  }
} catch (error) {
  console.error(`Photo synchronization failed: ${error.message}`);
  process.exitCode = 1;
}
