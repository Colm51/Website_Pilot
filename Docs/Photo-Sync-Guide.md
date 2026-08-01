# Photo synchronization script guide

This guide explains the current `scripts/sync-photos.js` file. The script is a small Node.js utility for keeping the Naples and Amsterdam photograph lists in sync with the files in their photo folders. It is separate from Eleventy's build process: synchronization changes the Markdown sources, while Eleventy later reads those sources to build the site.

## 1. What the script is for

Each configured gallery needs two things to agree with each other:

- image files must exist in the trip's configured photo folder;
- matching YAML entries must exist under `photos:` in the trip's configured Markdown file.

Adding an image file alone does not add it to the gallery. Manually writing the same four YAML lines for every new file is repetitive and can lead to path mistakes. The synchronization script discovers image files that are not yet represented in the YAML and creates starter entries for them.

The complete workflow is:

1. Copy web-sized photographs into `Photos/Naples/SmallPhotos/` or `Photos/Amsterdam/SmallPhotos/`.
2. Run `npm run sync-photos` from the repository root.
3. The script reads the directory and discovers supported image files.
4. It compares those files with the `thumbnail` and `full` paths in the matching trip Markdown file, then adds YAML entries for missing files.
5. Review the new entries and replace the generated `alt` and `caption` values with useful human-written text.
6. Run Eleventy. The trip layout loops over the `photos` data and builds the gallery.

The script does not need to be run every time the site is built. Run it when files have been added to the configured photo folder.

## 2. How the command is connected

An npm script is a named command stored in the `scripts` object in `package.json`. npm lets a project give a short, consistent name to a longer shell command.

The relevant line in this repository is:

```json
"sync-photos": "node scripts/sync-photos.js"
```

The name on the left is `sync-photos`. The command on the right tells the installed Node.js runtime to execute `scripts/sync-photos.js`.

When `npm run sync-photos` is entered:

1. npm reads `package.json` in the current directory.
2. It finds `sync-photos` inside the `scripts` object.
3. It runs `node scripts/sync-photos.js` with the repository root as the working directory.

That working directory matters because the script uses relative paths such as `Text/Naples.md` and `Text/Amsterdam.md`. The project also declares `"type": "module"` in `package.json`, so Node treats `.js` files as ES modules and accepts the script's `import` syntax.

There are currently no README files in the repository and therefore no existing README instructions for this command.

## 3. Imports

The first import is:

```js
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
```

An ES module import makes code exported by another module available in this file. The braces indicate **named imports**: the script requests three exports by their exact names.

The `node:` prefix identifies a module supplied by Node.js itself. `node:fs` is Node's built-in file-system module, so this import does not require an npm dependency.

- `readFileSync(path, encoding)` reads an entire file and waits until reading is complete. The script uses it to load each configured trip Markdown file as UTF-8 text.
- `readdirSync(path, options)` reads a directory and waits for the result. With `{ withFileTypes: true }`, it returns directory-entry objects that can say whether each entry is a file.
- `writeFileSync(path, data)` writes the supplied data and waits until the operation finishes. Here it replaces the Markdown file with the updated text.

The `Sync` suffix means each operation is synchronous. While it runs, no later JavaScript statement executes until the file operation finishes. That would be a concern in a busy web server, where one slow disk operation could delay many users. It is reasonable for this small, manually invoked local tool because it processes one configured trip, is easy to follow in order, and exits when finished.

The second import is:

```js
import path from "node:path";
```

This is a **default import**. The local variable `path` receives the default export from Node's built-in path utility module. The script uses:

- `path.parse(filename).name` to get a filename without its extension;
- `path.extname(filename)` to get its extension, including the leading period.

Using `path` avoids manually guessing where an extension begins and follows Node's filename-handling rules.

## 4. Supported image extensions

The script declares:

```js
const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);
```

`const` declares a variable whose binding will not be reassigned. The `Set` object itself could technically be mutated, but this script never changes it.

A `Set` stores unique values and provides a direct `.has(value)` membership check. That expresses the question clearly: “Is this extension supported?” It also prevents accidental duplicate extension entries from having any effect.

For every directory entry, the script runs:

```js
path.extname(entry.name).toLowerCase()
```

`path.extname` extracts an extension such as `.JPG`, and `toLowerCase()` turns it into `.jpg`. As a result, `Photo.JPG` and `Photo.jpg` are both accepted. A file whose normalized extension is not in the Set—for example, `notes.txt`, `animation.gif`, or a file with no extension—is removed by the filter and never becomes a YAML entry.

This test checks the filename extension, not the file's actual binary format. A non-image file incorrectly named `photo.jpg` would pass.

## 5. Trip configuration

The `trips` array contains configuration objects:

```js
const trips = [
  {
    markdownPath: "Text/Naples.md",
    photoFolder: "Photos/Naples/SmallPhotos",
  },
  {
    markdownPath: "Text/Amsterdam.md",
    photoFolder: "Photos/Amsterdam/SmallPhotos",
  },
];
```

