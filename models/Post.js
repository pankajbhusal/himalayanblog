const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  author: String,
  content: String,
});

const postSchema = new mongoose.Schema({
  title: String,
  intro: String,
  content: String,
  author: String,
  publishDate: { type: Date, default: Date.now },
  image: String,
  link: String,
  comments: [commentSchema],
});

module.exports = mongoose.model("Post", postSchema);
