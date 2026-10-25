---
title: Vancouver Election Map
date: 2026-10-24
updated: 2026-10-24
summary: An interactive map of 2026 Vancouver mayoral results by voting location with 2021 Census context.
description: Explore 2026 Vancouver mayoral results by voting location alongside selected 2021 Census characteristics.
layout: layouts/base.njk
permalink: /projects/vancouver-election/index.html
isProjects: true
tags:
  - projects
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Projects</p>
    <h1 id="page-title">Vancouver Election Map</h1>
    <p class="lede">Explore 2026 Vancouver mayoral results by voting location alongside selected 2021 Census characteristics.</p>
  </div>
</section>

<article class="essay measure">
  <section aria-labelledby="interactive-map-title">
    <h2 id="interactive-map-title">Interactive map</h2>
    <p>Use Election mode to compare candidates, vote shares, vote counts, and the winning candidate at each mapped voting location. Census mode maps selected characteristics by dissemination area, while Compare mode places election results and Census context side by side.</p>
    <p>Voting-place results show where ballots were recorded—not where voters live. Census comparison is contextual and does not establish demographic or neighbourhood voting patterns.</p>
    <iframe
      class="map-embed"
      src="{{ '/projects/vancouver-election/map.html' | htmlBaseUrl }}"
      title="Interactive map of 2026 Vancouver mayoral results and 2021 Census characteristics"
      loading="lazy"
    ></iframe>
    <p><a href="{{ '/projects/vancouver-election/map.html' | htmlBaseUrl }}">Open the map in a new page</a></p>
    <p><strong>Data sources:</strong> City of Vancouver, 2026 election results and voting places; Statistics Canada, 2021 Census of Population. Basemap © OpenStreetMap contributors.</p>
  </section>
</article>
