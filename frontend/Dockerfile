FROM node:20-alpine
WORKDIR /app
COPY package.json .
RUN npm install --legacy-peer-deps
COPY . .
ENV REACT_APP_API_URL=http://localhost:8000/api/v1
CMD ["npm", "start"]
