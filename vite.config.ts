import path from 'path';
import type { IncomingMessage, ServerResponse } from 'http';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import memberSelfHandler from './api/member-self.js';
import authPhoneHandler from './api/auth-phone.js';
import communityFeedHandler from './api/community-feed.js';
import communityPostHandler from './api/community-post.js';
import communityPostsHandler from './api/community-posts.js';
import communityReactionHandler from './api/community-reaction.js';
import communityCommentsHandler from './api/community-comments.js';
import communityPostManageHandler from './api/community-post-manage.js';
import communityMentionsHandler from './api/community-mentions.js';
import memberNotificationsHandler from './api/member-notifications.js';
import communityChatHandler from './api/community-chat.js';
import familyHuddleHandler from './api/family-huddle.js';
import kidsPlansHandler from './api/kids-plans.js';
import serveHandler from './api/serve.js';
import vaultNewsHandler from './api/vault-news.js';
import { handlePrayerBridge as prayerHandler } from './api/_utils/prayerBridge.js';
import { handleIntercessorsBridge as intercessorsHandler } from './api/_utils/intercessorsBridge.js';
import { handleBibleBridge as bibleHandler } from './api/_utils/bibleBridge.js';
import { handleArkBridge as arkHandler } from './api/_utils/arkBridge.js';
import { handleGalleryBridge as galleryHandler } from './api/_utils/galleryBridge.js';

const MAX_DEV_BODY_BYTES = 8192;
/** Matches api/_utils/communityPostCreateSanitize MAX_POST_CREATE_BODY_BYTES */
const MAX_DEV_POST_CREATE_BODY_BYTES = Math.floor(4 * 1024 * 1024);

async function readRawBody(req: IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        finish(null);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => finish(null));
  });
}

async function vercelLike(req: IncomingMessage, bodyLimit = MAX_DEV_BODY_BYTES) {
  const url = new URL(req.url || '/', 'http://localhost');
  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  const headers: Record<string, string | undefined> = {
    authorization: req.headers.authorization,
    'content-type': typeof req.headers['content-type'] === 'string' ? req.headers['content-type'] : undefined,
  };

  let body: unknown = undefined;
  if (req.method === 'PATCH' || req.method === 'POST' || req.method === 'PUT') {
    const raw = await readRawBody(req, bodyLimit);
    if (raw == null) {
      body = null;
    } else if (raw.length === 0) {
      body = undefined;
    } else {
      try {
        body = JSON.parse(raw);
      } catch {
        body = raw;
      }
    }
  }

  return {
    method: req.method || 'GET',
    headers,
    query,
    body,
  };
}

function vercelLikeRes(res: ServerResponse) {
  return {
    setHeader: (k: string, v: string) => {
      res.setHeader(k, v);
    },
    status(code: number) {
      res.statusCode = code;
      return {
        json(body: unknown) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(body));
        },
      };
    },
  };
}

