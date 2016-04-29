import R from 'ramda';
import http from 'http';
import moment from 'moment';

const queryStr = "http://ws.audioscrobbler.com/2.0/?api_key=a3123e138236b93c22e6dafa83e355b0&method=user.getRecentTracks&user=sidjain26&format=json&limit=5";

const getKey = (...path) => {
	const levels = R.map((level => R.prop(level)), R.reverse(path));
	return R.path([...path]);
};

const uniques = array => Array.from(new Set(array));
const getTracks = getKey("recenttracks", "track");

const trackInfo = (track) => {
	const title = getKey("name")(track) + " - " + getKey("artist", "#text")(track);
	const epoch = R.path(["date", "uts"], track) ? parseInt(getKey("date", "uts")(track)) : undefined;
	const timestamp = epoch ? " [" + moment.unix(epoch)
		.fromNow() + "]" : "";
	const active = R.path(["@attr", "nowplaying"], track) ? " [playing]" : "";
	return `${title}${timestamp}${active}`;
};

const logTitles = R.compose(console.log, trackInfo);
const uniqueTitles = R.compose(R.indexBy(getKey("name")), getTracks);

const groupByTitle = R.groupBy((track) => {
	const title = getKey("name")(track) + getKey("artist", "#text")(track);
	return title.toLowerCase()
		.replace(/\s/g, "");
});

http.get(queryStr, (res) => {
		let body = '';
		res.on('data', (chunk) => {
			body += chunk;
		});
		res.on('end', () => {
			const response = JSON.parse(body);
			//console.log(getTracks(response));
			R.map(logTitles, R.slice(0, 5, getTracks(response)));
			//console.log(groupByTitle(getTracks(response)));
		});
	})
	.on('error', (e) => {
		console.log("Got an error: ", e);
	});
