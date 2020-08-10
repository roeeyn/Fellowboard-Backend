const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const FormData = require("form-data");
const fetch = require("node-fetch");
const path = require("path");
const User = require("./models/User");
const Post = require("./models/Post");
const postRouter = require("./routes/posts.js");
const userRouter = require("./routes/user.js");
require("dotenv").config();

// connect to database
const mongoConnectionURL = process.env.MONGODB_SRV;

mongoose
  .connect(mongoConnectionURL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    dbName: "Dashboard",
    useFindAndModify: false,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log(`${err}: Failed to connect to MongoDB`));

// default all api endpoints to the defined routes in `api.js`
const app = express();
app.use(express.json());

app.use(bodyParser.json());
app.use(bodyParser.json({ type: "text/*" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use("/api/posts", postRouter);
app.use("/api/users", userRouter);
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  next();
});

if (process.env.ENV === "PRODUCTION") {
  const reactPath = path.resolve(__dirname, "..", "client", "build");
  app.use(express.static(reactPath));
  app.get("*", (req, res) => {
    res.sendFile(path.join(reactPath, "index.html"));
  });
}

app.get("/authenticate/user-posts", (req, res) => {
  const { ghUsername } = req.query;
  const queries = [
    User.findOne({ username: ghUsername }),
    Post.find({ $or: [{ creator: ghUsername }, { isPublic: true }] }).sort({ timestamp: -1 }),
  ];
  Promise.all(queries)
    .then(([dbUser, posts]) => {
      const result = { dbUser, posts };
      res.send(result);
    })
    .catch((error) => {
      console.error(error);
      res.send("An error ocurred");
    });
});

app.post("/authenticate", (req, res) => {
  const { client_id, redirect_uri, client_secret, code } = req.body;
  const data = new FormData();
  data.append("client_id", client_id);
  data.append("client_secret", client_secret);
  data.append("code", code);
  data.append("redirect_uri", redirect_uri);

  // Request to exchange code for an access token
  fetch(`https://github.com/login/oauth/access_token`, {
    method: "POST",
    body: data,
  })
    .then((response) => response.text())
    .then((paramsString) => {
      let params = new URLSearchParams(paramsString);
      const access_token = params.get("access_token");
      const scope = params.get("scope");
      const token_type = params.get("token_type");
      // Request to return data of a user that has been authenticated
      return fetch(
        `https://api.github.com/user?access_token=${access_token}&scope=${scope}&token_type=${token_type}`
      );
    })
    .then((response) => response.json())
    .then(async (response) => {
      try {
        const {
          avatar_url: avatarUrl,
          login: ghUsername,
          name: fullname,
          id: githubId,
        } = response;
        const existingUser = await User.find({ username: ghUsername });
        if (existingUser.length == 0) {
          const newUser = new User({
            githubId,
            username: ghUsername,
            fullname,
            avatarUrl,
          });
          const savedUser = await newUser.save();
        }
        return res.status(200).json(response);
      } catch (error) {
        console.error(error);
        return res.status(500).json({ error });
      }
    })
    .catch((error) => {
      return res.status(400).json(error);
    });
});
// handle errors
app.use((err, req, res, next) => {
  const status = err.status || 500;
  if (status === 500) {
    console.log("The server errored when processing a request");
    console.log(err);
  }
  res.status(status);
  res.send({
    status,
    message: err.message,
  });
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Server started on port ${port}`));
