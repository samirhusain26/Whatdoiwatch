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
let currentMovies = [];

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
  currentMovies = movies;
  const container = document.getElementById(id);
  container.innerHTML = movies.map((m, i) => movieCard(m, i)).join('');
  container.querySelectorAll('.movie-card').forEach(card => {
    card.addEventListener('click', () => showDetails(card.dataset.index));
  });
}

function movieCard(m, idx) {
  return `<div class="movie-card" data-index="${idx}"><img src="${m.poster}" alt="${m.title}"></div>`;
}

function showDetails(index) {
  const m = currentMovies[index];
  document.getElementById('modalTitle').textContent = m.title;
  document.getElementById('modalOverview').textContent = m.overview;
  document.getElementById('modalRelease').textContent = `Release: ${m.release_date}`;
  document.getElementById('modalRating').textContent = m.imdb_rating ? `IMDb: ${m.imdb_rating}` : '';
  document.getElementById('modalCast').textContent = `Cast: ${m.cast.join(', ')}`;

  document.getElementById('modalPoster').src = m.poster;
  const modal = new bootstrap.Modal(document.getElementById('movieModal'));
  modal.show();
}

async function searchMovies(q) {
  const sugg = document.getElementById('suggestions');
  if (q.length < 2) {
    sugg.innerHTML = '';
    return;
  }
  const res = await fetch(`/api/search/?query=${encodeURIComponent(q)}`);
  const data = await res.json();
  sugg.innerHTML = data
    .map(m => {
      const titleEsc = m.title.replace(/'/g, "\\'");
      const year = m.release_date ? m.release_date.slice(0, 4) : '';
      return `<button type="button" class="list-group-item list-group-item-action" onclick="addMovie(${m.id}, '${titleEsc}')">${m.title} (${year})</button>`;
    })
    .join('');
}

function addMovie(id, title) {
  if (selected.find(m => m.id === id) || selected.length >= 10) return;
  selected.push({ id, title });
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
  container.innerHTML = selected
    .map(m => `<span class="badge bg-primary me-1" onclick="removeSelected(${m.id})">${m.title}</span>`)
    .join('');
}

async function getRecommendations() {
  const ids = selected.map(m => m.id).join(',');
  const genre = document.getElementById('genre').value;
  const time = document.getElementById('time').value;
  const params = new URLSearchParams();
  if (ids) params.append('ids', ids);
  if (genre) params.append('genre', genre);
  if (time) params.append('time', time);
  const bar = document.getElementById('loading');
  bar.style.display = 'block';
  try {
    const res = await fetch(`/api/recommendations/?${params.toString()}`);
    const data = await res.json();
    renderMovies('recommendations', data);
    document.getElementById('description').textContent = buildDescription(genre, time, selected);
  } finally {
    bar.style.display = 'none';
  }
}

function buildDescription(genre, time, selected) {
  const g = genre ? genres.find(x => String(x.id) === String(genre))?.name : null;
  const t = time ? timeOptions.find(x => x.value === time)?.label : null;
  let desc = 'Showing';
  if (g) desc += ` ${g}`;
  desc += ' movies';
  if (t) desc += ` from ${t.toLowerCase()}`;
  if (selected.length) {
    desc += ` based on: ${selected.map(m => m.title).join(', ')}`;
  }
  return desc + '.';
}
