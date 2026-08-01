---
title: Local Issue Reporter
description: An iPhone app for reporting local issues such as bike lane issues.
layout: layouts/base.njk
permalink: /projects/local-issue-reporter/index.html
isProjects: true
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Civic technology</p>
    <h1 id="page-title">Local Issue Reporter</h1>
    <p class="lede">An iPhone app for reporting local issues such as bike lane issues</p>
    <p class="lede">Explanation: I developed a Demo of a Free Phone App for Easily Reporting Local Issues, Including Bike
Lane Issues and Potholes. This is a prototype of an iPhone app that has been tested on a personal iPhone. The app is not currently in the App Store, and I have no plans to deploy it in the App Store. It utilizes Apple’s Swift programming language, along with python - does not require any expensive proprietary
software such as Arc Gis to implement.</p>
   <p class="lede">While the 311 service provides a fairly straight-forward way of reporting issues, many issues that
are observed by residents as they go about the City go unreported owing to friction associated
with an internet interface, the need to complete on-line forms, etc. Moreover, information as to the location of issues, as well as other details, may be recorded
inconsistently. A simple phone app that allows residents to submit reports, along with location information with
a few clicks of buttons and using their phone’s camera would dramatically reduce the friction
associated with reporting issues and improve the accessibility of reporting.
   </p>

 <p class="lede">Alongside the phone app, python script has also been provided that integrates reports into a
map, providing a powerful visual tool for analyzing the geographical distribution of reported
issues alongside such other contextual geographical information such as ward boundaries and
the City’s bike network. Such mapping could easily be refined to support such geospatial analysis as hotspot analysis,
heat mapping, etc.
   </p>

  </div>
</section>

<article class="essay measure">
  <p><a href="https://github.com/Colm51/local-issue-reporter">View the source repository on GitHub</a></p>

  <section aria-labelledby="interactive-map-title">
    <h2 id="interactive-map-title">Interactive report map</h2>
    <iframe
      class="map-embed"
      src="{{ '/Maps/local-issue-reporter-map.html' | htmlBaseUrl }}"
      title="Local Issue Reporter interactive map"
      loading="lazy"
    ></iframe>
    <p><a href="{{ '/Maps/local-issue-reporter-map.html' | htmlBaseUrl }}">Open the map in a new page</a></p>
  </section>
</article>
