"use strict";

function _toConsumableArray(r) { return _arrayWithoutHoles(r) || _iterableToArray(r) || _unsupportedIterableToArray(r) || _nonIterableSpread(); }
function _nonIterableSpread() { throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _iterableToArray(r) { if ("undefined" != typeof Symbol && null != r[Symbol.iterator] || null != r["@@iterator"]) return Array.from(r); }
function _arrayWithoutHoles(r) { if (Array.isArray(r)) return _arrayLikeToArray(r); }
function _slicedToArray(r, e) { return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest(); }
function _nonIterableRest() { throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method."); }
function _unsupportedIterableToArray(r, a) { if (r) { if ("string" == typeof r) return _arrayLikeToArray(r, a); var t = {}.toString.call(r).slice(8, -1); return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0; } }
function _arrayLikeToArray(r, a) { (null == a || a > r.length) && (a = r.length); for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e]; return n; }
function _iterableToArrayLimit(r, l) { var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"]; if (null != t) { var e, n, i, u, a = [], f = !0, o = !1; try { if (i = (t = t.call(r)).next, 0 === l) { if (Object(t) !== t) return; f = !1; } else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = !0); } catch (r) { o = !0, n = r; } finally { try { if (!f && null != t["return"] && (u = t["return"](), Object(u) !== u)) return; } finally { if (o) throw n; } } return a; } }
function _arrayWithHoles(r) { if (Array.isArray(r)) return r; }
var timeOptions = [{
  value: 'this_month',
  label: 'This Month'
}, {
  value: 'this_year',
  label: 'This Year'
}, {
  value: 'this_decade',
  label: 'This Decade'
}, {
  value: 'last_decade',
  label: 'Last Decade'
}, {
  value: 'this_century',
  label: 'This Century'
}, {
  value: 'old',
  label: 'Old (1980-1999)'
}, {
  value: 'ancient',
  label: 'Ancient (before 1980)'
}];
function ProgressBar() {
  return /*#__PURE__*/React.createElement("div", {
    className: "progress-container"
  }, /*#__PURE__*/React.createElement("div", {
    className: "progress-bar"
  }));
}
function Modal(_ref) {
  var movie = _ref.movie,
    onClose = _ref.onClose;
  if (!movie) return null;
  return /*#__PURE__*/React.createElement("div", {
    className: "modal-overlay",
    onClick: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-content",
    onClick: function onClick(e) {
      return e.stopPropagation();
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modal-details"
  }, /*#__PURE__*/React.createElement("h2", null, movie.title), /*#__PURE__*/React.createElement("p", null, movie.overview), /*#__PURE__*/React.createElement("p", {
    className: "small"
  }, "Release: ", movie.release_date), movie.imdb_rating && /*#__PURE__*/React.createElement("p", {
    className: "small"
  }, "IMDb: ", movie.imdb_rating), /*#__PURE__*/React.createElement("p", {
    className: "small"
  }, "Cast: ", movie.cast.join(', ')), movie.streaming_sources.length > 0 && /*#__PURE__*/React.createElement("p", {
    className: "small"
  }, "Sources: ", movie.streaming_sources.join(', '))), /*#__PURE__*/React.createElement("div", {
    className: "modal-poster"
  }, /*#__PURE__*/React.createElement("img", {
    src: movie.poster,
    alt: movie.title
  })))));
}
function App() {
  var _React$useState = React.useState([]),
    _React$useState2 = _slicedToArray(_React$useState, 2),
    genres = _React$useState2[0],
    setGenres = _React$useState2[1];
  var _React$useState3 = React.useState(''),
    _React$useState4 = _slicedToArray(_React$useState3, 2),
    genre = _React$useState4[0],
    setGenre = _React$useState4[1];
  var _React$useState5 = React.useState(''),
    _React$useState6 = _slicedToArray(_React$useState5, 2),
    time = _React$useState6[0],
    setTime = _React$useState6[1];
  var _React$useState7 = React.useState(''),
    _React$useState8 = _slicedToArray(_React$useState7, 2),
    query = _React$useState8[0],
    setQuery = _React$useState8[1];
  var _React$useState9 = React.useState([]),
    _React$useState0 = _slicedToArray(_React$useState9, 2),
    suggestions = _React$useState0[0],
    setSuggestions = _React$useState0[1];
  var _React$useState1 = React.useState([]),
    _React$useState10 = _slicedToArray(_React$useState1, 2),
    selected = _React$useState10[0],
    setSelected = _React$useState10[1];
  var _React$useState11 = React.useState([]),
    _React$useState12 = _slicedToArray(_React$useState11, 2),
    recommendations = _React$useState12[0],
    setRecommendations = _React$useState12[1];
  var _React$useState13 = React.useState(''),
    _React$useState14 = _slicedToArray(_React$useState13, 2),
    description = _React$useState14[0],
    setDescription = _React$useState14[1];
  var _React$useState15 = React.useState(false),
    _React$useState16 = _slicedToArray(_React$useState15, 2),
    loading = _React$useState16[0],
    setLoading = _React$useState16[1];
  var _React$useState17 = React.useState(null),
    _React$useState18 = _slicedToArray(_React$useState17, 2),
    modalMovie = _React$useState18[0],
    setModalMovie = _React$useState18[1];
  React.useEffect(function () {
    fetch('/api/genres/').then(function (res) {
      return res.json();
    }).then(setGenres);
  }, []);
  var searchMovies = function searchMovies(q) {
    setQuery(q);
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    fetch("/api/search/?query=".concat(encodeURIComponent(q))).then(function (res) {
      return res.json();
    }).then(setSuggestions);
  };
  var addMovie = function addMovie(m) {
    if (selected.find(function (x) {
      return x.id === m.id;
    }) || selected.length >= 10) return;
    setSelected([].concat(_toConsumableArray(selected), [m]));
    setQuery('');
    setSuggestions([]);
  };
  var removeSelected = function removeSelected(id) {
    setSelected(selected.filter(function (m) {
      return m.id !== id;
    }));
  };
  var getRecommendations = function getRecommendations() {
    var params = new URLSearchParams();
    if (selected.length) params.append('ids', selected.map(function (m) {
      return m.id;
    }).join(','));
    if (genre) params.append('genre', genre);
    if (time) params.append('time', time);
    setLoading(true);
    fetch("/api/recommendations/?".concat(params.toString())).then(function (res) {
      return res.json();
    }).then(function (data) {
      setRecommendations(data);
      var genreObj = genre ? genres.find(function (x) {
        return String(x.id) === String(genre);
      }) : null;
      var timeObj = time ? timeOptions.find(function (x) {
        return x.value === time;
      }) : null;
      var g = genreObj ? genreObj.name : null;
      var t = timeObj ? timeObj.label : null;
      var desc = 'Showing';
      if (g) desc += " ".concat(g);
      desc += ' movies';
      if (t) desc += " from ".concat(t.toLowerCase());
      if (selected.length) desc += " based on: ".concat(selected.map(function (m) {
        return m.title;
      }).join(', '));
      desc += '.';
      setDescription(desc);
    })["finally"](function () {
      return setLoading(false);
    });
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "app-wrapper"
  }, loading && /*#__PURE__*/React.createElement(ProgressBar, null), /*#__PURE__*/React.createElement("h1", {
    className: "text-center"
  }, "What Do I Watch?"), /*#__PURE__*/React.createElement("div", {
    className: "controls glass-card"
  }, /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Genre"), /*#__PURE__*/React.createElement("select", {
    value: genre,
    onChange: function onChange(e) {
      return setGenre(e.target.value);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Any Genre"), genres.map(function (g) {
    return /*#__PURE__*/React.createElement("option", {
      key: g.id,
      value: g.id
    }, g.name);
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field"
  }, /*#__PURE__*/React.createElement("label", null, "Year"), /*#__PURE__*/React.createElement("select", {
    value: time,
    onChange: function onChange(e) {
      return setTime(e.target.value);
    }
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "Any Time"), timeOptions.map(function (opt) {
    return /*#__PURE__*/React.createElement("option", {
      key: opt.value,
      value: opt.value
    }, opt.label);
  }))), /*#__PURE__*/React.createElement("div", {
    className: "field position-relative"
  }, /*#__PURE__*/React.createElement("label", null, "Liked Movies"), /*#__PURE__*/React.createElement("input", {
    value: query,
    onChange: function onChange(e) {
      return searchMovies(e.target.value);
    },
    placeholder: "Search movies"
  }), suggestions.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "suggestions"
  }, suggestions.map(function (m) {
    var year = m.release_date ? m.release_date.slice(0, 4) : '';
    return /*#__PURE__*/React.createElement("button", {
      key: m.id,
      onClick: function onClick() {
        return addMovie({
          id: m.id,
          title: m.title
        });
      }
    }, m.title, " ", year && "(".concat(year, ")"));
  }))), /*#__PURE__*/React.createElement("div", {
    className: "selected"
  }, selected.map(function (m) {
    return /*#__PURE__*/React.createElement("span", {
      key: m.id,
      onClick: function onClick() {
        return removeSelected(m.id);
      }
    }, m.title);
  })), /*#__PURE__*/React.createElement("button", {
    className: "submit",
    onClick: getRecommendations
  }, "Get Recommendations")), description && /*#__PURE__*/React.createElement("div", {
    id: "description",
    className: "text-center"
  }, description), /*#__PURE__*/React.createElement("div", {
    className: "movies"
  }, recommendations.map(function (m) {
    return /*#__PURE__*/React.createElement("div", {
      key: m.id,
      className: "movie-card"
    }, /*#__PURE__*/React.createElement("img", {
      src: m.poster,
      alt: m.title,
      onClick: function onClick() {
        return setModalMovie(m);
      }
    }));
  })), /*#__PURE__*/React.createElement(Modal, {
    movie: modalMovie,
    onClose: function onClose() {
      return setModalMovie(null);
    }
  }));
}
ReactDOM.render(/*#__PURE__*/React.createElement(App, null), document.getElementById('root'));
