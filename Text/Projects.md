---
title: Projects
description: Civic tech
layout: layouts/base.njk
permalink: /projects/index.html
isProjects: true
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Projects</p>
    <h1 id="page-title">Projects</h1>
    <p class="lede">All content posted here has been developed outside of work using personal devices and publicly-available data. 
    </p>
     <p class="lede">Some of the projects touch on municipal finance - an area of personal and professional interest - while others are more idiosyncrattic.
    </p>
    <p class="lede">For all the content, my intent has been mostly to explore tech and programming as opposed to exhausting any particular topic. or to provide the best possible on-line resource
    </p>
    <p class="lede">
  All files related to this website are also available on
  <a href="https://github.com/Colm51/Website_Pilot">Github</a>
</p>

  </div>
</section>

<section class="essay measure" aria-labelledby="projects-title">
  <h2 id="projects-title">Projects</h2>
  <div class="trip-list">
    <article class="trip-card">
      <h3><a href="{{ '/projects/ontario-municipalities-census-divisions/' | htmlBaseUrl }}">Municipal & Census Divisions cross-walk</a></h3>
      <p>Walk-through of cross-walking Stats Can Census Divisions with Ontario upper and single-tier municipalities using mapping</p>
    </article>

    <article class="trip-card">
      <h3><a href="{{ '/projects/ontario-municipal-csd-crosswalk/' | htmlBaseUrl }}">Municipal & Census subdvisions cross-walk</a></h3>
      <p>Walk-through of cross-walking Stats Can Census Subdisions with Ontario lower and single-tier municipalities.</p>
    </article>

    <article class="trip-card">
      <h3><a href="{{ '/projects/music-library-dashboard/' | htmlBaseUrl }}">Music Library Dashboard</a></h3>
      <p>An interactive exploration of my personal music collection, listening history, and manually curated playlists.</p>
    </article>

    <article class="trip-card">
      <h3><a href="{{ '/projects/books-dashboard/' | htmlBaseUrl }}">Books Dashboard</a></h3>
      <p>An interactive exploration of my personal book library, including publication dates, manually curated Collections, Dewey subject classifications, languages, authors, and page counts.</p>
    </article>

    <article class="trip-card">
      <h3><a href="{{ '/projects/local-issue-reporter/' | htmlBaseUrl }}">Local Issue Reporter</a></h3>
      <p>Demo of an iPhone App for Easily Reporting Local Issues, Including Bike Lane Issues and Potholes</p>
    </article>
    

<article class="trip-card">

<h3>Draft Ontario Municipal Tax Receivables Dashboard (work in progress)</h3>

<p>An interactive Streamlit dashboard for exploring Municipal Tax Receivables data from FIR schedules 10 and 72.

It allows users to compare opening and closing balances, examine municipal trends over time, and explore mapping of the results.

Data for 2020 needs to be incorporated. Data requires significant validation.

It is recommended that users build their own version of the dashboard and conduct validation prior to usage.

Source code available at <a href="https://github.com/Colm51/TaxReceivablesDashboard" target="_blank" rel="noopener noreferrer">GitHub</a>.

</p>

  

<p>Built with Python, Parquet, GeoParquet, Streamlit, Polars, GeoPandas, and public Ontario Financial Information Return data.</p>

<p><a class="project-link" href="https://ontario-tax-receivables.streamlit.app/" target="_blank" rel="noopener noreferrer">Open interactive dashboard</a></p>

</article>


<article class="trip-card">

<h3>Draft Toronto Building Permits Tracker</h3>

<p>This is an experimental mapping of City of Toronto Open Data on building permits.

The source data is: 


<a href="https://open.toronto.ca/dataset/building-permits-active-permits/ ">https://open.toronto.ca/dataset/building-permits-active-permits/</a>
and
<a href="https://open.toronto.ca/dataset/building-permits-cleared-permits/">https://open.toronto.ca/dataset/building-permits-cleared-permits/</a>


Locations were derived from: 

<a href="https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/">https://open.toronto.ca/dataset/address-points-municipal-toronto-one-address-repository/</a>



This data is complex, and significant validation is still required to address duplicate entries.

A major challenge is that entries for fields like PROPOSED_USE are not standardised. The same type of use may have many variant entries such as Residential Apartment vs Residential - Apartment Building. This makes categorisation based on type of property complex. This was not attempted in this map.

Instead, this mapping focuses on the units_created and units_lost field and categorises development based on the number of net new units. Note that condos and townhouse developments will appear as entries with a value of 1 net unit, but may be part of intensive developments and not single family home developments.

Source code available at <a href="https://github.com/Colm51/HousingPermitMap"  target="_blank" rel="noopener noreferrer">GitHub</a>.

</p>

  

<p><a class="project-link" href="https://colm51.github.io/HousingPermitMap/" target="_blank" rel="noopener noreferrer">Open Toronto Permits Mapping</a></p>

</article>




  <p class="dashboard-note">  Note on dashboards: </p>
  <ul class="dashboard-list">
    <li>
    I have generally made these with Streamlit. This is a good open-source choice for making basic dashboards that can be shared. Unlike other programmes such as Tableau or PowerBi, there is no need to work around complex licensing requirements. 
    </li>

    <li>
    However, Streamlit does not create dashboards that are optimized for phones. I am exploring ways to make the dashboards work better on mobile, starting with the Books Dashboard, but the combination of streamlit's lack of strong design features and the behaviour of browsers such as Safari means the user experience of my dashboards on mobile is not as good as on a laptop. 
    </li>

    <li>
    If using safari on an iPhone, one setting that will dramatically improve the experience is turning off "Landscape bar tab" in settings>Apps>Safari>Tabs. 
    </li>

  </ul>

  <p class="dashboard-note">     Note on mapping: </p>
  <ul class="dashboard-list">
    <li>
    My projects generally walk-through performing geo-spatial analysis in python. Mapping files come in various formats, including .shp and .gpkg - these files don't require any particular software to use. The most common ways to use such files is either through desktop GIS software such as ArcGis or QGis, or through python, using various libraries.  
    </li>

    <li>
    In general, my walk-throughts yield .gpkg or .geojson files that can be viewed in desktop GIS such as QGis or using python. I haven't included tutorials on how to do this exactly, but users will need to decide how to actually view the files!
    </li>

    <li>
    In terms of the maps embedded on this website, python and leaflet are used.
    </li>

  </ul>


  </div>
</section>
