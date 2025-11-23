FROM node:18

WORKDIR /app

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml .env tsconfig.json ./
COPY src ./

RUN pnpm install

EXPOSE 3000

CMD ["pnpm", "dev",]