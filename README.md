# What Do I Watch? (Django)

A Django web application for finding movies and generating recommendations using the TMDB and Watchmode APIs. The interface is responsive for desktop and mobile and styled with a minimal streaming-site aesthetic.

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

## Features

- Browse movies by genre and release time range
- Search movies and select up to 10 titles
- Receive tailored recommendations
- Responsive design for desktop and mobile

Replace the placeholder API keys in settings before deploying.
