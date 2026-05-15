FROM node:lts

#ffmpg dzb
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    gcc \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./

# تثبيت المكتبات (دابا غادي يقد يجمع @discordjs/opus بلا مشاكل)
RUN npm install --production

COPY . .

CMD ["npm", "start"]
