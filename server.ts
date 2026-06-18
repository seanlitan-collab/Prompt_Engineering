/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';

// Load environment variables
dotenv.config();

// Core and Clean Architecture dependencies
import { getGeminiClient } from './src/frameworks/gemini';
import { GeminiItineraryGateway } from './src/adapters/GeminiItineraryGateway';
import { GenerateItineraryUseCase } from './src/usecases/GenerateItineraryUseCase';
import { ItineraryController } from './src/adapters/ItineraryController';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Initialize dependencies using Clean Architecture inversion
  let controller: ItineraryController | null = null;
  try {
    const aiClient = getGeminiClient();
    const gateway = new GeminiItineraryGateway(aiClient);
    const useCase = new GenerateItineraryUseCase(gateway);
    controller = new ItineraryController(useCase);
    console.log('Clean Architecture layers initialized successfully.');
  } catch (err: any) {
    console.warn('Backend dependencies warning (GEMINI_API_KEY might be missing or set incorrectly in Secrets):', err.message);
  }

  // Middleware
  app.use(express.json());

  // Security Headers (Covers basic OWASP defenses like Clickjacking, XSS)
  app.use((req, res, next) => {
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // API Routes
  app.post('/api/itinerary/generate', async (req, res) => {
    if (!controller) {
      res.status(500).json({
        error: 'Backend is currently unconfigured. Please configure your GEMINI_API_KEY inside Settings > Secrets.',
      });
      return;
    }
    await controller.generateItinerary(req, res);
  });

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'healthy',
      geminiConfigured: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // Vite Integration (Dev Mode Middleware vs Production Static Serving)
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}

startServer().catch((error) => {
  console.error('Server failed to startup:', error);
});