An array is an ordered collection. Here it currently has one object for Naples and one for Amsterdam. Each object groups related named values:

- `markdownPath` is the Markdown file whose YAML will be inspected and updated.
- `photoFolder` is the directory whose image files will be discovered.

Keeping these values in configuration separates “which trip should be processed?” from “how is a trip processed?” The `syncTrip` function can therefore receive an object instead of containing Naples paths throughout its logic.

In theory, another object with another Markdown path and photo folder could be added to the array later. `trips.flatMap(syncTrip)` would call `syncTrip` for each object. The combined success message reports the total additions without claiming that every file went to a single Markdown destination.

## 6. Function-by-function explanation

### `normalizeImagePath`

**Purpose:** Convert paths from the directory scan and YAML into a consistent comparison form.

**Parameter:** `imagePath`, intended to be a string but defensively accepted as any value.

**Return value:** A lowercase, forward-slash path with all leading slashes removed.

```js
function normalizeImagePath(imagePath) {
  return String(imagePath ?? "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .toLowerCase();
}
```

Important syntax includes nullish coalescing (`??`), conversion with `String`, and method chaining. `imagePath ?? ""` chooses an empty string only when the input is `null` or `undefined`. Backslashes become forward slashes, the regular expression removes leading slashes, and case is normalized.

Example:

```text
Input:  \Photos\Naples\SmallPhotos\Cathedral.JPEG
Output: photos/naples/smallphotos/cathedral.jpeg
```

What could go wrong: this is a comparison normalizer, not a complete path validator. It does not resolve `.` or `..`, check whether a path exists, or distinguish files whose names differ only by case. Lowercasing is useful for forgiving comparisons, but on a case-sensitive file system it can treat two distinct paths as equivalent.

The function is needed because YAML paths begin with `/`, generated comparison paths also use `/`, and operating systems may represent separators or case differently.

### `readableImageName`

**Purpose:** Turn a filename into starter human-readable text for `alt` and `caption`.

**Parameter:** `filename`, such as `NaplesCaravaggio.jpg`.

**Return value:** The filename without its extension, with some word boundaries converted to spaces.

```js
function readableImageName(filename) {
  return path
    .parse(filename)
    .name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
```

The code chains property access and string methods. Capturing groups in the first regular expression preserve both adjoining characters while inserting a space. Later replacements turn underscores and hyphens into spaces, collapse repeated whitespace, and trim the ends.

Example:

```text
Input:  NaplesCaravaggio.jpg
Output: Naples Caravaggio
```

What could go wrong: filename conventions are not natural-language understanding. `IMG_0042.jpg` becomes `IMG 0042`, acronyms may not split as expected, spelling cannot be corrected, and the result does not describe what is visually important.

This function is needed to provide editable placeholders instead of empty fields.

### `getFrontMatter`

**Purpose:** Separate the opening YAML front matter from the Markdown body.

**Parameters:** `source`, the full Markdown text; and `markdownPath`, used in an error message.

**Return value:** An object with `opening`, `yaml`, `closing`, and `body` strings.

```js
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
```

The regular expression creates capturing groups. Array indexes such as `match[1]` retrieve those groups. A template literal builds the error. `slice` takes everything after the complete match as the body.

Example: for a file beginning with `---\ntitle: Naples\n---\nBody`, the returned `yaml` is `title: Naples`, and `body` is `Body`.

What could go wrong: the front matter must begin at the first character, use the expected `---` delimiter lines, and follow the formatting assumptions described later. A byte-order mark or text before the first delimiter prevents a match.

This function is needed so the script changes YAML without reconstructing or disturbing the essay body.

### `getPhotosBlock`

**Purpose:** Locate the value area belonging to the top-level `photos:` field inside the YAML text.

**Parameters:** `yaml`, the front-matter content; and `markdownPath`, for errors.

**Return value:** An object containing numeric `start` and `end` offsets plus the extracted `content` string.

The function first finds a line containing `photos:`. It sets `contentStart` immediately after that line. It then searches from that position for a newline followed by the next top-level YAML key. If there is no later key, `contentEnd` is the end of the YAML.

Important syntax includes `RegExp.exec`, `.index`, the ternary operator, a lookahead, mutation of a regular expression's `lastIndex`, and `slice`.

Example:

```yaml
photos:
  - thumbnail: /Photos/example.jpg
    full: /Photos/example.jpg
footer: true
```

The content begins after `photos:` and ends before the newline that introduces `footer:`.

What could go wrong: an indented or quoted `photos` key is not recognized. A top-level-looking line inside an unusual YAML multiline value could be mistaken for the next field. The function does not understand YAML syntax; it recognizes a formatting pattern.

It is needed to place new list items inside `photos` rather than at an arbitrary point in the front matter.

### `existingPhotoPaths`

**Purpose:** Collect the existing `thumbnail` and `full` values in a photo block.

**Parameters:** `photosBlock`, the text returned as `getPhotosBlock(...).content`; and `markdownPath`, for errors.

