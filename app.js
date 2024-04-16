const express = require("express");
const app = express();
const session = require("express-session");
const MongoStore = require("connect-mongo");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const bcrypt = require("bcrypt");
const User = require("./models/User");
const Post = require("./models/Post");
// Set the view engine to EJS
app.set("view engine", "ejs");

// Serve static files from the public directory
app.use(express.static("public"));

// Parse URL-encoded bodies (as sent by HTML forms)
app.use(bodyParser.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Connect to MongoDB database
mongoose
  .connect("mongodb+srv://pankajbhusal11:2k8otCYd6vc3u8ap@cluster0.n5q2szl.mongodb.net/")
  .then(() => console.log("Connected to DB"))
  .catch((err) => console.log(err));

// Set up session middleware
app.use(
  session({
    secret: "your_secret_key",
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: "mongodb+srv://pankajbhusal11:2k8otCYd6vc3u8ap@cluster0.n5q2szl.mongodb.net/",
    }),
    cookie: { maxAge: 180 * 60 * 1000 }, // Session expiration time (180 minutes)
  })
);

// Middleware to check if the user is authenticated
function checkIfUserAuthenticated(req, res, next) {
  if (req.session.userId) return next();
  res.redirect("/viewLoginPage");
}

// Middleware to check if the user is an admin
function checkIfAdmin(req, res, next) {
  if (req.session.role === "admin") return next();
  res.status(403).send("Not authorized");
}

// Route to display home page
app.get("/", async (req, res) => {
  const posts = await Post.find().sort({ publishDate: -1 }).limit(10);
  res.render("viewHomePage", { posts, req });
});

// Route to display all posts
app.get("/view-all-posts", async (req, res) => {
  try {
    const posts = await Post.find().sort({ publishDate: -1 });
    res.render("viewAllPosts", { posts, req });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching all posts");
  }
});

// Route to display post details
app.get("/postdetails/:id", async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).send("Post not found");
    }
    const user = await User.findById(req.session.userId);
    res.render("viewPostDetails", { post, username: user?.username, req });
  } catch (error) {
    console.log(error);
    res.status(500).send("Error fetching post details");
  }
});

// Route to display login page
app.get("/viewLoginPage", (req, res) => {
  res.render("viewLoginPage", { message: req.session.message, req });
});

// Route to handle user login
app.post("/viewLoginPage", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).send("User not found");
  }
  user.comparePassword(password, (err, isMatch) => {
    if (err) {
      console.error("Error comparing passwords:", err);
      return res.status(500).send("Internal server error");
    }

    if (!isMatch) {
      console.log("Incorrect password:", password);
      return res.status(401).send("Incorrect password");
    }
    req.session.userId = user._id;
    req.session.role = user.role;
    res.redirect(user.role === "admin" ? "/admindashboard" : "/");
  });
});

// Route to display admin dashboard
app.get(
  "/admindashboard",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    const posts = await Post.find();
    const users = await User.find();
    res.render("viewDashboardAdmin", { posts, req, users });
  }
);

// Route to display post details for admin
app.get(
  "/admin/postdetails/:id",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    try {
      const post = await Post.findById(req.params.id);
      if (!post) {
        return res.status(404).send("Post not found");
      }
      const user = await User.findById(req.session.userId);
      res.render("viewPostDetails", { post, username: user?.username, req });
    } catch (error) {
      console.log(error);
      res.status(500).send("Error fetching post details");
    }
  }
);

// Route to display post details for admin
app.get(
  "/admin/posts/edit/:id",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    const post = await Post.findById(req.params.id);
    res.render("viewEditPostPage", { post, req });
  }
);

// Route to update post details
app.post(
  "/admin/posts/edit/:id",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    const { title, intro, content, author, image } = req.body;
    await Post.findByIdAndUpdate(req.params.id, {
      title,
      intro,
      content,
      author,
      image,
    });
    res.redirect("/admindashboard");
  }
);

