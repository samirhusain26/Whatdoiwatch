import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { getDateRange, getWatchmodeData } from '../../lib/movies';
import { TMDB_API_KEY } from '../../lib/apiKeys';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { ids, genre, time } = req.query;
  if (!ids || typeof ids !== 'string') {
    res.status(400).json({ error: 'Missing ids' });
    return;
  }
  if (!TMDB_API_KEY) {
    res.status(500).json({ error: 'Missing TMDB API key' });
    return;
  }
  const idArray = ids.split(',');
  const candidates: any[] = [];
  try {
    for (const id of idArray) {
      const rec = await axios.get(`https://api.themoviedb.org/3/movie/${id}/recommendations`, {
        params: { api_key: TMDB_API_KEY },
      });
      candidates.push(...rec.data.results);
    }
    const unique = Array.from(new Map(candidates.map(m => [m.id, m])).values());
    const { start, end } = getDateRange(typeof time === 'string' ? time : '');
    const filtered = unique.filter(m => {
      const genreMatch = !genre || m.genre_ids.includes(parseInt(genre as string));
      const date = m.release_date;
      return (
        genreMatch &&
        (!start || date >= start) &&
        (!end || date <= end) &&
        !idArray.includes(String(m.id))
      );
    });
    const top = filtered.slice(0, 5);
    const results = await Promise.all(
      top.map(async (m: any) => {
        const details = await axios.get(`https://api.themoviedb.org/3/movie/${m.id}`, {
          params: { api_key: TMDB_API_KEY, append_to_response: 'credits' },
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
    res.status(500).json({ error: 'Failed to fetch recommendations' });
  }
}
