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
        <p>Note: the "Median Dwelling Value" layer is a Stats Can data-point, not BC Assessment data. See discussion, below. </p>
        
        
      


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

  <p> Note on "median value per dwelling": </p>
  
  
  <p>According to Stats Can, this is owner estimated and refers to the dollar amount expected by the owner if the asset were to be sold. In the context of dwelling, it refers to the value of the entire dwelling, including the value of the land it is on and of any other structure, such as a garage, which is on the property. If the dwelling is located in a building which contains several dwellings, or a combination of residential and business premises, all of which the household owns, the value is estimated as a portion of the market value that applies only to the dwelling in which the household resides.</p>
        <p>BC Assessment makes limited assessment data freely available - however, unlike some jurisdictions, it restricts access to bulk property assessment data, requiring special applications by researchers and charging fees to other governments for this data if they do not require it for tax administration purposes.</p>


  <section class="project-section census-methodology" aria-labelledby="methodology-title">
    <h2 id="methodology-title">Downloading and mapping dissemination area data from the 2021 "Census Profile"</h2>

    <div class="download-links">
      <a class="project-link download-link" href="downloads/requirements.txt" download>requirements.txt</a>
    </div>

    <p>Dissemination Areas are the smallest geographies for which detailed public data on demographics is released.</p>

    <p>Working with dissemination area data from stats can can be a bit challenging as the data sets are quite large.</p>

    <p>The work flow below is designed to be more efficient than downloading very large data files and then filtering. It involves identifying upfront the specific dissemination areas you want, as well as the specific data-points, and then downloading just the data you want</p>

    <p>Note that the file paths referenced in the scripts are placeholders and need to be replaced with your actual local filepaths.</p>

    <h3>Steps</h3>

    <div class="methodology-step">
      <h4>Understanding the Stats Can data / download metadata to figure out which data points or "census characteristics" to access</h4>

      <p>The following is a terminal command to download the metadata. It downloads as a .xml file</p>

      <div class="command-block">
        <button class="copy-command" type="button" data-copy-target="metadata-command">Copy</button>
        <pre><code id="metadata-command">curl -L --fail --show-error -o DF_DA_metadata.xml '<a href="https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/dataflow/STC_CP/DF_DA?references=all">https://api.statcan.gc.ca/census-recensement/profile/sdmx/rest/dataflow/STC_CP/DF_DA?references=all</a>'</code></pre>
      </div>
    </div>

    <div class="methodology-step">
      <h4>convert xml to .xlsx</h4>

      <p>In order to more easily use the metadata.</p>

      <a class="project-link download-link" href="downloads/ConvertXML.py" download>ConvertXML.py</a>
    </div>

    <div class="methodology-step">
      <h4>Isolate Vancouver dissemination areas from the broader mapping of DAs across Canada</h4>

      <a class="project-link download-link" href="downloads/ExtractVanDAs.py" download>ExtractVanDAs.py</a>

      <p>Note: this script assumes: you have a boundary file for vancouver, you have mapping files for dissemination areas</p>

      <p>This script identifies vancouver das by deriving representative points for each da</p>
    </div>

    <div class="methodology-step">
      <h4>download the data for Vancouver DAs</h4>

      <a class="project-link download-link" href="downloads/download_vancouver_census.py" download>download_vancouver_census.py</a>

      <p>This creates a .xlsx and a .parquet with the data</p>

      <p>Note that .parquet is a powerful data format for data analysis.</p>
    </div>

    <div class="methodology-step">
      <h4>Join the data to the DA mapping</h4>

      <div class="download-links">
        <a class="project-link download-link" href="downloads/BasicMap.py" download>BasicMap.py</a>
      </div>
    </div>
  </section>
</article>

<script src="methodology.js"></script>
