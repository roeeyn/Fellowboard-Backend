const fetch = require('node-fetch');
const mongoose = require("mongoose");
const Post = require("./models/Post");
const { auth } = require('google-auth-library');
require("dotenv").config();

const mongoConnectionURL = process.env.MONGODB_SRV; 
const authHeader = `Bearer ${process.env.GITHUB_TOKEN}`; 

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


const issues = "issues";
const pullRequests = "pulls";

/*
org and repo are hard-coded here, will need input from frontend to pass in params
*/
var org = "MLH-Fellowship";
var repo = "httpie";

async function fetchIssues(org, repo) {
    await connectToDB();
    try {
        fetch(`https://api.github.com/repos/${org}/${repo}/${issues}`, {
          headers: {
            Authorization: authHeader
          }
        })
        .then(response => response.json())
        .then(data => {
            var issues = [];
            for(var i=0; i<data.length; i++) {
                var allAssignees = [];

                var dict = data[i].assignees;
                dict.forEach(function(d){
                    allAssignees.push(d.login);
                });
                var issue = {
                    'creator': 'server',
                    'tags': [repo, org],
                    'title': data[i].title,
                    'type': 'github',
                    'timestamp': new Date(data[i].created_at),
                    'isPublic': true,
                    'content': {
                        'url': data[i].url,
                        'body': data[i].body,
                        'state': data[i].state,
                        'creator': data[i].user.login,
                        'allAssignees': allAssignees
                    }
                };
                issues.push(issue);
                addPostToDatabase(issue);

            }
            console.log(issues);
            return issues;
        });
    } catch(err) {
        console.log(err);
    }
}

async function fetchSingleIssue(org, repo, issue) {
    try {
      const resp = await fetch(`https://api.github.com/repos/${org}/${repo}/${issues}/${issue}`, {
        headers: {
          Authorization: authHeader
          }
      });
      const data = await resp.json();
      const post = {
        'creator': '',
        'tags': [repo, org],
        'title': data.title,
        'type': 'github',
        'timestamp': new Date(),
        'isPublic': true,
        'content': {
            'url': data.url,
            'body': data.body,
            'state': data.state,
            'creator': data.user.login,
            'allAssignees': data.assignees
        }
      };
      return post;
    } catch (err) {
      console.log(err);
    }
}


async function fetchPRs(org, repo) {
    await connectToDB();
    try {
        fetch(`https://api.github.com/repos/${org}/${repo}/${pullRequests}`)
        .then(response => response.json())
        .then(data => {
            var PRs = [];
            for(var i=0; i<data.length; i++) {
                var allAssignees = [];

                var dict = data[i].assignees;
                dict.forEach(function(d){
                    allAssignees.push(d.login);
                });

                var PR = {
                    'creator': 'server',
                    'tags': [repo, org],
                    'title': data[i].title,
                    'type': "github",
                    'timestamp': new Date(data[i].created_at),
                    'isPublic': true,
                    'content': {
                        'url': data[i].url,
                        'body': data[i].body,
                        'state': data[i].state,
                        'creator': data[i].user.login,
                        'allAssignees': allAssignees
                    }
                };
                PRs.push(PR);
                addPostToDatabase(PR);
            }
            console.log(PRs);
            return PRs;
        });
    } catch(err) {
        console.log(err);
    }
}

async function fetchSinglePR(org, repo, pr) {
  try {
    const resp = await fetch(`https://api.github.com/repos/${org}/${repo}/${pullRequests}/${pr}`, {
      headers: {
        Authorization: authHeader
        }
    });
    const data = await resp.json();
    const post = {
      'creator': '',
      'tags': [repo, org],
      'title': data.title,
      'type': "github",
      'timestamp': new Date(),
      'isPublic': true,
      'content': {
          'url': data.url,
          'body': data.body,
          'state': data.state,
          'creator': data.user.login,
          'allAssignees': data.assignees
      }
    }
    return post;
  } catch (err) {
    console.log(err);
  }
}

const query = `
{
  organization(login: "MLH-Fellowship") {
    teams(first: 50) {
      edges {
        node {
          description
          name
          id
          members {
            nodes {
              avatarUrl
              bio
              email
              followers {
                totalCount
              }
              following {
                totalCount
              }
              location
              login
              name
              twitterUsername
              url
              websiteUrl
              company
            }
          }
        }
      }
    }
  }
}`;

function getPodName(name, description) {
    if (name.startsWith('Pod')) {
        return description === '' ? name : description;
    } else {
        return name;
    }
}

async function fetchUsers() {
    await connectToDB();
    const response = await fetch(
      'https://api.github.com/graphql',
      {
        method: 'post',
        headers: {
          Authorization: "bearer " + process.env.GITHUB_TOKEN,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query })
      },
    );
    const json = await response.json();
    const teams = json.data.organization.teams.edges;

    const users = [];
    teams.forEach(obj => {
      team = obj.node;

      if (['TTP Fellows (Summer 2020)', 'CTF', 'MLH Fellows (Summer 2020)'].includes(team.name)) return;
      
      const members = team.members.nodes;
      members.forEach(user => {
          const tags = ['Summer-2020', team.name];
          if (team.name.startsWith('Pod')) {
            tags.push('Fellow');
          }
          var singleUser = {
            'creator': 'server',
            'tags': tags,
            'title': (user.name !== null) ? user.name : user.login.toLowerCase(),
            'type': 'contacts',
            'isPublic': true,
            'content': {
                'username': user.login.toLowerCase(),
                'avatar': user.avatarUrl,
                'email': user.email,
                'github_url':user.url,
                'bio': user.bio,
                'location': user.location,
                'pod': getPodName(team.name, team.description)

            }
          };
        users.push(singleUser);
        addPostToDatabase(singleUser);
      });
    });
    // console.log(users)
  }

async function addPostToDatabase(post) {
    var toInsert = Post(post);
    try {
        const exists = await Post.findOne(post);
        if(!exists) {
            await toInsert.save();
            console.log(`added ${post.title} to database.`);
        } else {
            console.log(`${post.title} already exists.`);
        }
    } catch (e) {
        console.log(e);
    }
}

if (module === require.main) {
  fetchUsers().catch(console.error);
}

module.exports = {fetchIssues, fetchPRs, fetchUsers, fetchSingleIssue, fetchSinglePR};