**Return value:** A `Set` of normalized paths.

The function uses `matchAll` to iterate over every matching path line. `for...of` visits each match. It removes one leading or trailing quote, rejects an empty result, normalizes the path, and adds it to the Set. A Set collapses repeated `thumbnail` and `full` paths into one value.

Example: `/Photos/Naples/SmallPhotos/Cathedral.jpeg` becomes `photos/naples/smallphotos/cathedral.jpeg`. If both `thumbnail` and `full` contain that path, the Set still has one member for it.

What could go wrong: inline YAML objects, deeply different indentation, comments after quoted values, block scalars, or path fields written in another YAML style may not be interpreted correctly. If the block contains text but no readable path fields, the function throws rather than treating every folder file as new.

It is needed to establish the `knownPaths` against which folder files are compared.

### `missingPhotos`

**Purpose:** Return supported image filenames in the folder that are not represented by a known path.

**Parameters:** `photoFolder`, the configured directory; and `knownPaths`, the Set returned by `existingPhotoPaths`.

**Return value:** A sorted array of missing filenames, not full paths.

The function normalizes folder separators and removes one trailing slash. `readdirSync` returns directory entries. A chain of `filter`, `map`, `sort`, and another `filter` then:

1. keeps only regular files with supported lowercase extensions;
2. converts entry objects to names;
3. sorts names with `localeCompare`;
4. constructs and normalizes each expected website path;
5. keeps only filenames absent from `knownPaths`.

Example: if `NewPhoto.JPG` is a file and its normalized path is not in the Set, the returned array includes `NewPhoto.JPG`.

What could go wrong: a missing or unreadable directory causes `readdirSync` to throw. Symbolic links are excluded because `entry.isFile()` reports the directory-entry type rather than following every possible link. Extension checks do not validate image contents. Case-insensitive comparison may conceal case mismatches that matter on deployment.

It is the central discovery step that avoids duplicate YAML entries.

### `photoEntry`

**Purpose:** Create one YAML list item for a missing filename.

**Parameters:** `photoFolder` and `filename`.

**Return value:** A four-line string containing `thumbnail`, `full`, `alt`, and `caption`.

The function uses template literals to interpolate the folder and filename. An array holds four lines, and `.join("\n")` combines them without using spread syntax. Both image path fields initially point to the same file. `readableImageName` supplies both text placeholders.

Example for `NaplesCaravaggio.jpg`:

```yaml
  - thumbnail: /Photos/Naples/SmallPhotos/NaplesCaravaggio.jpg
    full: /Photos/Naples/SmallPhotos/NaplesCaravaggio.jpg
    alt: Naples Caravaggio
    caption: Naples Caravaggio
```

What could go wrong: filenames containing YAML-significant characters, such as `:` or `#`, are not quoted. The generated text may be vague or inaccurate. A future separate full-size directory is not supported.

The function is needed to make every discovered file conform to the gallery data structure expected by the trip layout.

### `syncTrip`

**Purpose:** Coordinate reading, parsing, comparison, insertion, writing, and recovery for one configured trip.

**Parameter:** One object destructured into `{ markdownPath, photoFolder }`.

**Return value:** An array of filenames that were added. It returns `[]` when nothing is missing.

Important syntax includes a destructured parameter, synchronous I/O, function composition, array length checks, `map`, template literals, string slicing and concatenation, `try/catch`, and rethrowing an exception.

Example: given one missing file, `syncTrip` creates its entry, inserts it into the YAML, writes the reconstructed document, and returns `['NewPhoto.jpg']`.

What could go wrong: any read, parse, directory, or write failure can stop synchronization. The recovery write can also fail. Multiple file changes are not wrapped in a transaction. If more trips are configured and an early one succeeds before a later one fails, the earlier file remains changed.

This function joins all smaller operations into one unit that `trips.flatMap(syncTrip)` can invoke.

## 7. Regular expressions

Regular expressions describe text patterns. This script uses each of the following patterns.

### Leading slash removal: `/^\/+/`

- `/.../` delimits the expression.
- `^` anchors the match at the start of the string.
- `\/` means a literal forward slash.
- `+` means one or more.

It matches the leading `//` in `//Photos/image.jpg`. It does not match the slash inside `Photos/image.jpg` because that slash is not at the start. There is no `g` flag because a single start-of-string match removes the entire leading run.

### Camel-case boundary: `/([a-z\d])([A-Z])/g`

- `([a-z\d])` captures a lowercase ASCII letter or digit.
- `([A-Z])` captures an immediately following uppercase ASCII letter.
- The replacement `$1 $2` puts both captures back with a space between them.
- `g` means find all occurrences rather than stopping after the first.

It matches `sC` inside `NaplesCaravaggio`. It does not match `NC` because the first character is uppercase. The complete replacement turns `NaplesCaravaggio` into `Naples Caravaggio`.

### Underscores and hyphens: `/[_-]+/g`

- `[...]` is a character class.
- `_` and `-` are the accepted characters.
- `+` consumes one or more adjacent separators.
- `g` replaces every run.

