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

  {
    markdownPath: "Text/Utila.md",
    photoFolder: "Photos/Utila/SmallPhotos",
  },

  {
    markdownPath: "Text/SantaFe.md",
    photoFolder: "Photos/SantaFe/SmallPhotos",
  },

  {
    markdownPath: "Text/Savannah.md",
    photoFolder: "Photos/Savannah/SmallPhotos",
  },

  {
    markdownPath: "Text/Copan.md",
    photoFolder: "Photos/Copan/SmallPhotos",
  },

  {
    markdownPath: "Text/Calakmul.md",
    photoFolder: "Photos/Calakmul/SmallPhotos",
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

function photoEntries(photosBlock, markdownPath) {
  const entryStarts = [...photosBlock.matchAll(/^  -\s+/gm)].map((match) => match.index);

  if (entryStarts.length === 0) {
    if (photosBlock.trim()) {
      throw new Error(`${markdownPath} has a photos: section with no readable entries.`);
    }

    return { prefix: photosBlock, entries: [] };
  }

  return {
    prefix: photosBlock.slice(0, entryStarts[0]),
    entries: entryStarts.map((start, index) => ({
      content: photosBlock.slice(start, entryStarts[index + 1] ?? photosBlock.length),
    })),
  };
}

function imagePaths(photoEntry, markdownPath) {
  const paths = [];
  const pathFields = /^\s+(?:thumbnail|full):\s+(.+?)\s*$/gm;

  for (const match of photoEntry.matchAll(pathFields)) {
    const value = match[1].replace(/^['"]|['"]$/g, "");
    if (!value) {
      throw new Error(`${markdownPath} contains an empty photograph path.`);
    }
    paths.push(normalizeImagePath(value));
  }

  if (paths.length === 0) {
    throw new Error(`${markdownPath} contains a photograph entry with no readable image paths.`);
  }

  return paths;
}

function folderPhotos(photoFolder) {
  const normalizedFolder = photoFolder.replaceAll("\\", "/").replace(/\/$/, "");

  return readdirSync(normalizedFolder, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() && supportedImageExtensions.has(path.extname(entry.name).toLowerCase()),
    )
    .map((entry) => entry.name)
    .sort((first, second) => first.localeCompare(second));
}

function synchronizePhotos(photosBlock, markdownPath, photoFolder) {
  const parsed = photoEntries(photosBlock, markdownPath);
  const filenames = folderPhotos(photoFolder);
  const normalizedFiles = new Set(filenames.map((filename) => filename.toLowerCase()));
  const normalizedFolder = normalizeImagePath(photoFolder).replace(/\/$/, "");
  const folderPrefix = `${normalizedFolder}/`;
  const knownPaths = new Set();
  const removals = [];

  const retained = parsed.entries.filter((entry) => {
    const paths = imagePaths(entry.content, markdownPath);
    paths.forEach((imagePath) => knownPaths.add(imagePath));

    // Only entries whose image fields all point into this trip's configured folder
    // are candidates for removal. Ambiguous or unrelated entries are preserved.
    if (!paths.every((imagePath) => imagePath.startsWith(folderPrefix))) {
      return true;
    }

    const referencedFiles = [
      ...new Set(paths.map((imagePath) => imagePath.slice(folderPrefix.length))),
    ];
    if (
      referencedFiles.length !== 1 ||
      referencedFiles[0].includes("/") ||
      normalizedFiles.has(referencedFiles[0])
    ) {
      return true;
    }

    removals.push(referencedFiles[0]);
    return false;
  });

  const additions = filenames.filter(
    (filename) => !knownPaths.has(normalizeImagePath(`/${normalizedFolder}/${filename}`)),
  );

  const retainedContent = parsed.prefix + retained.map((entry) => entry.content).join("");

  return { additions, removals, retainedContent };
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
    const { additions, removals, retainedContent } = synchronizePhotos(
      photosBlock.content,
      markdownPath,
      photoFolder,
    );

    if (additions.length === 0 && removals.length === 0) {
      return { additions, removals };
    }

    const appendedEntries = additions
      .map((filename) => photoEntry(photoFolder, filename))
      .join("\n");
    const separator = appendedEntries && !retainedContent.endsWith("\n") ? "\n" : "";
    const updatedYaml =
      frontMatter.yaml.slice(0, photosBlock.start) +
      retainedContent +
      separator +
      appendedEntries +
      frontMatter.yaml.slice(photosBlock.end);
    const updated = `${frontMatter.opening}${updatedYaml}${frontMatter.closing}${frontMatter.body}`;

    writeFileSync(markdownPath, updated);
    return { additions, removals };
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
  const results = trips.map(syncTrip);
  const added = results.flatMap((result) => result.additions);
  const removed = results.flatMap((result) => result.removals);

  if (added.length === 0 && removed.length === 0) {
    console.log("No photograph changes found");
  } else {
    console.log(`Added ${added.length} photograph${added.length === 1 ? "" : "s"}`);
    for (const filename of added) {
      console.log(`- ${filename}`);
    }

    console.log(`Removed ${removed.length} photograph${removed.length === 1 ? "" : "s"}`);
    for (const filename of removed) {
      console.log(`- ${filename}`);
    }
  }
} catch (error) {
  console.error(`Photo synchronization failed: ${error.message}`);
  process.exitCode = 1;
}
