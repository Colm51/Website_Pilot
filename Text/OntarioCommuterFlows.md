---
title: Mapping Stats Can 2021 Commuter Flows Between CSDs
date: 2026-09-20
updated: 2026-09-20
summary: A walk-through and interactive map of 2021 Statistics Canada commuter flows between census subdivisions.
description: A walk-through, interactive map, and Python scripts for cleaning and mapping Statistics Canada commuter-flow data between census subdivisions.
layout: layouts/commuter-flows-project.njk
permalink: /projects/ontario-commuter-flows/index.html
isProjects: true
tags:
  - projects
---
Stats Can makes commuter flow data (home / work) between CSDs available. This project uses this data to create a map representing home / work commutes as lines, weighted by the relative count of commutes in the context of each individual CSD.

**Important note: this project only looks at commutes crossing CSDs boundaries. Commutes within a CSD are not considered, and the mapping does not show the relative share of within CSD commutes as compared to intra-CSD commutes. Such intra-CSD commutes are included in the Stats Can data, and are a significant factor that would need to be incorporated into any network analysis.**



<https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810045901>

This means that the data can be joined to CSD boundary files and mapped. 

MOVE MAP HERE

**Discussion**

Working with the tabular data on the website is inefficient, and while the data can be downloaded, it is very large, messy and requires cleaning. Also, it is not set up to easily support mapping. As an example, it uses a different convention for CSD IDs than is found with Stat Can's own CSD boundary files.

This walk-through discusses all stages of data retrieval, cleaning and joining to boundary files, and mapping.

Python code snippets are included for download. A requirements.txt is also provided to facilitate setting up a python environment.

This is also a useful project for exploring efficient ways of working with large datasets. The data format .parquet is used. This format is efficient and also preserves data types, unlike .csv.

During this project, data exploration was conducted in DuckDB, which is a SQL engine, and DBeaver, which is a database client. However, use of these programs is not essential - there are many ways of exploring large data-sets leveraging python, SQL, or other languages. 

An interactive map is provided. Note that this map is very busy! The best way to use it is to turn off the commuter flow layer initially, select the desired CSD, and then turn the commuter flow layer back on.
 Different home / work commute are represented by lines that are weighted by the count of commuters. 
 
 This data is based on 25% census data, so will be less reliable with small populations. In addiiton, flows are associated with representative points within each CSD, as opposed to actual home / work coordinates. This creates unavoidable issues with CSDs that are in the unincorporated areas. In these cases, actual commutes often involve trips to a fringe area just outside municipal boundaries - something it is not possible to capture with this data.

 Interestingly, First Nations reserves are also CSDs, so this data captures detailed commuting patterns in these cases. While data for small CSDs needs to be treated with caution owing to the 25% feature, the data does reveal the limitation of some studies of northern populations that assume residents commute mainly to the closest relatively large municipality.

Finally, commutes across the international border are not captured.

## Walk-through:

## Download Stats Can commuting data

GetData.py retrives this data from the Stats Can website.

The data file is large - over 26 million records, meaning it is too large to work in excel.

## Extract Ontario data (and Manitoba and Quebec)

The records include the CSD ID DGUID, which includes a provincial code (35 for Ontario, 24 for Quebec, 46 for Manitoba).

extract_provinces.py extracts the data for these 3 provinces. It also defines appropraite datatypes for key fields to avoid losing important information. Data is exported as .parquet.

Although the focus is on Ontario, Quebec and Manitoba are included because of cross-border commutes.

## Explore the data 

explore_commuting_parquet.py

## Clean data by removing entries with no commutes

A very large number of entries in this data-set actually have zero counts of commuters. Removing these significantly simplifies the data.

filter_nonzero_commuters.py
explore_commuting_nonzero.py

## Leverage the "Coordinates" field to derive CSDs for both home and work

The Stats Can data download includes DGUID for home, but not for work. This complicates mapping. However, it was observed that there is a "Coordinates" fields that takes the form of two numbers seperated by a period. Data exploration revealed that the numbers to the left of the period formed an ID for home, and the numbers to the right for work. Its not clear why this is the case - it appears to be a vestige of earlier Stats Can platforms. However, this turned out to be a key to unlocking the data-set, as by matching DGUIDS and Coordinates for home, it is also possible to derive DGUIDs for work as well, yielding a complete data-set.

Care needs to be taken with the format of this field when saving the .csv Stats Can data. As it is two number seperated by a period, it will get treated as a decimal, leading to loss of important trailing zeros unless it is explicitly cast as text. Because .csv does not include any defined data types, these are inferred by whatever program is used to open the .csv unless explciit data types are specified.

split_coordinates.py
DeriveDGUIDS.py

## Dowload a CSD boundary file for Ontario, Quebec and Manitoba

ExtractCSDs.py

## Derive CSD IDs from the DGUIDs

The CSD boundary files use a CSD ID that is the 7 left-most digits of DGUIS.

DeriveCSDUIDs.py


## Derive a boundary file with Ontario municipalities and CSDs

This step is discussed in the Cross-walk CSDs and Municipalities project

## Prepare files appropriate for on-line mapping

CreateWebMappingFiles.py

This script creates a commuter flows file. It also addresses one interesting issue: Stats Can defines very large CSDs for different unincorporated areas. In deriving a representative point for these CSDs, the script takes into consideration where municipalities are situated and avoids arbitrarily creating points in the middle of these extensive CSDs.

**Important note: commutes within a CSD (i.e. where home and work CSDs) are discarded. However, while this makes sense for this project, such intra-CSD commutes are significant for many purposes.**

simplify_web_boundaries.py