// Route to display form to create new user
app.get(
  "/admin/users/new",
  checkIfUserAuthenticated,
  checkIfAdmin,
  (req, res) => {
    res.render("viewCreateUserScreen", { req });
  }
);

// Route to create a new user
app.post(
  "/admin/users/create",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    try {
      const { username, email, password, role } = req.body;
      console.log("User data to be saved:", {
        username,
        email,
        password,
        role,
      });

      const newUser = new User({
        username,
        email,
        password,
        role,
      });
      await newUser.save();
      console.log("User saved to database:", newUser);
      res.redirect("/admindashboard");
    } catch (error) {
      console.log(error);
      res.status(500).send("Error creating new user");
    }
  }
);

// Route to display form to edit user
app.get(
  "/admin/users/edit/:id",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    try {
      const user = await User.findById(req.params.id);
      res.render("viewEditUserPage", { user, req });
    } catch (error) {
      console.log(error);
      res.status(500).send("Error fetching user data");
    }
  }
);

// Route to update user details
app.post(
  "/admin/users/edit/:id",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    try {
      const { username, email, password, role } = req.body;
      const hashedPassword = await bcrypt.hash(password, 12);
      await User.findByIdAndUpdate(req.params.id, {
        username,
        email,
        password: hashedPassword,
        role,
      });
      res.redirect("/admindashboard");
    } catch (error) {
      console.log(error);
      res.status(500).send("Error updating user details");
    }
  }
);

// Route to search for users
app.get(
  "/admin/users/search",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    try {
      const { query } = req.query;
      const users = await User.find({
        $or: [
          { username: { $regex: new RegExp(query, "i") } },
          { email: { $regex: new RegExp(query, "i") } },
        ],
      });
      const posts = await Post.find();

      res.render("viewDashboardAdmin", { users, posts, req });
    } catch (error) {
      console.log(error);
      res.status(500).send("Error searching users");
    }
  }
);

// Route to delete a user
app.get(
  "/admin/users/delete/:id",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    try {
      await User.findByIdAndDelete(req.params.id);
      res.redirect("/admindashboard");
    } catch (error) {
      console.log(error);
      res.status(500).send("Error deleting user");
    }
  }
);

// Route to delete a post
app.get(
  "/admin/posts/delete/:id",
  checkIfUserAuthenticated,
  checkIfAdmin,
  async (req, res) => {
    await Post.findByIdAndDelete(req.params.id);
    res.redirect("/admindashboard");
  }
);

// Route to display form to create a new post
app.get("/posts/new", checkIfUserAuthenticated, (req, res) => {
  res.render("viewCreateNewPost", { req });
});

// Route to display form to create a new post
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/");
    }
    res.clearCookie("connect.sid");
    res.redirect("/viewLoginPage");
  });
});

// Route to create a new post
app.post("/user/posts", checkIfUserAuthenticated, async (req, res) => {
  const { title, intro, content, author, image, link } = req.body;
  const viewCreateNewPost = new Post({
    title,
    intro,
    content,
    author,
    image,
    link,
  });
  await viewCreateNewPost.save();
  res.redirect("/");
});

// Route to add a comment to a post
app.post("/posts/:postId/comments", async (req, res) => {
  try {
    const { postId } = req.params;
    const { author, content } = req.body;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).send("Post not found");
    }

    if (!post.comments) {
      post.comments = [];
    }

    post.comments.push({ author, content });
    await post.save();

    res.redirect(`/postdetails/${postId}`);
  } catch (error) {
    console.log(error);
    res.status(500).send("Error adding comment");
  }
});

app.get("/viewAboutus", async (req, res) => {
  const posts = await Post.find().sort({ publishDate: -1 }).limit(10);
  res.render("viewAboutus", { posts, req });
});

// Start the server
app.listen(PORT, () =>
  console.log(`Server running on port http://localhost:${PORT}`)
);
