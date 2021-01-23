const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const expressSession = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const socket = require("socket.io");
const dotenv = require("dotenv");
const flash = require("connect-flash");
const Post = require("./models/Post");
const User = require("./models/User");
const port = process.env.PORT || 3000;
const onlineChatUsers = {};

dotenv.config();

const postRoutes = require("./routes/posts");
const userRoutes = require("./routes/users");
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
// mongoose.connect("mongodb://localhost/facebook_clone");
mongoose.connect(
    "mongodb+srv://teste2:1OaAGGUveTSH1rEG@cluster0.cclvq.mongodb.net/www?retryWrites=true&w=majority"
);

// Passing variables to template files
app.use((req, res, next) => {
    res.locals.user = req.user;
    res.locals.login = req.isAuthenticated();
    res.locals.error = req.flash("error");
    res.locals.success = req.flash("success");
    next();
});

// Routes & Middleware
app.use("/", userRoutes);
app.use("/", postRoutes);

const server = app.listen(port, () => {
    console.log("App is running on port " + port);
});

// Socket.io setup
const io = socket(server);

const room = io.of("/chat");
room.on("connection", socket => {
    console.log("new user ", socket.id);

    room.emit("newUser", { socketID: socket.id });

    socket.on("newUser", data => {
        if (!(data.name in onlineChatUsers)) {
            onlineChatUsers[data.name] = data.socketID;
            socket.name = data.name;
            room.emit("updateUserList", Object.keys(onlineChatUsers));
            console.log("Online users: " + Object.keys(onlineChatUsers));
        }
    });

    socket.on("disconnect", () => {
        delete onlineChatUsers[socket.name];
        room.emit("updateUserList", Object.keys(onlineChatUsers));
        console.log(`user ${socket.name} disconnected`);
    });

    socket.on("chat", data => {
        console.log(data);
        if (data.to === "Global Chat") {
            room.emit("chat", data);
        } else if (data.to) {
            room.to(onlineChatUsers[data.name]).emit("chat", data);
            room.to(onlineChatUsers[data.to]).emit("chat", data);
        }
        // console.log(`User ${data.name} sent a message: ${data.message}`);
    });
});
