const Discord = require('discord.js');
const mongoose = require("mongoose");
const fs = require('fs');
const client = new Discord.Client();
const Post = require("./models/Post");
require('dotenv').config();

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DISCORD_GUILD = '716052909271285803';

const mongoConnectionURL = process.env.MONGODB_SRV; 

async function dbConnect() {
    mongoose
    .connect(mongoConnectionURL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
        useCreateIndex: true,
        dbName: "Dashboard",
    })
    .then(() => {
        console.log("Connected to MongoDB");
        
    })
    .catch(err => console.log(`${err}: Failed to connect to MongoDB`));
}


const db = mongoose.connection;

client.on('ready', async () => {
    await dbConnect();
    console.log(`Logged in as ${client.user.tag}`);
    console.log('Discord - Getting guild/server');
    const guild = client.guilds.resolve(DISCORD_GUILD);
    console.log('Discord - Got guild/server');
    console.log('Discord - Fetching posts');
    const posts = await fetchPosts(client, guild)
    console.log(`Discord - Fetched posts: ${posts.length}`);
    console.log(`MongoDB - Uploading to database`);
    const [added, skipped] = await addPostsToDatabase(posts);
    console.log(`MongoDB - Uploaded posts to database: ${added} new posts added, ${skipped} old posts skipped`);
    process.exit(0);
});

client.login(DISCORD_TOKEN);

//for debug
function writeToFile(posts) {
    const f = JSON.stringify(posts);
    fs.writeFileSync("./discord_posts.json", f, (err) => {
        if(err) {
            console.log(err);
            return;
        }
    });
    console.log("Wrote to file");
}

async function fetchPosts(client, guild) {
    //id for topics category (where all the golang, python, etc. channels are)
    const CATEGORY_ID = '716458296030265344';
    //if we want to ignore channels like #battlestations, #coffee, etc.
    const IGNORE_LIST = [];

    const guildChannels = guild.channels.cache;
    const topicChannels = [];
    //get all the channels 
    guildChannels.each(channel => {
        if(channel.parentID === CATEGORY_ID) {
            topicChannels.push({
                "id": channel.id,
                "name": channel.name,
            });
        }
    })

    let posts = [];

    //get the posts with links for each channel
    for(let i = 0; i < topicChannels.length; i++) {
        const channel = topicChannels[i];
        try {
            const textChannel = await client.channels.fetch(channel.id);
            const channelPosts = await getPostsFromChannelMessages(textChannel);
            posts.push(channelPosts);
        } catch(e) {
            console.log(e);
        }
    }
    //flatten array from [[Posts], [Posts], [Posts]] to [Post, Post, Post, Post...]
    posts = posts.flat();

    return posts;
};

async function getPostsFromChannelMessages(channel) {
    try {
        //default fetch is 50 messages
        const channelMessages = await channel.messages.fetch();
        const channelName = channel.name;
        // console.log(channelName);
        const posts = [];

        channelMessages.forEach(msg => {
            if (msg.content.includes('https://') || msg.content.includes('http://')) {
                if(msg.embeds || msg.embeds.length) {
                    msg.embeds.forEach(e => {
                        if (e.thumbnail) {
                            posts.push({
                                "creator": "server",
                                "tags": [channelName, "MLH-discord"],
                                "title": e.title ? e.title : `${channelName} Post`,
                                "type": "discord",
                                "timestamp": new Date(msg.createdTimestamp),
                                "isPublic": true,
                                "content": {
                                    "url": e.url,
                                    "description": e.description ? e.description : "",
                                    "thumbnail": e.thumbnail //thumbnail is object with url, proxyURL, height, width
                                }
                            });
                        }
                        else {
                            posts.push({
                                "creator": "server",
                                "tags": [channelName, "MLH-discord"],
                                "title": e.title ? e.title : `${channelName} Post`,
                                "type": "text",
                                "timestamp": new Date(msg.createdTimestamp),
                                "isPublic": true,
                                "content": {
                                    "url": e.url,
                                    "description": e.description ? e.description : "",
                                }
                            });
                        }
                        
                    })
                    
                }
            }
        });
        return posts;
    } catch(e) {
        console.log(e);
    }

}


async function addPostsToDatabase(posts) {
    let added = 0;
    let skipped = 0;
    for(let i = 0; i < posts.length; i++) {
        
        const post = Post(posts[i]);
        
        try {
            const exists = await Post.findOne(posts[i]);
            if(!exists) {
                await post.save();
                console.log(`added ${post.title} to database`);
                added++;
            }
            else {
                console.log(`${post.title} already exists, skipping`);
                skipped++;
            }
        } catch (e) {
            console.log(e);
        }
    }
    return [added, skipped];
}