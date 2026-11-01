---
title: Quebec Election and Census Map
date: 2026-11-01
updated: 2026-11-01
summary: Explore Quebec's 2026 provincial election results alongside selected 2021 Census characteristics.
description: An interactive map combining Quebec's 2026 provincial election results with selected 2021 Census characteristics.
layout: layouts/base.njk
permalink: /projects/quebec-census-election/index.html
isProjects: true
tags:
  - projects
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Projects</p>
    <h1 id="page-title">Quebec Election and Census Map</h1>
    <p class="lede">Explore Quebec's 2026 provincial election results alongside selected 2021 Census characteristics.</p>
  </div>
</section>

<article class="essay measure">
  <section aria-labelledby="interactive-map-title">
    <h2 id="interactive-map-title">Interactive map</h2>
    <p>Switch between Census, Election, and Combined views. Select Census characteristics and statistics, search by DAUID, inspect election results, and use the layer controls and legends to adjust the display.</p>
    <p>Election polling areas and Census dissemination areas are different geographies. Their combined display provides context and does not imply demographic or causal relationships. Combined-view dots represent polling divisions, not voting locations.</p>
    <iframe
      class="map-embed"
      src="{{ '/projects/quebec-census-election/map/' | htmlBaseUrl }}"
      title="Interactive map of Quebec election results and 2021 Census characteristics"
      loading="lazy"
    ></iframe>
    <p><a href="{{ '/projects/quebec-census-election/map/' | htmlBaseUrl }}">Open the map in a new page</a></p>
    <p><strong>Data sources:</strong> Quebec election polling-division geography and election results; Statistics Canada, 2021 Census of Population. Basemap data © OpenStreetMap contributors.</p>
  </section>
</article>
