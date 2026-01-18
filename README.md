# What Do I Watch?

A Django + React web application for discovering movies and generating personalized recommendations using the **TMDB** and **Watchmode** APIs. Features a modern, glassmorphic UI with movie poster modals and streaming source information.

---

## Features

- **📺 Browse by Genre & Time Period** – Filter movies by genre and release date (this month, decade, century, classic eras)
- **🔍 Smart Search** – Search TMDB's database with autocomplete suggestions
- **❤️ Liked Movies Selection** – Select up to 10 movies you've enjoyed to power recommendations
- **🎬 Personalized Recommendations** – Get tailored movie suggestions based on your selections
- **📊 Rich Movie Details** – View cast, IMDB ratings, and where to stream via Watchmode integration
- **🎨 Modern Glassmorphic UI** – Translucent cards, smooth animations, and responsive design
- **📱 Mobile-Friendly** – Fully responsive layout for desktop and mobile

---

## Tech Stack

| Layer       | Technology                          |
|-------------|-------------------------------------|
| Backend     | Django 4.2 (Python)                 |
| Frontend    | React 17 (JSX via Babel)            |
| Database    | SQLite (default)                    |
| APIs        | TMDB API, Watchmode API             |
| Styling     | Vanilla CSS (glassmorphism design)  |
| Build Tools | Babel (optional pre-compilation)    |

---

## Project Structure

```
Whatdoiwatch/
├── manage.py                 # Django management script
├── requirements.txt          # Python dependencies
├── package.json              # Node.js/Babel config for JSX compilation
├── db.sqlite3                # SQLite database
│
├── whatdoiwatch/             # Django project settings
│   ├── settings.py           # Configuration (incl. API keys)
│   ├── urls.py               # Root URL routing
│   ├── wsgi.py / asgi.py     # WSGI/ASGI entry points
│   └── __init__.py
│
└── watch/                    # Main Django app
    ├── views.py              # API endpoints & page rendering
    ├── urls.py               # App-level URL patterns
    ├── utils.py              # Helper functions (date ranges, Watchmode API)
    ├── models.py             # Database models (unused currently)
    ├── admin.py              # Admin configuration
    ├── apps.py               # App config
    ├── tests.py              # Test stubs
    │
    ├── templates/watch/
    │   └── index.html        # Main HTML template (loads React)
    │
    └── static/watch/
        ├── app.jsx           # React components (main app logic)
        ├── app.js            # Compiled JS (from Babel)
        └── styles.css        # CSS styles (glassmorphism theme)
```

---

## API Endpoints

| Endpoint                | Method | Description                                    |
|-------------------------|--------|------------------------------------------------|
| `/`                     | GET    | Serves the main React application              |
| `/api/genres/`          | GET    | Returns list of movie genres from TMDB         |
| `/api/movies/`          | GET    | Discover movies by genre/time (returns top 5)  |
| `/api/search/?query=`   | GET    | Search movies by title (returns top 10)        |
| `/api/recommendations/` | GET    | Get recommendations based on selected movies   |

**Query Parameters for `/api/recommendations/`:**
- `ids` – Comma-separated TMDB movie IDs (from liked movies)
- `genre` – Genre ID to filter by
- `time` – Time period (`this_month`, `this_year`, `this_decade`, `last_decade`, `this_century`, `old`, `ancient`)

---

## Setup

### Prerequisites

- Python 3.9+
- Node.js 16+ (optional, for Babel compilation)
- TMDB API key ([get one here](https://www.themoviedb.org/settings/api))
- Watchmode API key ([get one here](https://api.watchmode.com/)) – optional but recommended

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/Whatdoiwatch.git
   cd Whatdoiwatch
   ```

2. **Create and activate a virtual environment**
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Python dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables**
   
   Create a `.env` file in the root directory (same level as `manage.py`) and add your keys:
   ```bash
   TMDB_API_KEY=your_tmdb_api_key_here
   WATCHMODE_API_KEY=your_watchmode_api_key_here
   SECRET_KEY=your_django_secret_key
   DEBUG=True
   ALLOWED_HOSTS=localhost,127.0.0.1
   ```

5. **Run database migrations**
   ```bash
   python manage.py migrate
   ```

6. **Start the development server**
   ```bash
   python manage.py runserver
   ```

7. **Open the app** – Navigate to [http://localhost:8000/](http://localhost:8000/)

### Optional: Build JSX with Babel

The app uses in-browser Babel transformation by default. For production or faster loading:

```bash
npm install
npm run build
```

Then update `index.html` to load `app.js` instead of `app.jsx`.

---

## Usage

1. **Select a Genre** – Choose from any of TMDB's movie genres
2. **Pick a Time Period** – Filter by release date range
3. **Add Liked Movies** – Search and select up to 10 movies you've enjoyed
4. **Get Recommendations** – Click the button to receive 5 personalized suggestions
5. **View Details** – Click any movie poster to see:
   - Full plot overview
   - Release date
   - IMDB rating (if available)
   - Cast information
   - Streaming sources (via Watchmode)

---

## Configuration

### Environment Variables (Recommended for Production)

Instead of hardcoding API keys in `settings.py`, use environment variables:

```python
import os

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
WATCHMODE_API_KEY = os.environ.get("WATCHMODE_API_KEY", "")
```

### Time Period Categories

The `utils.py` file defines the following time period filters:

| Category       | Date Range         |
|----------------|--------------------|
| `this_month`   | Current month      |
| `this_year`    | Current year       |
| `this_decade`  | 2020 – Present     |
| `last_decade`  | 2010 – 2019        |
| `this_century` | 2000 – Present     |
| `old`          | 1980 – 1999        |
| `ancient`      | Before 1980        |

---

## License

ISC

---

## Acknowledgments

- [TMDB](https://www.themoviedb.org/) – Movie data and images
- [Watchmode](https://www.watchmode.com/) – Streaming availability data
- [React](https://reactjs.org/) – UI library
- [Django](https://www.djangoproject.com/) – Backend framework
