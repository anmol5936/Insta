import sharp from 'sharp';
import Post from "../models/post.model.js";
import cloudinary from "../utils/cloudinary.js";
import fs from "fs";
import { promisify } from "util";
import path from "path";
import { User } from '../models/user.model.js';

const unlinkAsync = promisify(fs.unlink);

export const addNewPost = async (req, res) => {
  try {
    const { caption } = req.body;
    const file = req.file;

    // Get user ID from auth token
    const userId = req.id; // Assuming req.id is correctly set by the authentication middleware

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    if (!file && !caption) {
      return res.status(400).json({
        success: false,
        message: "Please provide either a caption or media file",
      });
    }

    let mediaUrl = "";
    let mediaType = "";

    if (file) {
      try {
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'video/mp4'];
        if (!allowedTypes.includes(file.mimetype)) {
          await unlinkAsync(file.path);
          return res.status(400).json({
            success: false,
            message: "Invalid file type. Only JPEG, PNG, and MP4 are allowed",
          });
        }

        // Upload to Cloudinary
        const result = await cloudinary.uploader.upload(file.path, {
          resource_type: "auto",
          folder: "posts",
          transformation: file.mimetype.startsWith('image') ? [
            { width: 1080, height: 1080, crop: "limit" }
          ] : undefined,
        });

        mediaUrl = result.secure_url;
        mediaType = result.resource_type;

        // Remove temporary file after successful upload
        await unlinkAsync(file.path);
      } catch (uploadError) {
        console.error("Upload error:", uploadError);
        // If file exists but upload failed, clean up
        if (file && fs.existsSync(file.path)) {
          await unlinkAsync(file.path);
        }
        return res.status(500).json({
          success: false,
          message: `Upload failed: ${uploadError.message}`,
        });
      }
    }

    const postData = {
      caption,
      author: userId,
      ...(mediaUrl && {
        [mediaType === 'video' ? 'video' : 'image']: mediaUrl,
        mediaType,
      }),
    };

    const post = await Post.create(postData);

    const populatedPost = await Post.findById(post._id)
      .populate('author', 'username name profilePicture')
      .populate('comments.author', 'username name profilePicture');

    res.status(201).json({
      success: true,
      message: "Post created successfully",
      post: populatedPost,
    });
  } catch (error) {
    console.error("Error in addNewPost:", error);
    // Clean up temporary file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      await unlinkAsync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: error.message || "Failed to create post",
    });
  }
};

export const getAllPost = async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('author', 'username profilePicture')
      .populate('comments.author', 'username profilePicture')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUserPost = async (req, res) => {
  try {
    const posts = await Post.find({ author: req.user._id })
      .populate('author', 'username profilePicture')
      .populate('comments.author', 'username profilePicture')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      posts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.likes.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "Post already liked",
      });
    }

    post.likes.push(req.user._id);
    await post.save();

    res.status(200).json({
      success: true,
      message: "Post liked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const dislikePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (!post.likes.includes(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: "Post not liked yet",
      });
    }

    post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    await post.save();

    res.status(200).json({
      success: true,
      message: "Post disliked successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const addComment = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const comment = {
      content: req.body.text,
      author: req.user._id,
    };

    post.comments.push(comment);
    await post.save();

    const populatedComment = await Post.findOne(
      { _id: post._id, "comments._id": post.comments[post.comments.length - 1]._id }
    )
    .populate('comments.author', 'username profilePicture')
    .then(doc => doc.comments[doc.comments.length - 1]);

    res.status(200).json({
      success: true,
      message: "Comment added successfully",
      comment: populatedComment,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getCommentsOfPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('comments.author', 'username profilePicture');
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.status(200).json({
      success: true,
      comments: post.comments,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized to delete this post",
      });
    }

    // Delete media from cloudinary if exists
    if (post.image || post.video) {
      const publicId = post.image || post.video;
      await cloudinary.uploader.destroy(publicId);
    }

    await post.deleteOne();

    res.status(200).json({
      success: true,
      message: "Post deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const bookmarkPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const user = await User.findById(req.user._id);
    
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    const isBookmarked = post.bookmarks.includes(req.user._id);

    if (isBookmarked) {
      post.bookmarks = post.bookmarks.filter(id => id.toString() !== req.user._id.toString());
      user.bookmarks = user.bookmarks.filter(id => id.toString() !== post._id.toString());
      await Promise.all([post.save(), user.save()]);
      
      res.status(200).json({
        success: true,
        message: "Post removed from bookmarks",
      });
    } else {
      post.bookmarks.push(req.user._id);
      user.bookmarks.push(post._id);
      await Promise.all([post.save(), user.save()]);
      
      res.status(200).json({
        success: true,
        message: "Post bookmarked successfully",
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};