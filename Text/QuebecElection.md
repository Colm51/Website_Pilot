---
title: Quebec 2026 Election Map
date: 2026-10-29
updated: 2026-10-29
summary: Interactive map of the 2026 Quebec provincial election, showing electoral district and polling division results with party-level vote distributions.
description: Interactive map of the 2026 Quebec provincial election, showing electoral district and polling division results with party-level vote distributions.
layout: layouts/base.njk
permalink: /projects/quebec-election/index.html
isProjects: true
tags:
  - projects
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Projects</p>
    <h1 id="page-title">Quebec 2026 Election Map</h1>
    <p class="lede">Interactive map of the 2026 Quebec provincial election, showing electoral district and polling division results with party-level vote distributions.</p>
  </div>
</section>

<article class="essay measure">
  <section aria-labelledby="interactive-map-title">
    <h2 id="interactive-map-title">Interactive map</h2>
    <p>Switch between electoral district totals and ordinary polling division results. Hover over a geography to see ranked party vote counts and percentages.</p>
    <iframe
      class="map-embed"
      src="{{ '/projects/quebec-election/map/' | htmlBaseUrl }}"
      title="Interactive map of the 2026 Quebec provincial election"
      loading="lazy"
    ></iframe>
    <p><a href="{{ '/projects/quebec-election/map/' | htmlBaseUrl }}">Open the map in a new page</a></p>
    <p><strong>Basemap:</strong> © OpenStreetMap contributors.</p>
  </section>
</article>
