import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { TMDB_API_KEY } from '../../lib/apiKeys';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query } = req.query;
  if (!query || typeof query !== 'string') {
    res.status(400).json({ error: 'Missing query' });
    return;
  }
  if (!TMDB_API_KEY) {
    res.status(500).json({ error: 'Missing TMDB API key' });
    return;
  }
  try {
    const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
      params: { api_key: TMDB_API_KEY, query },
    });
    const results = response.data.results.slice(0, 10).map((m: any) => ({
      id: m.id,
      title: m.title,
      release_date: m.release_date,
    }));
    res.status(200).json(results);
  } catch (e) {
    res.status(500).json({ error: 'Search failed' });
  }
}
