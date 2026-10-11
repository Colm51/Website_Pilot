---
title: Vancouver Census Map
date: 2026-10-10
updated: 2026-10-10
summary: An interactive map of 2021 Census dissemination-area data for Vancouver.
description: An interactive map of 2021 Census dissemination-area data for Vancouver.
layout: layouts/base.njk
permalink: /projects/vancouver-census-map/index.html
isProjects: true
tags:
  - projects
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Projects</p>
    <h1 id="page-title">Vancouver Census Map</h1>
    <p class="lede">An interactive map of 2021 Census dissemination-area data for Vancouver.</p>
    <p class="lede">Vancouver's neighbourhoods vary dramatically in terms of such things as density and age. The densest neighbourhoods aren't just slightly more dense than the least dense - they are 100s of times denser.</p>
        <p class="lede">In order to support exploring these factors, this page maps data available at the Stats Can Dessemination Area geography (2021).</p>
  </div>
</section>

<article class="essay measure">
  <section aria-labelledby="interactive-map-title">
    <h2 id="interactive-map-title">Interactive map</h2>
    <p>Select a Census variable to update the map. Select the legend to filter the dissemination areas.</p>
    <iframe
      class="map-embed"
      src="{{ '/projects/vancouver-census-map/map.html' | htmlBaseUrl }}"
      title="Interactive map of 2021 Census dissemination-area data for Vancouver"
      loading="lazy"
    ></iframe>
    <p><a href="{{ '/projects/vancouver-census-map/map.html' | htmlBaseUrl }}">Open the map in a new page</a></p>
    <p><strong>Data source:</strong> Statistics Canada, 2021 Census of Population.</p>
  </section>
</article>