It matches `__-` in `Naples__-Street`. It does not match the space in `Naples Street`. Each run becomes one space.

### Whitespace cleanup: `/\s+/g`

- `\s` means a whitespace character, such as a space, tab, or newline.
- `+` consumes a run of one or more.
- `g` replaces every run.

It matches the two spaces in `Naples  Street`. It does not match the letters in `Naples`. Every run becomes one ordinary space.

### YAML front matter: `/^(---\r?\n)([\s\S]*?)(\r?\n---)(\r?\n|$)/`

- `^` requires the match to begin at the start of the file.
- `(---\r?\n)` captures the opening delimiter and its line ending.
- `\r?\n` accepts either Windows CRLF (`\r\n`) or Unix/Linux/macOS LF (`\n`). The carriage return is optional.
- `([\s\S]*?)` captures any character, including newlines. `*?` is non-greedy, so it stops at the earliest closing delimiter that lets the rest match.
- `(\r?\n---)` captures the newline before the closing delimiter and the delimiter itself.
- `(\r?\n|$)` captures either the line ending after the delimiter or the end of the file.

It matches a file beginning with `---\ntitle: Naples\n---\n`. It does not match `Introduction\n---\ntitle: Naples\n---` because the first delimiter is not at the start. There are no `g` or `m` flags: the script needs one front-matter region, and `^` means the start of the whole source.

`\r?\n` is used throughout the parsing expressions so files with CRLF or LF line endings can be read without requiring conversion first.

### The `photos:` line: `/^photos:\s*\r?$/m`

- `^photos:` requires the key to begin at the start of a line.
- `\s*` allows optional whitespace after the colon.
- `\r?` allows the carriage-return portion of CRLF before the line boundary.
- `$` marks the end of the line.
- `m` makes `^` and `$` apply to each line, not only the start and end of the complete YAML string.

It matches `photos:` and `photos:   ` on their own top-level lines. It does not match `  photos:` because of the indentation, or `photos: []` because non-whitespace follows the colon.

### Next top-level YAML field: `/\r?\n(?=[A-Za-z][\w-]*:\s*)/g`

- `\r?\n` matches a line break.
- `(?=...)` is a positive lookahead. It checks what follows without consuming it.
- `[A-Za-z]` requires the next key to begin with an ASCII letter at column one.
- `[\w-]*` permits zero or more word characters or hyphens in the rest of the key.
- `:` requires the key separator.
- `\s*` allows whitespace after the colon.
- `g` enables stateful searching with `lastIndex`; the function sets `lastIndex` to the start of the photo content before calling `exec`.

It matches the newline before `layout: layouts/trip.njk`. It does not match the newline before `    caption: Cathedral`, because the next line is indented. The matched newline becomes the boundary before the next top-level field.

### `thumbnail` and `full` paths: `/^\s+(?:thumbnail|full):\s+(.+?)\s*$/gm`

- `^` means the start of a line because of `m`.
- `\s+` requires indentation before the field.
- `(?:thumbnail|full)` is a non-capturing choice between the two field names.
- `:` matches the colon.
- The next `\s+` requires whitespace before the value.
- `(.+?)` captures the value, using a non-greedy match.
- `\s*$` permits trailing whitespace before the line ends.
- `g` finds all matching fields; `m` applies the anchors per line.

It matches `    full: /Photos/example.jpg` and captures `/Photos/example.jpg`. It does not match `alt: Example`, because the field name is neither `thumbnail` nor `full` and the line is not indented.

### Quote removal: `/^['"]|['"]$/g`

- `^['"]` matches one single or double quote at the start.
- `|` means “or.”
- `['"]$` matches one single or double quote at the end.
- `g` lets `.replace` remove both boundary quotes when both exist.

It removes the quotes from `"/Photos/example.jpg"`. It does not remove the slash or letters in `/Photos/example.jpg`. It only handles boundary quote characters; it is not a complete YAML string parser.

### Trailing folder slash: `/\/$/`

- `\/` matches a literal forward slash.
- `$` anchors it at the end of the string.

It matches the final slash in `Photos/Naples/SmallPhotos/`. It does not match the internal slashes in `Photos/Naples/SmallPhotos`. No `g` flag is needed because there can be only one final character. This same expression appears in both `missingPhotos` and `photoEntry`.

## 8. Reading the YAML front matter without a YAML library

The script does not parse YAML into JavaScript objects. Instead, it recognizes specific lines and boundaries with regular expressions, then inserts text into the original YAML string.

This keeps the utility dependency-free. Node's built-in modules are enough, installation remains simple, and most of the existing file can be preserved byte for byte.

The approach assumes:

- the file starts directly with `---`;
- the closing delimiter is another `---` on its own line;
- `photos:` is an unindented top-level key with no value on the same line;
- photo entries use indented `thumbnail:` and `full:` lines;
- later top-level keys begin at column one with a letter;
- paths are plain scalars or simply quoted strings;
- the front matter does not use unusual multiline constructs that imitate these boundaries.

