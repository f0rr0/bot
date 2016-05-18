import R from 'ramda';
import http from 'http';
import moment from 'moment';
import curryfm from 'curryfm';
import jsonfile from 'jsonfile';
import spotifier from 'spotifier';
const _ = R.__;

const spotifyClient = spotifier({
	authorizationUrl: 'https://accounts.spotify.com/api/token',
	clientId: '09db4769108945c8834a8cbf9eb2cb2e',
	clientSecret: 'c97cc1f959334126b1c2623ff4da23c0',
	searchResultLimit: 10,
	searchUrl: 'https://api.spotify.com/v1/search',
	timeout: 3000
});

/* LIBRARY FUNCTIONS*/

const callEvery = (duration) => {
	const delay = moment.duration(duration)
		.asMilliseconds();
	return (fn, ...args) => {
		return setInterval(fn, delay, ...args);
	};
};

const getKey = (or, path) => {
	return (obj, transform) => {
		return R.pathOr(false, path, obj) ? transform ? transform(R.path(path, obj)) : R.path(path, obj) : or;
	};
};

const spotifyInfo = R.curry((client, track) => {
			const {
				title,
				artist
			} = track;
			let info = {};
			client.findBestMatch({
						title,
						artist
					}, (err, result) => {
						if (err) {
							console.log(err);
						} else if (result) {
							const spotify_id = getKey(undefined, ["id"])(result);
							const spotify_url = getKey(undefined, ["external_urls", "spotify"])(result);
							const spotify_embed = `https://embed.spotify.com/?uri=${encodeURIComponent(`spotify:track:${spotify_id}`)}`;
		info = {
			spotify_id,
			spotify_url,
			spotify_embed
		};
		console.log(info);
	}
	});
	console.log(info);
	return R.merge(info, track);
});



// const getKeys = (pathsWithDefaults) => {
// 	const paths = R.keys(pathsWithDefaults);
// 	const getPaths = (path) => {
//
// 	}
// 	R
// 	return (obj) => {
// 		const x = (path) => {
// 			return getKey(pathsWithDefaults.path, path)(obj);
// 		}
// 		return R.map(x, path);
// 	}
// }

/* API FUNCTIONS */

const userApi = curryfm("a3123e138236b93c22e6dafa83e355b0", "user");
const getRecentTracks = userApi("getRecentTracks");
const getTopTracks = userApi("getTopTracks");
const getTopTags = userApi("getTopTags");
const getUserInfo = userApi("getInfo");
const getTopArtists = userApi("getTopArtists");
const getWeeklyArtistChart = userApi("getWeeklyArtistChart");
const getWeeklyTrackChart = userApi("getWeeklyTrackChart");
const getTracksForArtist = userApi("getArtistTracks");
const libraryTest = curryfm("a3123e138236b93c22e6dafa83e355b0", "library", "getArtists");


/* GETTERS */

const getKeyRecentTracks = getKey([{}], ["recenttracks", "track"]);
const getKeyTopTracks = getKey([{}], ["toptracks", "track"]);
const getKeyTopArtists = getKey([{}], ["topartists", "artist"]);
const getKeyWeeklyTrackChart = getKey([{}], ["weeklytrackchart", "track"]);
const getKeyWeeklyArtistChart = getKey([{}], ["weeklyartistchart", "artist"]);
const getKeyArtistTracks = getKey([{}], ["artisttracks", "track"]);

/* MANIPULATORS */


const trackInfo = (track) => {
	const title = getKey(null, ["name"])(track);
	const artist = getKey(getKey(null, ["artist", "#text"])(track), ["artist", "name"])(track);
	const playcount = getKey(null, ["playcount"])(track);
	const epoch = getKey(null, ["date", "uts"])(track);
	const timestamp = epoch ? moment.unix(epoch)
		.fromNow() : null;
	const active = getKey(false, ["@attr", "nowplaying"])(track) ? true : false;
	return {
		title,
		artist,
		playcount,
		epoch,
		timestamp,
		active
	};
};


/* TRANSFORMS */

const TransformTopTracks = R.compose(R.map(trackInfo), getKeyTopTracks);
const TransformRecentTracks = R.compose(R.map(trackInfo), getKeyRecentTracks);


/* TESTING */

const getParams = (params) => {
	const defaultParams = {
		user: "sidjain26",
		format: "json"
	}
	return params ? R.merge(defaultParams, params) : defaultParams;
};
const prettyJSON = (space, json) => {
	return JSON.stringify(json, null, space);
};
const prependSpace = (val) => " " + val;
const nicelyLog = R.compose(console.log, R.curry(prettyJSON)(1));
const logTopTracks = R.compose(R.map(R.pipe(spotifyInfo(spotifyClient), console.log)), TransformTopTracks);
const logRecentTracks = R.compose(R.map(console.log), TransformRecentTracks);
const logTitles = R.compose(console.log, trackInfo);
const pushToArray = R.curry((array, item) => {
	array.push(item);
});

