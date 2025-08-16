import axios from 'axios';

export function getDateRange(category: string) {
  const today = new Date();
  let start: Date;
  let end: Date;
  switch (category) {
    case 'this_month':
      start = new Date(today.getFullYear(), today.getMonth(), 1);
      end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      break;
    case 'this_year':
      start = new Date(today.getFullYear(), 0, 1);
      end = new Date(today.getFullYear(), 11, 31);
      break;
    case 'this_decade':
      start = new Date(2020, 0, 1);
      end = today;
      break;
    case 'last_decade':
      start = new Date(2010, 0, 1);
      end = new Date(2019, 11, 31);
      break;
    case 'this_century':
      start = new Date(2000, 0, 1);
      end = today;
      break;
    case 'old':
      start = new Date(1980, 0, 1);
      end = new Date(1999, 11, 31);
      break;
    case 'ancient':
      start = new Date(0, 0, 1);
      end = new Date(1979, 11, 31);
      break;
    default:
      start = new Date(0, 0, 1);
      end = today;
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export async function getWatchmodeData(tmdbId: number) {

  try {
    const search = await axios.get('https://api.watchmode.com/v1/search/', {
      params: { apiKey, search_field: 'tmdb_id', search_value: tmdbId },
    });
    if (!search.data.title_results || search.data.title_results.length === 0) {
      return null;
    }
    const wmId = search.data.title_results[0].id;
    const [details, sources] = await Promise.all([
      axios.get(`https://api.watchmode.com/v1/title/${wmId}/details/`, {
        params: { apiKey },
      }),
      axios.get(`https://api.watchmode.com/v1/title/${wmId}/sources/`, {
        params: { apiKey },
      }),
    ]);
    const streaming = sources.data
      .filter((s: any) => s.type === 'sub')
      .map((s: any) => s.name);
    return {
      imdb_rating: details.data.imdb_rating,
      sources: streaming,
    };
  } catch (e) {
    return null;
  }
}
