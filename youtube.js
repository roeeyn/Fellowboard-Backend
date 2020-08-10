const { google } = require('googleapis');
const mongoose = require("mongoose");
const Post = require('./models/Post');
require('dotenv').config();

const mongoConnectionURL = process.env.MONGODB_SRV; 
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const connectToDB = async () => {
    mongoose
    .connect(mongoConnectionURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        dbName: "Dashboard",
    })
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => console.log(`${err}: Failed to connect to MongoDB`));
}

/**
 * Fetch all uploaded videos from channelID, and filters it by checking for `filterBy`
 * in the title.  filterBy is case sensative.  If no tags are passed in, the filterBy
 * is used by default.
 * 
 * @param {String} channelId 
 * @param {String} filterBy Use an empty string if no filter is desired.
 * @param {String} tag
 */
const getUploadedVideos = async (channelId, filterBy = "MLH Fellowship", tags = null) => {
    if (!tags) {
        tags = [filterBy.replace(" ", "-")];
    }

    // get the MLH channel
    const youtube = google.youtube("v3");
    const channel = await youtube.channels.list({
        auth: YOUTUBE_API_KEY,
        part: "contentDetails,status",
        id: channelId,
    });

    if (channel.status !== 200) {
        throw Error(`${channel.status} error: failed to GET channel`);
    }

    // get all of (up to 50) MLH's uploaded videos
    const playlistId = channel.data.items[0].contentDetails.relatedPlaylists.uploads;
    const playlist = await youtube.playlistItems.list({
        playlistId,
        auth: YOUTUBE_API_KEY,
        part: "snippet,status,contentDetails",
        maxResults: 50,
    });

    if (playlist.status !== 200) {
        throw Error(`${playlist.status} error: failed to GET uploads`);
    }

    // keep only MLH Fellowship videos, and keep only relevant info
    const videos = playlist.data.items
        .filter((video) => video.snippet.title.includes(filterBy))
        .map((video) => {
            return {
                tags,
                creator: "server",
                type: "youtube",
                title: video.snippet.title,
                content: {
                    id: video.contentDetails.videoId,
                    description: video.snippet.description,
                    thumbnails: video.snippet.thumbnails.standard,
                },
                timestamp: new Date(video.snippet.publishedAt),
                isPublic: true,
            }
        });
    return videos
}

const getVideoData = async (videoId) => {
    const youtube = google.youtube("v3");
    const req = await youtube.videos.list({
        id: videoId,
        auth: YOUTUBE_API_KEY,
        part: "snippet"
    });
  
    const video = await req.data.items[0];
    const post = {
        tags: video.snippet.tags || [],
        creator: "",
        type: "youtube",
        title: video.snippet.title,
        content: {
            id: video.id,
            description: video.snippet.description,
            thumbnails: video.snippet.thumbnails.standard
        },
        timestamp: new Date(),
        isPublic: true
    };
    return post;
}
/**
 * Adds list of videos to DB, given that the videos are already formatted
 * to match the Post schema.
 * 
 * @param {[Object]} videos 
 */
const addVideosToDb = async (videos) => {
    const allVideos = [];
    for (let i = 0; i < videos.length; i++) {
        const post = Post(videos[i]);
        const found = await Post.find({ content: videos[i].content }); // videoId is unique
        if (found.length === 0) {
            const savedPost = await post.save();
            allVideos.push(savedPost);
        }
    }
    return allVideos;
}

const prepopulateVideos = async () => {
    const MLH_CHANNEL_ID = "UCBYaqTVeO-oQW2AlmZVj-Fg";
    
    // connect to DB
    await connectToDB();
    
    // fetch videos
    const videos = await getUploadedVideos(MLH_CHANNEL_ID, "MLH Fellowship", "MLH-Workshop");
    console.log(`Fetched ${videos.length} videos that contain MLH Fellowship in its name`);

    // add to DB if unique
    const addedVideos = await addVideosToDb(videos);
    console.log(`Added ${addedVideos.length} videos to the DB`);

    process.exit(0);
}

if (module === require.main) {
    prepopulateVideos().catch(console.error);
}
module.exports = { getUploadedVideos, addVideosToDb, getVideoData };