const toptracks = [];
const saveTracks = (response) => {
	const attr = getKey({}, ["toptracks", "@attr"])(response);
	console.log("Fetching page " + attr.page);
	const tracks = getKey({}, ["toptracks", "track"])(response);
	const getTrackInfo = (track) => {
		const omitKeys = ["streamable"];
		return R.omit(omitKeys, track);
	}
	const pushToTracks = pushToArray(toptracks);
	R.map(R.pipe(getTrackInfo, pushToTracks), tracks);
	if (+attr.page < +attr.totalPages) {
		getTopTracks({
			user: "sidjain26",
			format: "json",
			limit: 50,
			page: ++attr.page,
			period: "overall"
		}, saveTracks)
	} else {
		console.log("Finished fetching...");
		const file = "./logs/" + moment()
			.format("MM-DD-YY@HH:mm:ss") + "-TOPTRACKS.JSON";
		jsonfile.writeFileSync(file, {
			tracks: toptracks
		}, {
			spaces: 2
		});
	}
};

const callEverySecond = callEvery('00:00:01');

// {
// 	"name": "Gemini (feat. George Maple)",
// 	"duration": "0",
// 	"playcount": "111",
// 	"mbid": "",
// 	"url": "http://www.last.fm/music/What+So+Not/_/Gemini+(feat.+George+Maple)",
// 	"streamable": {
// 		"#text": "0",
// 		"fulltrack": "0"
// 	},
// 	"artist": {
// 		"name": "What So Not",
// 		"mbid": "e840a9e5-4b73-486a-a47d-790d5096dd1f",
// 		"url": "http://www.last.fm/music/What+So+Not"
// 	},
// 	"image": [{
// 		"#text": "http://img2-ak.lst.fm/i/u/34s/f74d5dbae628468891f0850f882ccce4.png",
// 		"size": "small"
// 	}, {
// 		"#text": "http://img2-ak.lst.fm/i/u/64s/f74d5dbae628468891f0850f882ccce4.png",
// 		"size": "medium"
// 	}, {
// 		"#text": "http://img2-ak.lst.fm/i/u/174s/f74d5dbae628468891f0850f882ccce4.png",
// 		"size": "large"
// 	}, {
// 		"#text": "http://img2-ak.lst.fm/i/u/300x300/f74d5dbae628468891f0850f882ccce4.png",
// 		"size": "extralarge"
// 	}],
// 	"@attr": {
// 		"rank": "1"
// 	}
// }

// getRecentTracks({
// 	user: "sidjain26",
// 	format: "json",
// 	limit: 5
// }, logRecentTracks);



getTopTracks({
	user: "sidjain26",
	format: "json",
	limit: 5,
	page: 1,
	period: "overall"
}, logTopTracks)


/*
getTopArtists({
	user: "sidjain26",
	limit: 10,
	format: "json",
	period: "overall"
}, nicelyLog);
*/

/*
getWeeklyTrackChart({
	user: "sidjain26",
	format: "json",
}, R.pipe(getKeyWeeklyTrackChart, R.take(10), R.map(nicelyLog)));
*/

/*
getWeeklyArtistChart(getParams(), R.pipe(getKeyWeeklyArtistChart, R.take(10), R.map(nicelyLog)));
*/


// getTracksForArtist(getParams({
// 	artist: "Drake"
// }), R.pipe(getKeyArtistTracks, R.take(10), R.map(nicelyLog)));

// getUserInfo(getParams(), nicelyLog);

// const timer = callEverySecond(getUserInfo, getParams(), nicelyLog);

//const uniques = array => Array.from(new Set(array));
//const uniqueTitles = R.compose(R.indexBy(getKey("name")), getTracks);

/*
const groupByTitle = R.groupBy((track) => {
	const title = getKey("name")(track) + getKey("artist", "#text")(track);
	return title.toLowerCase()
		.replace(/\s/g, "");
});
*/
/*
const req = http.get(queryStr, (res) => {
		let body = '';
		res.on('data', (chunk) => {
			body += chunk;
		});
		res.on('end', () => {
			const response = JSON.parse(body);
			//console.log(getTracks(response));
			R.map(logTitles, R.slice(0, 10, getTracks(response)));
			//console.log(groupByTitle(getTracks(response)));
		});
	})
	.on('error', (e) => {
		console.log(JSON.stringify(e));
	})
	.setTimeout(100, () => {
		req.abort();
		console.log("Timed out");
	});
	*/

// let params = {
// 	artist: 'drake',
// 	title: 'fishy'
// };
//
// spotify.findBestMatch(params, function (err, result) {
// 	if (err) {
// 		console.error(err);
// 	}
// 	console.log(result);
// });