Advantages include little code, no new package, readable output, and preservation of the Markdown body and most original formatting.

Limitations are that syntactically valid YAML can be formatted in ways the script does not understand. It cannot reliably account for comments, anchors, aliases, flow-style arrays, complex quoted strings, multiline scalars, or every legal key. It also cannot validate the complete YAML structure.

A real YAML parser would be safer if the front matter became more complex, if users needed flexible formatting, if paths could contain YAML-special characters, if the script needed to modify several nested fields, or if correctness across arbitrary YAML mattered more than preserving the original text layout.

## 9. Detecting existing and missing photographs

The comparison proceeds in two directions.

First, `existingPhotoPaths` scans the current `photos:` text. It extracts every indented `thumbnail` or `full` value, removes simple boundary quotes, normalizes the path, and adds it to a Set. Because the current entries use the same path for both fields, those two values collapse into one Set member.

Second, `missingPhotos` reads the configured folder with:

```js
readdirSync(normalizedFolder, { withFileTypes: true })
```

For each returned entry:

1. `entry.isFile()` excludes directories and other non-file entries.
2. `path.extname(entry.name)` extracts the extension.
3. `.toLowerCase()` makes the extension check case-insensitive.
4. `supportedImageExtensions.has(...)` excludes unsupported extensions.
5. `.map((entry) => entry.name)` retains only filenames.
6. `.sort((first, second) => first.localeCompare(second))` creates stable, readable ordering.
7. A website path is built from the folder and filename.
8. `normalizeImagePath` makes it comparable with YAML paths.
9. `knownPaths.has(...)` checks membership, and `!` retains only unknown paths.

For example, suppose the folder contains:

```text
Cathedral.jpeg
NaplesStreet.jpg
PompeiiForum.jpg
```

Suppose the YAML already lists `Cathedral.jpeg` and `PompeiiForum.jpg`. The Set contains their normalized paths. All three directory entries pass the file and extension checks and are sorted. The final filter removes the two known paths and returns:

```js
["NaplesStreet.jpg"]
```

The Set comparison prevents another entry from being added for a path already used as either a thumbnail or full image.

## 10. Generating YAML entries

`photoEntry` constructs the gallery data expected by the trip layout. With this filename:

```text
NaplesCaravaggio.jpg
```

`readableImageName` removes `.jpg` and inserts a space between `s` and `C`, producing `Naples Caravaggio`. `photoEntry` then returns:

```yaml
  - thumbnail: /Photos/Naples/SmallPhotos/NaplesCaravaggio.jpg
    full: /Photos/Naples/SmallPhotos/NaplesCaravaggio.jpg
    alt: Naples Caravaggio
    caption: Naples Caravaggio
```

- `thumbnail` tells the gallery which image to load in the grid.
- `full` tells the lightbox which image to open. The current workflow uses the same web-sized file for both.
- `alt` supplies a text alternative for the image. Good alt text communicates relevant visual information to people who cannot see the image, including users of screen readers, and can help when an image fails to load.
- `caption` is visible text displayed with the photograph and can provide context to all readers.

The filename-derived text is only a starting point. `Naples Caravaggio` does not say what the photograph shows, where the artwork appears, or what detail matters. A person should inspect the photograph and write concise, accurate alt text and a useful caption. The two fields serve different purposes and do not have to remain identical.

## 11. Updating the Markdown file safely

`syncTrip` reads the complete original file before attempting any transformation:

```js
const original = readFileSync(markdownPath, "utf8");
```

Keeping `original` provides both the source for parsing and the text used by the recovery attempt. UTF-8 makes `readFileSync` return a string rather than a binary `Buffer`.

After finding missing files, the function maps each filename through `photoEntry` and joins the entries with `\n`. It determines whether the existing photo content already ends in `\n`:

```js
const separator = photosBlock.content.endsWith("\n") ? "" : "\n";
```

This prevents either joining a new entry directly onto the previous line or deliberately adding an unnecessary extra blank line. The new YAML is constructed from:

1. the unchanged YAML before the end of the photo block;
2. the needed separator;
3. the generated entries;
4. the unchanged YAML after the photo block.

The complete document is then reconstructed from the original opening delimiter, updated YAML, original closing delimiter and line ending, and original body. Because `frontMatter.body` is copied directly, the essay text is preserved.

`writeFileSync(markdownPath, updated)` replaces the contents of the Markdown file. It does not create a separate backup.

If an error occurs after the original was read, the inner recovery `try/catch` attempts to write `original` back to the same path. This is a useful safeguard, especially if a write began but did not complete normally. It is not a complete transaction or backup system: the process or computer could stop at the wrong time, the disk could fail, permissions might prevent restoration, and the restoration attempt itself might fail. The empty recovery `catch` intentionally preserves the original synchronization error rather than replacing it with the recovery error. Version control and separate source photographs remain important.

## 12. Error handling

`throw new Error(message)` creates an exception and immediately stops the current normal control flow. The script explicitly throws when:

