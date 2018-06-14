const express = require("express");
const Post = require("../models/Post");
const User = require("../models/User");
const Comment = require("../models/Comment");
const passport = require("passport");
const router = express.Router();

// Middleware
const isLoggedIn = (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    req.flash("error", "You need to be logged in to do that!");
    res.redirect("/user/login");
};

// Index page
router.get("/", (req, res) => {
    // get all posts
    if (req.isAuthenticated()) {
        // Post.find({}, (err, posts) => {
        User.findById(req.user._id).populate({ // get friends posts
            path: "friends",
            populate: {
                path: "posts",
                model: "Post"
            },
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
                // TODO: see who is online inside the current user's friend list
                let friendsOnline = [];
                // if user has friends
                if (req.user.friends.length > 0) {
                    // check which one is online
                    let sessions = req.sessionStore.sessions
                    for (let i in sessions) {
                        let sess = JSON.parse(sessions[i]);
                        let useremail = sess.passport.user;
                        for(var j = 0; j < user.friends.length; j++) {
                            if (user.friends[j].username === useremail) {
                                friendsOnline.push(user.friends[j]);
                            }
                        }
                    }
                }
                let posts = [];
                for(var i = 0; i < user.friends.length; i++) {
                    for(var j = 0; j  < user.friends[i].posts.length; j++) {
                        posts.push(user.friends[i].posts[j])
                    }
                }
                for(var i = 0; i < user.posts.length; i++) {
                    posts.push(user.posts[i]);
                }
                if(posts) {
                    if (friendsOnline.length > 0) {
                        res.render("posts/index", { posts: posts, friendsOnline: friendsOnline});
                    } else {
                        res.render("posts/index", { posts: posts, friendsOnline: null});
                    }
                } else {
                    res.render("posts/index", { posts: null })
                }
            }
        });
    } else {
        // user is not logged in
        res.redirect("/user/login");
    }
});

// Users

// New user GET route - show register form
router.get("/user/register", (req, res) => {
    res.render("users/register");
});

// New user POST route - handle register logic and sign the user in
router.post("/user/register", (req, res) => {
    if (
        req.body.username &&
        req.body.firstname &&
        req.body.lastname &&
        req.body.password
    ) {
        let newUser = new User({
            username: req.body.username,
            firstName: req.body.firstname,
            lastName: req.body.lastname
        });
        User.register(newUser, req.body.password, (err, user) => {
            if (err) {
                req.flash("error", err.message);
                res.redirect("/");
            } else {
                passport.authenticate("local")(req, res, function() {
                    console.log(req.user);
                    req.flash(
                        "success",
                        "Success! You are registered and logged in!"
                    );
                    res.redirect("/");
                });
            }
        });
    }
});

// Log in GET route - show login form
router.get("/user/login", (req, res) => {
    res.render("users/login");
});

// Log in POST route - handle login logic
router.post(
    "/user/login",
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/user/login"
    }),
    (req, res) => {
        req.flash("success", "Success! You are logged in!");
    }
);

// All users GET route
router.get("/user/all", isLoggedIn, (req, res) => {
    User.find({}, (err, users) => {
        if (err) {
            console.log(err);
            req.flash(
                "error",
                "There has been a problem getting all users info."
            );
            res.redirect("/");
        } else {
            res.render("users/users", { users: users });
        }
    });
});

// Logout
router.get("/user/logout", (req, res) => {
    req.logout();
    res.redirect("back");
});

// Posts

// New Post GET Route
router.get("/post/new", isLoggedIn, (req, res) => {
    res.render("posts/new");
});

// New Post POST Route
router.post("/post/new", isLoggedIn, (req, res) => {
    if (req.body.content) {
        Post.create(
            {
                content: req.body.content,
                time: new Date(),
                creator: req.user
            },
            (err, post) => {
                if (err) {
                    console.log(err);
                } else {
                    req.user.posts.push(post._id);
                    req.user.save()
                    res.redirect("/");
                }
            }
        );
    }
});

// User Profile
router.get("/user/:id/profile", isLoggedIn, (req, res) => {
    // getting the user data (including friends and friend requests)
    User.findById(req.params.id).populate("friends").populate("friendRequests").exec((err, user) => {
        if (err) {
            console.log(err);
            req.flash("error", "There has been an error.");
            res.redirect("back");
        } else {
            // render the page without the friends array.
            res.render("users/user", { userData: user }); // im calling it userData because i have a local template variable called user and i don't want to over-write it
        }
    });
});

