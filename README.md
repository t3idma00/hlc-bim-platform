# HLC BIM Platform

Interactive Building Modeling and Heat Load Analysis System

## Overview

The HLC BIM Platform is a web-based application developed as part of a thesis project. It integrates building design, visualization, and HVAC heat load analysis into a single system.

The platform allows users to:

- Input building survey data through an intuitive interface
- Visualize the building layout in a 2D plan view
- Generate a real-time 3D model of the building
- Calculate cooling load requirements using a heat load engine

This approach combines engineering calculations with interactive visualization, improving both usability and understanding.

## Project Objective

The main goal of this project is to develop a system that:

- Simplifies building data input and visualization
- Provides accurate heat load calculations
- Connects design and analysis in real time
- Reduces manual calculations and fragmented workflows in HVAC design

## System Workflow

The system follows a structured data-driven pipeline:

`User Input -> JSON Data Model -> 2D Plan -> 3D Model -> Heat Load Calculation`

- User enters building details such as room size, walls, windows, and other survey data
- Data is stored in a structured format
- The 2D canvas renders the plan view
- The 3D module generates a spatial model
- The heat load engine computes cooling requirements

All modules operate using a shared data model to ensure consistency.

## System Architecture

The platform is built using a feature-based modular architecture, allowing independent development of each subsystem:

- Heat Load Module: performs HVAC calculations
- Building Survey Module: handles user input
- BIM Model Module: manages 2D and 3D visualization



## Project Structure

```text
hlc-bim-platform/
|-- public/
|   |-- icons/
|   |-- models/
|   `-- textures/
|-- src/
|   |-- actions/
|   |-- app/
|   |-- components/
|   |-- data/
|   |-- features/
|   |-- hooks/
|   |-- lib/
|   |-- store/
|   |-- types/
|   `-- utils/
|-- middleware.ts
|-- next.config.ts
`-- package.json
```

## Measurement System

The platform uses a consistent unit system:



## Key Features

- Interactive 2D plan workspace with grid and rulers
- Real-time 3D building visualization
- Structured building data input system
- Modular heat load calculation engine
- Clean and user-friendly interface

## Getting Started

Run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open:

`http://localhost:3000`

## Technologies Used

- Next.js
- React
- Three.js for 3D visualization
- Canvas API for 2D drawing

## Future Development

Planned improvements include:

- Multi-room and multi-floor support
- Advanced material-based heat calculations
- Exporting drawings and reports
- Improved 3D interaction and realism
- Backend integration for data storage

## Academic Context

This project is developed as part of a thesis in the field of Information Technology, focusing on:

- Web-based engineering tools
- Visualization systems
- HVAC analysis integration

## Summary

The HLC BIM Platform aims to bridge the gap between building design and HVAC analysis, providing a unified, interactive, and efficient solution for both learning and practical applications.