- the Markdown file does not contain front matter matching the expected delimiters;
- the YAML does not contain a recognizable top-level `photos:` section;
- a matched `thumbnail` or `full` path is empty;
- a non-empty `photos:` block contains no readable `thumbnail` or `full` paths.

Node file operations can also throw errors that the script does not create itself, including a missing Markdown file, missing photo directory, permission failure, invalid path, or failed read/write.

The inner `try/catch` is inside `syncTrip`. It covers parsing, directory inspection, generation, and writing. On failure it attempts to restore the already-read original text, then uses `throw error` to pass the original exception outward.

The outer `try/catch` surrounds synchronization of the `trips` array. On success it prints a normal status. On failure:

```js
console.error(`Photo synchronization failed: ${error.message}`);
process.exitCode = 1;
```

`console.error` writes an error message to the standard error stream. `process.exitCode = 1` tells Node to finish with a nonzero exit status after current work completes. By convention, zero means success and nonzero means failure. npm observes Node's exit status, so the npm command is reported as failed to a terminal, shell script, or continuous-integration system.

The code assumes the caught value has a useful `.message` property, as normal `Error` objects do.

## 13. Program execution from start to finish

Starting with `npm run sync-photos`, execution proceeds as follows:

1. npm looks up `sync-photos` and starts `node scripts/sync-photos.js`.
2. Node loads the ES module because the package uses `"type": "module"`.
3. Node imports the three file-system functions and the path module.
4. JavaScript creates the supported-extension Set.
5. JavaScript creates the two-item `trips` configuration array.
6. Function declarations are established. Their bodies do not run yet.
7. Execution reaches the outer `try` and calls `trips.flatMap(syncTrip)`.
8. `flatMap` passes each configured trip object to `syncTrip`, beginning with Naples and then Amsterdam.
9. For each trip, `syncTrip` reads the configured Markdown file as the `original` string.
10. `getFrontMatter` divides the file into delimiters, YAML, and body.
11. `getPhotosBlock` locates the `photos:` content.
12. `existingPhotoPaths` builds a normalized Set from current `thumbnail` and `full` values.
13. `missingPhotos` reads the photo directory, filters supported files, sorts them, and returns filenames whose paths are absent from the Set.

If no new photographs are found:

14. `syncTrip` returns `[]` without calling `writeFileSync` for the normal update.
15. `flatMap` produces an empty `added` array.
16. The script prints `No new photographs found` and exits successfully.

If new photographs are found:

14. Each missing filename is passed to `photoEntry`.
15. The generated entries are joined and inserted at the end of the existing photo block.
16. The full Markdown text is reconstructed and written.
17. `syncTrip` returns the missing filename array.
18. `flatMap` produces the combined `added` array.
19. The script prints the count and then prints each filename on a line beginning with `- `.
20. Node exits successfully unless an exception occurred.

At any failing step covered by `syncTrip`, recovery is attempted and the error reaches the outer catch. The failure message is printed and the exit code becomes 1.

## 14. JavaScript concepts used

### Variables declared with `const`

`const` creates a block-scoped binding that cannot be reassigned. Examples include `supportedImageExtensions`, `trips`, `original`, and `added`. Objects, arrays, Sets, and regular expressions held by a `const` can still have internal mutable state; it is the variable binding that stays fixed.

### Arrays

Arrays are ordered collections. `trips` holds configuration objects, `photoEntry` builds an array of YAML lines, and `missingPhotos` returns an array of filenames.

### Objects

Objects group values under property names. A trip has `markdownPath` and `photoFolder`; `getFrontMatter` returns an object with four named string parts.

### Sets

A Set stores unique values. `supportedImageExtensions` uses `.has` for allowed types, while `existingPhotoPaths` uses a Set to collapse repeated paths and make membership checks clear.

### Functions

Declarations such as `function photoEntry(...)` package reusable behavior. Smaller functions each handle one concern, and `syncTrip` combines them.

### Destructured parameters

```js
function syncTrip({ markdownPath, photoFolder })
```

The braces unpack two properties from the object argument into local variables. The caller can pass the whole trip object without manually supplying two positional arguments.

### Template literals

Backticks create strings that can interpolate expressions with `${...}`. The script uses them for paths, errors, YAML lines, and console messages.

### Optional chaining

Optional chaining uses `?.`, for example `possibleError?.message`, to stop property access safely when the left side is `null` or `undefined`. The current script does **not** use optional chaining. Expressions such as `error.message`, `entry.name`, and `match[1]` use ordinary access and assume the containing value exists. This distinction matters because `imagePath ?? ""` is nullish coalescing, not optional chaining.

### Nullish coalescing

`imagePath ?? ""` uses the right side only when `imagePath` is `null` or `undefined`. Values such as `0` or `false` are not replaced, though `String(...)` converts them afterward.

### Regular expressions

Regular expressions locate structured text and clean filenames. Examples include the front-matter matcher and `/[_-]+/g`. Section 7 explains every current expression.

### Method chaining