router.get("/user/:id/add", isLoggedIn, (req, res) => {
    // First finding the logged in user
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err);
            req.flash(
                "error",
                "There has been an error adding this person to your friends list"
            );
            res.redirect("back");
        } else {
            // finding the user that needs to be added
            User.findById(req.params.id, (err, foundUser) => {
                if (err) {
                    console.log(err);
                    req.flash("error", "Person not found");
                    res.redirect("back");
                } else {
                    // FOUNDUSER IS THE USER THAT THE LOGGED IN USER WANTS TO ADD
                    // USER IS THE CURRENT LOGGED IN USER

                    // checking if the user is already in foundUsers friend requests or friends list
                    if (
                        foundUser.friendRequests.find(o =>
                            o._id.equals(user._id)
                        )
                    ) {
                        req.flash(
                            "error",
                            `You have already sent a friend request to ${
                                user.firstName
                            }`
                        );
                        return res.redirect("back");
                    } else if (
                        foundUser.friends.find(o => o._id.equals(user._id))
                    ) {
                        req.flash(
                            "error",
                            `The user ${
                                foundUser.firstname
                            } is already in your friends list`
                        );
                        return res.redirect("back");
                    }
                    let currUser = {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName
                    };
                    foundUser.friendRequests.push(currUser);
                    foundUser.save();
                    req.flash(
                        "success",
                        `Success! You sent ${
                            foundUser.firstName
                        } a friend request!`
                    );
                    res.redirect("back");
                }
            });
        }
    });
});

router.get("/user/:id/accept", isLoggedIn, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err);
            req.flash(
                "error",
                "There has been an error finding your profile, are you connected?"
            );
            res.redirect("back");
        } else {
            User.findById(req.params.id, (err, foundUser) => {
                let r = user.friendRequests.find(o =>
                    o._id.equals(req.params.id)
                );
                if (r) {
                    let index = user.friendRequests.indexOf(r);
                    user.friendRequests.splice(index, 1);
                    let friend = {
                        _id: foundUser._id,
                        firstName: foundUser.firstName,
                        lastName: foundUser.lastName
                    };
                    user.friends.push(friend);
                    user.save();

                    let currUser = {
                        _id: user._id,
                        firstName: user.firstName,
                        lastName: user.lastName
                    };
                    foundUser.friends.push(currUser);
                    foundUser.save();
                    req.flash(
                        "success",
                        `You and ${foundUser.firstName} are now friends!`
                    );
                    res.redirect("back");
                } else {
                    req.flash(
                        "error",
                        "There has been an error, is the profile you are trying to add on your requests?"
                    );
                    res.redirect("back");
                }
            });
        }
    });
});

router.get("/user/:id/decline", isLoggedIn, (req, res) => {
    User.findById(req.user._id, (err, user) => {
        if (err) {
            console.log(err);
            req.flash("error", "There has been an error declining the request");
            res.redirect("back");
        } else {
            User.findById(req.params.id, (err, foundUser) => {
                if (err) {
                    console.log(err);
                    req.flash(
                        "error",
                        "There has been an error declining the request"
                    );
                    res.redirect("back");
                } else {
                    // remove request
                    let r = user.friendRequests.find(o =>
                        o._id.equals(foundUser._id)
                    );
                    if (r) {
                        let index = user.friendRequests.indexOf(r);
                        user.friendRequests.splice(index, 1);
                        user.save();
                        req.flash("success", "You declined");
                        res.redirect("back");
                    }
                }
            });
        }
    });
});

router.get("/post/:id", isLoggedIn, (req, res) => {
    Post.findById(req.params.id).populate("comments").exec((err, post) => {
        if (err) {
            console.log(err);
            req.flash("error", "There has been an error finding this post");
            res.redirect("back");
        } else {
            res.render("posts/show", { post: post });
        }
    })
})

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
            Comment.create({content: req.body.content}, (err, comment) => {
                if (err) {
                    console.log(err);
                    req.flash("error", "Something went wrong with posting your comment")
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
            })
        }
    })
});

module.exports = router;