function connectApiDevBridge() {
  return {
    name: 'connect-api-dev-bridge',
    configureServer(server) {
      server.middlewares.use('/api/member-self', async (req, res) => {
        try {
          await memberSelfHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'We could not verify your member access right now. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/intercessors', async (req, res) => {
        try {
          await intercessorsHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(JSON.stringify({ ok: false, code: 'vault_unavailable', message: 'We couldn’t load the prayer list. Please try again.' }));
        }
      });

      server.middlewares.use('/api/gallery', async (req, res) => {
        try {
          await galleryHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, code: 'unavailable', message: 'We couldn’t load the gallery.' }));
        }
      });

      server.middlewares.use('/api/ark', async (req, res) => {
        try {
          await arkHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, code: 'unavailable', error: 'The Ark is not available right now.' }));
        }
      });
      server.middlewares.use('/api/bible', async (req, res) => {
        try {
          await bibleHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ ok: false, code: 'unavailable', message: 'NIV isn’t available right now.' }));
        }
      });
      server.middlewares.use('/api/prayer', async (req, res) => {
        try {
          await prayerHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'We couldn’t send your prayer request. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/auth-phone', async (req, res) => {
        try {
          await authPhoneHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Phone sign-in is temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/community-feed', async (req, res) => {
        try {
          await communityFeedHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Community is temporarily unavailable. Please try again.',
            })
          );
        }
      });

      // Register plural create route before singular read so `/api/community-posts`
      // is not captured by the `/api/community-post` prefix matcher.
      server.middlewares.use('/api/community-posts', async (req, res) => {
        try {
          await communityPostsHandler(
            await vercelLike(req, MAX_DEV_POST_CREATE_BODY_BYTES),
            vercelLikeRes(res)
          );
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message:
                'We couldn’t publish your post. Your draft is still here so you can try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/community-post', async (req, res) => {
        try {
          await communityPostHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Community is temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/community-reaction', async (req, res) => {
        try {
          await communityReactionHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'We couldn’t update your reaction right now. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/community-comments', async (req, res) => {
        try {
          await communityCommentsHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Comments are temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/community-post-manage', async (req, res) => {
        try {
          await communityPostManageHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'We couldn’t update that post right now. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/community-mentions', async (req, res) => {
        try {
          await communityMentionsHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message:
                'Member search is temporarily unavailable. You can still post without mentions.',
            })
          );
        }
      });

      server.middlewares.use('/api/community-chat', async (req, res) => {
        try {
          await communityChatHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Chat is temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/family-huddle', async (req, res) => {
        try {
          await familyHuddleHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Family Huddle is temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/kids-plans', async (req, res) => {
        try {
          await kidsPlansHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Kids Plans are temporarily unavailable. Please try again.',
            })
          );
        }
      });

      // Preserve public /api/latest-youtube URL (Hobby: folded into family-huddle).
      server.middlewares.use('/api/latest-youtube', async (req, res) => {
        try {
          const fakeReq = await vercelLike(req);
          fakeReq.query = { ...(fakeReq.query || {}), resource: 'youtube' };
          await familyHuddleHandler(fakeReq, vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Failed to fetch latest video' }));
        }
      });

      server.middlewares.use('/api/member-notifications', async (req, res) => {
        try {
          await memberNotificationsHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Notifications are temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/serve', async (req, res) => {
        try {
          await serveHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'serve_unavailable',
              message: 'Serve is temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/vault-health', async (req, res) => {
        try {
          const fakeReq = await vercelLike(req);
          fakeReq.query = { ...(fakeReq.query || {}), probe: 'health' };
          await vaultNewsHandler(fakeReq, vercelLikeRes(res));
        } catch {
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(JSON.stringify({ ok: true, database: 'unavailable' }));
        }
      });

      // Hobby: check-in points / member pass / season ride on the vault-news function.
      server.middlewares.use('/api/checkin-points', async (req, res) => {
        try {
          const fakeReq = await vercelLike(req);
          fakeReq.query = { ...(fakeReq.query || {}), bridge: 'points' };
          await vaultNewsHandler(fakeReq, vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Check-in points are temporarily unavailable. Please try again.',
            })
          );
        }
      });

      server.middlewares.use('/api/vault-news', async (req, res) => {
        try {
          await vaultNewsHandler(await vercelLike(req), vercelLikeRes(res));
        } catch {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'private, no-store');
          res.end(
            JSON.stringify({
              ok: false,
              code: 'vault_unavailable',
              message: 'Vault News is temporarily unavailable. Please try again.',
            })
          );
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (env.VAULT_API_ORIGIN && !process.env.VAULT_API_ORIGIN) {
    process.env.VAULT_API_ORIGIN = env.VAULT_API_ORIGIN;
  }
  if (env.VITE_SUPABASE_URL && !process.env.VITE_SUPABASE_URL) {
    process.env.VITE_SUPABASE_URL = env.VITE_SUPABASE_URL;
  }
  if (env.VITE_SUPABASE_ANON_KEY && !process.env.VITE_SUPABASE_ANON_KEY) {
    process.env.VITE_SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY;
  }

  return {
    // Expose OPENAI_API_KEY to the client build (same pattern as VITE_GEMINI_API_KEY).
    envPrefix: ['VITE_', 'OPENAI_'],
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react(), connectApiDevBridge()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      // Keep Vite’s default 500 kB warning — do not raise the threshold.
      rollupOptions: {
        output: {
          /**
           * Split only stable framework cores for long-term caching.
           * Feature code stays in route-level dynamic imports.
           */
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('node_modules/react-dom')) return 'vendor-react';
            if (id.includes('node_modules/react-router')) return 'vendor-react';
            if (id.includes('node_modules/react/')) return 'vendor-react';
            if (id.includes('node_modules/scheduler')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            // Assistant SDK stays in its own async chunk via dynamic import of lib/ai.
          },
        },
      },
    },
  };
});

