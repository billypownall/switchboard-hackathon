FROM mcr.microsoft.com/playwright:v1.57.0-noble

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL=file:/data/dev.db
ENV QUICKCART_BASE_URL=http://localhost:3000

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

CMD ["npm", "run", "start"]
