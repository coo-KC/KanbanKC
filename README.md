# KanbaKan

KanbaKan is a lightweight, free-of-cost kanban task tracking system for teams of 20 to 30 people. It is designed around a practical free-tier technology stack, using free database services and free deployment options so the platform can be started without a large budget. The goal is to offer an organization-friendly task management system with planning, deadlines, role management, warnings, notifications, and clear team visibility.

## Why KanbaKan

KanbaKan is built to give a simple but powerful project workflow for organizations that need a kanban board, calendars, user roles, and admin oversight without paying for premium software. This repository uses free services such as Firebase for authentication and messaging, MongoDB Atlas free-tier database provider, and Vercel + Render free deploy targets for the frontend and backend. Cron-job.org was configured to periodically ping the backend, preventing hibernation and cold starts after 15 minutes of inactivity.

The project is intentionally aimed at a small team size of around 20 to 30 users. It can be used as a friendly internal product workflow that runs without enterprise pricing.

## Project Structure

The repository is separated into three main areas:

- `frontend/` – The Vite + React + TypeScript single-page user interface.
- `backend/` – Express.js API, authentication middleware, route handlers, MongoDB models, and automated task logic.
- `shared/` – Shared frontend/backend constants and project assets.

### Frontend

The frontend is built with Vite, React, TypeScript, Tailwind styling, and Firebase integration. It contains the kanban board pages, organization dashboards, reports, planning and calendar views, settings, and admin screens.

### Backend

The backend is an Express server with Mongoose models, Firebase Admin authentication hooks, role-based route middleware, task APIs, event APIs, calendar/deadline automation, and notification logic.

### Shared

The shared folder keeps project-wide constants and shared package metadata that can be reused across frontend and backend services.

## Core Features

KanbaKan includes the following features:

- Individual and organization kanban boards
- Deadline calendar and event calendar
- Admin controls for managing users, tasks, organization structure, and visibility
- Warning and alert system from admin
- Notification and update messaging for activity changes
- Organization tree for team, department, and role visibility
- User roles and access flow for teams, admins, and members
- Project reporting and organization-level analytics

## User Roles

KanbaKan supports role-based usage through the backend and UI. Typical roles include admins, team members, and organization users with different permissions for task management, reports, settings, and system administration.

## Free Deployment and Database Model

This implementation is organized around low-cost or free deployment and database choices so that a team of 20 to 30 people can run a full task-tracking platform without paying for a commercial SaaS license. The project is set up to use free or free-tier database records and public deployment services while keeping the codebase open and extensible.

## Getting Started

1. Install the backend dependencies in `backend/`.
2. Install the frontend dependencies in `frontend/`.
3. Configure environment variables for MongoDB access, Firebase, and deployment URLs.
4. Run the backend server and start the Vite frontend.

## Production Theme

KanbaKan is presented as a clean, organization-focused, collaborative kanban and task management platform for planning, tracking, and reporting work in a transparent, visible project environment.
