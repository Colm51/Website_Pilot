---
title: Ontario Municipalities and Census Divisions
date: 2026-09-12
updated: 2026-09-12
summary: Walk-through of cross-walking Stats Can Census Divisions with Ontario Municipalities using mapping
description: Walk-through of cross-walking Stats Can Census Divisions with Ontario Municipalities using mapping
layout: layouts/ontario-cd-project.njk
permalink: /projects/ontario-municipalities-census-divisions/index.html
isProjects: true
tags:
  - projects
---
This page provides a walk-through of cross-walking Stats Can Census Divisions with Ontario municipalities using mapping.

Python was used in order to generate reproducible code. Mostly complete python files are provided. Users will need to add local filepaths to these scripts. The code in these files has not been optimised from a programming perspective.

Note on using QGis:

QGis has a "Model Designer" tool that assists in making Gis transformations and processing more reproductible.

I have been exploring this, and as an example, assuming one has the boundary files for lower and single and upper tiers downloaded, as well as a boundary file for provincial boundaries, I devceloped a model file that will merge the municipal files, dissolve them on municipality, and clip to the boundaries of Ontario:


<a href="{{ '/projects/ontario-municipalities-census-divisions/QGis/Merge%20and%20Clip%20Municipal%20Boundaries.zip' | htmlBaseUrl }}" download>Download the QGIS model file</a>


This walk-through is intended to support others who wish to work through the same work-flow. However, to cut to the chase and see the results, scroll to the bottom of the page for maps and tables!

CAVEAT: use with caution - this is just a hobby project and all data should be validated independently


Overview of this approach to cross-walking municipalities to census divisons:
- the relation between CDs and municipal boundaries is nunaced. In general, CDs relate either to UT or ST municipalities. 
- however, there are major exceptions to this. For example, it is not true in the North - there CDs may include many STs and also non-municipal CSDs. 
- in the south there are also examples of seperated STs that fall within the CD that a UT also falls in. This creates a major tripping hazard for municipal analysis, as simply using CDs as proxies for UTs will badly mis-state data in cases where there are seperated municipalities
- open data municipal boundary files for UTs, LTs and STs were merged to create one layer
- open data FIR data was used to derive a cross-walk between UTs and LTs
- a list of seperated municipalities was sourced from the Association of Municipalities of Ontario website
- open data CD boundaries for Ontario were downloaded, and municipalities were assigned to the CD where most of of their geography is located
- an interactive map and tables, along with downloads are provided



*Note on using python:*

<em>
I use VS code and both run python scripts from the terminal as well as using Jupyter notebooks for exploratory analysis, validation etc prior to running python scripts

A requirements.txt is provided that can be used to load the required libraries in a virtual
environment

Note that a few extra steps are required to get a notebook to also work in a venv created in terminal
One approach is to "register" the venv, creating a jupyter kernal</em>

*pip install ipykernel*
*python -m ipykernel install --user --name uppertier-venv --display-name "Python (Uppertiers)"*
*municipal boundary files*




***Preparing Municipal Files and Data***

**First step: obtain Municipal boundary files**

Municipal boundary files are provided in two sets: one for single and lower tiers, another for upper tiers

<https://geohub.lio.gov.on.ca/datasets/municipal-boundary-lower-and-single-tier/explore?location=50.926000%2C-84.745000%2C4>

<https://geohub.lio.gov.on.ca/datasets/11be9127e6ae43c4850793a3a2ee943c_13/explore?location=50.926000%2C-84.745000%2C4>

One caution: On the Municipal Boundary – Upper Tier and District page, the standard “Shapefile” download was incomplete: it contained 59 records while the GeoHub table showed 98. 
The separate “Complete Shapefile” download contained the full dataset. 

**Second step - merge UT LT and ST boundaries and perform other cleanup**

Python script:

MergeBoundaryFiles.py

Output: ontario_municipal_boundaries_all.gpkg

Note: output files are generally not included as downloads,

This script:

- merges the two boundary files, creating one with UT, LT and ST municipal boundaries
- dissolves municipalities eliminating duplicate entries (i.e. ensure each municipality has just one entry)
- ignores non-municipal geographies such Regions
- standardizes the Assessment Code field to 4-character text, and restores missing leading 0s
- standardizes the name and tier fields

**Third step: remove extraneous elements extending into the water by clipping to land boundaries**

