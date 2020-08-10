const express = require("express");
const router = express.Router();
const User = require("../models/User.js");

router.get('/:username', async (req, res, next) => {
    const username = req.params.username;
    try {
        const user = await User.findOne({username: username}).exec();
        res.status(200).send(user);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

//update pinned posts with new pinned posts array
router.post('/:username/pins', async (req, res, next) => {
    const username = req.params.username;
    const newPins = req.body.pinnedPosts;

    try {
        const user = await User.findOneAndUpdate({username: username}, {"pinnedPosts": newPins}).exec();
        res.status(200).send(user);
    } catch (err) {
        console.log(err);
        res.status(500).send(err);
    }
});

//update user object with new data from body
//key: value, eg {avatarUrl: newAvatarUrl}
router.post('/:username', async (req, res, next) => {
    const username = req.params.username;
    const newData = req.body;
    try {
        const user = await User.findOneAndUpdate({username: username}, newData).exec();
        res.status(200).send(user);
    } catch(err) {
        console.log(err);
        res.status(500).send(err);
    }
});


module.exports = router;