// Liga o servidor em modo de desenvolvimento (npm run dev), do mesmo jeito em Windows, Mac e Linux.

process.env.NODE_ENV = "development";
await import("./server.js");
