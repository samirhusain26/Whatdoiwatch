import { useEffect, useState } from 'react';
import MovieCard from '../components/MovieCard';

interface Movie {
  id: number;
  title: string;
  overview: string;
  release_date: string;
  poster: string;
  cast: string[];
  imdb_rating?: number;
  streaming_sources: string[];
}

const timeOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'this_decade', label: 'This Decade' },
  { value: 'last_decade', label: 'Last Decade' },
  { value: 'this_century', label: 'This Century' },
  { value: 'old', label: 'Old (1980-1999)' },
  { value: 'ancient', label: 'Ancient (before 1980)' },
];

export default function Home() {
  const [genres, setGenres] = useState<any[]>([]);
  const [genre, setGenre] = useState('');
  const [time, setTime] = useState('this_year');
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selected, setSelected] = useState<any[]>([]);
  const [recommendations, setRecommendations] = useState<Movie[]>([]);

  useEffect(() => {
    fetch('/api/genres').then(res => res.json()).then(setGenres);
  }, []);

  const findMovies = async () => {
    const res = await fetch(`/api/movies?genre=${genre}&time=${time}`);
    setMovies(await res.json());
  };

  const search = async (q: string) => {
    setQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
    setSearchResults(await res.json());
  };

  const addMovie = (movie: any) => {
    if (selected.find(m => m.id === movie.id) || selected.length >= 10) return;
    setSelected([...selected, movie]);
    setQuery('');
    setSearchResults([]);
  };

  const removeSelected = (id: number) => setSelected(selected.filter(m => m.id !== id));

  const getRecommendations = async () => {
    if (selected.length === 0) return;
    const ids = selected.map(m => m.id).join(',');
    const res = await fetch(`/api/recommendations?ids=${ids}&genre=${genre}&time=${time}`);
    setRecommendations(await res.json());
  };

  return (
    <div className="p-4 space-y-8">
      <h1 className="text-3xl font-bold">What Do I Watch?</h1>

      <section>
        <h2 className="text-xl mb-2">Browse Movies</h2>
        <div className="flex flex-wrap gap-4 mb-4">
          <select className="text-black p-2" value={genre} onChange={e => setGenre(e.target.value)}>
            <option value="">Select Genre</option>
            {genres.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
          <select className="text-black p-2" value={time} onChange={e => setTime(e.target.value)}>
            {timeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <button className="bg-green-600 px-4 py-2 rounded" onClick={findMovies}>Find Movies</button>
        </div>
        <div className="flex flex-wrap gap-4">
          {movies.map(m => <MovieCard key={m.id} {...m} />)}
        </div>
      </section>

      <section>
        <h2 className="text-xl mb-2">Recommendation Engine</h2>
        <div className="mb-2 relative">
          <input className="text-black p-2 w-64" value={query} onChange={e => search(e.target.value)} placeholder="Search movies" />
          {searchResults.length > 0 && (
            <div className="absolute bg-white text-black w-64 max-h-60 overflow-auto z-10">
              {searchResults.map(m => (
                <div key={m.id} className="p-2 hover:bg-gray-200 cursor-pointer" onClick={() => addMovie(m)}>
                  {m.title} ({m.release_date?.slice(0,4)})
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          {selected.map(m => (
            <span key={m.id} className="bg-blue-600 px-2 py-1 rounded-full cursor-pointer" onClick={() => removeSelected(m.id)}>
              {m.title}
            </span>
          ))}
        </div>
        <button className="bg-indigo-600 px-4 py-2 rounded" onClick={getRecommendations}>Get Recommendations</button>
        <div className="flex flex-wrap gap-4 mt-4">
          {recommendations.map(m => <MovieCard key={m.id} {...m} />)}
        </div>
      </section>
    </div>
  );
}
