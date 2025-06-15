# req-query-cache 📦

A lightweight, TypeScript-first package to bring Ruby on Rails–style per-request query caching (plus optional cross-request TTL caching) to Node.js. Ship it as a single module that works out of-the-box with **Express** and **NestJS**, and supports any Promise-based data source (**SQL** or **NoSQL**).

![Vitest Coverage](./badges/vitest.svg)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)


---

## Table of Contents

- [req-query-cache 📦](#req-query-cache-)
	- [Table of Contents](#table-of-contents)
	- [Introduction](#introduction)
	- [Features](#features)
	- [Installation](#installation)
	- [Quick Start](#quick-start)
		- [Basic Per-Request Caching](#basic-per-request-caching)
		- [Cross-Request (TTL) Caching](#cross-request-ttl-caching)
		- [`forceRefresh` Option](#forcerefresh-option)
		- [autoKey Generation](#autokey-generation)
	- [Express Integration](#express-integration)
	- [NestJS Integration](#nestjs-integration)
	- [API Reference](#api-reference)
		- [`runWithCache(fn: () => Promise<T>): Promise<T>`](#runwithcachefn---promiset-promiset)
			- [Example](#example)
		- [`cachedQuery(options: CachedQueryOptions<T>): Promise<T>`](#cachedqueryoptions-cachedqueryoptionst-promiset)
			- [`CachedQueryOptions<T>`](#cachedqueryoptionst)
			- [How `cachedQuery` Works (Step-by-Step)](#how-cachedquery-works-step-by-step)
		- [`closeDefaultAdapter(): void`](#closedefaultadapter-void)
			- [Example (in Vitest teardown)](#example-in-vitest-teardown)
		- [Types \& Interfaces](#types--interfaces)
			- [`PersistentStoreAdapter`](#persistentstoreadapter)
			- [`CachedQueryOptions<T>`](#cachedqueryoptionst-1)
	- [Custom Persistent-Store Adapter](#custom-persistent-store-adapter)
	- [In-Memory Store Behavior](#in-memory-store-behavior)
	- [Testing \& Teardown](#testing--teardown)
	- [Contributing](#contributing)
	- [License](#license)

---

## Introduction

Many Node.js ORMs or database drivers (Mongoose, Prisma, TypeORM, raw MongoDB/Redis clients, etc.) lack built-in, per-request query caching that automatically expires at the end of a single HTTP request—something Ruby on Rails’ ActiveRecord query cache provides by default. The `req-query-cache` package fills that gap:

- **Per-Request Cache**: Within one `runWithCache` context (e.g., one Express/NestJS request), identical `cachedQuery(...)` calls only run the database once.
- **Optional Cross-Request TTL Cache**: When you set `ttlMs > 0`, results persist in a shared, in-memory store (by default) for up to `ttlMs` milliseconds across multiple requests.
- **forceRefresh**: Bypass any cache (per-request + cross-request) on demand.
- **autoKey Generation**: Automatically derive a stable cache key by hashing function arguments (with an optional prefix), or supply your own `key`.
- **Framework Adapters**: Includes an Express middleware and a NestJS interceptor so setup is one line.
- **TypeScript-First**: Fully typed, shipped with `.d.ts` files, designed for Node 14+ (because of `AsyncLocalStorage`).

---

## Features

- **Rails-Style Per-Request Query Cache**
  Wrap any function that returns a `Promise<T>` in `cachedQuery(...)` inside one `runWithCache(...)` context, and repeated calls with the same key only hit your DB once.

- **Optional Cross-Request TTL Cache**
  Add a `ttlMs` option to cache results across requests in a module-level, in-memory store. Subsequent requests within that TTL return cached results instantly. You can also supply your own Redis (or any) adapter.

- **forceRefresh Flag**
  Pass `forceRefresh: true` to skip both per-request and TTL caches, forcing a fresh query and updating both caches.

- **autoKey Generation with Hashing**
  Let the package hash your function arguments (JSON-stringified) into a stable key (with or without a string `prefix`), so you don’t need to manually compose cache keys for each query.

- **Express Middleware**
  One-liner: `app.use(expressRequestCache())` to enable request-scoped caching across all routes.

- **NestJS Interceptor**
  Register `RequestCacheInterceptor` globally or at the controller level to automatically wrap every handler in a `runWithCache` context.

- **Custom Persistent-Store Adapter**
  By default, an in-memory `Map<string, { data, expiresAt }>` is used for TTL caching. If you need Redis (or another store), just pass an object implementing `PersistentStoreAdapter` with `get(key)`, `set(key, value, ttlMs)`, and `del(key)`.

- **Built-In `close()`**
  The in-memory store runs a cleanup `setInterval`. Call `closeDefaultAdapter()` in tests or on app shutdown to clear intervals and free resources.

- **Fully TypeScript**
  Types for every API surface, and shipped alongside compiled `.js` files. No `@types/*` needed.

---

## Installation

```bash
npm install req-query-cache
# or
yarn add req-query-cache
````

Requires Node.js 14+ (for `AsyncLocalStorage`).

---

## Quick Start

### Basic Per-Request Caching

```ts
import express from 'express';
import mongoose from 'mongoose';
import { expressRequestCache, cachedQuery } from 'req-query-cache';

const app = express();
app.use(express.json());

// 1) Mount middleware to create a cache context per request:
app.use(expressRequestCache());

// 2) Use cachedQuery inside handlers:
const User = mongoose.model('User', new mongoose.Schema({ name: String }));

app.get('/users', async (req, res) => {
  // “foo” is the manual key
  const users = await cachedQuery({
    key: 'foo',
    queryFn: () => User.find().lean(),
  });

  // Second call in the same request with key “foo” hits the in-memory ReqStore
  const again = await cachedQuery({
    key: 'foo',
    queryFn: () => User.find().lean(), // not executed again
  });

  res.json(users);
});

app.listen(3000);
```

- **Within one HTTP request**, two `cachedQuery({ key: 'foo', queryFn: … })` calls only run `User.find()` once.

---

### Cross-Request (TTL) Caching

```ts
app.get('/recent-articles', async (req, res) => {
  // QueryFn might call some SQL or NoSQL driver; runs only once per TTL window:
  const articles = await cachedQuery({
    key: 'recentArticles',
    queryFn: () => ArticleModel.find({ published: true }).limit(10).lean(),
    ttlMs: 30_000, // store result for 30 seconds across requests
  });

  res.json(articles);
});
```

1. **First Request**: `cachedQuery` runs the query, caches in both per-request and persistent store.
2. **Subsequent Requests within 30 sec**:

   - The middleware provides a fresh per-request store, but the code sees an existing value in the module-level, in-memory adapter (since `ttlMs > 0`).
   - The cached result is returned immediately, and is also inserted into this request’s per-request store for any further `cachedQuery(...)` calls.
3. **After 30 sec** (plus cleanup interval delay):

   - The adapter’s cleanup has removed the entry, so the next request re-runs `queryFn`.

---

### `forceRefresh` Option

```ts
app.get('/stats', async (req, res) => {
  // Even if we have a cached “stats” from TTL or per-request, do a fresh query:
  const stats = await cachedQuery({
    key: 'globalStats',
    queryFn: () => computeHeavyStats(),
    ttlMs: 60_000,        // TTL = 60 seconds
    forceRefresh: true,   // bypass any cached value
  });
  res.json(stats);
});
```

- `forceRefresh` = **true** means:

  1. Skip any per-request cache for `finalKey`.
  2. Skip any persistent store (TTL).
  3. Run `queryFn`, then store its result in both caches for future calls (per-request + TTL).

---

### autoKey Generation

```ts
// Suppose you want to cache “users by page number” without manually composing “users:page=2”:
app.get('/users/page/:num', async (req, res) => {
  const page = parseInt(req.params.num, 10);
  const pageSize = 20;

  const usersPage = await cachedQuery({
    autoKey: true,
    prefix: 'usersPage',
    args: [page, pageSize],
    queryFn: () =>
      User.find()
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
    ttlMs: 10_000, // 10 seconds across requests
  });

  res.json(usersPage);
});
```

- **How the key is derived**:

  - `JSON.stringify([page, pageSize])` → e.g. `"[2,20]"`.
  - SHA-256‐hash that string (using built-in `hashKey( … )`).
  - If `prefix` = `"usersPage"`, final cache key is `"usersPage:<sha256-hash>"`.
  - If `prefix` = `""`, final key is just `"<sha256-hash>"` (no leading colon).

---

## Express Integration

```ts
import express from 'express';
import { expressRequestCache, cachedQuery } from 'req-query-cache';

const app = express();
app.use(express.json());

// 1) Plug in the middleware to create a per-request AsyncLocalStorage store:
app.use(expressRequestCache());

// 2) Use cachedQuery(...) in any route handler:
app.get('/products', async (req, res) => {
  const products = await cachedQuery({
    key: 'allProducts',
    queryFn: () => productService.getAll(), // Promise-based function
    ttlMs: 60_000, // optional TTL
  });
  res.json(products);
});

app.listen(3000);
```

- **`expressRequestCache()`** must be called before any handlers that use `cachedQuery`.
- Under the hood, it does:

  ```ts
  runWithCache(async () => {
    next(); // all downstream code runs in this AsyncLocalStorage context
  });
  ```

---

## NestJS Integration

Choose either to register at the **application level** (affects all controllers) or at the **controller/provider level**.

<details>
<summary>Global (application-level) Registration</summary>

```ts
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { RequestCacheInterceptor } from 'req-query-cache';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Register interceptor globally:
  app.useGlobalInterceptors(new RequestCacheInterceptor());
  await app.listen(3000);
}
bootstrap();
```

Now every incoming request’s controller method is implicitly wrapped in a `runWithCache(...)` context. Inside any service or controller, you can call:

```ts
// some.controller.ts
import { Controller, Get } from '@nestjs/common';
import { cachedQuery } from 'req-query-cache';
import { PrismaClient } from '@prisma/client';

@Controller('users')
export class UsersController {
  private readonly prisma = new PrismaClient();

  @Get()
  async listUsers() {
    return await cachedQuery({
      key: 'allUsers',
      queryFn: () => this.prisma.user.findMany(),
      ttlMs: 30_000,
    });
  }
}
```

</details>

<details>
<summary>Controller-Level Registration</summary>

```ts
// users.module.ts
import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { RequestCacheInterceptor } from 'req-query-cache';
import { UsersController } from './users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestCacheInterceptor,
    },
  ],
})
export class UsersModule {}
```

All routes in `UsersController` benefit from per-request caching.

</details>

---

## API Reference

### `runWithCache(fn: () => Promise<T>): Promise<T>`

- **Usage**:

  - Internally called by `expressRequestCache()` and `RequestCacheInterceptor`.
  - If you need a manual “fake” context (e.g. in tests), wrap your async code in `runWithCache(() => { … })` to enable per-request caching.

- **Behavior**:

  - Creates a fresh `Map<string, any>` in a new `AsyncLocalStorage` context.
  - Any `cachedQuery(...)` inside that context uses this Map as the per-request store.
  - Returns whatever `fn()` resolves to.

#### Example

```ts
// In a unit test, to simulate a request context:
import { runWithCache, cachedQuery } from 'req-query-cache';

await runWithCache(async () => {
  const a = await cachedQuery({ key: 'x', queryFn: () => Promise.resolve(1) });
  const b = await cachedQuery({ key: 'x', queryFn: () => Promise.resolve(999) });
  console.log(a, b); // both === 1, because second call uses the per-request cache
});
```

---

### `cachedQuery(options: CachedQueryOptions<T>): Promise<T>`

**Purpose**:
Combine a per-request (Rails-style) cache with an optional cross-request TTL cache in one call.

#### `CachedQueryOptions<T>`

```ts
interface CachedQueryOptions<T> {
  /**
   * If `autoKey` is false (default), this string key is required.
   * If `autoKey` is true, this is ignored.
   */
  key?: string;

  /**
   * If true, generate cache key from `args` via SHA-256 hashing.
   * Default: false.
   */
  autoKey?: boolean;

  /**
   * A string prefix for auto-generated keys. E.g. `prefix = "users"`.
   * If omitted or empty string, final key is just the hash.
   */
  prefix?: string;

  /**
   * Used only when `autoKey = true`. Arguments to pass into `queryFn`.
   */
  args?: any[];

  /**
   * The function that actually runs your query. May take arguments (spread).
   */
  queryFn: (...args: any[]) => Promise<T>;

  /**
   * TTL (in milliseconds) for the persistent, cross-request cache.
   * If <= 0 (default), cross-request caching is disabled.
   */
  ttlMs?: number;

  /**
   * Custom persistent-store adapter. Must implement `get(key): Promise<T|null>`,
   * `set(key, value, ttlMs?): Promise<void>`, `del(key): Promise<void>`.
   * If omitted and `ttlMs > 0`, a module-level, in-memory adapter is used.
   */
  storeAdapter?: PersistentStoreAdapter;

  /**
   * If true, ignore any cached values (per-request or TTL) and run `queryFn` anew.
   * Default: false.
   */
  forceRefresh?: boolean;
}
```

#### How `cachedQuery` Works (Step-by-Step)

1. **Key Determination**

   - If `autoKey = true`:

     - Compute `raw = JSON.stringify(args || [])`.
     - Compute `hashed = hashKey(raw)`, where `hashKey()` returns a 64-char lowercase SHA-256 hex string.
     - If `prefix` is non-empty: `finalKey =`\${prefix}:\${hashed}\`\`; otherwise `finalKey = hashed`.
   - Else (`autoKey = false`):

     - Require `options.key`; if missing, throw `Error('`key`is required when`autoKey`is false.')`.

2. **Per-Request Cache Check**

   - `const reqStore = requestStore.getStore()`.
   - If `reqStore` exists and `forceRefresh = false` and `reqStore.has(finalKey)`:

     - Return `reqStore.get(finalKey)` immediately.

3. **Cross-Request (TTL) Cache Check**

   - If `ttlMs > 0`:

     - Determine `persistentAdapter = storeAdapter || getDefaultAdapter()`.
     - If `forceRefresh = false`:

       - `const cached = await persistentAdapter.get(finalKey)`.
       - If `cached !== null`:

         - If `reqStore` exists: `reqStore.set(finalKey, cached)`.
         - Return `cached`.

4. **Run the Query**

   - `const result = await queryFn(...(args || []))`.

5. **Store in Per-Request**

   - If `reqStore` exists: `reqStore.set(finalKey, result)`.

6. **Store in Persistent Store**

   - If `persistentAdapter` exists (i.e. `ttlMs > 0`): `await persistentAdapter.set(finalKey, result, ttlMs)`.

7. **Return `result`**.

---

### `closeDefaultAdapter(): void`

- **Purpose**:

  - The default in-memory `PersistentStoreAdapter` runs a `setInterval` to clean up expired entries every minute.
  - Call `closeDefaultAdapter()` to clear that interval and drop the singleton reference. Useful in tests or when your application is shutting down and you want to free resources.

#### Example (in Vitest teardown)

```ts
import { afterAll } from 'vitest';
import { closeDefaultAdapter } from '../src/core';

afterAll(() => {
  closeDefaultAdapter();
});
```

---

### Types & Interfaces

#### `PersistentStoreAdapter`

```ts
export interface PersistentStoreAdapter {
  /** Return stored value or null if none/expired. */
  get<T>(key: string): Promise<T | null>;

  /** Set `value` under `key` with optional TTL in ms (0 = no expiration). */
  set<T>(key: string, value: T, ttlMs?: number): Promise<void>;

  /** Delete any stored entry for `key`. */
  del(key: string): Promise<void>;
}
```

#### `CachedQueryOptions<T>`

(See above in [API Reference](#cachedqueryoptions).)

---

## Custom Persistent-Store Adapter

If you need to store TTL‐cached results in Redis, Memcached, or another process, simply implement the `PersistentStoreAdapter` interface and pass it to `cachedQuery`.

```ts
import { createClient } from 'redis';
import type { PersistentStoreAdapter } from 'req-query-cache';

class RedisAdapter implements PersistentStoreAdapter {
  constructor(private client: ReturnType<typeof createClient>) {}

  async get<T>(key: string): Promise<T | null> {
    const raw = await this.client.get(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const serialized = JSON.stringify(value);
    if (ttlMs && ttlMs > 0) {
      await this.client.set(key, serialized, { PX: ttlMs });
    } else {
      await this.client.set(key, serialized);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }
}

// Usage in an Express handler:
app.get('/orders', async (req, res) => {
  const orders = await cachedQuery({
    key: 'recentOrders',
    queryFn: () => orderRepo.findRecent(),
    ttlMs: 60_000,
    storeAdapter: new RedisAdapter(redisClient),
  });
  res.json(orders);
});
```

---

## In-Memory Store Behavior

- The default adapter is a module‐level singleton (so all `cachedQuery({ ttlMs > 0 })` calls share the same store across requests).
- Internally, it tracks entries as `{ data: T; expiresAt: number }`.
- A cleanup loop (every minute) removes expired entries.
- When you call `get(key)`, if the entry exists but `expiresAt <= Date.now()`, that entry is deleted and `get` returns `null`.

**Note**: Because it’s a singleton, **every** `cachedQuery({ ttlMs > 0 })` that does *not* provide a `storeAdapter` will use this same adapter instance. If you want Redis or a custom store, pass your own.

---

## Testing & Teardown

If you write Vitest/Jest unit tests that rely on TTL behavior, you should call `closeDefaultAdapter()` in your test teardown so the in-memory cleanup interval is cleared. For example:

```ts
// tests/core.ttl.test.ts
import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { runWithCache, cachedQuery, closeDefaultAdapter } from '../src/core';

describe('core: TTL behavior', () => {
  // ... your tests for ttlMs, forceRefresh, etc. …

  afterAll(() => {
    // Clear the interval to avoid “open handles” in test runner
    closeDefaultAdapter();
  });
});
```

Without calling `closeDefaultAdapter()`, Vitest may warn about open timers.

---

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Install dependencies: `npm install`
4. Build: `npm run build`
5. Run tests: `npm test`
6. Commit your changes & open a Pull Request

Please follow the existing style, write TypeScript, and add tests for any new behavior.

---

## License

MIT ©

Enjoy effortless per-request and TTL caching in Node.js! 🚀
