const timeOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'this_decade', label: 'This Decade' },
  { value: 'last_decade', label: 'Last Decade' },
  { value: 'this_century', label: 'This Century' },
  { value: 'old', label: 'Old (1980-1999)' },
  { value: 'ancient', label: 'Ancient (before 1980)' },
];

function ProgressBar() {
  return (
    <div className="progress-container">
      <div className="progress-bar"></div>
    </div>
  );
}

function Modal({ movie, onClose }) {
  if (!movie) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-body">
          <div className="modal-details">
            <h2>{movie.title}</h2>
            <p>{movie.overview}</p>
            <p className="small">Release: {movie.release_date}</p>
            {movie.imdb_rating && <p className="small">IMDb: {movie.imdb_rating}</p>}
            <p className="small">Cast: {movie.cast.join(', ')}</p>
            {movie.streaming_sources.length > 0 && (
              <p className="small">Sources: {movie.streaming_sources.join(', ')}</p>
            )}
          </div>
          <div className="modal-poster">
            <img src={movie.poster} alt={movie.title} />
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [genres, setGenres] = React.useState([]);
  const [genre, setGenre] = React.useState('');
  const [time, setTime] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [suggestions, setSuggestions] = React.useState([]);
  const [selected, setSelected] = React.useState([]);
  const [recommendations, setRecommendations] = React.useState([]);
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [modalMovie, setModalMovie] = React.useState(null);

  React.useEffect(() => {
    fetch('/api/genres/').then(res => res.json()).then(setGenres);
  }, []);

  const searchMovies = q => {
    setQuery(q);
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    fetch(`/api/search/?query=${encodeURIComponent(q)}`)
      .then(res => res.json())
      .then(setSuggestions);
  };

  const addMovie = m => {
    if (selected.find(x => x.id === m.id) || selected.length >= 10) return;
    setSelected([...selected, m]);
    setQuery('');
    setSuggestions([]);
  };

  const removeSelected = id => {
    setSelected(selected.filter(m => m.id !== id));
  };

  const getRecommendations = () => {


    const params = new URLSearchParams();
    if (selected.length) params.append('ids', selected.map(m => m.id).join(','));
    if (genre) params.append('genre', genre);
    if (time) params.append('time', time);
    setLoading(true);

    fetch(`/api/recommendations/?${params.toString()}`)
      .then(res => res.json())
      .then(data => {
        setRecommendations(data);
        const genreObj = genre ? genres.find(x => String(x.id) === String(genre)) : null;
        const timeObj = time ? timeOptions.find(x => x.value === time) : null;
        const g = genreObj ? genreObj.name : null;
        const t = timeObj ? timeObj.label : null;
        let desc = 'Showing';
        if (g) desc += ` ${g}`;
        desc += ' movies';
        if (t) desc += ` from ${t.toLowerCase()}`;
        if (selected.length) desc += ` based on: ${selected.map(m => m.title).join(', ')}`;
        desc += '.';
        setDescription(desc);
      })
      .finally(() => setLoading(false));

  };

  return (
    <div className="app-wrapper">
      {loading && <ProgressBar />}
      <h1 className="text-center">What Do I Watch?</h1>
      <div className="controls glass-card">
        <div className="field">
          <label>Genre</label>
          <select value={genre} onChange={e => setGenre(e.target.value)}>
            <option value="">Any Genre</option>
            {genres.map(g => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Year</label>
          <select value={time} onChange={e => setTime(e.target.value)}>
            <option value="">Any Time</option>
            {timeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="field position-relative">
          <label>Liked Movies</label>
          <input value={query} onChange={e => searchMovies(e.target.value)} placeholder="Search movies" />
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map(m => {
                const year = m.release_date ? m.release_date.slice(0, 4) : '';
                return (
                  <button key={m.id} onClick={() => addMovie({ id: m.id, title: m.title })}>
                    {m.title} {year && `(${year})`}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="selected">
          {selected.map(m => (
            <span key={m.id} onClick={() => removeSelected(m.id)}>{m.title}</span>
          ))}
        </div>
        <button className="submit" onClick={getRecommendations}>Get Recommendations</button>
      </div>
      {description && <div id="description" className="text-center">{description}</div>}
      <div className="movies">
        {recommendations.map(m => (
          <div key={m.id} className="movie-card">
            <img src={m.poster} alt={m.title} onClick={() => setModalMovie(m)} />
          </div>
        ))}
      </div>
      <Modal movie={modalMovie} onClose={() => setModalMovie(null)} />
    </div>
  );
}


document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(<App />, document.getElementById('root'));
});

ReactDOM.render(<App />, document.getElementById('root'));