Method chaining passes one result into the next operation. `missingPhotos` chains directory filtering, mapping, sorting, and missing-path filtering. `normalizeImagePath` chains string transformations.

### Callbacks

A callback is a function supplied to another function. The functions passed to `filter`, `map`, `sort`, and `flatMap` are callbacks invoked by those array methods.

### Arrow functions

Arrow syntax provides compact callbacks. `(entry) => entry.name` returns a filename. A multiline arrow callback in the first filter returns a Boolean condition.

### `map`

`map` transforms every array item into a corresponding new item. Directory entries become names, and missing filenames become YAML entry strings.

### `filter`

`filter` keeps only items whose callback returns a truthy value. One filter keeps supported regular files; another keeps paths absent from `knownPaths`.

### `sort`

`sort((first, second) => first.localeCompare(second))` orders filenames using string locale comparison. Sorting before the missing-path filter makes generated additions deterministic relative to the directory names.

### `flatMap`

`trips.flatMap(syncTrip)` calls `syncTrip` for every trip and flattens the returned filename arrays by one level. With one trip returning `['A.jpg', 'B.jpg']`, `added` is directly `['A.jpg', 'B.jpg']`, not `[['A.jpg', 'B.jpg']]`.

### Spread-independent string construction

The script does not use spread syntax such as `[...items]`. It constructs output through template literals, `Array.join("\n")`, and `+` concatenation of slices. This makes the exact ordering of the YAML fragments explicit.

### Synchronous file operations

The `Sync` functions complete before execution moves onward. This yields straightforward step-by-step control flow suitable for this small command-line utility.

### Exceptions

`throw` signals a failure. `try/catch` allows recovery and user-friendly reporting. `throw error` rethrows the same failure after restoration is attempted.

### Exit codes

The normal exit code is zero. Setting `process.exitCode = 1` marks the command as failed without abruptly terminating before Node finishes current cleanup and output.

## 15. Worked example

Assume the folder contains exactly:

```text
PompeiiForum.jpg
NaplesStreet.jpg
CaravaggioChurch.jpg
```

Assume `PompeiiForum.jpg` and `NaplesStreet.jpg` already have both `thumbnail` and `full` fields in `Text/Naples.md`.

### 1. Paths collected into `knownPaths`

After quote removal and normalization, repeated thumbnail/full values collapse into:

```js
new Set([
  "photos/naples/smallphotos/pompeiiforum.jpg",
  "photos/naples/smallphotos/naplesstreet.jpg",
])
```

### 2. Result of `missingPhotos`

The folder names are filtered to supported files and sorted. Each normalized candidate path is checked against the Set. The result is:

```js
["CaravaggioChurch.jpg"]
```

### 3. YAML created for the missing file

`readableImageName` changes `CaravaggioChurch` to `Caravaggio Church`. `photoEntry` returns:

```yaml
  - thumbnail: /Photos/Naples/SmallPhotos/CaravaggioChurch.jpg
    full: /Photos/Naples/SmallPhotos/CaravaggioChurch.jpg
    alt: Caravaggio Church
    caption: Caravaggio Church
```

### 4. Insertion location

The entry is inserted after the existing content of the `photos:` section and before the next top-level YAML field. If `photos:` is the final field, as it currently is in `Text/Naples.md`, the entry is inserted immediately before the closing `---` delimiter. The Markdown essay after that delimiter is copied unchanged.

### 5. Final console output

```text
Added 1 new photograph
- CaravaggioChurch.jpg
```

The user should then replace `Caravaggio Church` with meaningful alt text and an appropriate visible caption.

## 16. What the script does not do

The current script does not:

- copy photographs into the repository;
- resize photographs;
- optimize or compress images;
- delete obsolete YAML entries;
- delete image files;
- validate whether alt text is meaningful;
- generate genuinely descriptive captions;
- create separate thumbnail files;
- automatically commit or push changes.

It also does not run the Eleventy build or preview server. Those remain separate commands.

## 17. Safe usage checklist

- [ ] Keep original, full-quality photographs somewhere outside this website folder.
- [ ] Copy only appropriately web-sized versions into the matching Naples or Amsterdam photo folder.
- [ ] Run `git status` before synchronization so existing work is understood.
- [ ] Run `npm run sync-photos` from the repository root.
- [ ] Inspect the resulting diff.
- [ ] Edit every generated alt text and caption for accuracy and usefulness.
- [ ] Run `npm run build`.
- [ ] Preview the site locally and check the gallery and lightbox.
- [ ] Commit only after reviewing all changes.

## 18. Commands reference

### `npm run sync-photos`

Runs the npm script that executes `node scripts/sync-photos.js`. It discovers missing supported images and may rewrite `Text/Naples.md` and `Text/Amsterdam.md`.

### `git diff -- Text/Naples.md`

Shows unstaged changes to the Naples Markdown file. Use it to inspect exactly which YAML lines synchronization added and to review later caption edits. Untracked files do not appear in a normal `git diff` until Git is told about them, so also use `git status --short`.

