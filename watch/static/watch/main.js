const timeOptions = [
  { value: 'this_month', label: 'This Month' },
  { value: 'this_year', label: 'This Year' },
  { value: 'this_decade', label: 'This Decade' },
  { value: 'last_decade', label: 'Last Decade' },
  { value: 'this_century', label: 'This Century' },
  { value: 'old', label: 'Old (1980-1999)' },
  { value: 'ancient', label: 'Ancient (before 1980)' },
];

let genres = [];
let selected = [];

async function init() {
  const genreSelect = document.getElementById('genre');
  const timeSelect = document.getElementById('time');
  timeOptions.forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value;
    option.textContent = opt.label;
    timeSelect.appendChild(option);
  });
  const res = await fetch('/api/genres/');
  genres = await res.json();
  genres.forEach(g => {
    const option = document.createElement('option');
    option.value = g.id;
    option.textContent = g.name;
    genreSelect.appendChild(option);
  });
}

document.addEventListener('DOMContentLoaded', init);

function renderMovies(id, movies) {
  const container = document.getElementById(id);
  container.innerHTML = movies.map(m => movieCard(m)).join('');
}

function movieCard(m) {
  const sources = m.streaming_sources && m.streaming_sources.length ? `<p class="small">Available on: ${m.streaming_sources.join(', ')}</p>` : '';
  const rating = m.imdb_rating ? `<p class="small">IMDb: ${m.imdb_rating}</p>` : '';
  return `<div class="movie-card"><img src="${m.poster}" alt="${m.title}"><div class="info"><h3>${m.title}</h3><p>${m.overview}</p><p class="small">Release: ${m.release_date}</p>${rating}<p class="small">Cast: ${m.cast.join(', ')}</p>${sources}</div></div>`;
}

async function findMovies() {
  const genre = document.getElementById('genre').value;
  const time = document.getElementById('time').value;
  const res = await fetch(`/api/movies/?genre=${genre}&time=${time}`);
  const data = await res.json();
  renderMovies('movies', data);
}

async function searchMovies(q) {
  const sugg = document.getElementById('suggestions');
  if (q.length < 2) {
    sugg.innerHTML = '';
    return;
  }
  const res = await fetch(`/api/search/?query=${encodeURIComponent(q)}`);
  const data = await res.json();
  sugg.innerHTML = data.map(m => `<div onclick="addMovie(${m.id}, '${m.title.replace(/'/g, "\'")}')">${m.title} (${m.release_date?.slice(0,4) || ''})</div>`).join('');
}

function addMovie(id, title) {
  if (selected.find(m => m.id === id) || selected.length >= 10) return;
  selected.push({id, title});
  document.getElementById('query').value = '';
  document.getElementById('suggestions').innerHTML = '';
  renderSelected();
}

function removeSelected(id) {
  selected = selected.filter(m => m.id !== id);
  renderSelected();
}

function renderSelected() {
  const container = document.getElementById('selected');
  container.innerHTML = selected.map(m => `<span onclick="removeSelected(${m.id})">${m.title}</span>`).join('');
}

async function getRecommendations() {
  if (selected.length === 0) return;
  const ids = selected.map(m => m.id).join(',');
  const genre = document.getElementById('genre').value;
  const time = document.getElementById('time').value;
  const res = await fetch(`/api/recommendations/?ids=${ids}&genre=${genre}&time=${time}`);
  const data = await res.json();
  renderMovies('recommendations', data);
}
