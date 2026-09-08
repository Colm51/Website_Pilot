---
title: Cross-walking Ontario Municipal Boundaries, names, and IDs with Stats Can CSDs
date: 2026-09-07
updated: 2026-09-07
summary: A reproducible crosswalk between Ontario lower and single-tier municipalities and Statistics Canada census subdivisions.
description: A workflow, interactive map, scripts, and spreadsheet for cross-walking Ontario municipalities with Statistics Canada census subdivisions.
layout: layouts/base.njk
permalink: /projects/ontario-municipal-csd-crosswalk/index.html
isProjects: true
tags:
  - projects
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Ontario municipal data</p>
    <h1 id="page-title">Cross-walking Ontario Municipal Boundaries, names, and IDs with Stats Can CSDs</h1>
    <p class="lede">A reproducible workflow for matching Ontario lower and single-tier municipalities to Statistics Canada census subdivisions.</p>
  </div>
</section>

<article class="essay measure">
  <section aria-labelledby="project-text-title">
    <h2 id="project-text-title">Project text</h2>

    <p>In order to integrate municipal data and Stats Can data, it will often arise that one needs to cross-walk municipal boundaries with Stats Can CSDs (census subdivisions).</p>

    <p>This walk-through discusses how to do this. It does not consider other stats can geographies such as CMAs, CDs, DA, CTs. I may discuss these other geographies in the future.</p>

    <p>There are a few important considerations in joining municipal and CSD geographies:</p>
    <ul>
      <li>Most CSDs correspond to Ontario's 414 lower and single tier municipalities.</li>
      <li>Upper tier municipalies are not CSDs.</li>
      <li>A number of CSDs do not relate to municipalities. Instead, they relate to First Nations reserves, unincoporated areas, etc.</li>
    </ul>

    <p>Boundary files for CSDs are available at: <a href="https://www12.statcan.gc.ca/census-recensement/2011/geo/bound-limit/bound-limit-s-eng.cfm?year=25">https://www12.statcan.gc.ca/census-recensement/2011/geo/bound-limit/bound-limit-s-eng.cfm?year=25</a></p>

    <p>Boundary files for lower and single - tier municipalities are available at: <a href="https://geohub.lio.gov.on.ca/datasets/municipal-boundary-lower-and-single-tier/explore?location=50.926000%2C-84.745000%2C4">https://geohub.lio.gov.on.ca/datasets/municipal-boundary-lower-and-single-tier/explore?location=50.926000%2C-84.745000%2C4</a></p>

    <p>Both sets of boundary files need to be further adjusted prior to joining.</p>

    <p>In order to extract only Ontario CSDs, filtering on Stats Can's provincial code for Ontario is required. This condition is PRUID = 35</p>

    <p>The municipal boundary files contain multiple geometries for many municipalities, resulting in over 600 rows. In order to get the expected 414, it is necessary to dissolve on individual municipalities.</p>

    <p>The municipal boundary files also extend into the water. In order to derive municipal boundaries, it is necessary to clip the file to conform to the land geography of Ontario.</p>

    <p>The boundary of Ontario can be obtained at: <a href="https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21&amp;utm_source=chatgpt.com">https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21&amp;utm_source=chatgpt.com</a>.</p>

    <p>This files inludes all provinces: in order to extract just Ontario, another PRUID selection is required.</p>

    <p>Once both Ontario CSD and municipal boudaries have been obtained, it is possible to do a spatial join. There are various ways of doing this, including in QGis. In this example, reproducible python code is used. A representstive point was derived for each municipal polygon, and this point was then used to join to the CSD polygons they fell within.</p>

    <p>One caveat: The ID referred to as "Munid" by the Ministry of Finance appears as "Assessment code", and furthermore these codes lack leading 0s in those cases where they should appear. For example, Ottawa appears as 614 but should be 0614. </p>

    <p>A number of example python scripts are included- including scripts to:</p>
    <ul>
      <li>Clean municipal boundaries by dissolving</li>
      <li>Clip municipal boundaries to Ontario land boundaries</li>
      <li>Extract a boundary for Ontario</li>
      <li>Extract Ontario CSDs</li>
      <li>Join Municipalities to CSDs</li>
    </ul>

    <p>The scripts assume all data was manually downloaded.</p>

    <p>My local filenames etc have been removed - this content needs to be populated.</p>
  </section>

  <section class="project-section" aria-labelledby="workflow-title">
    <h2 id="workflow-title">Workflow</h2>
    <ol class="workflow-list">
      <li><strong>Download the boundaries.</strong> Obtain the Ontario municipal boundary data and Statistics Canada province and CSD boundary files from the source links below.</li>
      <li><strong>Extract Ontario.</strong> Run <code>CreateOntarioGeopkg.py</code> against the province and territory file, selecting Ontario with <code>PRUID = 35</code>.</li>
      <li><strong>Clean the municipal layer.</strong> Run <code>CleanMuniBoundaries.py</code> to dissolve the source features by <code>MUNID</code>.</li>
      <li><strong>Clip municipal boundaries.</strong> Run <code>ClipMuniBoundaries.py</code> with the dissolved municipalities and Ontario cartographic boundary.</li>
      <li><strong>Extract Ontario CSDs.</strong> Run <code>FilterCSDs.py</code> to retain CSD records where <code>PRUID = 35</code>.</li>
      <li><strong>Create the crosswalk.</strong> Run <code>JoinMunisCSDs.py</code>. It creates a representative point inside each municipality, spatially matches the point to its containing CSD, restores the match to the municipal polygon, and writes both the joined layer and workbook.</li>
      <li><strong>Validate the result.</strong> Confirm that the municipal row count remains 414, inspect unmatched CSDs, and review boundary matches before using the crosswalk in analysis.</li>
    </ol>
    <p>The public scripts use command-line arguments and reusable paths rather than paths from my local computer. Run a script with <code>--help</code> to see its inputs.</p>
  </section>

  <section class="project-section" aria-labelledby="map-title">
    <h2 id="map-title">Interactive municipal and CSD map</h2>
    <p>Select a municipality to see its municipal identifiers and matched census subdivision name and UID.</p>
    <iframe
      class="map-embed"
      src="{{ '/projects/ontario-municipal-csd-crosswalk/map.html' | htmlBaseUrl }}"
      title="Ontario municipal boundaries and census subdivision crosswalk map"
      loading="lazy"
    ></iframe>
    <p><a href="{{ '/projects/ontario-municipal-csd-crosswalk/map.html' | htmlBaseUrl }}">Open the map in a new page</a></p>
  </section>

  <section class="project-section" aria-labelledby="downloads-title">
    <h2 id="downloads-title">Downloads</h2>
    <ul class="download-list">
      <li><a class="project-link" href="{{ '/projects/ontario-municipal-csd-crosswalk/downloads/Municipal_CSD_Crosswalk.xlsx' | htmlBaseUrl }}" download>Download the municipal–CSD crosswalk spreadsheet</a></li>
      <li><a href="{{ '/projects/ontario-municipal-csd-crosswalk/scripts/CreateOntarioGeopkg.py' | htmlBaseUrl }}" download>Extract the Ontario boundary — CreateOntarioGeopkg.py</a></li>
      <li><a href="{{ '/projects/ontario-municipal-csd-crosswalk/scripts/CleanMuniBoundaries.py' | htmlBaseUrl }}" download>Dissolve municipal boundaries — CleanMuniBoundaries.py</a></li>
      <li><a href="{{ '/projects/ontario-municipal-csd-crosswalk/scripts/ClipMuniBoundaries.py' | htmlBaseUrl }}" download>Clip municipal boundaries — ClipMuniBoundaries.py</a></li>
      <li><a href="{{ '/projects/ontario-municipal-csd-crosswalk/scripts/FilterCSDs.py' | htmlBaseUrl }}" download>Extract Ontario CSDs — FilterCSDs.py</a></li>
      <li><a href="{{ '/projects/ontario-municipal-csd-crosswalk/scripts/JoinMunisCSDs.py' | htmlBaseUrl }}" download>Create the joined layer and workbook — JoinMunisCSDs.py</a></li>
      <li><a href="{{ '/projects/ontario-municipal-csd-crosswalk/scripts/requirements.txt' | htmlBaseUrl }}" download>Download requirements.txt</a></li>
    </ul>
  </section>

  <section class="project-section" aria-labelledby="sources-title">
    <h2 id="sources-title">Source data</h2>
    <ul>
      <li><a href="https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index-eng.cfm">Statistics Canada boundary files</a></li>
      <li><a href="https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21">Statistics Canada 2021 Census boundary files</a></li>
      <li><a href="https://geohub.lio.gov.on.ca/datasets/municipal-boundary-lower-and-single-tier/explore?location=50.926000%2C-84.745000%2C4">Ontario GeoHub municipal boundary — lower and single tier</a></li>
    </ul>
  </section>
</article>
