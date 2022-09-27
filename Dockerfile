FROM docker.io/node:18-alpine3.14

WORKDIR /app
RUN apk add --no-cache git
RUN npm i -g pnpm

COPY package.json pnpm-lock.yaml /app/
RUN pnpm i --frozen-lockfile --prod

COPY . /app

RUN git rev-parse HEAD > /commit.txt

CMD ["pnpm", "start"]
