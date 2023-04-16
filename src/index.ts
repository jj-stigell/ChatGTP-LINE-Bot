// Modules
import { middleware, WebhookEvent } from '@line/bot-sdk';
import express, { Application, NextFunction, Request, Response } from 'express';

// Project imports
import { lineMiddlewareConfig } from './configs/configuration';
import { connectToDatabase } from './database';
import { PORT } from './configs/environment';
import { populateCache } from './util/cache';
import loggerMiddleware from './middleware/loggerMiddleware';
import { test, testHash } from './controllers';
import logger from './configs/winston';
import { handleEvent } from './util/eventHandlers';

export const app: Application = express();

app.use(express.urlencoded({ extended: true }));
app.use(loggerMiddleware);

// Health check endpoint.
app.get('/health', (_req: Request, res: Response, next: NextFunction) => {
  res.status(200).send();
  next();
});

// DELETE before release.
app.get('/test/:conversationId', test);
app.get('/test/hash/:message', testHash);

// Handle LINE webhook calls.
app.post(
  '/webhook',
  middleware(lineMiddlewareConfig),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!Array.isArray(req.body.events)) {
      res.status(500).end();
      next();
    }
    const events: Array<WebhookEvent> = req.body.events;
    logger.info(`${events.length} new LINE events: ${events}`);

    // Process all of the received events asynchronously.
    Promise.all(events.map(handleEvent))
      .then(() => {
        logger.info('All events processed succesfully!');
        res.status(200).send();
      })
      .catch((err: unknown) => {
        if (err instanceof Error) {
          logger.error(err.message);
        } else {
          logger.error(err);
        }
        res.status(500).end();
      });
    next();
  }
);

app.listen(PORT, async function () {
  populateCache();
  connectToDatabase();
  logger.info(`LINE bot started on PORT: ${PORT} 🤖`);
});
