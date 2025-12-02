// import { loadEnv, defineConfig, Modules} from '@medusajs/framework/utils'

// loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// module.exports = defineConfig({
//   projectConfig: {
//     databaseUrl: process.env.DATABASE_URL,
//     http: {
//       storeCors: process.env.STORE_CORS!,
//       adminCors: process.env.ADMIN_CORS!,
//       authCors: process.env.AUTH_CORS!,
//       jwtSecret: process.env.JWT_SECRET || "supersecret",
//       cookieSecret: process.env.COOKIE_SECRET || "supersecret",
//     },
//     workerMode: process.env.MEDUSA_WORKER_MODE as 
//       | "shared" 
//       | "worker" 
//       | "server",
//     redisUrl : process.env.REDIS_URL,
//   },
//   modules: {
//     [Modules.CACHE]: {
//       resolve: "@medusajs/cache-redis",
//       options: { 
//         redisUrl: process.env.REDIS_URL,
//       },
//     },
//     [Modules.EVENT_BUS]: {
//       resolve: "@medusajs/event-bus-redis",
//       options: { 
//         redisUrl: process.env.REDIS_URL,
//       },
//     },
//     [Modules.WORKFLOW_ENGINE]: {
//       resolve: "@medusajs/medusa/workflow-engine-redis",
//       options: {
//         redis: {
//           url: process.env.REDIS_URL,
//         },
//       },
//     },
//   },
  
//   // modules: [
//   //   {
//   //     resolve: "@medusajs/cache-redis", 
//   //     options: { 
//   //       redisUrl: process.env.REDIS_URL,
//   //     },
//   //   },
//   //   {
//   //     resolve: "@medusajs/event-bus-redis", 
//   //     options: { 
//   //       redisUrl: process.env.REDIS_URL,
//   //     },
//   //   },
//   //    {
//   //     resolve: "@medusajs/medusa/workflow-engine-redis",
//   //     options: {
//   //       redis: {
//   //         url: process.env.REDIS_URL,
//   //       },
//   //     },
//   //    },
//   // ],
//   admin: {
//     disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
//     backendUrl: process.env.MEDUSA_BACKEND_URL,
//   },
// })

import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

module.exports = defineConfig({
  projectConfig: {
    // 1. Database Connection (camelCase)
    databaseUrl: process.env.DATABASE_URL,
    
    // 2. Redis (Required for Cache/Events in Prod)
    redisUrl: process.env.REDIS_URL,

    // 3. Worker Mode (shared, worker, or server)
    workerMode: process.env.MEDUSA_WORKER_MODE as "shared" | "worker" | "server",

    // 4. HTTP Settings (CORS & Auth - THE FIX FOR 401s)
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  
  // 5. Admin Dashboard Configuration
  admin: {
    disable: process.env.DISABLE_MEDUSA_ADMIN === "true",
    backendUrl: process.env.MEDUSA_BACKEND_URL,
  },

  // 6. Modules (Now an Array)
  modules: [
    {
      resolve: "@medusajs/medusa/cache-redis",
      options: { 
        redisUrl: process.env.REDIS_URL 
      },
    },
    {
      resolve: "@medusajs/medusa/event-bus-redis",
      options: { 
        redisUrl: process.env.REDIS_URL 
      },
    },
    {
      resolve: "@medusajs/medusa/workflow-engine-redis",
      options: {
        redis: {
          url: process.env.REDIS_URL,
        },
      },
    },
  ],
})