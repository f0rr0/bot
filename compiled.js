'use strict';

var _ramda = require('ramda');

var _ramda2 = _interopRequireDefault(_ramda);

var _http = require('http');

var _http2 = _interopRequireDefault(_http);

var _moment = require('moment');

var _moment2 = _interopRequireDefault(_moment);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var queryStr = "http://ws.audioscrobbler.com/2.0/?api_key=a3123e138236b93c22e6dafa83e355b0&method=user.getRecentTracks&user=sidjain26&format=json&limit=5";

var getKey = function getKey() {
    for (var _len = arguments.length, path = Array(_len), _key = 0; _key < _len; _key++) {
        path[_key] = arguments[_key];
    }

    var levels = _ramda2.default.map(function (level) {
        return _ramda2.default.prop(level);
    }, _ramda2.default.reverse(path));
    return _ramda2.default.path([].concat(path));
};

var uniques = function uniques(array) {
    return Array.from(new Set(array));
};
var getTracks = getKey("recenttracks", "track");
var trackInfo = function trackInfo(track) {
    var title = getKey("name")(track) + " - " + getKey("artist", "#text")(track);
    var epoch = _ramda2.default.path(["date", "uts"], track) ? parseInt(getKey("date", "uts")(track)) : undefined;
    var timestamp = epoch ? " [" + _moment2.default.unix(epoch).fromNow() + "]" : "";
    var active = _ramda2.default.path(["@attr", "nowplaying"], track) ? " [playing]" : "";
    return '' + title + timestamp + active;
};
var logTitles = _ramda2.default.compose(console.log, trackInfo);
var uniqueTitles = _ramda2.default.compose(_ramda2.default.indexBy(getKey("name")), getTracks);
var groupByTitle = _ramda2.default.groupBy(function (track) {
    var title = getKey("name")(track) + getKey("artist", "#text")(track);
    return title.toLowerCase().replace(/\s/g, "");
});

_http2.default.get(queryStr, function (res) {
    var body = '';
    res.on('data', function (chunk) {
        body += chunk;
    });
    res.on('end', function () {
        var response = JSON.parse(body);
        //console.log(getTracks(response));
        _ramda2.default.map(logTitles, _ramda2.default.slice(0, 5, getTracks(response)));
        //console.log(groupByTitle(getTracks(response)));
    });
}).on('error', function (e) {
    console.log("Got an error: ", e);
});

