# What Do I Watch?

A Django web application for finding movies and generating recommendations using the TMDB and Watchmode APIs. The landing page is now powered by a lightweight React interface rendered in the browser, providing a modern, translucent look and a movie-poster modal experience.

## Setup

1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
2. Configure API keys in `whatdoiwatch/settings.py`.
3. Run database migrations (uses SQLite by default):
   ```bash
   python manage.py migrate
   ```
4. Start the development server:
   ```bash
   python manage.py runserver
   ```
5. Open [http://localhost:8000/](http://localhost:8000/) in a browser to use the site.

## Features

- Browse movies by genre and release time range
- Search movies and select up to 10 titles
- Receive tailored recommendations
- Responsive design for desktop and mobile

Replace the placeholder API keys in settings before deploying. No Node build step is required; the React code is compiled in the browser.
