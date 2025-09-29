FROM node:18-alpine

WORKDIR /app
COPY package.json .
COPY package-lock.json* .
RUN npm install

COPY . .

EXPOSE 3000

# Ensure node_modules/.bin is in the PATH
ENV PATH /app/node_modules/.bin:$PATH

# Copy and make the start script executable
COPY start-vite.sh /app/start-vite.sh
RUN chmod +x /app/start-vite.sh

# Run the Vite development server using our script
CMD ["/app/start-vite.sh"]