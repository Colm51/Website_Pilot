import { fileURLToPath } from "node:url";

const sourceRoot = fileURLToPath(
  new URL("../../Quebec/InteractiveMap/", import.meta.url),
);
const outputDirectory = fileURLToPath(
  new URL("../Projects/QuebecElection/map/", import.meta.url),
);

export default {
  root: sourceRoot,
  base: "./",
  plugins: [
    {
      name: "quebec-election-relative-data-paths",
      enforce: "pre",
      transform(code, id) {
        if (!id.endsWith("/src/main.js")) return null;

        let replacements = 0;
        const transformedCode = code.replace(
          /(geometryUrl|resultsUrl): "\/data\/([^\"]+)"/g,
          (_match, property, filename) => {
            replacements += 1;
            return `${property}: \`\${import.meta.env.BASE_URL}data/${filename}\``;
          },
        );

        if (replacements !== 4) {
          throw new Error(
            `Expected four Quebec election data paths, found ${replacements}`,
          );
        }

        return { code: transformedCode, map: null };
      },
      transformIndexHtml: {
        order: "post",
        handler(html) {
          const scriptThenStylesheet = /(\n[ \t]*)(<script type="module"[^>]*><\/script>)(\n[ \t]*)(<link rel="stylesheet"[^>]*>)/;

          if (!scriptThenStylesheet.test(html)) {
            throw new Error(
              "Expected the Quebec election module script before its stylesheet",
            );
          }

          return html.replace(scriptThenStylesheet, "$1$4$3$2");
        },
      },
    },
  ],
  build: {
    outDir: outputDirectory,
    emptyOutDir: true,
  },
};
