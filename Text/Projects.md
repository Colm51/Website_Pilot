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
    <p class="lede">Civic tech</p>
  </div>
</section>

<section class="essay measure" aria-labelledby="projects-title">
  <h2 id="projects-title">Projects</h2>
  <div class="trip-list">
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

  </div>
</section>
