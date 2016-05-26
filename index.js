import R from 'ramda';
import http from 'http';
import moment from 'moment';
import curryfm from 'curryfm';
import jsonfile from 'jsonfile';
import spotifier from 'spotifier';
import youtuber from 'youtuber';
import firebase from 'firebase';

/* API INITIALIZERS */

const getParams = (params) => {
  const defaultParams = {
    user: 'sidjain26',
		format: 'json'
  };
  return params ? R.merge(defaultParams, params) : defaultParams;
};

const spotify_client = (() => {
  const secrets = jsonfile.readFileSync('./secrets/spotify-config.json');
  const params = {
    authorizationUrl: 'https://accounts.spotify.com/api/token',
    searchResultLimit: 5,
    searchUrl: 'https://api.spotify.com/v1/search',
    timeout: 3000
  };
  const merged_params = R.merge(secrets, params);
  return spotifier(merged_params);
})();

firebase.initializeApp({
  serviceAccount: './secrets/firebase-config.json',
  databaseURL: 'https://web-bot-e8aee.firebaseio.com'
});

const youtube_client = (() => {
  const secrets = jsonfile.readFileSync('./secrets/youtube-config.json');
  return youtuber(secrets.api_key);
})();

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
  const active = getKey(false, ['@attr', 'nowplaying'])(track) ? true : null;
  return {
   title,
   artist,
   epoch,
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

const transformRecentTracks = R.compose(R.map(recentTrackInfo), getKeyRecentTracks);

const transformTopTracks = R.compose(R.map(topTrackInfo), getKeyTopTracks);

const sortRecentTracks = (tracks) => {
  const sortByEpoch = R.pipe(R.sortBy(R.prop("epoch")), R.reverse);
  const findActiveTrack = (track) => {
    if(R.pathOr(false, ["active"], track)) {
      return true;
    }
    else return false;
  };
  let active_track = R.filter(findActiveTrack, tracks);
  const sorted_tracks = (() => {
    const sorted = sortByEpoch(tracks);
    if (!R.isEmpty(active_track)) {
      const sorted_without_active = R.dropLast(1, sorted);
      const sorted_with_active = R.insert(0, R.head(active_track), sorted_without_active);
      return sorted_with_active;
    }
    return sorted;
  })();
  return sorted_tracks;
};

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
  const min_retries = 3;
  let retries = 0;
	let getData = (primaryCallback, track) => {
		const { title, artist } = track;
		client.findBestMatch({ title, artist }, (err, result) => {
			if (err) {
				console.error(track.title, JSON.stringify(err));
        if (retries < min_retries) {
          retries++;
          getData(primaryCallback, track);
        } else if (retries === min_retries) {
          retries = 0;
          fetched++;
          primaryCallback({}, track, spotified_tracks);
        }
			} else if (result) {
        retries = 0;
        fetched++;
				const info = extractMetaData(result);
				primaryCallback(info, track, spotified_tracks);
			}
			if (fetched === length) {
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
	const spotify_link = getKey(undefined, ["external_urls", "spotify"])(result);
	const spotify_embed = `https://embed.spotify.com/?uri=${encodeURIComponent(`spotify:track:${spotify_id}`)}`;
  const spotify_images = getKey(undefined, ["album", "images"])(result);
  return { spotify_embed, spotify_id, spotify_link, spotify_images };
}

const mergeSpotifyMetaDataToTrack = (info, track, spotified_tracks) => {
  const spotified_track = {
    ...track,
    ...info
  };
  spotified_tracks.push(spotified_track);
}

const mergeSpotifyMetaDataAnd = getSpotifyMetaData(spotify_client, mergeSpotifyMetaDataToTrack);

/* YOUTUBE HELPERS */

let mergeYoutubeMetaDataAnd = R.curry((client, secondaryCallback, tracks) => {
  const length = R.length(tracks);
  let fetched = 0;
  let youtubed_tracks = [];
  const min_retries = 3;
  let retries = 0;
  let pushToTracks = (track, err) => {
    if(err) {
      console.error(track.title, JSON.stringify(err, null, 1));
      if (retries < min_retries) {
        retries++;
        client(pushToTracks, track);
      } else if (retries === min_retries) {
        retries = 0;
        fetched++;
        youtubed_tracks.push(track);
      }
    }
    else if (track) {
      retries = 0;
      fetched++;
      youtubed_tracks.push(track);
    }
    if (fetched === length) {
      secondaryCallback(youtubed_tracks);
    }
  };
  R.map(client(pushToTracks), tracks);
});
mergeYoutubeMetaDataAnd = mergeYoutubeMetaDataAnd(youtube_client);

/* FIREBASE HELPERS */

const db = firebase.database();
const top_tracks_monthly_ref = db.ref("toptracks/monthly");
const top_tracks_weekly_ref = db.ref("toptracks/weekly");
const top_tracks_quarterly_ref = db.ref("toptracks/quarterly");
const recent_tracks_ref = db.ref("recenttracks");
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
// const logRecentTracks = R.compose(R.map(console.log), transformRecentTracks);
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
const callEveryTwoHours = callEvery("02:00:00");
const callEveryFiveSeconds = callEvery("00:00:05");

const recenttracks_timer = callEveryFiveSeconds(() => {
  getRecentTracks(getParams({
    limit: 5
  }), (result) => {
    mergeSpotifyMetaDataAnd(mergeYoutubeMetaDataAnd(R.pipe(sortRecentTracks, setTracksInFirebase(recent_tracks_ref))))(transformRecentTracks(result));
  })
});

const toptracks_timer = callEveryTwoHours(() => {
	getTopTracks(getParams({
		limit: 10,
		page: 1,
		period: "1month"
	}), (result) => {
    mergeSpotifyMetaDataAnd(mergeYoutubeMetaDataAnd(setTracksInFirebase(top_tracks_monthly_ref)))(transformTopTracks(result));
	});
  getTopTracks(getParams({
    limit: 10,
    page: 1,
    period: "7day"
  }), (result) => {
    mergeSpotifyMetaDataAnd(mergeYoutubeMetaDataAnd(setTracksInFirebase(top_tracks_weekly_ref)))(transformTopTracks(result));
  });
  getTopTracks(getParams({
    limit: 10,
    page: 1,
    period: "3month"
  }), (result) => {
    mergeSpotifyMetaDataAnd(mergeYoutubeMetaDataAnd(setTracksInFirebase(top_tracks_quarterly_ref)))(transformTopTracks(result));
  });
});
