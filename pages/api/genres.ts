import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { TMDB_API_KEY } from '../../lib/apiKeys';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const response = await axios.get('https://api.themoviedb.org/3/genre/movie/list', {
      params: { api_key: TMDB_API_KEY },
    });
    res.status(200).json(response.data.genres);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
}