### `npm run build`

Runs Eleventy and writes the generated site to `_site`. A successful build checks that the updated front matter can still be processed by the current templates.

### `npm run start`

Starts Eleventy's local development server. It supports previewing the website in a browser and watches for relevant source changes until the server is stopped.

### `git status --short`

Displays a compact summary of tracked modifications and untracked files. Run it before and after synchronization to understand the full working-tree state.

## 19. Possible future improvements

The following are hypothetical improvements, not features of the current script:

- **YAML parser:** Parse front matter structurally so valid alternative YAML formatting, quoted values, and complex fields are safer to handle.
- **Dry-run mode:** Report entries that would be added without writing the Markdown file.
- **Configurable trip list:** Load trip definitions from data or discover them from front matter, while making output reporting accurate for every file.
- **Separate thumbnail and full-size folders:** Generate different `thumbnail` and `full` paths when the site keeps two image versions.
- **Duplicate-content detection:** Hash file contents to notice identical photographs with different filenames, instead of comparing paths only.
- **Automatic image dimensions:** Read width and height for use in markup and layout stability.
- **Tests:** Exercise path normalization, filename conversion, YAML boundaries, failure recovery, and end-to-end fixtures.
- **Backups:** Write a dated backup or use an atomic temporary-file-and-rename strategy before replacing Markdown.
- **Command-line arguments:** Let a user choose a trip, Markdown file, folder, or dry-run behavior when invoking the command.
- **Validation of missing files:** Report YAML entries whose referenced images no longer exist, without necessarily deleting them.
- **Automatic placeholder markers for captions:** Generate an obvious marker such as `TODO:` so unfinished human review is easier to find.

Each improvement would add behavior or complexity and should be designed and tested separately. None is implemented by the script documented here.

## 20. Annotated version of the script

The following is the complete current script. Its executable lines are preserved in their original order and wording. Explanatory comments have been added around important sections; these comments are documentation and are not present in the executable file.

```js
// Import synchronous file reading, directory reading, and file writing from Node.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
// Import Node's cross-platform filename and extension utilities.
import path from "node:path";

// Only regular files with one of these extensions are candidates for the gallery.
const supportedImageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

// Configuration connects each trip Markdown file to its photo folder.
const trips = [
  {
    markdownPath: "Text/Naples.md",
    photoFolder: "Photos/Naples/SmallPhotos",
  },
  {
    markdownPath: "Text/Amsterdam.md",
    photoFolder: "Photos/Amsterdam/SmallPhotos",
  },
];

// Make differently written versions of the same image path comparable.
function normalizeImagePath(imagePath) {
  return String(imagePath ?? "")
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .toLowerCase();
}

// Convert a filename into starter text, without its extension.
function readableImageName(filename) {
  return path
    .parse(filename)
    .name
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Divide a Markdown source file into its front-matter pieces and body.
function getFrontMatter(source, markdownPath) {
  const match = source.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)(\r?\n|$)/);

  // Stop instead of modifying a file whose expected boundaries cannot be found.
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

// Locate the content owned by the top-level photos: YAML key.
function getPhotosBlock(yaml, markdownPath) {
  const photosMatch = /^photos:\s*\r?$/m.exec(yaml);

  if (!photosMatch) {
    throw new Error(`${markdownPath} does not contain a photos: front-matter section.`);
  }

  const contentStart = photosMatch.index + photosMatch[0].length;
  // A later unindented key marks the end; otherwise photos runs to YAML's end.
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

// Extract and normalize paths already used by thumbnail or full fields.
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

  // Non-empty but unrecognized content is treated as unsafe to modify.
  if (paths.size === 0 && photosBlock.trim()) {
    throw new Error(`${markdownPath} has a photos: section with no readable image paths.`);
  }

  return paths;
}

// Read, filter, sort, and compare the files in one configured directory.
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

// Generate the exact four YAML lines required for one gallery item.
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

// Synchronize one configured Markdown file and photo directory.
function syncTrip({ markdownPath, photoFolder }) {
  // Keep the complete original text for parsing and possible recovery.
  const original = readFileSync(markdownPath, "utf8");

  try {
    const frontMatter = getFrontMatter(original, markdownPath);
    const photosBlock = getPhotosBlock(frontMatter.yaml, markdownPath);
    const additions = missingPhotos(
      photoFolder,
      existingPhotoPaths(photosBlock.content, markdownPath),
    );

    // Do not perform the normal write when the source is already synchronized.
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
    // Reuse the original delimiters and body around the updated YAML.
    const updated = `${frontMatter.opening}${updatedYaml}${frontMatter.closing}${frontMatter.body}`;

    writeFileSync(markdownPath, updated);
    return additions;
  } catch (error) {
    // Attempt to restore the original text while preserving the first error.
    try {
      writeFileSync(markdownPath, original);
    } catch {
      // Preserve the original error, which describes the failed synchronization.
    }
    throw error;
  }
}

// Process all configured trips and report either success or failure.
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
```
