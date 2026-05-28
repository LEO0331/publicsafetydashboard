FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 python3-pip \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY requirements.txt ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
