import mongoose from "mongoose";

const {
  NODE_ENV = "development",
  MONGO_URI,
  MONGO_HOST = "127.0.0.1",
  MONGO_PORT = "27017",
  MONGO_USERNAME,
  MONGO_PASSWORD,
  MONGO_DB_NAME = "smartwork_dev", 
  MONGO_REPLICA_SET,
  MONGO_AUTH_DB = "admin",
  MONGO_MAX_POOL_SIZE = "20",
  MONGO_MIN_POOL_SIZE = "0",
  MONGO_CONNECT_TIMEOUT_MS = "20000",
  MONGO_SOCKET_TIMEOUT_MS = "45000",
  MONGO_RETRY_WRITES = "true",
  MONGO_TLS = "false",
  MONGO_DEBUG = "false",
} = process.env;

function buildMongoUri() {
  if (MONGO_URI) return MONGO_URI;

  const creds =
    MONGO_USERNAME && MONGO_PASSWORD
      ? `${encodeURIComponent(MONGO_USERNAME)}:${encodeURIComponent(
          MONGO_PASSWORD
        )}@`
      : "";

  const params = new URLSearchParams();
  if (MONGO_REPLICA_SET) {
    params.set("replicaSet", MONGO_REPLICA_SET);
  }
  if (MONGO_AUTH_DB) params.set("authSource", MONGO_AUTH_DB);
  if (MONGO_RETRY_WRITES) params.set("retryWrites", MONGO_RETRY_WRITES);
  if (MONGO_TLS === "true") params.set("tls", "true");

  const qs = params.toString();
  const suffix = qs ? `?${qs}` : '';

  return `mongodb://${creds}${MONGO_HOST}:${MONGO_PORT}/${MONGO_DB_NAME}${suffix}`;
}

function mongooseOptions() {
  return {
    dbName: (!MONGO_URI ? MONGO_DB_NAME : undefined),
    maxPoolSize: Number(MONGO_MAX_POOL_SIZE),
    minPoolSize: Number(MONGO_MIN_POOL_SIZE),
    connectTimeoutMS: Number(MONGO_CONNECT_TIMEOUT_MS),
    socketTimeoutMS: Number(MONGO_SOCKET_TIMEOUT_MS),
    retryWrites: MONGO_RETRY_WRITES === 'true',
    tls: MONGO_TLS === 'true',
    autoIndex: NODE_ENV !== 'production', 
  };
}

let isConnecting = false;

/**
 * Kết nối Mongo (idempotent).
 * @param {object} opts - { uri?, options? }
 */

export async function connectMongo(opts = {}) {
    if (mongoose.connection.readyState === 1) return mongoose.connection; 
    if (isConnecting) return await waitForMongo(15000);

    const uri = opts.uri || buildMongoUri();
    const options = {...mongooseOptions(), ...(opts.options || {})};

    mongoose.set('strictQuery', true);
    mongoose.set('debug', MONGO_DEBUG == 'true');

    bindConnectionEvents();

    const maxAttempts = 5;
  let attempt = 0;
  isConnecting = true;

  try {
    while (attempt < maxAttempts) {
      try {
        attempt += 1;
        await mongoose.connect(uri, options);
        return mongoose.connection;
      } catch (err) {
        const delay = Math.min(1000 * 2 ** (attempt - 1), 10000);
        if (attempt >= maxAttempts) throw err;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  } finally {
    isConnecting = false;
  }
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function mongoState() {
  const map = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return map[mongoose.connection.readyState] || 'unknown';
}

export function mongoHealth() {
  const state = mongoState();
  return {
    ok: state === 'connected',
    state,
    host: mongoose.connection.host,
    db: mongoose.connection.name,
  };
}

/**
 * Chờ có kết nối sẵn (dùng khi nhiều nơi gọi connect đồng thời).
 * @param {number} timeoutMs
 */
export async function waitForMongo(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (mongoose.connection.readyState === 1) return mongoose.connection;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('Timeout waiting for Mongo connection');
}

/**
 * Chạy 1 hàm trong transaction (ReplicaSet / Mongo Atlas yêu cầu).
 * @param {(session: mongoose.ClientSession) => Promise<any>} fn
 * @param {object} txOpts - { readPreference?, readConcern?, writeConcern? }
 */
export async function withTransaction(fn, txOpts = {}) {
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      result = await fn(session);
    }, txOpts);
    return result;
  } finally {
    await session.endSession();
  }
}

/**
 * Đồng bộ index theo model (khuyên dùng: gọi lúc deploy hoặc script riêng).
 * @param {Array<mongoose.Model>} models
 * @param {boolean} dropBeforeSync - WARNING: dropIndexes (chỉ dùng khi kiểm soát downtime)
 */
export async function syncIndexes(models = [], dropBeforeSync = false) {
  for (const m of models) {
    if (dropBeforeSync) {
      await m.collection.dropIndexes().catch((e) => {
        if (!/ns not found|index not found/.test(String(e))) throw e;
      });
    }
    await m.syncIndexes();
  }
}

export function installMongoShutdownHooks(logger = console) {
  const graceful = async (signal) => {
    try {
      logger.info?.(`[mongo] Received ${signal}, closing Mongo connection…`);
      await disconnectMongo();
      logger.info?.('[mongo] Mongo disconnected');
    } catch (e) {
      logger.error?.('[mongo] Error during disconnect', e);
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGINT', graceful);
  process.on('SIGTERM', graceful);
}

function bindConnectionEvents() {
  const c = mongoose.connection;
  if (c.__eventsBound) return; 
  c.__eventsBound = true;

  c.on('connected', () => {
    console.log(`[mongo] connected: ${c.host}/${c.name}`);
  });
  c.on('error', (err) => {
    console.error('[mongo] error:', err?.message || err);
  });
  c.on('disconnected', () => {
    console.warn('[mongo] disconnected');
  });
}