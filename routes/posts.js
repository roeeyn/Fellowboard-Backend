const express = require("express");
const router = express.Router();
const Post = require("../models/Post.js");
const youtube = require("../youtube.js");
const github = require("../github.js");
const qs = require('querystring');
//get all public posts for All/Explore page
router.get('/', async (req, res, next) => {
    console.log(req.body);

    try {
        const posts = await Post.find({isPublic: true}).exec();
        res.status(200).send(posts);
    } catch(err) {
        console.log(err);
        res.status(500).send(err);
    }
});

//get post by id (pinnedPosts under User)
router.get('/:id', async (req, res, next) => {
    try {
        const id = req.params.id;
        const post = await Post.findById(id).exec();
        res.status(200).send(post);
    } catch(err) {
        console.log(err);
        res.status(500).send(err);
    }
});

router.get('/contacts', async (req, res, next) => {
    try {
        const contacts = await Post.find({type: "contacts"}).exec();
        res.status(200).send(contacts);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
})
//create a new post, will need to get type from user
router.post('/', async (req, res, next) => {
    try {
        if(req.body.url) {
            const youtubeRegex = /^(https?\:\/\/)?(www\.youtube\.com|youtu\.?be)\/.+$/;
            const githubRegex = /^(https?\:\/\/)?(www\.github\.com|github\.com)\/.+$/;
            const url = req.body.url;
            if(youtubeRegex.test(url)) {
                let videoId;
                const youtubeShareRegex = /youtu\.be/;
                //matches youtu.be links
                if(youtubeShareRegex.test(url)) {
                    videoId = url.split("youtu.be/")[1];
                }
                //matches youtube.com links
                else {
                    const urlToParse = url.split("?")[1];
                    const parsed = qs.parse(urlToParse);
                    videoId = parsed.v;
                }

                const videoPost = await youtube.getVideoData(videoId);
                videoPost.creator = req.body.creator;

                res.status(200).send(videoPost);
            }
            else if (githubRegex.test(url)) {
                const params = url.split("github.com/").slice(1);
                const [org, repo, type, id] = params[0].split("/");
                if(type == 'issues') {
                    const issue = await github.fetchSingleIssue(org, repo, id);
                    issue.creator = req.body.creator;

                    res.status(200).send(issue);
                }
                else if (type == 'pull') {
                    const pr = await github.fetchSinglePR(org, repo, id);
                    pr.creator = req.body.creator;

                    res.status(200).send(pr);
                }
            } else {
                res.status(404).send({ err: "URL not valid"});
            }
        }
        else if (req.body.title) {
            const post = Post(req.body);
            //bugged, exist check doesnt work right now
            const exists = await Post.findOne(post, "-_id -timestamp").exec();
            if (exists) {
                res.sendStatus(409);
            }
            else {
                const saved = await post.save();
                res.status(200).send(saved);
            }
        }
        
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

//update post based on id, update post with new data in body
router.post('/:id/', async (req, res) => {
    const newData = req.body;
    const id = req.params.id;
    try {
        const updated = await Post.findByIdAndUpdate(id, newData).exec();
        res.status(200).send(updated);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

//delete post based on id, return 200 ok

router.delete('/:id/', async (req, res) => {
    try {
        const id = req.params.id;
        const deleted = await Post.findByIdAndDelete(id).exec();
        if(deleted) {
            res.sendStatus(200);
        }
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
})

module.exports = router;