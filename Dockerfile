FROM node:22-alpine

# Install FFmpeg, Python3, curl, and CA certificates
RUN apk add --no-cache \
    ffmpeg \
    python3 \
    curl \
    ca-certificates

# Install the latest standalone yt-dlp binary
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && yt-dlp --version

WORKDIR /app

# Install Node.js dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY src ./src

# Create downloads directory
RUN mkdir -p downloads

ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "src/index.js"]
