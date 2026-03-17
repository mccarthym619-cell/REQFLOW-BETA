import { Response } from 'express';
import { logger } from '../config/logger';

const MAX_CONNECTIONS_PER_USER = 5;
const HEARTBEAT_INTERVAL_MS = 30_000;

class SSEService {
  private connections: Map<number, Response[]> = new Map();
  private heartbeats: Map<Response, NodeJS.Timeout> = new Map();

  addConnection(userId: number, res: Response): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    if (!this.connections.has(userId)) {
      this.connections.set(userId, []);
    }
    const conns = this.connections.get(userId)!;
    conns.push(res);

    // Evict oldest connections if over limit
    while (conns.length > MAX_CONNECTIONS_PER_USER) {
      const oldest = conns.shift()!;
      this.cleanupConnection(oldest);
      oldest.end();
      logger.debug({ userId }, 'SSE connection evicted (max limit reached)');
    }

    // Start heartbeat to keep connection alive through proxies
    const interval = setInterval(() => {
      try {
        res.write(':heartbeat\n\n');
      } catch {
        this.removeConnection(userId, res);
      }
    }, HEARTBEAT_INTERVAL_MS);
    this.heartbeats.set(res, interval);

    res.on('close', () => {
      this.removeConnection(userId, res);
    });
  }

  pushToUser(userId: number, event: string, data: unknown): void {
    const conns = this.connections.get(userId) || [];
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    const failed: Response[] = [];
    for (const res of conns) {
      try {
        res.write(payload);
      } catch {
        failed.push(res);
      }
    }
    for (const res of failed) {
      this.removeConnection(userId, res);
    }
  }

  private removeConnection(userId: number, res: Response): void {
    this.cleanupConnection(res);
    const conns = this.connections.get(userId);
    if (conns) {
      this.connections.set(userId, conns.filter(c => c !== res));
      if (this.connections.get(userId)!.length === 0) {
        this.connections.delete(userId);
      }
    }
  }

  private cleanupConnection(res: Response): void {
    const interval = this.heartbeats.get(res);
    if (interval) {
      clearInterval(interval);
      this.heartbeats.delete(res);
    }
  }
}

export const sseService = new SSEService();
