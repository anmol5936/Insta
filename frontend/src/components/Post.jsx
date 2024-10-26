import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Dialog, DialogContent, DialogTrigger } from './ui/dialog';
import { Bookmark, MessageCircle, MoreHorizontal, Send, Share2 } from 'lucide-react';
import { Button } from './ui/button';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import CommentDialog from './CommentDialog';
import { Badge } from './ui/badge';
import { format, isValid } from 'date-fns';
import axios from 'axios';
import { toast } from 'sonner';
import { setPosts } from '@/redux/postSlice';

const Post = ({ post, index }) => {
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const { user } = useSelector((store) => store.auth);
  const { posts } = useSelector((store) => store.post);
  const [liked, setLiked] = useState(post?.likes?.includes(user?._id) || false);
  const [postLike, setPostLike] = useState(post?.likes?.length || 0);
  const [comment, setComment] = useState(post?.comments || []);
  const [isMediaZoomed, setIsMediaZoomed] = useState(false);
  const dispatch = useDispatch();

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return isValid(date) ? format(date, "MMM d, yyyy") : "Date unavailable";
  };

  const postVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { 
        type: "spring",
        stiffness: 100,
        damping: 15,
        delay: index * 0.1 
      },
    },
    hover: {
      y: -5,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10
      }
    }
  };

  const mediaZoomVariants = {
    normal: { scale: 1 },
    zoomed: { scale: 1.05 }
  };

  const likeAnimation = {
    scale: [1, 1.3, 1],
    rotate: [0, -15, 15, -15, 0],
    transition: { duration: 0.5 }
  };

  const iconAnimation = {
    hover: { scale: 1.1, rotate: 5 },
    tap: { scale: 0.95 }
  };

  const changeEventHandler = (e) => {
    const inputText = e.target.value;
    setText(inputText.trim() ? inputText : "");
  };

  const likeOrDislikeHandler = async () => {
    try {
      const action = liked ? "dislike" : "like";
      const res = await axios.get(
        `http://localhost:3000/api/v1/post/${post._id}/${action}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        const updatedLikes = liked ? postLike - 1 : postLike + 1;
        setPostLike(updatedLikes);
        setLiked(!liked);

        const updatedPostData = posts.map((p) =>
          p._id === post._id
            ? {
                ...p,
                likes: liked
                  ? p.likes.filter((id) => id !== user._id)
                  : [...p.likes, user._id],
              }
            : p
        );
        dispatch(setPosts(updatedPostData));
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to update like status");
    }
  };

  const commentHandler = async () => {
    if (!text.trim()) return;
    
    try {
      const res = await axios.post(
        `http://localhost:3000/api/v1/post/${post._id}/comment`,
        { text },
        {
          headers: { "Content-Type": "application/json" },
          withCredentials: true,
        }
      );
      if (res.data.success) {
        const updatedCommentData = [...comment, res.data.comment];
        setComment(updatedCommentData);
        dispatch(setPosts(posts.map((p) =>
          p._id === post._id ? { ...p, comments: updatedCommentData } : p
        )));
        toast.success(res.data.message);
        setText("");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to add comment");
    }
  };

  const bookmarkHandler = async () => {
    try {
      const res = await axios.get(
        `http://localhost:3000/api/v1/post/${post?._id}/bookmark`,
        { withCredentials: true }
      );
      if (res.data.success) {
        setIsBookmarked(!isBookmarked);
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to bookmark post");
    }
  };

  const deletePostHandler = async () => {
    try {
      const res = await axios.delete(
        `http://localhost:3000/api/v1/post/delete/${post?._id}`,
        { withCredentials: true }
      );
      if (res.data.success) {
        dispatch(setPosts(posts.filter((p) => p?._id !== post?._id)));
        toast.success(res.data.message);
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete post");
    }
  };

  const shareHandler = () => {
    if (navigator.share) {
      navigator.share({
        title: `${post.author.username}'s post`,
        text: post.caption,
        url: window.location.href,
      }).catch(console.error);
    } else {
      toast.error("Sharing is not supported on this device");
    }
  };

  return (
    <motion.div
      variants={postVariants}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      className="my-8 w-full max-w-xl mx-auto bg-gradient-to-b from-white to-blue-50 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-all duration-300 border border-blue-100"
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.1 }} 
              transition={{ duration: 0.2 }}
              className="relative"
            >
              <Avatar className="h-12 w-12 ring-2 ring-blue-200 ring-offset-2 cursor-pointer">
                <AvatarImage src={post.author?.profilePicture} alt="profile" />
                <AvatarFallback className="bg-blue-100 text-blue-600 text-lg">
                  {post.author?.username?.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <motion.div
                className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-white"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            </motion.div>
            <div>
              <h1 className="font-semibold text-gray-800 hover:text-blue-600 transition-colors text-lg">
                {post.author?.username}
              </h1>
              <div className="flex items-center gap-2">
                <AnimatePresence>
                  {user?._id === post.author._id && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                    >
                      <Badge variant="secondary" className="bg-blue-100 text-blue-600">
                        Author
                      </Badge>
                    </motion.div>
                  )}
                </AnimatePresence>
                <span className="text-xs text-gray-500">
                  {formatDate(post.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <motion.div
                whileHover={{ rotate: 90 }}
                transition={{ duration: 0.3 }}
              >
                <MoreHorizontal className="cursor-pointer text-gray-600 hover:text-blue-600" />
              </motion.div>
            </DialogTrigger>
            <DialogContent className="flex flex-col items-center gap-2 p-4 bg-white/90 backdrop-blur-sm">
              {post?.author?._id !== user?._id && (
                <Button
                  variant="ghost"
                  className="w-full text-red-500 font-semibold hover:bg-red-50"
                >
                  Unfollow
                </Button>
              )}
              <Button variant="ghost" className="w-full hover:bg-blue-50 text-blue-600">
                Add to favorites
              </Button>
              {user?._id === post?.author._id && (
                <Button
                  onClick={deletePostHandler}
                  variant="ghost"
                  className="w-full text-red-500 hover:bg-red-50"
                >
                  Delete
                </Button>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <motion.div
          variants={mediaZoomVariants}
          animate={isMediaZoomed ? "zoomed" : "normal"}
          whileHover="zoomed"
          onHoverStart={() => setIsMediaZoomed(true)}
          onHoverEnd={() => setIsMediaZoomed(false)}
          className="relative rounded-xl overflow-hidden shadow-inner mb-4"
        >
          {post?.mediaType === 'video' ? (
            <video
              className="w-full aspect-video object-cover"
              src={post.video}
              controls
              preload="metadata"
            />
          ) : (
            <img
              className="w-full aspect-square object-cover transition-transform duration-300"
              src={post.image}
              alt="post content"
              loading="lazy"
            />
          )}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: isMediaZoomed ? 1 : 0 }}
            className="absolute inset-0 bg-black/10"
          />
        </motion.div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-6">
            <motion.div
              whileTap={likeAnimation}
              className="cursor-pointer"
            >
              {liked ? (
                <FaHeart
                  onClick={likeOrDislikeHandler}
                  size={28}
                  className="text-red-500 drop-shadow-sm"
                />
              ) : (
                <FaRegHeart
                  onClick={likeOrDislikeHandler}
                  size={28}
                  className="text-gray-600 hover:text-red-500 transition-colors"
                />
              )}
            </motion.div>
            <motion.div
              variants={iconAnimation}
              whileHover="hover"
              whileTap="tap"
            >
              <MessageCircle
                onClick={() => setOpen(true)}
                className="cursor-pointer text-gray-600 hover:text-blue-600 transition-colors"
                size={28}
              />
            </motion.div>
            <motion.div
              variants={iconAnimation}
              whileHover="hover"
              whileTap="tap"
            >
              <Share2
                onClick={shareHandler}
                className="cursor-pointer text-gray-600 hover:text-blue-600 transition-colors"
                size={26}
              />
            </motion.div>
          </div>
          <motion.div
            variants={iconAnimation}
            whileHover="hover"
            whileTap="tap"
          >
            <Bookmark
              onClick={bookmarkHandler}
              className={`cursor-pointer transition-colors ${
                isBookmarked ? 'text-blue-600 fill-blue-600' : 'text-gray-600 hover:text-blue-600'
              }`}
              size={26}
            />
          </motion.div>
        </div>

        <div className="space-y-3">
          <span className="font-semibold text-gray-800">
            {postLike.toLocaleString()} {postLike === 1 ? 'like' : 'likes'}
          </span>
          <p className="text-gray-800 leading-relaxed">
            <span className="font-semibold mr-2">{post.author?.username}</span>
            {post.caption}
          </p>
          {comment.length > 0 && (
            <motion.span
              whileHover={{ color: "#3B82F6" }}
              onClick={() => setOpen(true)}
              className="cursor-pointer text-sm text-gray-500 block hover:underline"
            >
              View all {comment.length} comments
            </motion.span>
          )}
        </div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 flex items-center gap-3"
        >
          <input
            type="text"
            placeholder="Add a comment..."
            value={text}
            onChange={changeEventHandler}
            className="flex-1 outline-none text-sm bg-white/50 rounded-full px-4 py-3 focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-gray-400"
          />
          <AnimatePresence>
            {text && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={commentHandler}
                className="bg-blue-600 text-white px-4 py-2 rounded-full font-medium text-sm hover:bg-blue-700 transition-colors"
              >
                Post
              </motion.button>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
      <CommentDialog open={open} setOpen={setOpen} />
    </motion.div>
  );
};

export default Post;