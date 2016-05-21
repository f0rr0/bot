import R from 'ramda';
import http from 'http';
import moment from 'moment';
import curryfm from 'curryfm';
import jsonfile from 'jsonfile';
import spotifier from 'spotifier';
import firebase from 'firebase';

/* API INITIALIZERS */

const getParams = (params) => {
  const defaultParams = {
    user: 'sidjain26',
		format: 'json',
  };
  return params ? R.merge(defaultParams, params) : defaultParams;
};

const spotify_client = (() => {
  const secrets = jsonfile.readFileSync('./secrets/spotify-config.json');
  const params = {
    authorizationUrl: 'https://accounts.spotify.com/api/token',
    searchResultLimit: 5,
    searchUrl: 'https://api.spotify.com/v1/search',
    timeout: 3000,
  };
  const merged_params = R.merge(secrets, params);
  return spotifier(merged_params);
})();

firebase.initializeApp({
  serviceAccount: './secrets/firebase-config.json',
  databaseURL: 'https://web-bot-e8aee.firebaseio.com',
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

/* GETTERS */

const getKeyRecentTracks = getKey([{}], ['recenttracks', 'track']);
const getKeyTopTracks = getKey([{}], ['toptracks', 'track']);
const getKeyTopArtists = getKey([{}], ['topartists', 'artist']);
const getKeyWeeklyTrackChart = getKey([{}], ['weeklytrackchart', 'track']);
const getKeyWeeklyArtistChart = getKey([{}], ['weeklyartistchart', 'artist']);
const getKeyArtistTracks = getKey([{}], ['artisttracks', 'track']);

/* MANIPULATORS */

const recentTrackInfo = (track) => {
  const title = getKey(null, ['name'])(track);
  const artist = getKey(null, ['artist', '#text'])(track);
  const epoch = getKey(null, ['date', 'uts'])(track);
  const timestamp = epoch ? moment.unix(epoch)
   .fromNow() : null;
  const active = getKey(false, ['@attr', 'nowplaying'])(track) ? true : false;
  return {
   title,
   artist,
   epoch,
   timestamp,
   active
  };
};

const topTrackInfo = (track) => {
	const title = getKey(null, ["name"])(track);
	const artist = getKey(null, ["artist", "name"])(track);
	const playcount = getKey(null, ["playcount"])(track);
	const rank = getKey(null, ["@attr", "rank"])(track);
	return {
		title,
		artist,
		playcount,
		rank
	};
};

/* TRANSFORMS */

const TransformRecentTracks = R.compose(R.map(recentTrackInfo), getKeyRecentTracks);
const TransformTopTracks = R.compose(R.map(topTrackInfo), getKeyTopTracks);

/* CURRYFM HELPERS */

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

/* SPOTIFY HELPERS */

let getSpotifyMetaData = (client, primaryCallback, secondaryCallback, tracks) => {
	const length = R.length(tracks);
	let fetched = 0;
	let spotified_tracks = [];
	let getData = (primaryCallback, track) => {
		const { title, artist } = track;
		client.findBestMatch({ title, artist }, (err, result) => {
			if (err) {
				fetched++;
				// console.log(`Spotified ${fetched} of ${length}. Error :(`);
				primaryCallback({}, track, spotified_tracks);
			} else if (result) {
				const info = extractMetaData(result);
				fetched++;
				// console.log(`Spotified ${fetched} of ${length}. Success :)`);
				primaryCallback(info, track, spotified_tracks);
			}
			if (+fetched === +length) {
				// console.log("\nFin");
				secondaryCallback(spotified_tracks);
			}
		});
	};
	getData = R.curry(getData);
	R.map(getData(primaryCallback), tracks);
};

getSpotifyMetaData = R.curry(getSpotifyMetaData);

const extractMetaData = (result) => {
	const spotify_id = getKey(undefined, ["id"])(result);
	const spotify_url = getKey(undefined, ["external_urls", "spotify"])(result);
	const spotify_embed = `https://embed.spotify.com/?uri=${encodeURIComponent(`spotify:track:${spotify_id}`)}`;
  const spotify_images = getKey(undefined, ["album", "images"])(result);
  return { spotify_embed, spotify_id, spotify_url, spotify_images };
}

const mergeSpotifyMetaDataToTrack = (info, track, spotified_tracks) => {
  const spotified_track = R.merge(info, track);
	// console.log(spotified_track);
  spotified_tracks.push(spotified_track);
}

const mergeMetaDataFromSpotifyAnd = getSpotifyMetaData(spotify_client, mergeSpotifyMetaDataToTrack);

/* FIREBASE HELPERS */

const db = firebase.database();
const top_tracks_monthly_ref = db.ref("toptracks/monthly");
// ref.orderByChild("rank")
// 	.on("child_changed", (snapshot) => {
// 		console.log(snapshot.val());
// 	}, (err) => {
// 		console.log(err.code);
// 	});

const setTracksInFirebase = R.curry((ref, tracks) => {
	ref.set(tracks);
});

/* TESTING */

// const prettyJSON = (space, json) => {
// 	return JSON.stringify(json, null, space);
// };
// const prependSpace = (val) => " " + val;
// const nicelyLog = R.compose(console.log, R.curry(prettyJSON)(1));
// const logTopTracks = R.compose(R.map(console.log), TransformTopTracks);
// const logRecentTracks = R.compose(R.map(console.log), TransformRecentTracks);
// const logTitles = R.compose(console.log, recentTrackInfo);
// const pushToArray = R.curry((array, item) => {
// 	array.push(item);
// });

// const toptracks = [];
// const saveTracks = (response) => {
// 	const attr = getKey({}, ["toptracks", "@attr"])(response);
// 	console.log("Fetching page " + attr.page);
// 	const tracks = getKey({}, ["toptracks", "track"])(response);
// 	const getTrackInfo = (track) => {
// 		const omitKeys = ["streamable", "url", "mbid"];
// 		return R.omit(omitKeys, track);
// 	}
// 	const pushToTracks = pushToArray(toptracks);
// 	R.map(R.pipe(getTrackInfo, pushToTracks), tracks);
// 	if (+attr.page < +attr.totalPages) {
// 		getTopTracks({
// 			user: "sidjain26",
// 			format: "json",
// 			limit: 50,
// 			page: ++attr.page,
// 			period: "overall"
// 		}, saveTracks)
// 	} else {
// 		console.log("Finished fetching...");
// 		const file = "./logs/" + moment()
// 			.format("MM-DD-YY@HH:mm:ss") + "-TOPTRACKS.JSON";
// 		jsonfile.writeFileSync(file, {
// 			tracks: toptracks
// 		}, {
// 			spaces: 2
// 		});
// 	}
// };

// const callEverySecond = callEvery('00:00:01');

// callEverySecond(() => {
// 	ref.push()
// 		.set({
// 			hello: "world"
// 		});
// });

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

// getTopTracks({
// 	user: "sidjain26",
// 	format: "json",
// 	limit: 10,
// 	page: 1,
// 	period: "1month"
// }, uploadTopTracksMonthlyToFirebase)

// getTopArtists({
// 	user: "sidjain26",
// 	limit: 10,
// 	format: "json",
// 	period: "overall"
// }, nicelyLog);

// getWeeklyTrackChart({
// 	user: "sidjain26",
// 	format: "json",
// }, R.pipe(getKeyWeeklyTrackChart, R.take(10), R.map(nicelyLog)));

// getWeeklyArtistChart(getParams(), R.pipe(getKeyWeeklyArtistChart, R.take(10), R.map(nicelyLog)));

// getTracksForArtist(getParams({
// 	artist: "Drake"
// }), R.pipe(getKeyArtistTracks, R.take(10), R.map(nicelyLog)));

// getUserInfo(getParams(), nicelyLog);

// const timer = callEverySecond(getUserInfo, getParams(), nicelyLog);

//const uniques = array => Array.from(new Set(array));
//const uniqueTitles = R.compose(R.indexBy(getKey("name")), getTracks);

// const groupByTitle = R.groupBy((track) => {
// 	const title = getKey("name")(track) + getKey("artist", "#text")(track);
// 	return title.toLowerCase()
// 		.replace(/\s/g, "");
// });

// const req = http.get(queryStr, (res) => {
// 		let body = '';
// 		res.on('data', (chunk) => {
// 			body += chunk;
// 		});
// 		res.on('end', () => {
// 			const response = JSON.parse(body);
// 			//console.log(getTracks(response));
// 			R.map(logTitles, R.slice(0, 10, getTracks(response)));
// 			//console.log(groupByTitle(getTracks(response)));
// 		});
// 	})
// 	.on('error', (e) => {
// 		console.log(JSON.stringify(e));
// 	})
// 	.setTimeout(100, () => {
// 		req.abort();
// 		console.log("Timed out");
// 	});

(() => {
	getTopTracks(getParams({
		limit: 20,
		page: 1,
		period: "1month"
	}), (result) => {
		mergeMetaDataFromSpotifyAnd(setTracksInFirebase(top_tracks_monthly_ref), TransformTopTracks(result));
	});
})();
