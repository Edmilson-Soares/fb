const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const expressSession = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const socket = require("socket.io");
const flash = require("connect-flash");
const Post = require("./models/Post");
const User = require("./models/User");
const port = process.env.port || 3000;
const onlineChatUsers = [];

const routes = require("./routes/routes");
const app = express();

// Set view engine to ejs so that template files will be ejs files
app.set("view engine", "ejs");
// Set up express session
app.use(
    expressSession({
        secret: "secretKey",
        resave: false,
        saveUninitialized: false
    })
);

// Set up passport for authentication
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// Set up body parser
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Set up flash (alerts)
app.use(flash());

// Connect to MongoDB database
mongoose.connect("mongodb://localhost/facebook_clone");

// Passing variables to template files
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.login = req.isAuthenticated();
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

// Routes & Middleware
app.use("/", routes);

const server = app.listen(port, () => {
    console.log("App is running on port " + port);
});

// Socket.io setup
const io = socket(server);

const room = io.of("/chat");
room.on("connection", socket => {
    console.log(socket);
    console.log("new user ", socket.id);
    // onlineChatUsers.push({
    //     _id: req.user._id,

    // });
    room.emit("newUser", { socketID: socket.id });

    socket.on("newUser", data => {
        if (!onlineChatUsers.find(o => o.name === data.name)) {
            onlineChatUsers.push(data);
            room.emit("updateUserList", onlineChatUsers);
            console.log(onlineChatUsers);
        }
    });

    socket.on("disconnect", () => {
        let dcUser = onlineChatUsers.find(o => o.socketID === socket.id);
        let index = onlineChatUsers.indexOf(dcUser);
        onlineChatUsers.splice(index, 1);
        room.emit("updateUserList", onlineChatUsers);
        console.log(`user ${socket.id} disconnected`);
    });

    socket.on("chat", data => {
        console.log(data);
        room.emit("chat", data);
    });
});
