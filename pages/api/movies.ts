import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDateRange, getWatchmodeData } from '../../lib/movies';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { genre, time } = req.query;
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Missing TMDB API key' });
    return;
  }
  const { start, end } = getDateRange(typeof time === 'string' ? time : '');
  try {
    const discover = await axios.get('https://api.themoviedb.org/3/discover/movie', {
      params: {
        api_key: apiKey,
        with_genres: genre,
        sort_by: 'popularity.desc',
        'primary_release_date.gte': start,
        'primary_release_date.lte': end,
      },
    });
    const movies = discover.data.results.slice(0, 5);
    const results = await Promise.all(
      movies.map(async (m: any) => {
        const details = await axios.get(`https://api.themoviedb.org/3/movie/${m.id}`, {
          params: { api_key: apiKey, append_to_response: 'credits' },
        });
        const cast = details.data.credits.cast.slice(0, 5).map((c: any) => c.name);
        const watch = await getWatchmodeData(m.id);
        return {
          id: m.id,
          title: m.title,
          overview: m.overview,
          release_date: m.release_date,
          poster: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : '',
          cast,
          imdb_rating: watch?.imdb_rating,
          streaming_sources: watch?.sources || [],
        };
      })
    );
    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch movies' });
  }
}
