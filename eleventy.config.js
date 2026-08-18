import { HtmlBasePlugin } from "@11ty/eleventy";

function getPathPrefix() {
  if (process.env.ELEVENTY_PATH_PREFIX) {
    return process.env.ELEVENTY_PATH_PREFIX;
  }

  if (process.env.GITHUB_ACTIONS === "true" && process.env.GITHUB_REPOSITORY) {
    const repositoryName = process.env.GITHUB_REPOSITORY.split("/").pop();

    if (repositoryName && !repositoryName.endsWith(".github.io")) {
      return `/${repositoryName}/`;
    }
  }

  return "/";
}

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(HtmlBasePlugin, { extensions: "" });

  eleventyConfig.addPassthroughCopy("style.css");
  eleventyConfig.addPassthroughCopy("script.js");
  eleventyConfig.addPassthroughCopy("Maps/local-issue-reporter-map.html");
  eleventyConfig.addPassthroughCopy("Photos/**/SmallPhotos");
  eleventyConfig.addWatchTarget("Photos/Naples/SmallPhotos");
  eleventyConfig.addWatchTarget("Photos/Amsterdam/SmallPhotos");
  eleventyConfig.addWatchTarget("Photos/Guanajuato/SmallPhotos");
  eleventyConfig.addWatchTarget("Photos/Utila/SmallPhotos");
  eleventyConfig.addWatchTarget("Photos/SantaFe/SmallPhotos");


  eleventyConfig.ignores.add("README.md");
  eleventyConfig.ignores.add("index-original.html");
  eleventyConfig.ignores.add("Text/.obsidian/**");
}

export const config = {
  dir: {
    input: ".",
    includes: "_includes",
    output: "_site",
  },
  markdownTemplateEngine: "njk",
  pathPrefix: getPathPrefix(),
  templateFormats: ["md", "njk"],
};
