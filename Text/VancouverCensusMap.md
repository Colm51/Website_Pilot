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
    <p class="lede">An interactive map of 2021 Census dissemination area data for Vancouver.</p>
    <p>Vancouver's neighbourhoods vary dramatically in terms of such things as density and age. The densest neighbourhoods aren't just slightly more dense than the least dense - they are many times denser.</p>
        <p>In order to support exploring these factors, this page maps data available at the Stats Can Dessemination Area geography (2021).</p>
        <p>Note: the "Median Dwelling Value" layer is a Stats Can data-point, not to BC Assessment data. According to Stats Can, this is owner estimated and refers to the dollar amount expected by the owner if the asset were to be sold. In the context of dwelling, it refers to the value of the entire dwelling, including the value of the land it is on and of any other structure, such as a garage, which is on the property. If the dwelling is located in a building which contains several dwellings, or a combination of residential and business premises, all of which the household owns, the value is estimated as a portion of the market value that applies only to the dwelling in which the household resides.</p>
        <p>BC Assessment makes limited assessment data freely available - however, unlike some jurisdictions, it restricts access to bulk property assessment data, requiring special applications by researchers and charging fees to other governments for this data if they do not require it for tax administration purposes.</p>


  </div>
</section>

<article class="essay measure">
  <section aria-labelledby="interactive-map-title">
    <h2 id="interactive-map-title">Interactive map</h2>
    <p>Select the legend or a dissemination area to filter the dissemination areas.</p>
    <p>Select "Compare" to display side-by-side maps that can be filtered based on different variables. In order to support basic comparative exploration, a Jaccard Similarity Index is generated showing the degree of intersection in DAs between two maps.</p>
    <p>Layers for displaying major rapit transit routes and roads are also provided.</p>
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
