FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/dev.db
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# NODE_ENV is intentionally NOT set to production yet: npm ci must install
# devDependencies (tailwindcss, @tailwindcss/postcss, postcss) so `next build`
# can process globals.css.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Switch to production only for the runtime stage.
ENV NODE_ENV=production

EXPOSE 3000

CMD ["npm", "run", "start:prod"]
