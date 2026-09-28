---
title: Charge Duration
date: 2026-09-28
updated: 2026-09-28
summary: A personal iPhone app that records battery levels and estimates how long a charge lasts.
description: A personal iPhone app that records battery levels over time and estimates the duration of a phone charge.
layout: layouts/base.njk
permalink: /projects/charge-duration/index.html
isProjects: true
tags:
  - projects
---
<section class="opening" aria-labelledby="page-title">
  <div class="measure">
    <p class="kicker">Personal utility app</p>
    <h1 id="page-title">Phone Battery Charge Duration</h1>
    <p class="lede">An iPhone app that records battery levels over time and estimates how long a charge will last based on current usage.</p>
  </div>
</section>

<article class="essay measure">
  <p><a class="project-link" href="https://github.com/Colm51/BatteryApp" target="_blank" rel="noopener noreferrer">View the source repository on GitHub</a></p>

  <h2>The problem</h2>
  <p>Apple’s battery information emphasizes recent activity and comparisons with other days. I wanted a simple estimate, in hours, of how long a full charge would last and how much time remained based on my current phone use.</p>

  <section class="project-section" aria-labelledby="measurements-title">
    <h2 id="measurements-title">Measurements</h2>
    <p>For the clearest result, charge the phone to 100% and start a measurement. The app records the starting time and battery percentage, then records another reading whenever it becomes active. It also responds to battery-level and charging-state changes while running.</p>
    <p>A measurement can begin below 100%. While it runs, the app shows the current battery level, elapsed time, and the percentage points consumed since the start.</p>
  </section>

  <section class="project-section" aria-labelledby="estimate-title">
    <h2 id="estimate-title">How the estimate works</h2>
    <p>Battery use is the starting percentage minus the current percentage. The estimated full duration is elapsed time divided by the fraction of the battery consumed. For example, using 20% in two hours produces a full-duration estimate of 10 hours. The same measured rate is used to estimate the time remaining at the current battery level.</p>
    <p>Estimates appear after at least 10 percentage points have been consumed. Waiting for more battery use generally produces a more representative result.</p>
  </section>

  <section class="project-section" aria-labelledby="history-title">
    <h2 id="history-title">Saved history</h2>
    <p>Ending a measurement saves its starting and ending levels, measured time, battery use, and full-duration estimate in History. The app can also end the current measurement and immediately start another. Saved items can be deleted by touching and holding them.</p>
  </section>

  <section class="project-section" aria-labelledby="limitations-title">
    <h2 id="limitations-title">iOS limitations</h2>
    <p>iOS does not let the app monitor the battery continuously in the background or access detailed battery-health data. The app works with the battery percentage and charging state supplied by iOS, so it must be opened to record a fresh reading after time in the background. A real battery reading is also unavailable in the iOS Simulator.</p>
    <p>The result is an estimate, not a prediction guaranteed by iOS. It assumes future use will resemble use during the measurement. Screen brightness, apps, signal strength, temperature, battery health, and recharging during a measurement can all change the result.</p>
  </section>

  <section class="project-section" aria-labelledby="privacy-title">
    <h2 id="privacy-title">Privacy and storage</h2>
    <p>Measurements are stored as a file in the app’s private local storage. The app has no accounts, analytics, advertising, cloud synchronization, external services, or network features.</p>
  </section>

  <section class="project-section" aria-labelledby="screenshots-title">
    <h2 id="screenshots-title">Screenshots</h2>
    <div class="app-screenshot-grid">
      <figure>
        <img src="{{ '/projects/charge-duration/images/IMG_5664.jpg' | htmlBaseUrl }}" alt="Charge Duration showing a newly started measurement at 100 percent battery" width="1206" height="2458" loading="lazy">
        <figcaption>A new measurement before enough battery has been consumed to calculate an estimate.</figcaption>
      </figure>
      <figure>
        <img src="{{ '/projects/charge-duration/images/IMG_5665.jpg' | htmlBaseUrl }}" alt="Charge Duration showing a saved measurement in History" width="1206" height="2475" loading="lazy">
        <figcaption>A completed measurement saved in History with its elapsed time, battery use, and full-duration estimate.</figcaption>
      </figure>
    </div>
  </section>
</article>
