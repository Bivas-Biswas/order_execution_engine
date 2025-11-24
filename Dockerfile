FROM node:18

WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml ./

RUN pnpm install

COPY tsconfig.json ./

COPY .env ./

COPY src ./

EXPOSE 3000

CMD ["pnpm", "dev",]