The municipal boundary files extend into the water. In order to create normal boundaries, it is possible to use a boundary file for the land border of Ontario and clip the municipal boundary file to this shape.

The boundary of Ontario can be obtained at: <https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21&utm>

This file includes all provinces: in order to extract just Ontario, a PRUID selection is required. This is discussed in more detail in the CSD project.

Python script:

ClipMunicipalBoundaries.py

Output: ontario_municipal_boundaries_land_clipped.gpkg

**Fourth step, Relating UTs and LTs**

This has some nuances. Merging the boundary files superimposes administrative boundaries - but municipalities falling with an UT geography aren't necessarily part of the UT.

The reason for this relates to separated cities
As laid out in the Ontario Municipal Act 309(1)
<https://www.ontario.ca/laws/statute/01m25/v35>

*“separated municipality” means a local municipality that is situated within a geographic county but does not form part of the county for municipal purposes.*

There is a list of 19 separated municipalities at 
<https://www.amo.on.ca/about-us/municipal-101/ontario-municipalities>

This information can be scraped from the AMO website and turned into a table.
I have not provided scraping code in this walk-through.
Alternatively, a table can be created manually

Output: separated_municipalities_AMO.csv


<p>Discussion: two approaches to matching UTs and LTs</p>

<ol>
  <li>
    <strong>Using the boundary files</strong>
    <ul>
      <li>
        While simply observing which municipalities fall within UTs doesnt provide a reliable way of associating upper and lower tiers, it is possible to use the boundary files creatively to construct a UT and LT list. 
      </li>
      <li>
        This is because the LT boundary files include an upper tier name as well where relevant. However, it does not provide the assessment code for the UT, which complicates matching.
        </li>
    </ul>
  </li>

  <li>
    <strong>Using FIR data</strong>
    <ul>
      <li>
        There is also another data-set that can be used to do this:
        <a href="https://efis.fma.csc.gov.on.ca/fir/MultiYearReport/MYCIndex.html">
  FIR Data By Year – .CSV Format
</a>
        
      </li>

      <li>
        This is a large dataset with multiple entries for each municipality corresponding to FIR entries
        It contains ASSESSMENT_CODE , TIER_CODE , which is UT, LT , ST
        It is possible to use this to derive a data set with the ASSESSMENT_CODE for each municipality, its tier, as well as the ASSESSMENT_CODE for its UT, where relevant
      </li>

      <li>
        However, not all municipalities complete FIRs each year, so its important to use a year showing 444 of 444 municipalities reporting such as 2021
      </li>

      <li>
        A simple table can be derived from this data with this python script:
        ExtractFIRdata.py
      </li>

      <li>
        Output: municipalities_data_2021.xlsx
      </li>
    </ul>
  </li>
</ol>



**Fifth step: Enrichening the boundary files with the additional UT and separated cities info**

*First - add a flag for seperated city to the FIR data*

The AMO website only yields names - and these naming conventions are different from those in the boundary files, so this matching needs to normalise the names, eg so that "Kingston C" matches "City of Kingston"

AddSeperatedCityFlag.py

output: municipalities_data_2021_with_separated.xlsx

*Second - add data to the boundary file*

EnrichenMapping.py

Output: ontario_municipal_boundaries_enriched.gpkg

Known issue: 5124 – Municipality of Gordon / Barrie Island is present in the municipal boundary dataset but did not match the 2021 FIR-derived municipal crosswalk. The final spatial dataset therefore has one municipality without FIR-derived enrichment fields.

**Sixth step: create a Seperated Cities Map**

To do this I just did a quick filter in QGis

Output: SeperatedCities.geojson

***Prepare Census Division files* and match to municipal files**

**Seventh step: download CDs**

<https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/boundary-limites/index2021-eng.cfm?year=21>


**Eighth step: extract Ontario**

ExtractOntarioCDs.py

Output: ontario_census_divisions.gpkg



**Ninth step: Use geospatial analysis to associate every municipality with a CD**

For every Ontario municipality, figure out which Census Division it belongs to, then build a table grouped by CD.
The approach used assigns every municipality to a CD based on which most of the area falls in
This is a strong rule, as analysis shows that all 444 municipalities are 95% or more in one CD by geography

Python script:

CreateCDTables.py

Output: CD_summary.xlsx and CD_municipality_crosswalk.xlsx
