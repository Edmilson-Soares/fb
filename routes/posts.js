const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const multer = require("multer");
const cloudinary = require("cloudinary");
const router = express.Router();

// Multer setup
const storage = multer.diskStorage({
    filename: (req, file, callback) => {
        callback(null, Date.now() + file.originalname);
    }
});

const imageFilter = (req, file, callback) => {
    if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
        return callback(new Error("Only image files are allowed!"), false);
    }
    callback(null, true);
};

const upload = multer({ storage: storage, fileFilter: imageFilter });

// Cloudinary setup
cloudinary.config({
    cloud_name: "idanlo",
    api_key: "684776635339213",
    api_secret: "zsvfzGd1EA8zK4CfPAsrMrJxDW4"
});
// Middleware
const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("/user/login");
};

// Index page
router.get("/", isLoggedIn, (req, res) => {
    // get all posts
    // Post.find({}, (err, posts) => {
    User.findById(req.user._id)
        .populate({
            // get friends posts
            path: "friends",
            populate: {
                path: "posts",
                model: "Post"
            }
        })
        .populate("posts") // get current users posts
        .exec((err, user) => {
            if (err) {
                console.log(err);
                req.flash(
                    "error",
                    "There has been an error finding all posts."
                );
                res.render("posts/index"); // posts will be undefined/null
            } else {
                // req.sessionStore.sessions has all sessions open with the users email so you can see who is logged in.
                // it shows the username even if the user's browser is not open and the session is just open so it's pretty much useless
                // if i do fix it, i need to add the friendsOnline array in the res.render function so that the ejs template will get the variable

                let posts = [];
                for (var i = 0; i < user.friends.length; i++) {
                    for (var j = 0; j < user.friends[i].posts.length; j++) {
                        posts.push(user.friends[i].posts[j]);
                    }
                }
                for (var i = 0; i < user.posts.length; i++) {
                    posts.push(user.posts[i]);
                }
                if (posts) {
                    res.render("posts/index", {
                        posts: posts
                    });
                } else {
                    res.render("posts/index", { posts: null });
                }
            }
        });
});

// user likes a post
router.get("/post/:id/like", isLoggedIn, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err);
            req.flash(
                "There has been an error trying to like this post, are you logged in?"
            );
            rse.redirect("back");
        } else {
            Post.findById(req.params.id, (err, post) => {
                if (err) {
                    console.log(err);
                    req.flash(
                        "There has been an error trying to like this post, are you sure you are in the correct URL?"
                    );
                    res.redirect("back");
                } else {
                    // check if user already likes this post
                    for (let i = 0; i < user.liked.length; i++) {
                        if (user.liked[i].equals(post._id)) {
                            // req.flash with error saying he already liked this post
                            req.flash("error", "You already liked this post");
                            return res.redirect("back");
                        }
                    }
                    // increase the likes on the post and add it to user's array. req.flash with success
                    post.likes = post.likes + 1;
                    post.save();
                    user.liked.push(post._id);
                    user.save();
                    req.flash(
                        "success",
                        `You successfully liked ${
                            post.creator.firstName
                        }'s post`
                    );
                    res.redirect("back");
                }
            });
        }
    });
});

// New Post GET Route
router.get("/post/new", isLoggedIn, (req, res) => {
    res.render("posts/new");
});

// New Post POST Route
router.post("/post/new", isLoggedIn, upload.single("image"), (req, res) => {
    if (req.body.content) {
        let newPost = {};
        if (req.file) {
            cloudinary.uploader.upload(req.file.path, result => {
                // set image url
                newPost.image = result.secure_url;
                newPost.creator = req.user;
                newPost.time = new Date();
                newPost.likes = 0;
                newPost.content = req.body.content;
                Post.create(newPost, (err, post) => {
                    if (err) {
                        console.log(err);
                    } else {
                        req.user.posts.push(post._id);
                        req.user.save();
                        res.redirect("/");
                    }
                });
            });
        } else {
            newPost.image = null;
            newPost.creator = req.user;
            newPost.time = new Date();
            newPost.likes = 0;
            newPost.content = req.body.content;
            Post.create(newPost, (err, post) => {
                if (err) {
                    console.log(err);
                } else {
                    req.user.posts.push(post._id);
                    req.user.save();
                    res.redirect("/");
                }
            });
        }
    }
});

router.get("/post/:id", isLoggedIn, (req, res) => {
    Post.findById(req.params.id)
        .populate("comments")
        .exec((err, post) => {
            if (err) {
                console.log(err);
                req.flash("error", "There has been an error finding this post");
                res.redirect("back");
            } else {
                res.render("posts/show", { post: post });
            }
        });
});

router.get("/post/:id/comments/new", isLoggedIn, (req, res) => {
    Post.findById(req.params.id, (err, post) => {
        if (err) {
            console.log(err);
            req.flash(
                "error",
                "There has been an error trying to comment on this post"
            );
            res.redirect("back");
        } else {
            res.render("comments/new", { post: post });
        }
    });
});

router.post("/post/:id/comments/new", isLoggedIn, (req, res) => {
    Post.findById(req.params.id, (err, post) => {
        if (err) {
            console.log(err);
            req.flash("error", "There has been an error posting your comment");
            res.redirect("back");
        } else {
            Comment.create({ content: req.body.content }, (err, comment) => {
                if (err) {
                    console.log(err);
                    req.flash(
                        "error",
                        "Something went wrong with posting your comment"
                    );
                    res.redirect("back");
                } else {
                    comment.creator._id = req.user._id;
                    comment.creator.firstName = req.user.firstName;
                    comment.creator.lastName = req.user.lastName;
                    comment.save();
                    post.comments.push(comment);
                    post.save();
                    req.flash("success", "Successfully posted your comment");
                    res.redirect("/post/" + post._id);
                }
            });
        }
    });
});

module.exports = router;
