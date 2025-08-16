import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

    res.status(500).json({ error: 'Missing TMDB API key' });
    return;
  }
  try {
    const response = await axios.get('https://api.themoviedb.org/3/genre/movie/list', {

    });
    res.status(200).json(response.data.genres);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
}
