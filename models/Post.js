const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const PostSchema = new Schema({
    creator: String,            // If it is a user created post, this will be  
    tags: [String],             // the user's GitHub username.  Otherwise, it
    title: {                    // will be `server`. 
        type: String,
        required: true,
    },
    content: Schema.Types.Mixed,
    type: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
    isPublic: { type: Boolean, default: true },
});

// Exports the model
module.exports = Post = mongoose.model('post', PostSchema);