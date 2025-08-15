# What Do I Watch?

A Next.js application that helps users discover movies and get personalized recommendations.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env.local` based on `.env.example` and provide your API keys:
   ```
   TMDB_API_KEY=your_tmdb_key
   WATCHMODE_API_KEY=your_watchmode_key
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```

## Features
- Filter movies by genre and release timeframe (this month, this year, this decade, last decade, this century, old, ancient).
- Display posters, synopsis, cast, release date, IMDb rating, and streaming platforms.
- Select up to 10 favorite movies and receive 5 similar recommendations that respect the chosen genre and timeframe.
- Responsive UI styled with Tailwind CSS.

## Testing
Build the project to ensure TypeScript and Next.js compile:
```bash
npm test
```
