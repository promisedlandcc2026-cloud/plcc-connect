// One serverless function for all community endpoints (Vercel Hobby allows 12 functions per app).
// vercel.json rewrites /api/community-<name> to /api/community?fn=community-<name>.
import chat from './_community/community-chat.js';
import comments from './_community/community-comments.js';
import feed from './_community/community-feed.js';
import mentions from './_community/community-mentions.js';
import postManage from './_community/community-post-manage.js';
import post from './_community/community-post.js';
import posts from './_community/community-posts.js';
import reaction from './_community/community-reaction.js';

const HANDLERS = {
  'community-chat': chat,
  'community-comments': comments,
  'community-feed': feed,
  'community-mentions': mentions,
  'community-post-manage': postManage,
  'community-post': post,
  'community-posts': posts,
  'community-reaction': reaction,
};

export default async function handler(req, res) {
  const fn = String((req.query && req.query.fn) || '').trim();
  const target = HANDLERS[fn];
  if (!target) {
    res.status(404).json({ ok: false, error: 'Unknown community endpoint' });
    return;
  }
  if (req.query) delete req.query.fn;
  return target(req, res);
}
